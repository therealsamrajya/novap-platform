import { z } from "zod";
import { paginationQuerySchema } from "./api";
import { categorySummarySchema, productImageSchema } from "./catalog";
import { booleanParam, optionalText, required } from "./validation";

// Admin catalogue: inputs for create/update and the responses the admin
// dashboard reads. Unlike the public catalogue, admin sees everything,
// including inactive products and variants, stock counts and sort orders.

// ---------------------------------------------------------------- field rules

// URL-safe: lowercase letters, numbers and single hyphens ("reference-02").
const slug = z
  .string(required("Slug is required"))
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens")
  .meta({ example: "reference-02" });

const sortOrder = z.number().int().min(-10_000).max(10_000).meta({ description: "Lower comes first", example: 0 });

// Max $1,000,000 so a typo can't create an absurd price.
const cents = z.number().int().min(0).max(100_000_000);

// Blank text means "no value", stored as null.
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

// PATCH bodies: every field optional, but an empty body is almost certainly a client bug.
const notEmpty = (o: object) => Object.values(o).some((v) => v !== undefined);
const notEmptyMessage = "Send at least one field to change";

// Ids in the path, e.g. /api/admin/products/{id}. Path params are strings, so coerce.
export const idParamSchema = z.coerce.number().int().positive().meta({ type: "integer", minimum: 1 });

// ---------------------------------------------------------------- categories

const categoryFields = {
  name: z.string(required("Name is required")).trim().min(1, "Name is required").max(100).meta({ example: "Collection" }),
  slug: slug.meta({ example: "collection" }),
  sortOrder,
};

export const categoryCreateSchema = z.object({ ...categoryFields, sortOrder: sortOrder.default(0) });
export type CategoryCreateInput = z.output<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z.object(categoryFields).partial().refine(notEmpty, notEmptyMessage);
export type CategoryUpdateInput = z.output<typeof categoryUpdateSchema>;

export const adminCategorySchema = categorySummarySchema.extend({
  sortOrder: z.number().int(),
  productCount: z.number().int().meta({ description: "All products in this category, active or not", example: 4 }),
  createdAt: z.iso.datetime(),
});
export type AdminCategory = z.infer<typeof adminCategorySchema>;

// ---------------------------------------------------------------- variants

const variantFields = {
  sku: z
    .string(required("SKU is required"))
    .trim()
    .min(1, "SKU is required")
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, hyphens and underscores")
    .meta({ example: "REF02-S" }),
  label: z.string(required("Label is required")).trim().min(1, "Label is required").max(100).meta({ example: "Small" }),
  priceCents: cents.meta({ description: "Price in cents, GST-inclusive", example: 5495 }),
  compareAtCents: cents
    .nullable()
    .meta({ description: "Original price; shown as a sale when above priceCents", example: 6495 }),
  stock: z.number().int().min(0).max(1_000_000).meta({ example: 25 }),
  attributes: z
    .record(z.string().trim().min(1).max(50), z.string().trim().max(100))
    .refine((r) => Object.keys(r).length <= 20, "At most 20 attributes")
    .nullable()
    .meta({ example: { size: "small" } }),
  active: z.boolean(),
  sortOrder,
};

export const variantCreateSchema = z.object({
  ...variantFields,
  compareAtCents: variantFields.compareAtCents.default(null),
  stock: variantFields.stock.default(0),
  attributes: variantFields.attributes.default(null),
  active: variantFields.active.default(true),
  sortOrder: sortOrder.default(0),
});
export type VariantCreateInput = z.output<typeof variantCreateSchema>;

export const variantUpdateSchema = z.object(variantFields).partial().refine(notEmpty, notEmptyMessage);
export type VariantUpdateInput = z.output<typeof variantUpdateSchema>;

export const adminVariantSchema = z.object({
  id: z.number().int().meta({ example: 3 }),
  productId: z.number().int().meta({ example: 2 }),
  sku: z.string(),
  label: z.string(),
  priceCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  stock: z.number().int(),
  attributes: z.record(z.string(), z.string()).nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminVariant = z.infer<typeof adminVariantSchema>;

// ---------------------------------------------------------------- products

const productFields = {
  slug,
  name: z.string(required("Name is required")).trim().min(1, "Name is required").max(150).meta({ example: "Reference 02" }),
  subtitle: nullableText(150).meta({ example: "Obsidian / Silver" }),
  description: z.string().trim().max(10_000),
  categoryId: z.number().int().positive().nullable().meta({ description: "null = no category", example: 1 }),
  active: z.boolean().meta({ description: "Inactive products are hidden from the shop" }),
  featured: z.boolean(),
};

export const productCreateSchema = z.object({
  ...productFields,
  subtitle: productFields.subtitle.default(null),
  description: productFields.description.default(""),
  categoryId: productFields.categoryId.default(null),
  active: productFields.active.default(true),
  featured: productFields.featured.default(false),
});
export type ProductCreateInput = z.output<typeof productCreateSchema>;

export const productUpdateSchema = z.object(productFields).partial().refine(notEmpty, notEmptyMessage);
export type ProductUpdateInput = z.output<typeof productUpdateSchema>;

export const adminProductListQuerySchema = paginationQuerySchema.extend({
  q: optionalText.meta({ description: "Search in name and slug (case-insensitive)" }),
  categoryId: z.coerce.number().int().positive().optional().meta({ type: "integer", minimum: 1 }),
  active: booleanParam.optional(),
});
export type AdminProductListQuery = z.output<typeof adminProductListQuerySchema>;

export const adminProductImageSchema = productImageSchema.extend({
  id: z.number().int().meta({ example: 5 }),
  sortOrder: z.number().int(),
});
export type AdminProductImage = z.infer<typeof adminProductImageSchema>;

const visible = z.boolean().meta({ description: "Shown in the shop: active and has at least one active variant" });

// One row in the admin product table.
export const adminProductSummarySchema = z.object({
  id: z.number().int().meta({ example: 2 }),
  slug: z.string().meta({ example: "reference-02" }),
  name: z.string().meta({ example: "Reference 02" }),
  active: z.boolean(),
  featured: z.boolean(),
  visible,
  category: categorySummarySchema.nullable(),
  variantCount: z.number().int().meta({ description: "All variants, active or not", example: 3 }),
  totalStock: z.number().int().meta({ description: "Sum of stock over all variants", example: 40 }),
  priceFromCents: z.number().int().nullable().meta({ description: "Cheapest active variant, null if none", example: 5495 }),
  image: productImageSchema.nullable(),
  updatedAt: z.iso.datetime(),
});
export type AdminProductSummary = z.infer<typeof adminProductSummarySchema>;

export const adminProductDetailSchema = z.object({
  id: z.number().int().meta({ example: 2 }),
  slug: z.string(),
  name: z.string(),
  subtitle: z.string().nullable(),
  description: z.string(),
  category: categorySummarySchema.nullable(),
  active: z.boolean(),
  featured: z.boolean(),
  visible,
  variants: z.array(adminVariantSchema).meta({ description: "All variants, in display order" }),
  images: z.array(adminProductImageSchema).meta({ description: "In display order" }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminProductDetail = z.infer<typeof adminProductDetailSchema>;
