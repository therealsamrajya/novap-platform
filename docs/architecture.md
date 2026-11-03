# Architecture

## Overview

```
 shop (phase 8) ─┐                     ┌─ D1  (SQLite: catalog, users, orders)
                 ├─ HTTPS ─► API Worker┤
admin (phase 8) ─┘   (CORS + cookie)   ├─ R2  (product images)
                                       └─ Stripe (Checkout + webhook)
```

- **API**: a single Cloudflare Worker (`apps/api`) built with [Hono](https://hono.dev). All routes live under `/api/*`.
- **Database**: Cloudflare D1, accessed through [Drizzle ORM](https://orm.drizzle.team). The schema is in `apps/api/src/db/schema.ts`.
- **Images**: Cloudflare R2. The database stores only the R2 key (`product_images.r2_key`).
- **Payments**: Stripe Checkout (hosted payment page). Stripe tells the API about payments through a signed webhook.
- **Shared package**: `@novap/shared` holds the zod schemas and types. The API validates with them, and the frontends use the same schemas for forms. This gives one source of truth.

Local dev (`wrangler dev`) simulates D1 and R2 in `apps/api/.wrangler/`. No Cloudflare account is needed.
Checkout needs a Stripe test-mode key and the Stripe CLI to forward webhooks (see [api.md](api.md#checkout)).

## Request flow

```
request
  → secureHeaders, CORS (index.ts)
  → csrf (blocks cross-site form posts), loadSession (sets c.var.user from the cookie, or null)
  → requireAdmin on /api/admin/*
  → route  (routes/*.ts, routes/admin/*.ts)  parse + validate input with @novap/shared schemas
  → service (services/*.ts)  Drizzle queries, business rules
  → JSON response
errors anywhere → middleware/error.ts → { error, issues? }
```

The Stripe webhook (`POST /api/stripe/webhook`) goes through the same chain but uses no cookie: Stripe's servers
call it, and the `Stripe-Signature` header is its only authentication. `csrf()` lets it through because it only
checks form content types, and Stripe sends JSON.

### Layers

| Layer | Folder | Knows about Hono? | Job |
|---|---|---|---|
| Route | `src/routes/` | yes | HTTP: parse input, choose status code, return JSON |
| Service | `src/services/` | no | Data access and business logic. Takes `db: Db` |
| Lib | `src/lib/` | no | Small pure helpers |
| Schema | `packages/shared` | no | Input validation and shared types |

Services stay free of Hono, so other routes can reuse them (the Stripe webhook reuses `cancelPendingOrder` from the checkout service), and they can be unit-tested without HTTP.

## Data model (summary)

- **categories** 1─* **products** 1─* **variants** (what is bought: price, stock, SKU)
- **products** 1─* **product_images** (R2 keys, ordered)
- **users** 1─* **sessions**, **addresses**, **orders**
- **orders** 1─* **order_items**. Each item stores a snapshot of name, label, SKU and unit price at purchase time.
- **stripe_events**: processed webhook ids, kept for idempotency
- **contact_messages**: contact form inbox (`new | read | archived`)

The full definitions, with comments, are in `apps/api/src/db/schema.ts`. For ER and class diagrams, see [diagrams.md](diagrams.md).

## Checkout flow

```
shop                     API                                   D1 / Stripe
 │ POST /api/checkout ──► read prices + stock                   D1
 │                        reserve stock (conditional decrement) D1
 │                        insert order "pending" + item snapshot D1
 │                        create Checkout Session (31 min) ───► Stripe
 │ ◄── { checkoutUrl } ──
 │ redirect ─────────────────────────────────────────────────► Stripe page (address, card)
 │                                                             │
 │                        POST /api/stripe/webhook ◄──────────┘ signed event
 │                          completed → order "paid", address saved
 │                          expired   → order "cancelled", stock put back
 │                          refunded  → order "refunded"
 │ ◄─ redirect to SHOP_URL/checkout/success?session_id=…
 │ GET /api/checkout/sessions/{id} → status (poll until "paid")
```

Code: `services/checkout.ts` (steps up to the session, plus `cancelPendingOrder`), `services/stripe-webhook.ts`
(event handlers), `routes/checkout.ts`, `routes/stripe.ts`, `lib/stripe.ts`.

- **Stock is reserved before payment.** Each line is a single `UPDATE … SET stock = stock - q WHERE id = ? AND stock >= q`,
  all in one batch. If any line didn't match, someone else took the stock first: the lines that did match are put back
  and the request gets a 409.
- **Every undo goes through `cancelPendingOrder`.** In one atomic batch it puts the items back in stock and sets the order
  to `cancelled`, but only while the order is still `pending`. A repeated webhook can't put stock back twice.
- **If a step fails part way**, earlier steps are undone: a failed order insert puts the stock back, and a failed Stripe call
  cancels the order.
- **Webhook idempotency**: an event already in `stripe_events` is skipped. Events are recorded only *after* they are
  handled, so a failed attempt (500) is retried by Stripe rather than lost. Each handler also checks the order's current
  status before changing it, so an event that gets past the check twice (two deliveries at the same moment) does no harm.

## Key decisions

| Decision | Why |
|---|---|
| Money stored as integer cents in AUD, GST-inclusive | No floating-point errors. Australian retail shows prices with GST included |
| Prices never taken from the client | The client can tamper with them. Checkout reads prices from D1 |
| Only the Stripe webhook marks an order paid | The redirect back from Stripe can be faked; the signed webhook can't |
| Session cookie (httpOnly) whose SHA-256 hash is stored in D1 | Can be revoked. A leaked database row can't be used as a session |
| Sessions slide: 30 days for customers, 12 hours for admins | An admin cookie can change the whole shop, so it expires sooner. The expiry renews only after half the lifetime has passed, so most requests don't write to D1 |
| Passwords hashed with PBKDF2-SHA256 (100k iterations, WebCrypto) | Built into Workers, so no WASM dependency. 100k is the Workers maximum. The hash string stores its own iteration count, so the cost can be raised later |
| `SameSite=Lax` cookie plus Hono `csrf()` origin check | Shop, admin and API share one site, so Lax lets the cookie through while blocking cross-site POSTs. `csrf()` also rejects form posts from other subdomains |
| No API route grants the admin role | Admins are promoted with a SQL update, so a bug in a public endpoint can't create one |
| Guest and user orders in one table | The only difference is whether `user_id` is null |
| Order items snapshot the product data | Order history stays correct after a product is edited or deleted |
| D1 `batch()` instead of transactions | D1 has no interactive transactions; a batch is atomic |
| Images served by the Worker at `/api/images/<key>`, cached forever | No public bucket is needed yet. Every upload gets a new key (`products/<id>/<uuid>.<ext>`), never overwriting one, so the forever-cache is safe. Phase 9 may move images to an R2 custom domain |
| Upload type read from the file's bytes; JPEG/PNG/WebP/AVIF only, no SVG | The browser's Content-Type is only a claim. SVG can carry scripts, so serving uploaded SVGs would be an XSS risk |
| On delete, the D1 row goes first, the R2 file second | If R2 fails, the worst case is an unused file, never a product pointing at a missing image |
| Admin input is strict (unknown keys are a 400) | A typo or a read-only field like `productCount` fails loudly instead of being silently dropped |
| Slugs generated from the name when left out; a taken slug is a 409, never a `-2` suffix | Less typing for admins. A second product with the same name is usually a mistake, and a silent suffix would hide it. Renames keep the slug, so shop URLs stay stable |
| Admin deletes are permanent; `active: false` / `archived` hide instead | Order items snapshot the product data, so deleting can't break order history |
| Public catalog hides products with no active variant | A product without a buyable variant can't be sold, so the list, the detail page and category counts all agree |
| API docs generated from code: OpenAPI (`@hono/zod-openapi`) and Swagger UI at `/api/docs` | The zod schemas that validate requests also produce the docs, so the docs can't drift from the code. Shared schemas stay plain zod (`.meta()`), so the frontends don't depend on Hono |
| Product search uses `LIKE`, not FTS5 | The catalog is small, so a full scan is cheap. It stays in Drizzle with no hand-written SQL. Search lives in one service function, so it can switch to FTS5 later without changing the API |
| Stock reserved when checkout starts, released when the Stripe session expires | Stock is small, so overselling the last unit is a real risk. The cost: an abandoned checkout holds stock for about 30 minutes |
| Stripe Checkout (hosted page), not Stripe Elements | Card data never touches our code. Stripe also collects the address and phone, so the API has no address form to validate |
| Cards only (`allowed_payment_method_types: ["card"]`) | Cards settle at once, so `checkout.session.completed` always means paid. Delayed methods (e.g. BECS direct debit) would need the `async_payment_*` events |
| Prices sent to Stripe as inline `price_data`, no Stripe Products | D1 stays the only catalog. Nothing has to be kept in sync with the Stripe dashboard |
| Flat shipping rate, free from a threshold, set in `wrangler.jsonc` | Simple for a small AU-only shop. Changing it doesn't need a code change |
| GST computed as 1/11 of the total, no Stripe Tax | Prices already include GST. Stripe Tax charges per transaction for something a division does |
| Full refunds mark the order `refunded`; stock is not put back | A returned item may not be resellable. Partial refunds leave the order as it is; the details stay in Stripe |
| Checkout status endpoint returns no email or address | The session id travels in a URL (browser history, referrers), so it should only show what was bought |
| Missed `expired` webhooks leave stock held (known gap) | If the webhook is down when a session expires, the order stays `pending`. A scheduled clean-up is planned for phase 9 |
