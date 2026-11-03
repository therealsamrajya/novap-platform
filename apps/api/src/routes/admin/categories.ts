import { createRoute, z } from "@hono/zod-openapi";
import { adminCategorySchema, categoryCreateSchema, categoryUpdateSchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../../db/client";
import { adminTags, cookieAuth, createRouter, errors, idParams, json } from "../../lib/openapi";
import {
  createCategory,
  deleteCategory,
  getAdminCategory,
  listAdminCategories,
  updateCategory,
} from "../../services/admin-catalog";

const AdminCategory = adminCategorySchema.openapi("AdminCategory");
const CategoryCreate = categoryCreateSchema.openapi("CategoryCreate");
const CategoryUpdate = categoryUpdateSchema.openapi("CategoryUpdate");

// Every route here sits behind requireAdmin (index.ts).
const admin = { tags: [adminTags.categories], security: cookieAuth };
const guarded = { 401: errors[401], 403: errors[403], 500: errors[500] };
const notFound = () => new HTTPException(404, { message: "Category not found" });

// GET /api/admin/categories — all categories with product counts
const list = createRoute({
  ...admin,
  method: "get",
  path: "/",
  summary: "List categories (admin)",
  description: "productCount counts all products, active or not.",
  responses: { 200: json(z.array(AdminCategory), "Categories"), ...guarded },
});

// GET /api/admin/categories/:id — one category
const getOne = createRoute({
  ...admin,
  method: "get",
  path: "/{id}",
  summary: "Get a category (admin)",
  request: { params: idParams(1) },
  responses: { 200: json(AdminCategory, "Category"), 400: errors[400], 404: errors[404], ...guarded },
});

// POST /api/admin/categories — create a category
const create = createRoute({
  ...admin,
  method: "post",
  path: "/",
  summary: "Create a category",
  description: "`slug` is optional: left out, it is made from the name (\"Limited Run\" -> `limited-run`). 409 if the slug is taken.",
  request: { body: { content: { "application/json": { schema: CategoryCreate } }, required: true } },
  responses: {
    201: json(AdminCategory, "Created"),
    400: errors[400],
    409: errors[409],
    415: errors[415],
    ...guarded,
  },
});

// PATCH /api/admin/categories/:id — change some fields
const update = createRoute({
  ...admin,
  method: "patch",
  path: "/{id}",
  summary: "Update a category",
  description: "Only the fields sent are changed. 409 if the new slug is taken.",
  request: {
    params: idParams(1),
    body: { content: { "application/json": { schema: CategoryUpdate } }, required: true },
  },
  responses: {
    200: json(AdminCategory, "Updated"),
    400: errors[400],
    404: errors[404],
    409: errors[409],
    415: errors[415],
    ...guarded,
  },
});

// DELETE /api/admin/categories/:id — delete; its products are kept without a category
const remove = createRoute({
  ...admin,
  method: "delete",
  path: "/{id}",
  summary: "Delete a category",
  description: "Products in the category are kept, with `category: null`.",
  request: { params: idParams(1) },
  responses: { 204: { description: "Deleted" }, 400: errors[400], 404: errors[404], ...guarded },
});

export const adminCategoriesRoute = createRouter()
  .openapi(list, async (c) => c.json(await listAdminCategories(getDb(c.env.DB)), 200))
  .openapi(getOne, async (c) => {
    const category = await getAdminCategory(getDb(c.env.DB), c.req.valid("param").id);
    if (!category) throw notFound();
    return c.json(category, 200);
  })
  .openapi(create, async (c) => c.json(await createCategory(getDb(c.env.DB), c.req.valid("json")), 201))
  .openapi(update, async (c) => {
    const category = await updateCategory(getDb(c.env.DB), c.req.valid("param").id, c.req.valid("json"));
    if (!category) throw notFound();
    return c.json(category, 200);
  })
  .openapi(remove, async (c) => {
    if (!(await deleteCategory(getDb(c.env.DB), c.req.valid("param").id))) throw notFound();
    return c.body(null, 204);
  });
