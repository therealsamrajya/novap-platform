---
name: new-endpoint
description: Add a new HTTP endpoint to the NŌVAP API (apps/api). Use when creating or extending a route, e.g. "add GET /api/products", "add contact form endpoint", "new admin route". Covers shared zod schemas (input + response), service function, OpenAPI route with createRoute, mounting, error handling and Swagger docs.
---

# Add an API endpoint

Follow the layers in order. Each layer has one job. The OpenAPI spec and Swagger UI (`/api/docs`)
are generated from these schemas, so documenting an endpoint happens as part of building it.
See `routes/products.ts` for a complete example.

## 1. Shared schemas (`packages/shared/src/<area>.ts`)

Input schemas (query, params, body) **and** response schemas, as plain zod. Infer the types from them.
Export everything from `index.ts`. Do not import `@hono/zod-openapi` in shared: frontends use this package.

```ts
export const productListQuerySchema = paginationQuerySchema.extend({
  category: optionalText.meta({ description: "Category slug", example: "collection" }),
});
export type ProductListQuery = z.output<typeof productListQuerySchema>;

export const productSummarySchema = z.object({
  id: z.number().int().meta({ example: 2 }),
  priceFromCents: z.number().int().meta({ description: "Cheapest active variant", example: 5495 }),
});
export type ProductSummary = z.infer<typeof productSummarySchema>;
```

- Use `.meta({ description, example })` for docs. Swagger shows it.
- Query strings are strings, so use `z.coerce.number()` for numbers. For booleans use
  `z.enum(["true","false"]).transform(v => v === "true")`, never `z.coerce.boolean()`
  (it turns `"false"` into true).
- Emails: `z.email().toLowerCase()`. Free text: `.trim()` and a `.max()` on everything.
- Form messages: write user-facing messages (`.min(1, "Name is required")`). For a missing field use the
  `required()` pattern in `contact.ts`. A plain `z.string({ error })` would also override the max-length message.
  Move `required()` to a shared helper when a second form needs it.
- Lists: extend `paginationQuerySchema`; respond with `paginatedSchema(itemSchema)`.
- After adding a schema, check the generated spec (`/api/openapi.json`). Coerced params can show up as
  `integer | null`; fix that with `.meta({ type: "integer", minimum: 0 })` (see `priceParam`).

## 2. Service (`apps/api/src/services/<area>.ts`)

DB logic lives here, with no Hono imports. The first argument is `db: Db`. The return type is the shared type.

```ts
export async function getProductBySlug(db: Db, slug: string): Promise<ProductDetail | undefined> { ... }
```

- Return plain data or `undefined`. Let the route decide the HTTP status.
- Map rows to the response shape explicitly. Never return raw rows (they leak internal fields like `passwordHash` or `r2Key`).
- Use `db.batch([...])` when several writes must succeed together. D1 has no interactive transactions.

## 3. Route (`apps/api/src/routes/<area>.ts`)

```ts
import { createRoute } from "@hono/zod-openapi";
import { productDetailSchema, productListQuerySchema, paginatedSchema, productSummarySchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import { createRouter, errors, json, slugParams } from "../lib/openapi";

// .openapi("Name") makes it a named schema under "Schemas" in Swagger.
const ProductDetail = productDetailSchema.openapi("ProductDetail");

// GET /api/products/:slug — product page with variants and images
const getOne = createRoute({
  method: "get",
  path: "/{slug}",                       // OpenAPI style {param}, not :param
  tags: ["Catalog"],
  summary: "Get a product",
  request: { params: slugParams("reference-02") },  // also: query, body
  responses: { 200: json(ProductDetail, "Product"), 404: errors[404], 500: errors[500] },
});

export const productsRoute = createRouter().openapi(getOne, async (c) => {
  const product = await getProductBySlug(getDb(c.env.DB), c.req.valid("param").slug);
  if (!product) throw new HTTPException(404, { message: "Product not found" });
  return c.json(product, 200);           // status is required and must be listed in responses
});
```

- **Always `createRouter()`** from `lib/openapi.ts`, never `new Hono()`. Its hook rethrows validation
  errors so they get the standard `{ error, issues }` format.
- **Always `createRoute` + `.openapi()`.** Routes added with plain `.get()` are missing from the docs.
  If a path can't be expressed (wildcards), use plain `.get()` and add `router.openAPIRegistry.registerPath(...)`
  for the docs (see `routes/images.ts`).
- Read input with `c.req.valid("query" | "param" | "json")`. It is already validated and typed.
- JSON body: `request: { body: { content: { "application/json": { schema } }, required: true } }`.
- **Errors: throw, never return.** Use `throw new HTTPException(status, { message })`, and never
  `return c.json({ error }, 4xx)`. Only `middleware/error.ts` and `app.notFound` produce
  `{ error, issues? }` (see "Error responses" in CLAUDE.md). List every error status in `responses` with `errors[...]`.
- Status codes: 200 read, 201 create, 204 delete, 400 bad input, 401 not logged in, 403 not allowed, 404 missing, 409 conflict.
- Add a one-line comment above each route: `// GET /api/products — ...`.
- New area: add a `tags` entry in `index.ts` (`app.doc31(...)`).

## 4. Mount (`apps/api/src/index.ts`)

`app.route("/api/products", productsRoute);`. Keep mounts grouped and ordered. Mounting also merges the docs.

## 5. Docs

Check http://localhost:8787/api/docs. The new endpoint should appear with its params, schemas and examples.
Update [docs/api.md](../../../docs/api.md) only if a **convention** changed (auth, errors, pagination).

## 6. Verify

Run the `verify-api` skill: typecheck, then curl the happy path, a 404 and a 400.
