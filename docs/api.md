# API reference

**Interactive docs (Swagger UI): http://localhost:8787/api/docs** (run `pnpm dev:api` first)

Every endpoint, parameter, response schema and example is listed there, with "Try it out" buttons.
The raw OpenAPI 3.1 spec is at `/api/openapi.json`. You can import it into Postman or Insomnia, or generate a typed client from it.
Both are generated from the zod schemas the API validates with, so they always match the code.
Both are disabled when `APP_ENV=production`.

For TypeScript frontends in this repo, import the types directly from `@novap/shared`
(`ProductSummary`, `ProductDetail`, `Category`, `User`, `Paginated<T>`, `ApiError`, ...).

This file covers only the conventions shared by every endpoint.

## Conventions

- **JSON** everywhere. Base URL locally: `http://localhost:8787`.
- **Money**: integer cents, AUD, GST-inclusive. `5495` = $54.95. Format with `formatAud` from `@novap/shared`.
- **Timestamps**: ISO 8601 strings.
- **Images**: `url` values are paths on the API (`/api/images/...`); prefix them with the API base URL.
- **Visibility**: the public catalog only shows active products that have at least one active variant.

### Errors

Every non-2xx response has the same shape. The message is always in `error`.
`issues` appears only on validation errors (400). Frontends read `body.error`.

```json
{ "error": "Product not found" }
{ "error": "Invalid input", "issues": [{ "path": ["limit"], "message": "Too big: expected number to be <=48", "code": "too_big" }] }
```

| Status | Meaning |
|---|---|
| 400 | Input failed validation (`issues` lists the problems) |
| 401 | Not logged in, session expired, or wrong email/password on login |
| 403 | Logged in but not allowed (e.g. not an admin), or a cross-site form post blocked by CSRF protection |
| 404 | Resource or route not found |
| 409 | Conflict, e.g. duplicate email, slug or SKU |
| 413 | Upload too large (images: max 5 MB) |
| 415 | Wrong `Content-Type` (e.g. a JSON route sent a form) |
| 500 | Server error. Details are logged, never returned |

### Pagination

List endpoints accept `page` (default 1) and `limit` (default 12, max 48), and return:

```json
{ "items": [], "page": 1, "limit": 12, "total": 0 }
```

Query params that are empty (`?q=`) count as not set.

### Auth

Auth uses a session cookie, `novap_session` (httpOnly, `SameSite=Lax`, `Secure` outside development).
Frontends never read or store a token: the browser sends the cookie when requests use `credentials: "include"`.

```ts
await fetch(`${API}/api/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const me = await fetch(`${API}/api/auth/me`, { credentials: "include" }); // 200 User, or 401
```

- `POST /api/auth/register` creates a **customer** and logs in (201). 409 if the email exists.
- `POST /api/auth/login` returns the `User` (200). Wrong email and wrong password give the same 401.
- `POST /api/auth/logout` returns 204, even when not logged in.
- `GET /api/auth/me` returns the `User`, or 401. Use it on app load to check whether someone is logged in.
- Emails are trimmed and lowercased. Passwords: 10–128 characters.
- Sessions last **30 days** for customers and **12 hours** for admins. Both renew while in use, so only idle sessions expire.
- Everything under `/api/admin/*` requires an admin: 401 if not logged in, 403 if not an admin.
- Nobody becomes admin through the API. Locally the seed has `admin@novap.local` / `novap-admin-dev`.
  In production, register normally, then run
  `wrangler d1 execute novap-db --remote --command "UPDATE users SET role='admin' WHERE email='you@example.com'"`.

Testing with curl: keep the cookie in a jar with `-c jar` (save) and `-b jar` (send). A POST with no
body (logout) also needs `-H "Origin: http://localhost:5173"`; browsers send that header on their own.

### Admin

All admin routes live under `/api/admin/*` and are grouped in Swagger as **Admin · Categories / Products /
Variants / Images / Contact inbox**.

- Resources are addressed by numeric `id` (`/api/admin/products/2`), not by slug.
- **Strict input**: create and update bodies reject unknown keys with a 400 (`Unrecognized key: "productCount"`),
  so typos and read-only fields fail loudly instead of being ignored.
- **PATCH** changes only the fields sent. An empty body is a 400.
- **Slugs**: optional on create. Left out, they are made from the name with `slugify()` from `@novap/shared`
  (`"Café Noir"` → `cafe-noir`). A taken slug is a 409; renaming never changes the slug.
- **Delete** is permanent. Past orders keep their own copy of name, SKU and price. To hide something instead,
  set `active: false` (products, variants) or `status: "archived"` (contact messages).
- **Images**: `POST /api/admin/products/{id}/images` as `multipart/form-data` with `file` and optional `alt`.
  JPEG, PNG, WebP or AVIF (checked from the file's bytes), max 5 MB, max 20 per product.
- Body-less requests (DELETE) and uploads from curl need `-H "Origin: http://localhost:5174"`; browsers send it.
