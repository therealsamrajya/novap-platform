import { z } from "zod";
import { paginationQuerySchema } from "./api";

// ---------------------------------------------------------------- query params

// "?inStock=true" -> true. z.coerce.boolean() would turn "false" into true.
const booleanParam = z.enum(["true", "false"]).transform((v) => v === "true");

// Empty strings ("?q=") are treated as "not set" so forms can send blank fields.
const optionalText = z
  .string()
  .trim()
  .max(100)
  .transform((v) => v || undefined)
  .optional();

// type override: z.coerce makes the generated docs say "integer or null".
const priceParam = z.coerce.number().int().min(0).max(100_000_000).optional().meta({ type: "integer", minimum: 0 });

export const productSortValues = ["newest", "price_asc", "price_desc", "name"] as const;
export type ProductSort = (typeof productSortValues)[number];

export const productListQuerySchema = paginationQuerySchema
  .extend({
    q: optionalText.meta({ description: "Search in name, subtitle and description (case-insensitive)" }),
    category: optionalText.meta({ description: "Category slug", example: "collection" }),
    minPrice: priceParam.meta({ description: "Min price in cents, compared with the cheapest variant" }),
    maxPrice: priceParam.meta({ description: "Max price in cents, compared with the cheapest variant" }),
    inStock: booleanParam.optional().meta({ description: "Any variant in stock" }),
    featured: booleanParam.optional(),
    sort: z.enum(productSortValues).default("newest"),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: "minPrice must not be greater than maxPrice",
    path: ["maxPrice"],
  });
export type ProductListQuery = z.output<typeof productListQuerySchema>;

// ---------------------------------------------------------------- responses
// Money is integer cents, AUD, GST-inclusive. Image urls are paths on the API
// (e.g. "/api/images/products/1/main.webp"); prefix them with the API base URL.

const cents = (description: string, example: number) => z.number().int().meta({ description, example });

export const categorySummarySchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  slug: z.string().meta({ example: "collection" }),
  name: z.string().meta({ example: "Collection" }),
});
export type CategorySummary = z.infer<typeof categorySummarySchema>;

export const categorySchema = categorySummarySchema.extend({
  productCount: z.number().int().meta({ description: "Visible products in this category", example: 4 }),
});
export type Category = z.infer<typeof categorySchema>;

export const productImageSchema = z.object({
  url: z.string().meta({ description: "Path on the API; prefix with the API base URL", example: "/api/images/products/2/main.webp" }),
  alt: z.string().meta({ example: "Reference 02" }),
});
export type ProductImage = z.infer<typeof productImageSchema>;

// One card on a listing page.
export const productSummarySchema = z.object({
  id: z.number().int().meta({ example: 2 }),
  slug: z.string().meta({ example: "reference-02" }),
  name: z.string().meta({ example: "Reference 02" }),
  subtitle: z.string().nullable().meta({ example: "Obsidian / Silver" }),
  featured: z.boolean(),
  category: categorySummarySchema.nullable(),
  priceFromCents: cents("Cheapest active variant", 5495),
  onSale: z.boolean().meta({ description: "Any variant has compareAtCents above its price" }),
  inStock: z.boolean().meta({ description: "Any variant has stock" }),
  image: productImageSchema.nullable().meta({ description: "First image, or null" }),
});
export type ProductSummary = z.infer<typeof productSummarySchema>;

// What is actually bought.
export const productVariantSchema = z.object({
  id: z.number().int().meta({ example: 3 }),
  sku: z.string().meta({ example: "REF02-S" }),
  label: z.string().meta({ example: "Small" }),
  priceCents: cents("Price in cents, GST-inclusive", 5495),
  compareAtCents: z.number().int().nullable().meta({ description: "Original price when on sale", example: 6495 }),
  inStock: z.boolean(),
  attributes: z.record(z.string(), z.string()).nullable().meta({ example: { size: "small" } }),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

export const productDetailSchema = productSummarySchema
  .pick({ id: true, slug: true, name: true, subtitle: true, featured: true, category: true })
  .extend({
    description: z.string(),
    variants: z.array(productVariantSchema).meta({ description: "Active variants, in display order" }),
    images: z.array(productImageSchema).meta({ description: "In display order" }),
  });
export type ProductDetail = z.infer<typeof productDetailSchema>;
