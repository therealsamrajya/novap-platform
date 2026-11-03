import { z } from "zod";
import { paginationQuerySchema } from "./api";
import { categorySummarySchema, productImageSchema } from "./catalog";
import { orderLineSchema, orderStatusSchema, shippingAddressSchema } from "./checkout";
import { SLUG_MAX, SLUG_PATTERN } from "./slug";
import { booleanParam, optionalText, required } from "./validation";

// Admin catalogue: inputs for create/update and the responses the admin
// dashboard reads. Unlike the public catalogue, admin sees everything,
// including inactive products and variants, stock counts and sort orders.
// Input schemas are strict: an unknown key (a typo, or a read-only field like
// productCount) is a 400 instead of being silently dropped.

// ---------------------------------------------------------------- field rules

// URL-safe: lowercase letters, numbers and single hyphens ("reference-02").
const slug = z
  .string(required("Slug is required"))
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(SLUG_MAX)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens")
  .meta({ example: "reference-02" });

// On create the slug may be left out: the API then makes one from the name with slugify().
const optionalSlug = (example: string) =>
  slug.optional().meta({ description: "Generated from the name when left out", example });

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
// `when` skips the check if the body already failed (e.g. only unknown keys), so that error isn't repeated.
const notEmpty = (o: object) => Object.values(o).some((v) => v !== undefined);
const notEmptyMessage = {
  message: "Send at least one field to change",
  when: (payload: { issues: unknown[] }) => payload.issues.length === 0,
};

// Ids in the path, e.g. /api/admin/products/{id}. Path params are strings, so coerce.
export const idParamSchema = z.coerce.number().int().positive().meta({ type: "integer", minimum: 1 });

// ---------------------------------------------------------------- categories

const categoryFields = {
  name: z.string(required("Name is required")).trim().min(1, "Name is required").max(100).meta({ example: "Collection" }),
  slug: slug.meta({ example: "collection" }),
  sortOrder,
};

export const categoryCreateSchema = z.strictObject({
  ...categoryFields,
  slug: optionalSlug("collection"),
  sortOrder: sortOrder.default(0),
});
export type CategoryCreateInput = z.output<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z.strictObject(categoryFields).partial().refine(notEmpty, notEmptyMessage);
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

export const variantCreateSchema = z.strictObject({
  ...variantFields,
  compareAtCents: variantFields.compareAtCents.default(null),
  stock: variantFields.stock.default(0),
  attributes: variantFields.attributes.default(null),
  active: variantFields.active.default(true),
  sortOrder: sortOrder.default(0),
});
export type VariantCreateInput = z.output<typeof variantCreateSchema>;

export const variantUpdateSchema = z.strictObject(variantFields).partial().refine(notEmpty, notEmptyMessage);
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

export const productCreateSchema = z.strictObject({
  ...productFields,
  slug: optionalSlug("reference-02"),
  subtitle: productFields.subtitle.default(null),
  description: productFields.description.default(""),
  categoryId: productFields.categoryId.default(null),
  active: productFields.active.default(true),
  featured: productFields.featured.default(false),
});
export type ProductCreateInput = z.output<typeof productCreateSchema>;

export const productUpdateSchema = z.strictObject(productFields).partial().refine(notEmpty, notEmptyMessage);
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

// ---------------------------------------------------------------- images

// SVG is left out on purpose: it can carry scripts, so serving uploads as SVG is an XSS risk.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const IMAGES_PER_PRODUCT_MAX = 20;

const imageAlt = z.string().trim().max(200).meta({ description: "Text for screen readers", example: "Reference 02, front" });

// multipart/form-data. The file's type is checked again on the server from its
// bytes; `type` here is only what the browser claims.
export const imageUploadSchema = z.strictObject({
  file: z
    .file(required("Choose an image file"))
    .min(1, "The file is empty")
    .max(IMAGE_MAX_BYTES, "Images must be 5 MB or smaller")
    .mime([...IMAGE_TYPES], "Use a JPEG, PNG, WebP or AVIF image")
    // The OpenAPI generator doesn't know z.file(); this is how OpenAPI describes an upload.
    .meta({ type: "string", format: "binary", description: "JPEG, PNG, WebP or AVIF, max 5 MB" }),
  alt: imageAlt.default(""),
});
export type ImageUploadInput = z.output<typeof imageUploadSchema>;

