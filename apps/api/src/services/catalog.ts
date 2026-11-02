import type {
  Category,
  Paginated,
  ProductDetail,
  ProductImage,
  ProductListQuery,
  ProductSummary,
} from "@novap/shared";
import { and, asc, count, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/client";
import { categories, productImages, products, variants } from "../db/schema";
import { imageUrl } from "../lib/images";
import { pageOffset, paginated } from "../lib/pagination";
import { containsText } from "../lib/sql";

// Public catalogue reads. Only active products with at least one active
// variant are visible: a product without a buyable variant can't be sold.

// ---------------------------------------------------------------- categories

// Categories with the number of visible products in each.
const selectCategories = (db: Db, where?: SQL) =>
  db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      // variants.productId is only non-null when both joins matched, i.e. the product is visible.
      productCount: sql<number>`count(distinct ${variants.productId})`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.active, true)))
    .leftJoin(variants, and(eq(variants.productId, products.id), eq(variants.active, true)))
    .where(where)
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

export function listCategories(db: Db): Promise<Category[]> {
  return selectCategories(db);
}

export async function getCategoryBySlug(db: Db, slug: string): Promise<Category | undefined> {
  const [category] = await selectCategories(db, eq(categories.slug, slug));
  return category;
}

// ---------------------------------------------------------------- products

export async function listProducts(db: Db, query: ProductListQuery): Promise<Paginated<ProductSummary>> {
  const { q, category, minPrice, maxPrice, inStock, featured, sort, page, limit } = query;

  // Per-product aggregates over its active variants.
  const priceFrom = sql<number>`min(${variants.priceCents})`;
  const anyInStock = sql<number>`max(${variants.stock} > 0)`;
  const anyOnSale = sql<number>`max(coalesce(${variants.compareAtCents} > ${variants.priceCents}, 0))`;

  const where: SQL[] = [eq(products.active, true)];
  if (category) where.push(eq(categories.slug, category));
  if (featured !== undefined) where.push(eq(products.featured, featured));
  if (q) {
    where.push(
      or(containsText(products.name, q), containsText(products.subtitle, q), containsText(products.description, q))!,
    );
  }

  // Filters on aggregates go in HAVING, after grouping by product.
  const having: SQL[] = [];
  if (minPrice !== undefined) having.push(gte(priceFrom, minPrice));
  if (maxPrice !== undefined) having.push(lte(priceFrom, maxPrice));
  if (inStock !== undefined) having.push(sql`${anyInStock} = ${inStock ? 1 : 0}`);

  // One row per visible product. Used for both the page of results and the total count.
  const base = db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      subtitle: products.subtitle,
      featured: products.featured,
      createdAt: products.createdAt,
      // Aliased: categories also has id/slug/name, and duplicate column names
      // in a subquery make the outer select read the wrong values.
      categoryId: sql<number | null>`${categories.id}`.as("category_id"),
      categorySlug: sql<string | null>`${categories.slug}`.as("category_slug"),
      categoryName: sql<string | null>`${categories.name}`.as("category_name"),
      priceFromCents: priceFrom.as("price_from_cents"),
      inStock: anyInStock.as("in_stock"),
      onSale: anyOnSale.as("on_sale"),
    })
    .from(products)
    .innerJoin(variants, and(eq(variants.productId, products.id), eq(variants.active, true)))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...where))
    .groupBy(products.id)
    .having(having.length ? and(...having) : undefined)
    .as("base");

  // id as the last key keeps the order stable, so pages never overlap or skip items.
  const orderBy = {
    newest: [desc(base.createdAt), desc(base.id)],
    price_asc: [asc(base.priceFromCents), asc(base.id)],
    price_desc: [desc(base.priceFromCents), asc(base.id)],
    name: [asc(sql`${base.name} COLLATE NOCASE`), asc(base.id)],
  }[sort];

  // batch = one round trip to D1 for both queries.
  const [rows, [counted]] = await db.batch([
    db.select().from(base).orderBy(...orderBy).limit(limit).offset(pageOffset(page, limit)),
    db.select({ total: count() }).from(base),
  ]);

  const firstImages = await firstImageByProduct(
    db,
    rows.map((r) => r.id),
  );

  const items = rows.map(
    (r): ProductSummary => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      subtitle: r.subtitle,
      featured: r.featured,
      category: r.categoryId !== null ? { id: r.categoryId, slug: r.categorySlug!, name: r.categoryName! } : null,
      priceFromCents: Number(r.priceFromCents),
      onSale: Number(r.onSale) === 1,
      inStock: Number(r.inStock) === 1,
      image: firstImages.get(r.id) ?? null,
    }),
  );

  return paginated(items, counted?.total ?? 0, page, limit);
}

async function firstImageByProduct(db: Db, productIds: number[]): Promise<Map<number, ProductImage>> {
  const result = new Map<number, ProductImage>();
  if (productIds.length === 0) return result;

  const rows = await db
    .select({ productId: productImages.productId, r2Key: productImages.r2Key, alt: productImages.alt })
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(asc(productImages.productId), asc(productImages.sortOrder), asc(productImages.id));

  for (const row of rows) {
    if (!result.has(row.productId)) result.set(row.productId, { url: imageUrl(row.r2Key), alt: row.alt });
  }
  return result;
}

export async function getProductBySlug(db: Db, slug: string): Promise<ProductDetail | undefined> {
  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: {
      category: true,
      variants: {
        where: eq(variants.active, true),
        orderBy: [asc(variants.sortOrder), asc(variants.id)],
      },
      images: { orderBy: [asc(productImages.sortOrder), asc(productImages.id)] },
    },
  });
  if (!product || product.variants.length === 0) return undefined;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle,
    description: product.description,
    featured: product.featured,
    category: product.category
      ? { id: product.category.id, slug: product.category.slug, name: product.category.name }
      : null,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      priceCents: v.priceCents,
      compareAtCents: v.compareAtCents,
      inStock: v.stock > 0,
      attributes: v.attributes ?? null,
    })),
    images: product.images.map((i) => ({ url: imageUrl(i.r2Key), alt: i.alt })),
  };
}
