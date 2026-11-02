import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../index";
import { getDb } from "../db/client";
import { getCategoryBySlug, listCategories } from "../services/catalog";

export const categoriesRoute = new Hono<AppEnv>()
  // GET /api/categories — all categories with visible product counts
  .get("/", async (c) => c.json(await listCategories(getDb(c.env.DB))))

  // GET /api/categories/:slug — one category
  .get("/:slug", async (c) => {
    const category = await getCategoryBySlug(getDb(c.env.DB), c.req.param("slug"));
    if (!category) throw new HTTPException(404, { message: "Category not found" });
    return c.json(category);
  });