export const imageUpdateSchema = z
  .strictObject({ alt: imageAlt, sortOrder })
  .partial()
  .refine(notEmpty, notEmptyMessage);
export type ImageUpdateInput = z.output<typeof imageUpdateSchema>;

// ---------------------------------------------------------------- contact inbox

// new = not opened yet, read = opened, archived = dealt with (hidden from the default view).
export const contactStatusValues = ["new", "read", "archived"] as const;
export const contactStatusSchema = z.enum(contactStatusValues);
export type ContactStatus = z.infer<typeof contactStatusSchema>;

export const adminContactListQuerySchema = paginationQuerySchema.extend({
  status: contactStatusSchema.optional().meta({ description: "Only messages with this status. Left out: all except archived" }),
  q: optionalText.meta({ description: "Search in name, email and subject (case-insensitive)" }),
});
export type AdminContactListQuery = z.output<typeof adminContactListQuerySchema>;

export const adminContactMessageSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  name: z.string().meta({ example: "Alex Citizen" }),
  email: z.string().meta({ example: "alex@example.com" }),
  subject: z.string().meta({ example: "Question about Reference 02" }),
  message: z.string(),
  status: contactStatusSchema,
  createdAt: z.iso.datetime(),
});
export type AdminContactMessage = z.infer<typeof adminContactMessageSchema>;

export const contactUpdateSchema = z.strictObject({ status: contactStatusSchema });
export type ContactUpdateInput = z.output<typeof contactUpdateSchema>;

// ---------------------------------------------------------------- orders

export const adminOrderListQuerySchema = paginationQuerySchema.extend({
  status: orderStatusSchema
    .optional()
    .meta({ description: "Only orders with this status. Left out: all except pending (unpaid checkouts)" }),
  q: optionalText.meta({ description: "Search by email (contains) or order number (exact)" }),
});
export type AdminOrderListQuery = z.output<typeof adminOrderListQuerySchema>;

export const adminOrderSummarySchema = z.object({
  id: z.number().int().meta({ example: 4 }),
  email: z.string().meta({ example: "guest@example.com" }),
  userId: z.number().int().nullable().meta({ description: "null for guest orders", example: null }),
  status: orderStatusSchema,
  totalCents: z.number().int().meta({ example: 13480 }),
  itemCount: z.number().int().meta({ description: "Total quantity across all lines", example: 3 }),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
});
export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;

export const adminOrderSchema = adminOrderSummarySchema.extend({
  currency: z.string().meta({ example: "aud" }),
  subtotalCents: z.number().int().meta({ example: 12485 }),
  shippingCents: z.number().int().meta({ example: 995 }),
  gstCents: z.number().int().meta({ description: "GST included in the total", example: 1225 }),
  shippingAddress: shippingAddressSchema.nullable().meta({ description: "Collected by Stripe; null until paid" }),
  items: z.array(
    orderLineSchema.extend({
      variantId: z.number().int().nullable().meta({ description: "null if the variant was deleted since", example: 1 }),
    }),
  ),
  customer: z
    .object({ id: z.number().int(), name: z.string(), email: z.string() })
    .nullable()
    .meta({ description: "The account that placed the order; null for guests" }),
  trackingNumber: z.string().nullable().meta({ example: "AP123456789AU" }),
  fulfilledAt: z.iso.datetime().nullable(),
  stripeSessionId: z.string().nullable().meta({ example: "cs_test_a1b2c3" }),
  stripePaymentIntentId: z.string().nullable().meta({ description: "Find the payment in the Stripe dashboard", example: "pi_3abc" }),
  updatedAt: z.iso.datetime(),
});
export type AdminOrder = z.infer<typeof adminOrderSchema>;

// The only manual status change is shipping a paid order. Payment, cancellation and
// refunds come from Stripe through the webhook (refund in the Stripe dashboard).
export const orderUpdateSchema = z
  .strictObject({
    status: z.literal("fulfilled").meta({ description: "Mark a paid order as shipped. Sets fulfilledAt" }),
    trackingNumber: nullableText(100).meta({ description: "Blank or null clears it", example: "AP123456789AU" }),
  })
  .partial()
  .refine(notEmpty, notEmptyMessage);
export type OrderUpdateInput = z.output<typeof orderUpdateSchema>;
