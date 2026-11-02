import { createRoute, z } from "@hono/zod-openapi";
import { categorySchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import { createRouter, errors, json, slugParams } from "../lib/openapi";
import { getCategoryBySlug, listCategories } from "../services/catalog";

const Category = categorySchema.openapi("Category");

// GET /api/categories — all categories with visible product counts
const list = createRoute({
  method: "get",
  path: "/",
  tags: ["Catalog"],
  summary: "List categories",
  description: "Ordered by sortOrder, then name. productCount counts visible products only.",
  responses: { 200: json(z.array(Category), "Categories"), 500: errors[500] },
});

// GET /api/categories/:slug — one category
const getOne = createRoute({
  method: "get",
  path: "/{slug}",
  tags: ["Catalog"],
  summary: "Get a category",
  request: { params: slugParams("collection") },
  responses: { 200: json(Category, "Category"), 404: errors[404], 500: errors[500] },
});

export const categoriesRoute = createRouter()
  .openapi(list, async (c) => c.json(await listCategories(getDb(c.env.DB)), 200))
  .openapi(getOne, async (c) => {
    const category = await getCategoryBySlug(getDb(c.env.DB), c.req.valid("param").slug);
    if (!category) throw new HTTPException(404, { message: "Category not found" });
    return c.json(category, 200);
  });
