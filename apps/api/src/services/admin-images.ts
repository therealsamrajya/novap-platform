import {
  IMAGES_PER_PRODUCT_MAX,
  type AdminProductImage,
  type ImageUpdateInput,
  type ImageUploadInput,
} from "@novap/shared";
import { count, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Db } from "../db/client";
import { productImages, products } from "../db/schema";
import { imageUrl, sniffImageType } from "../lib/images";

// Product images: the file lives in R2, the row in product_images holds its key,
// alt text and display order. Functions return undefined when the id doesn't exist.

type ImageRow = typeof productImages.$inferSelect;

const toAdminImage = (row: ImageRow): AdminProductImage => ({
  id: row.id,
  url: imageUrl(row.r2Key),
  alt: row.alt,
  sortOrder: row.sortOrder,
});

export async function uploadProductImage(
  db: Db,
  bucket: R2Bucket,
  productId: number,
  input: ImageUploadInput,
): Promise<AdminProductImage | undefined> {
  const product = await db.query.products.findFirst({ columns: { id: true }, where: eq(products.id, productId) });
  if (!product) return undefined;

  const [stats] = await db
    .select({ total: count(), maxSort: sql<number | null>`max(${productImages.sortOrder})` })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  if ((stats?.total ?? 0) >= IMAGES_PER_PRODUCT_MAX) {
    throw new HTTPException(409, { message: `A product can have at most ${IMAGES_PER_PRODUCT_MAX} images` });
  }

  // Zod types the file as just { type, size }; at runtime it is the Workers File (a Blob).
  const bytes = new Uint8Array(await (input.file as unknown as Blob).arrayBuffer());
  const sniffed = sniffImageType(bytes.subarray(0, 16));
  if (!sniffed) throw new HTTPException(400, { message: "Use a JPEG, PNG, WebP or AVIF image" });

  // A fresh key per upload: images are served with a 1-year "immutable" cache,
  // so a key must never point at different bytes later.
  const r2Key = `products/${productId}/${crypto.randomUUID()}.${sniffed.ext}`;
  await bucket.put(r2Key, bytes, { httpMetadata: { contentType: sniffed.type } });

  try {
    const [row] = await db
      .insert(productImages)
      .values({ productId, r2Key, alt: input.alt, sortOrder: (stats?.maxSort ?? -1) + 1 })
      .returning();
    return toAdminImage(row!);
  } catch (err) {
    // No row points at the file, so remove it rather than leave an orphan in R2.
    await bucket.delete(r2Key).catch(() => {});
    throw err;
  }
}

export async function updateProductImage(db: Db, id: number, input: ImageUpdateInput): Promise<AdminProductImage | undefined> {
  const [row] = await db.update(productImages).set(input).where(eq(productImages.id, id)).returning();
  return row && toAdminImage(row);
}

export async function deleteProductImage(db: Db, bucket: R2Bucket, id: number): Promise<boolean> {
  const [row] = await db.delete(productImages).where(eq(productImages.id, id)).returning({ r2Key: productImages.r2Key });
  if (!row) return false;

  // After the DB delete: if R2 fails, the worst case is an unused file, never a broken image in the shop.
  try {
    await bucket.delete(row.r2Key);
  } catch (err) {
    console.error("Failed to delete image from R2", err);
  }
  return true;
}
