import { createRoute } from "@hono/zod-openapi";
import { paginatedSchema, productDetailSchema, productListQuerySchema, productSummarySchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import { createRouter, errors, json, slugParams } from "../lib/openapi";
import { getProductBySlug, listProducts } from "../services/catalog";

const ProductSummary = productSummarySchema.openapi("ProductSummary");
const ProductDetail = productDetailSchema.openapi("ProductDetail");

// GET /api/products — filtered, sorted, paginated product cards
const list = createRoute({
  method: "get",
  path: "/",
  tags: ["Catalog"],
  summary: "List products",
  description:
    "Only visible products (active, with at least one active variant). Empty params count as not set. " +
    "An unknown category returns an empty list.",
  request: { query: productListQuerySchema },
  responses: {
    200: json(paginatedSchema(ProductSummary).openapi("ProductPage"), "One page of products"),
    400: errors[400],
    500: errors[500],
  },
});

// GET /api/products/:slug — product page with variants and images
const getOne = createRoute({
  method: "get",
  path: "/{slug}",
  tags: ["Catalog"],
  summary: "Get a product",
  description: "404 also covers inactive products and products without an active variant.",
  request: { params: slugParams("reference-02") },
  responses: { 200: json(ProductDetail, "Product"), 404: errors[404], 500: errors[500] },
});

export const productsRoute = createRouter()
  .openapi(list, async (c) => c.json(await listProducts(getDb(c.env.DB), c.req.valid("query")), 200))
  .openapi(getOne, async (c) => {
    const product = await getProductBySlug(getDb(c.env.DB), c.req.valid("param").slug);
    if (!product) throw new HTTPException(404, { message: "Product not found" });
    return c.json(product, 200);
  });
