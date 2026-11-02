# API reference

**Interactive docs (Swagger UI): http://localhost:8787/api/docs** (run `pnpm dev:api` first)

Every endpoint, parameter, response schema and example is listed there, with "Try it out" buttons.
The raw OpenAPI 3.1 spec is at `/api/openapi.json`. You can import it into Postman or Insomnia, or generate a typed client from it.
Both are generated from the zod schemas the API validates with, so they always match the code.
Both are disabled when `APP_ENV=production`.

For TypeScript frontends in this repo, import the types directly from `@novap/shared`
(`ProductSummary`, `ProductDetail`, `Category`, `Paginated<T>`, `ApiError`, ...).

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
| 401 | Not logged in (phase 4+) |
| 403 | Logged in but not allowed (phase 4+) |
| 404 | Resource or route not found |
| 409 | Conflict, e.g. duplicate email |
| 500 | Server error. Details are logged, never returned |

### Pagination

List endpoints accept `page` (default 1) and `limit` (default 12, max 48), and return:

```json
{ "items": [], "page": 1, "limit": 12, "total": 0 }
```

Query params that are empty (`?q=`) count as not set.

### Auth

From phase 4, auth uses a session cookie. Send requests with `credentials: "include"`.
