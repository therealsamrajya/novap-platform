import type {
  AdminCategory,
  AdminProductDetail,
  AdminProductListQuery,
  AdminProductSummary,
  AdminVariant,
  CategoryCreateInput,
  CategoryUpdateInput,
  Paginated,
  ProductCreateInput,
  ProductUpdateInput,
  VariantCreateInput,
  VariantUpdateInput,
} from "@novap/shared";
import { slugify } from "@novap/shared";
import { and, asc, count, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Db } from "../db/client";
import { categories, productImages, products, variants } from "../db/schema";
import { imageUrl } from "../lib/images";
import { pageOffset, paginated } from "../lib/pagination";
import { containsText, isUniqueViolation } from "../lib/sql";
import { firstImageByProduct } from "./catalog";

// Admin catalogue writes and reads. Admin sees everything, including inactive
// products/variants. Functions return undefined when the target id doesn't exist;
// the route turns that into a 404.

// Runs a write and turns a UNIQUE violation into a 409 with a readable message.
// Catching the error (instead of checking first) means two admins saving the
// same slug at once can't both succeed.
async function conflictOnUnique<T>(write: PromiseLike<T>, message: string): Promise<T> {
  try {
    return await write;
  } catch (err) {
    if (isUniqueViolation(err)) throw new HTTPException(409, { message });
    throw err;
  }
}

// The slug sent, or one made from the name. A taken slug is a 409, never a silent
// "-2" suffix: a second product with the same name is usually a mistake.
function slugFor(input: { slug?: string; name: string }): string {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw new HTTPException(400, { message: "Can't make a slug from this name; send a slug" });
  return slug;
}

// Names the slug, since the admin may not have typed it (generated from the name).
const slugTaken = (thing: "category" | "product", slug: string | undefined) =>
  slug ? `A ${thing} with the slug "${slug}" already exists` : `A ${thing} with this slug already exists`;

// A bad categoryId would otherwise fail the foreign key and surface as a 500.
async function assertCategoryExists(db: Db, categoryId: number | null | undefined) {
  if (categoryId == null) return;
  const found = await db.query.categories.findFirst({ columns: { id: true }, where: eq(categories.id, categoryId) });
  if (!found) throw new HTTPException(400, { message: "Category does not exist" });
}

// ---------------------------------------------------------------- categories

const selectAdminCategories = (db: Db, where?: SQL) =>
  db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
      productCount: sql<number>`count(${products.id})`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(where)
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name), asc(categories.id));

type AdminCategoryRow = Awaited<ReturnType<typeof selectAdminCategories>>[number];

const toAdminCategory = (row: AdminCategoryRow): AdminCategory => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

export async function listAdminCategories(db: Db): Promise<AdminCategory[]> {
  return (await selectAdminCategories(db)).map(toAdminCategory);
}

export async function getAdminCategory(db: Db, id: number): Promise<AdminCategory | undefined> {
  const [row] = await selectAdminCategories(db, eq(categories.id, id));
  return row && toAdminCategory(row);
}

export async function createCategory(db: Db, input: CategoryCreateInput): Promise<AdminCategory> {
  const slug = slugFor(input);
  const [row] = await conflictOnUnique(
    db.insert(categories).values({ ...input, slug }).returning(),
    slugTaken("category", slug),
  );
  return toAdminCategory({ ...row!, productCount: 0 });
}

// Renaming never changes the slug: the shop URL stays the same unless a new slug is sent.
export async function updateCategory(db: Db, id: number, input: CategoryUpdateInput): Promise<AdminCategory | undefined> {
  const [row] = await conflictOnUnique(
    db.update(categories).set(input).where(eq(categories.id, id)).returning({ id: categories.id }),
    slugTaken("category", input.slug),
  );
  return row && getAdminCategory(db, row.id);
}

