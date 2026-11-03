import { createRoute } from "@hono/zod-openapi";
import { adminProductImageSchema, imageUpdateSchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../../db/client";
import { adminTags, cookieAuth, createRouter, errors, idParams, json } from "../../lib/openapi";
import { deleteProductImage, updateProductImage } from "../../services/admin-images";

const AdminProductImage = adminProductImageSchema.openapi("AdminProductImage");
const ImageUpdate = imageUpdateSchema.openapi("ImageUpdate");

// Images are uploaded under their product (POST /api/admin/products/:id/images)
// and changed here by their own id. Every route sits behind requireAdmin (index.ts).
const admin = { tags: [adminTags.images], security: cookieAuth };
const guarded = { 401: errors[401], 403: errors[403], 500: errors[500] };
const notFound = () => new HTTPException(404, { message: "Image not found" });

// PATCH /api/admin/images/:id — change alt text or display order
const update = createRoute({
  ...admin,
  method: "patch",
  path: "/{id}",
  summary: "Update an image",
  description: "Only the fields sent are changed. The file itself can't be replaced: upload a new image and delete this one.",
  request: {
    params: idParams(5),
    body: { content: { "application/json": { schema: ImageUpdate } }, required: true },
  },
  responses: {
    200: json(AdminProductImage, "Updated"),
    400: errors[400],
    404: errors[404],
    415: errors[415],
    ...guarded,
  },
});

// DELETE /api/admin/images/:id — delete the image and its file in R2
const remove = createRoute({
  ...admin,
  method: "delete",
  path: "/{id}",
  summary: "Delete an image",
  description: "Permanent. Also deletes the file from R2.",
  request: { params: idParams(5) },
  responses: { 204: { description: "Deleted" }, 400: errors[400], 404: errors[404], ...guarded },
});

export const adminImagesRoute = createRouter()
  .openapi(update, async (c) => {
    const image = await updateProductImage(getDb(c.env.DB), c.req.valid("param").id, c.req.valid("json"));
    if (!image) throw notFound();
    return c.json(image, 200);
  })
  .openapi(remove, async (c) => {
    if (!(await deleteProductImage(getDb(c.env.DB), c.env.BUCKET, c.req.valid("param").id))) throw notFound();
    return c.body(null, 204);
  });
