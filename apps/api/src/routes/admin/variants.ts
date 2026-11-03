import { createRoute } from "@hono/zod-openapi";
import { adminVariantSchema, variantUpdateSchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../../db/client";
import { adminTags, cookieAuth, createRouter, errors, idParams, json } from "../../lib/openapi";
import { deleteVariant, updateVariant } from "../../services/admin-catalog";

const AdminVariant = adminVariantSchema.openapi("AdminVariant");
const VariantUpdate = variantUpdateSchema.openapi("VariantUpdate");

// Variants are created under their product (POST /api/admin/products/:id/variants)
// and changed here by their own id. Every route sits behind requireAdmin (index.ts).
const admin = { tags: [adminTags.variants], security: cookieAuth };
const guarded = { 401: errors[401], 403: errors[403], 500: errors[500] };
const notFound = () => new HTTPException(404, { message: "Variant not found" });

// PATCH /api/admin/variants/:id — change price, stock, etc.
const update = createRoute({
  ...admin,
  method: "patch",
  path: "/{id}",
  summary: "Update a variant",
  description: "Only the fields sent are changed. `stock` sets the new count (not an increment). 409 if the SKU is taken.",
  request: {
    params: idParams(3),
    body: { content: { "application/json": { schema: VariantUpdate } }, required: true },
  },
  responses: {
    200: json(AdminVariant, "Updated"),
    400: errors[400],
    404: errors[404],
    409: errors[409],
    415: errors[415],
    ...guarded,
  },
});

// DELETE /api/admin/variants/:id — delete a variant
const remove = createRoute({
  ...admin,
  method: "delete",
  path: "/{id}",
  summary: "Delete a variant",
  description: "Permanent. Past orders keep their copy of the SKU and price. To stop selling it instead, set `active: false`.",
  request: { params: idParams(3) },
  responses: { 204: { description: "Deleted" }, 400: errors[400], 404: errors[404], ...guarded },
});

export const adminVariantsRoute = createRouter()
  .openapi(update, async (c) => {
    const variant = await updateVariant(getDb(c.env.DB), c.req.valid("param").id, c.req.valid("json"));
    if (!variant) throw notFound();
    return c.json(variant, 200);
  })
  .openapi(remove, async (c) => {
    if (!(await deleteVariant(getDb(c.env.DB), c.req.valid("param").id))) throw notFound();
    return c.body(null, 204);
  });