// Products in the category are kept, with categoryId set to null (foreign key rule).
export async function deleteCategory(db: Db, id: number): Promise<boolean> {
  const deleted = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------- variants

type VariantRow = typeof variants.$inferSelect;

const toAdminVariant = (v: VariantRow): AdminVariant => ({
  id: v.id,
  productId: v.productId,
  sku: v.sku,
  label: v.label,
  priceCents: v.priceCents,
  compareAtCents: v.compareAtCents,
  stock: v.stock,
  attributes: v.attributes ?? null,
  active: v.active,
  sortOrder: v.sortOrder,
  createdAt: v.createdAt.toISOString(),
  updatedAt: v.updatedAt.toISOString(),
});

const skuTaken = "A variant with this SKU already exists";

export async function createVariant(db: Db, productId: number, input: VariantCreateInput): Promise<AdminVariant | undefined> {
  const product = await db.query.products.findFirst({ columns: { id: true }, where: eq(products.id, productId) });
  if (!product) return undefined;
  const [row] = await conflictOnUnique(db.insert(variants).values({ ...input, productId }).returning(), skuTaken);
  return toAdminVariant(row!);
}

export async function updateVariant(db: Db, id: number, input: VariantUpdateInput): Promise<AdminVariant | undefined> {
  const [row] = await conflictOnUnique(db.update(variants).set(input).where(eq(variants.id, id)).returning(), skuTaken);
  return row && toAdminVariant(row);
}

// Past orders keep their copy of name, SKU and price (order_items snapshot), so deleting is safe.
export async function deleteVariant(db: Db, id: number): Promise<boolean> {
  const deleted = await db.delete(variants).where(eq(variants.id, id)).returning({ id: variants.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------- products

export async function listAdminProducts(db: Db, query: AdminProductListQuery): Promise<Paginated<AdminProductSummary>> {
  const { q, categoryId, active, page, limit } = query;

  const where: SQL[] = [];
  if (q) where.push(or(containsText(products.name, q), containsText(products.slug, q))!);
  if (categoryId !== undefined) where.push(eq(products.categoryId, categoryId));
  if (active !== undefined) where.push(eq(products.active, active));
  const filter = where.length ? and(...where) : undefined;

  // Filters only touch products columns, so the count needs no joins.
  const [rows, [counted]] = await db.batch([
    db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        active: products.active,
        featured: products.featured,
        updatedAt: products.updatedAt,
        // Aliased: products also has id/slug/name, and D1 merges result columns
        // that share a name, which shifts every later value into the wrong field.
        categoryId: sql<number | null>`${categories.id}`.as("category_id"),
        categorySlug: sql<string | null>`${categories.slug}`.as("category_slug"),
        categoryName: sql<string | null>`${categories.name}`.as("category_name"),
        variantCount: sql<number>`count(${variants.id})`.mapWith(Number),
        activeVariantCount: sql<number>`coalesce(sum(${variants.active}), 0)`.mapWith(Number),
        totalStock: sql<number>`coalesce(sum(${variants.stock}), 0)`.mapWith(Number),
        priceFromCents: sql<number | null>`min(case when ${variants.active} then ${variants.priceCents} end)`,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(variants, eq(variants.productId, products.id))
      .where(filter)
      .groupBy(products.id)
      .orderBy(desc(products.updatedAt), desc(products.id))
      .limit(limit)
      .offset(pageOffset(page, limit)),
    db.select({ total: count() }).from(products).where(filter),
  ]);

  const firstImages = await firstImageByProduct(
    db,
    rows.map((r) => r.id),
  );

  const items = rows.map(
    (r): AdminProductSummary => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      active: r.active,
      featured: r.featured,
      visible: r.active && r.activeVariantCount > 0,
      category: r.categoryId !== null ? { id: r.categoryId, slug: r.categorySlug!, name: r.categoryName! } : null,
      variantCount: r.variantCount,
      totalStock: r.totalStock,
      priceFromCents: r.priceFromCents === null ? null : Number(r.priceFromCents),
      image: firstImages.get(r.id) ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }),
  );

  return paginated(items, counted?.total ?? 0, page, limit);
}

export async function getAdminProduct(db: Db, id: number): Promise<AdminProductDetail | undefined> {
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      category: true,
      variants: { orderBy: [asc(variants.sortOrder), asc(variants.id)] },
      images: { orderBy: [asc(productImages.sortOrder), asc(productImages.id)] },
    },
  });
  if (!product) return undefined;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle,
    description: product.description,
    category: product.category
      ? { id: product.category.id, slug: product.category.slug, name: product.category.name }
      : null,
    active: product.active,
    featured: product.featured,
    visible: product.active && product.variants.some((v) => v.active),
    variants: product.variants.map(toAdminVariant),
    images: product.images.map((i) => ({
      id: i.id,
      url: imageUrl(i.r2Key),
      alt: i.alt,
      variantId: i.variantId,
      sortOrder: i.sortOrder,
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export async function createProduct(db: Db, input: ProductCreateInput): Promise<AdminProductDetail> {
  const slug = slugFor(input);
  await assertCategoryExists(db, input.categoryId);
  const [row] = await conflictOnUnique(
    db.insert(products).values({ ...input, slug }).returning({ id: products.id }),
    slugTaken("product", slug),
  );
  return (await getAdminProduct(db, row!.id))!;
}

// Renaming never changes the slug: the shop URL stays the same unless a new slug is sent.
export async function updateProduct(db: Db, id: number, input: ProductUpdateInput): Promise<AdminProductDetail | undefined> {
  await assertCategoryExists(db, input.categoryId);
  const [row] = await conflictOnUnique(
    db.update(products).set(input).where(eq(products.id, id)).returning({ id: products.id }),
    slugTaken("product", input.slug),
  );
  return row && getAdminProduct(db, row.id);
}

// Variants and image rows go with the product (ON DELETE CASCADE). The image
// files in R2 don't, so they are deleted here too.
export async function deleteProduct(db: Db, bucket: R2Bucket, id: number): Promise<boolean> {
  const images = await db
    .select({ r2Key: productImages.r2Key })
    .from(productImages)
    .where(eq(productImages.productId, id));
  const deleted = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  if (deleted.length === 0) return false;

  // After the DB delete: if R2 fails, the worst case is unused files, never a product pointing at missing images.
  if (images.length) {
    try {
      await bucket.delete(images.map((i) => i.r2Key));
    } catch (err) {
      console.error("Failed to delete product images from R2", err);
    }
  }
  return true;
}
