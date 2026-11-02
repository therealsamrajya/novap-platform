---
name: new-endpoint
description: Add a new HTTP endpoint to the NŌVAP API (apps/api). Use when creating or extending a route, e.g. "add GET /api/products", "add contact form endpoint", "new admin route". Covers shared zod schema, service function, Hono route, mounting, error handling and API docs.
---

# Add an API endpoint

Follow the layers in order. Each layer has one job.

## 1. Shared schema (`packages/shared/src/schemas.ts`)

Define input schemas (query, params, body) and export inferred types. Frontends reuse them.

```ts
export const productListQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
```

- Query strings are strings, so use `z.coerce.number()` for numbers. For booleans use
  `z.enum(["true","false"]).transform(v => v === "true")`, never `z.coerce.boolean()`
  (it turns `"false"` into true).
- Emails: `z.email().toLowerCase()`. Free text: `.trim()` and a `.max()` on everything.
- If the file grows past ~200 lines, split it into `schemas/<area>.ts` and re-export from `index.ts`.

## 2. Service (`apps/api/src/services/<area>.ts`)

DB logic lives here, with no Hono imports. The first argument is `db: Db` (from `../db/client`).

```ts
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { products } from "../db/schema";

export async function getProductBySlug(db: Db, slug: string) {
  return db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: { variants: true, images: true, category: true },
  });
}
```

- Return plain data or `undefined`. Let the route decide the HTTP status.
- Choose explicit columns for the response. Don't leak internal fields (`passwordHash`, `r2Key` paths if a URL is meant).
- Use `db.batch([...])` when several writes must succeed together. D1 has no interactive transactions.

## 3. Route (`apps/api/src/routes/<area>.ts`)

```ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { productListQuerySchema } from "@novap/shared";
import type { AppEnv } from "../index";
import { getDb } from "../db/client";
import { getProductBySlug, listProducts } from "../services/catalog";

export const productsRoute = new Hono<AppEnv>()
  .get("/", async (c) => {
    const query = productListQuerySchema.parse(c.req.query());
    return c.json(await listProducts(getDb(c.env.DB), query));
  })
  .get("/:slug", async (c) => {
    const product = await getProductBySlug(getDb(c.env.DB), c.req.param("slug"));
    if (!product) throw new HTTPException(404, { message: "Product not found" });
    return c.json(product);
  });
```

- **Errors: throw, never return.** Use `throw new HTTPException(status, { message })`, and never
  `return c.json({ error }, 4xx)`. Only `middleware/error.ts` and `app.notFound` produce
  `{ error, issues? }`, which keeps the shape consistent and the logic in one place (see "Error responses" in CLAUDE.md).
- Validate with `schema.parse()`. The global handler turns `ZodError` into a 400.
- Body: `schema.parse(await c.req.json())`. Invalid JSON throws too; the handler returns 500 for that, so wrap it:
  `await c.req.json().catch(() => { throw new HTTPException(400, { message: "Invalid JSON" }) })`.
- Status codes: 200 read, 201 create, 204 delete, 400 bad input, 401 not logged in, 403 not allowed, 404 missing, 409 conflict.
- List responses use the shape `{ items, page, limit, total }`.
- Add a one-line comment above each handler: `// GET /api/products — ...`.

## 4. Mount (`apps/api/src/index.ts`)

`app.route("/api/products", productsRoute);`. Keep mounts grouped and ordered.

## 5. Docs

Add the endpoint to [docs/api.md](../../../docs/api.md): method, path, auth, query/body, response example, errors.

## 6. Verify

Run the `verify-api` skill: typecheck, then curl the happy path, a 404 and a 400.
