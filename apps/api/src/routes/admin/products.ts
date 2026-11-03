import { createRoute } from "@hono/zod-openapi";
import {
  IMAGE_MAX_BYTES,
  IMAGES_PER_PRODUCT_MAX,
  adminProductDetailSchema,
  adminProductImageSchema,
  adminProductListQuerySchema,
  adminProductSummarySchema,
  adminVariantSchema,
  imageUploadSchema,
  paginatedSchema,
  productCreateSchema,
  productUpdateSchema,
  variantCreateSchema,
} from "@novap/shared";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../../db/client";
import { adminTags, cookieAuth, createRouter, errors, idParams, json } from "../../lib/openapi";
import {
  createProduct,
  createVariant,
  deleteProduct,
  getAdminProduct,
  listAdminProducts,
  updateProduct,
} from "../../services/admin-catalog";
import { uploadProductImage } from "../../services/admin-images";

const AdminProductImage = adminProductImageSchema.openapi("AdminProductImage");
const ImageUpload = imageUploadSchema.openapi("ImageUpload");
const AdminProductSummary = adminProductSummarySchema.openapi("AdminProductSummary");
const AdminProductDetail = adminProductDetailSchema.openapi("AdminProductDetail");
const AdminVariant = adminVariantSchema.openapi("AdminVariant");
const ProductCreate = productCreateSchema.openapi("ProductCreate");
const ProductUpdate = productUpdateSchema.openapi("ProductUpdate");
const VariantCreate = variantCreateSchema.openapi("VariantCreate");

// Every route here sits behind requireAdmin (index.ts).
const admin = { tags: [adminTags.products], security: cookieAuth };
const guarded = { 401: errors[401], 403: errors[403], 500: errors[500] };
const notFound = () => new HTTPException(404, { message: "Product not found" });

// GET /api/admin/products — every product, newest change first
const list = createRoute({
  ...admin,
  method: "get",
  path: "/",
  summary: "List products (admin)",
  description: "Includes inactive products and products without variants. Sorted by last update.",
  request: { query: adminProductListQuerySchema },
  responses: {
    200: json(paginatedSchema(AdminProductSummary).openapi("AdminProductPage"), "One page of products"),
    400: errors[400],
    ...guarded,
  },
});

// GET /api/admin/products/:id — product with all variants and images
const getOne = createRoute({
  ...admin,
  method: "get",
  path: "/{id}",
  summary: "Get a product (admin)",
  request: { params: idParams(2) },
  responses: { 200: json(AdminProductDetail, "Product"), 400: errors[400], 404: errors[404], ...guarded },
});

// POST /api/admin/products — create a product (add variants after)
const create = createRoute({
  ...admin,
  method: "post",
  path: "/",
  summary: "Create a product",
  description:
    "The product is not shown in the shop until it has an active variant. " +
    "`slug` is optional: left out, it is made from the name (\"Café Noir\" -> `cafe-noir`). " +
    "400 if `categoryId` doesn't exist, 409 if the slug is taken.",
  request: { body: { content: { "application/json": { schema: ProductCreate } }, required: true } },
  responses: {
    201: json(AdminProductDetail, "Created"),
    400: errors[400],
    409: errors[409],
    415: errors[415],
    ...guarded,
  },
});

// PATCH /api/admin/products/:id — change some fields
const update = createRoute({
  ...admin,
  method: "patch",
  path: "/{id}",
  summary: "Update a product",
  description: "Only the fields sent are changed. Set `active: false` to hide a product without deleting it.",
  request: {
    params: idParams(2),
    body: { content: { "application/json": { schema: ProductUpdate } }, required: true },
  },
  responses: {
    200: json(AdminProductDetail, "Updated"),
    400: errors[400],
    404: errors[404],
    409: errors[409],
    415: errors[415],
    ...guarded,
  },
});

// DELETE /api/admin/products/:id — delete with its variants and images
const remove = createRoute({
  ...admin,
  method: "delete",
  path: "/{id}",
  summary: "Delete a product",
  description:
    "Permanent. Also deletes its variants and image files. Past orders are unaffected " +
    "(they keep a copy of name, SKU and price). To hide a product instead, set `active: false`.",
  request: { params: idParams(2) },
  responses: { 204: { description: "Deleted" }, 400: errors[400], 404: errors[404], ...guarded },
});

// POST /api/admin/products/:id/variants — add a variant to a product
const addVariant = createRoute({
  ...admin,
  tags: [adminTags.variants],
  method: "post",
  path: "/{id}/variants",
  summary: "Add a variant",
  description: "409 if the SKU is taken.",
  request: {
    params: idParams(2),
    body: { content: { "application/json": { schema: VariantCreate } }, required: true },
  },
  responses: {
    201: json(AdminVariant, "Created"),
    400: errors[400],
    404: errors[404],
    409: errors[409],
    415: errors[415],
    ...guarded,
  },
});

// POST /api/admin/products/:id/images — upload an image to R2
const addImage = createRoute({
  ...admin,
  tags: [adminTags.images],
  method: "post",
  path: "/{id}/images",
  summary: "Upload an image",
  description:
    "multipart/form-data with `file` (JPEG, PNG, WebP or AVIF, max 5 MB) and optional `alt`. " +
    "The type is checked from the file's bytes, not its name. Added at the end of the display order. " +
    `409 when the product already has ${IMAGES_PER_PRODUCT_MAX} images.`,
  // Rejects oversized bodies while streaming, before the upload is read into memory.
  // The margin covers the multipart boundaries and the alt field.
  middleware: [
    bodyLimit({
      maxSize: IMAGE_MAX_BYTES + 64 * 1024,
      onError: () => {
        throw new HTTPException(413, { message: "Images must be 5 MB or smaller" });
      },
    }),
  ] as const,
  request: {
    params: idParams(2),
    body: { content: { "multipart/form-data": { schema: ImageUpload } }, required: true },
  },
  responses: {
    201: json(AdminProductImage, "Uploaded"),
    400: errors[400],
    404: errors[404],
    409: errors[409],
    413: errors[413],
    ...guarded,
  },
});

export const adminProductsRoute = createRouter()
  .openapi(list, async (c) => c.json(await listAdminProducts(getDb(c.env.DB), c.req.valid("query")), 200))
  .openapi(getOne, async (c) => {
    const product = await getAdminProduct(getDb(c.env.DB), c.req.valid("param").id);
    if (!product) throw notFound();
    return c.json(product, 200);
  })
  .openapi(create, async (c) => c.json(await createProduct(getDb(c.env.DB), c.req.valid("json")), 201))
  .openapi(update, async (c) => {
    const product = await updateProduct(getDb(c.env.DB), c.req.valid("param").id, c.req.valid("json"));
    if (!product) throw notFound();
    return c.json(product, 200);
  })
  .openapi(remove, async (c) => {
    if (!(await deleteProduct(getDb(c.env.DB), c.env.BUCKET, c.req.valid("param").id))) throw notFound();
    return c.body(null, 204);
  })
  .openapi(addVariant, async (c) => {
    const variant = await createVariant(getDb(c.env.DB), c.req.valid("param").id, c.req.valid("json"));
    if (!variant) throw notFound();
    return c.json(variant, 201);
  })
  .openapi(addImage, async (c) => {
    const image = await uploadProductImage(getDb(c.env.DB), c.env.BUCKET, c.req.valid("param").id, c.req.valid("form"));
    if (!image) throw notFound();
    return c.json(image, 201);
  });
