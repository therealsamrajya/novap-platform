# Architecture

## Overview

```
 shop (phase 8) ─┐                     ┌─ D1  (SQLite: catalog, users, orders)
                 ├─ HTTPS ─► API Worker┤
admin (phase 8) ─┘   (CORS + cookie)   ├─ R2  (product images)
                                       └─ Stripe (Checkout + webhook, phase 6)
```

- **API**: a single Cloudflare Worker (`apps/api`) built with [Hono](https://hono.dev). All routes live under `/api/*`.
- **Database**: Cloudflare D1, accessed through [Drizzle ORM](https://orm.drizzle.team). The schema is in `apps/api/src/db/schema.ts`.
- **Images**: Cloudflare R2. The database stores only the R2 key (`product_images.r2_key`).
- **Shared package**: `@novap/shared` holds the zod schemas and types. The API validates with them, and the frontends use the same schemas for forms. This gives one source of truth.

Local dev (`wrangler dev`) simulates D1 and R2 in `apps/api/.wrangler/`. No Cloudflare account is needed.

## Request flow

```
request
  → secureHeaders, CORS (index.ts)
  → [auth middleware — phase 4]
  → route  (routes/*.ts)     parse + validate input with @novap/shared schemas
  → service (services/*.ts)  Drizzle queries, business rules
  → JSON response
errors anywhere → middleware/error.ts → { error, issues? }
```

### Layers

| Layer | Folder | Knows about Hono? | Job |
|---|---|---|---|
| Route | `src/routes/` | yes | HTTP: parse input, choose status code, return JSON |
| Service | `src/services/` | no | Data access and business logic. Takes `db: Db` |
| Lib | `src/lib/` | no | Small pure helpers |
| Schema | `packages/shared` | no | Input validation and shared types |

Services stay free of Hono, so later phases (webhooks, admin) can reuse them, and they can be unit-tested without HTTP.

## Data model (summary)

- **categories** 1─* **products** 1─* **variants** (what is bought: price, stock, SKU)
- **products** 1─* **product_images** (R2 keys, ordered)
- **users** 1─* **sessions**, **addresses**, **orders**
- **orders** 1─* **order_items**. Each item stores a snapshot of name, label, SKU and unit price at purchase time.
- **stripe_events**: processed webhook ids, kept for idempotency
- **contact_messages**: contact form inbox (`new | read | archived`)

The full definitions, with comments, are in `apps/api/src/db/schema.ts`.

## Key decisions

| Decision | Why |
|---|---|
| Money stored as integer cents in AUD, GST-inclusive | No floating-point errors. Australian retail shows prices with GST included |
| Prices never taken from the client | The client can tamper with them. Checkout reads prices from D1 |
| Only the Stripe webhook marks an order paid | The redirect back from Stripe can be faked; the signed webhook can't |
| Session cookie (httpOnly) whose SHA-256 hash is stored in D1 | Can be revoked. A leaked database row can't be used as a session |
| Guest and user orders in one table | The only difference is whether `user_id` is null |
| Order items snapshot the product data | Order history stays correct after a product is edited or deleted |
| D1 `batch()` instead of transactions | D1 has no interactive transactions; a batch is atomic |
| Product search uses `LIKE`, not FTS5 | The catalog is small, so a full scan is cheap. It stays in Drizzle with no hand-written SQL. Search lives in one service function, so it can switch to FTS5 later without changing the API |
