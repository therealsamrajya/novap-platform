import { productListQuerySchema } from "@novap/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../index";
import { getDb } from "../db/client";
import { getProductBySlug, listProducts } from "../services/catalog";

export const productsRoute = new Hono<AppEnv>()
  // GET /api/products — filtered, sorted, paginated product cards
  .get("/", async (c) => {
    const query = productListQuerySchema.parse(c.req.query());
    return c.json(await listProducts(getDb(c.env.DB), query));
  })

  // GET /api/products/:slug — product page with variants and images
  .get("/:slug", async (c) => {
    const product = await getProductBySlug(getDb(c.env.DB), c.req.param("slug"));
    if (!product) throw new HTTPException(404, { message: "Product not found" });
    return c.json(product);
  });
