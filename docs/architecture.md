# Architecture

## Overview

```
 shop           ─┐                     ┌─ D1  (SQLite: catalog, users, orders)
                 ├─ HTTPS ─► API Worker┤
admin           ─┘   (CORS + cookie)   ├─ R2  (product images)
                                       ├─ Stripe (Checkout + webhook)
                                       └─ Resend (emails)
```

That is local dev: three origins, the browser calls the API directly. In production the shop and admin are Workers
too, serving their built files and forwarding `/api/*` to the API through a service binding, so each browser talks
to one origin and the API has no public URL. See [deploy.md](deploy.md).

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
  → requestLogger (X-Request-Id, one log line per request), secureHeaders, CORS (index.ts)
  → csrf (blocks cross-site form posts), rateLimit on abusable endpoints, loadSession (sets c.var.user from the cookie, or null)
  → requireAdmin on /api/admin/*
  → route  (routes/*.ts, routes/admin/*.ts)  parse + validate input with @novap/shared schemas
  → service (services/*.ts)  Drizzle queries, business rules
  → JSON response
errors anywhere → middleware/error.ts → { error, issues? }
```

The Stripe webhook (`POST /api/stripe/webhook`) goes through the same chain but uses no cookie: Stripe's servers
call it, and the `Stripe-Signature` header is its only authentication. `csrf()` lets it through because it only
checks form content types, and Stripe sends JSON.

Besides HTTP, the Worker has a cron trigger every 15 minutes (`src/scheduled.ts`, the `scheduled` export in
`index.ts`). It skips the Hono chain and calls services directly: reconcile stale pending orders with Stripe, then
delete expired sessions and email tokens.

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
- **products** 1─* **product_images** (R2 keys, ordered). Optional `variant_id`: the image belongs to that variant (colour, flavour); null = shared
- **users** 1─* **sessions**, **password_reset_tokens**, **email_verification_tokens**, **addresses**, **orders**
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

## Emails

Sent through [Resend](https://resend.com)'s HTTP API with plain `fetch` (`lib/email.ts`, `getMailer(env)`).
Templates are functions in `src/emails/` that return `{ to, subject, text, html }`. Every email has a plain-text and an
HTML version, and user text is escaped with `escapeHtml`. `services/notifications.ts` loads the data and sends.

| Email | Trigger | To |
|---|---|---|
| Order confirmation | Webhook moves an order `pending` → `paid` | Order email |
| Contact notification | Contact form message saved (not for honeypot hits) | `ADMIN_NOTIFY_EMAIL`, Reply-To the sender |
| Password reset | `POST /api/auth/password/forgot` for an existing account | Account email |
| Email confirmation | Register, or `POST /api/auth/verify-email/resend` | Account email |

- **After the response.** Routes hand the send to `c.executionCtx.waitUntil(...)`. The request doesn't wait for Resend,
  and a failed email can't fail it. That matters most for the webhook: a 500 there would make Stripe retry an event
  that already succeeded.
- **Exactly once per order.** `handleStripeEvent` returns `paidOrderId` only when its conditional update actually
  changed the order, so duplicate or replayed events send nothing.
- **Failures are logged, not retried.** The order or message is already saved. A queue with retries can come later.
- **Local dev:** with `RESEND_API_KEY` empty, emails are printed to the `pnpm dev:api` console instead of sent.
  In production a missing key throws (and is logged), so customer emails aren't dropped silently.

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
| Stale pending orders reconciled with Stripe every 15 minutes (cron trigger, `services/maintenance.ts`) | If the `expired` (or `completed`) webhook is missed, the order would hold stock forever. The job asks Stripe what happened instead of assuming expiry: a paid session is marked paid (with its confirmation email), an expired one cancelled. Cancelling blindly could release stock that was actually sold |
| Rate limits with Cloudflare's rate limiting binding, per IP and endpoint | No extra storage or table. It's approximate (per location, eventually consistent), which is enough to slow password guessing and email spam. 10/min for login, register and checkout; 5/min where each request sends an email |
| Request logs are JSON objects with a request id, no bodies or emails | Workers Logs indexes the fields (filter by status, path, userId). The id is returned in `X-Request-Id`, so a user's report finds the log line. Leaving out bodies keeps passwords and personal data out of logs |
| Checkout is AUD only (`adaptive_pricing` off) | Stripe would otherwise offer overseas buyers their own currency, with converted amounts that don't match the GST-inclusive AUD receipts |
| Production: shop and admin Workers forward `/api/*` to the API over a service binding; the API has no public URL | Each browser talks to one origin, so the `SameSite=Lax` cookie, `csrf()` and image headers work even on `*.workers.dev` (separate sites per subdomain) and keep working unchanged once a domain is added. The shop's forwarder refuses `/api/admin/*`, so admin endpoints are only reachable through the admin's address |
| Admins can only ship orders (`paid` → `fulfilled` + tracking number) | Payment, cancellation and refunds must match what Stripe did, so only the webhook changes them. A refund made in the Stripe dashboard reaches the order through `charge.refunded` |
| Resend over plain `fetch`, no SDK | One endpoint is all the API needs. Nothing extra to bundle into the Worker |
| Password reset tokens: random, stored as sha256, 1 hour, single use, newest only | Same scheme as sessions, so a leaked table can't reset anyone. The token is claimed with one conditional update, so two requests with the same link can't both succeed |
| Guest orders join the account history only after the email is confirmed | Matching by email alone would let anyone register with someone else's address and read their orders and shipping address. Orders placed while logged in show without confirmation |
| Product images send `Cross-Origin-Resource-Policy: same-site`; everything else keeps `same-origin` | `secureHeaders()` defaults to `same-origin`, which blocks the shop and admin (other origins on the same site) from showing images in `<img>`. `same-site` still keeps other websites from embedding them |
| Frontends are React + Vite SPAs calling the API with `fetch(..., { credentials: "include" })` | Static files deploy anywhere and talk to the one API. The admin needs no SEO. Forms validate with the same `@novap/shared` schemas the API uses, and server errors come back in the same `{ error, issues }` shape, so both map onto the same fields |
| Shop cart in `localStorage`, holding only variant ids, quantities and the product slug | No account or server state is needed to shop. Names, prices and availability are read fresh from the API on the cart page, so a stale cart can't show an old price, and checkout re-reads prices anyway |
| The cart is cleared on the checkout success page, not when checkout starts | Stripe only redirects to the success page after payment. Cancelling on Stripe brings the buyer back to a full cart |
| Unconfirmed accounts can still log in and buy | Confirmation only guards access to guest orders. Blocking login would cost sales for no security gain |
| A password reset also confirms the email | The reset link reached the inbox, which is the same proof a confirmation link gives |
| Order history shows only paid, fulfilled and refunded orders | Pending and cancelled orders are unfinished or expired checkouts, not purchases |
| A password reset deletes every session of the account | The usual reason to reset is a stolen password or session; the old sessions must stop working. The user logs in again |
| Forgot-password answers 202 for any email, and sends after the response | It can't be used to find out who has an account, by the answer or by its timing |
| Emails sent with `waitUntil`, failures only logged | Saving the order or message is what matters. An email outage must not turn a paid webhook into a 500 that Stripe retries |
| Admin order list hides `pending` by default | Pending orders are mostly abandoned checkouts. Hiding them keeps the orders that need shipping on top; `?status=pending` still shows them |
