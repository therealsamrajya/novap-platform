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

const priceParam = z.coerce.number().int().min(0).max(100_000_000).optional();

export const productSortValues = ["newest", "price_asc", "price_desc", "name"] as const;
export type ProductSort = (typeof productSortValues)[number];

export const productListQuerySchema = paginationQuerySchema
  .extend({
    q: optionalText, // search in name, subtitle, description
    category: optionalText, // category slug
    minPrice: priceParam, // cents, compared with the cheapest variant
    maxPrice: priceParam,
    inStock: booleanParam.optional(),
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

export type CategorySummary = { id: number; slug: string; name: string };

export type Category = CategorySummary & { productCount: number };

export type ProductImage = { url: string; alt: string };

// One card on a listing page.
export type ProductSummary = {
  id: number;
  slug: string;
  name: string;
  subtitle: string | null;
  featured: boolean;
  category: CategorySummary | null;
  priceFromCents: number; // cheapest active variant
  onSale: boolean; // any variant has compareAtCents above its price
  inStock: boolean; // any variant has stock
  image: ProductImage | null; // first image
};

// What is actually bought.
export type ProductVariant = {
  id: number;
  sku: string;
  label: string;
  priceCents: number;
  compareAtCents: number | null;
  inStock: boolean;
  attributes: Record<string, string> | null;
};

export type ProductDetail = {
  id: number;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string;
  featured: boolean;
  category: CategorySummary | null;
  variants: ProductVariant[];
  images: ProductImage[];
};
