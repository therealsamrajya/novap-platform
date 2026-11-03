# API reference

**Interactive docs (Swagger UI): http://localhost:8787/api/docs** (run `pnpm dev:api` first)

Every endpoint, parameter, response schema and example is listed there, with "Try it out" buttons.
The raw OpenAPI 3.1 spec is at `/api/openapi.json`. You can import it into Postman or Insomnia, or generate a typed client from it.
Both are generated from the zod schemas the API validates with, so they always match the code.
Both are disabled when `APP_ENV=production`.

For TypeScript frontends in this repo, import the types directly from `@novap/shared`
(`ProductSummary`, `ProductDetail`, `Category`, `User`, `CheckoutInput`, `CheckoutSessionStatus`, `Paginated<T>`, `ApiError`, ...).

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
| 409 | Conflict, e.g. duplicate email, slug or SKU, or a cart item out of stock at checkout |
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

- `POST /api/auth/register` creates a **customer**, logs in (201) and emails a confirmation link. 409 if the email exists.
- `POST /api/auth/login` returns the `User` (200). Wrong email and wrong password give the same 401.
- `POST /api/auth/logout` returns 204, even when not logged in.
- `GET /api/auth/me` returns the `User`, or 401. Use it on app load to check whether someone is logged in.
- Emails are trimmed and lowercased. Passwords: 10–128 characters.
- **Forgot password**: `POST /api/auth/password/forgot { email }` always answers 202, so it never reveals whether the
  account exists. If it does, the email links to `SHOP_URL/reset-password?token=...` (valid 1 hour, single use; a newer
  request voids the older link). The shop's reset page sends `POST /api/auth/password/reset { token, password }`:
  204 on success, 400 if the link is invalid, used or expired. A reset logs the account out everywhere, so send the user
  to the login page afterwards. The reset page should set `Referrer-Policy: no-referrer`, so the token in its URL
  isn't passed on to other sites. A reset also confirms the email (the link reached the inbox).
- **Email confirmation**: `User.emailVerified` is false after registering. The link goes to
  `SHOP_URL/verify-email?token=...` (valid 24 hours, single use). That page sends `POST /api/auth/verify-email { token }`:
  204, or 400 if the link is invalid, used or expired. It needs no login, so the link works on any device; refetch
  `/api/auth/me` afterwards if logged in. `POST /api/auth/verify-email/resend` (logged in, no body) sends a new link and
  voids the old one: 202, or 409 if already confirmed. Unconfirmed accounts can still log in and buy; only the guest
  order history (see Account) waits for confirmation.
- Sessions last **30 days** for customers and **12 hours** for admins. Both renew while in use, so only idle sessions expire.
- Everything under `/api/admin/*` requires an admin: 401 if not logged in, 403 if not an admin.
- Nobody becomes admin through the API. Locally the seed has `admin@novap.local` / `novap-admin-dev`.
  In production, register normally, then run
  `wrangler d1 execute novap-db --remote --command "UPDATE users SET role='admin' WHERE email='you@example.com'"`.

Testing with curl: keep the cookie in a jar with `-c jar` (save) and `-b jar` (send). A POST with no
body (logout, verify-email/resend) also needs `-H "Origin: http://localhost:5173"`; browsers send that header on their own.

### Account

`GET /api/account/orders` (paginated) and `GET /api/account/orders/{id}` return the logged-in customer's orders: 401
if not logged in, 404 for an order that isn't theirs. The list contains orders placed while logged in and, once the
email is confirmed, **guest orders placed with the same email**. Without the confirmation step, anyone could register
with someone else's email and read their orders and address. Only `paid`, `fulfilled` and `refunded` orders appear;
unfinished (`pending`) and expired (`cancelled`) checkouts are left out. Seed: `customer@novap.local` has orders 2, 5
and the guest order 6.

### Checkout

Payment happens on Stripe's hosted page. The shop never sees card details.

1. The shop sends the cart: `POST /api/checkout` with `{ items: [{ variantId, quantity }], email }`.
   Send only ids and quantities. The API reads prices from the database.
   - **Guests** must send `email`. **Logged-in customers** don't need to: the account email is used, and the order
     is linked to the account.
   - Each variant may appear once (merge duplicates in the cart). Max 50 lines, quantity 1–99.
   - **409** if an item is inactive, deleted or out of stock. `error` says which, e.g.
     `"Reference 01 (Small): only 3 left"`. Show it and let the buyer fix the cart.
2. The response is `201 { orderId, checkoutUrl, expiresAt }`. Redirect the browser to `checkoutUrl`.
   The stock is **held** for the order until `expiresAt` (about 30 minutes).
3. Stripe collects the shipping address (Australia only), phone and card, then redirects to
   `SHOP_URL/checkout/success?session_id=cs_...`. If the buyer cancels, it redirects to `SHOP_URL/cart`.
4. The success page calls `GET /api/checkout/sessions/{session_id}`. It returns status, totals and items,
   but no email or address. The status can still be `pending` for a few seconds, until Stripe's webhook arrives,
   so poll every 1–2 seconds until it is `paid`.

**Order status**: `pending` (waiting for payment) → `paid` → `fulfilled`, or `pending` → `cancelled` (session
expired; stock released), or `paid` → `refunded` (full refund in Stripe). Only the webhook sets `paid`,
`cancelled` and `refunded`. The redirect back from Stripe changes nothing.

**Shipping**: a flat rate, free from a threshold. Both are `wrangler.jsonc` vars (`SHIPPING_FLAT_CENTS`,
`FREE_SHIPPING_FROM_CENTS`; currently $9.95, free from $150). GST (1/11 of the total, shipping included) is stored
on the order for receipts.

**Webhook**: `POST /api/stripe/webhook` is called only by Stripe and verified with the `Stripe-Signature` header.
Locally, forward events with the [Stripe CLI](https://docs.stripe.com/stripe-cli):

```sh
stripe login
stripe listen --events checkout.session.completed,checkout.session.expired,charge.refunded \
  --forward-to localhost:8787/api/stripe/webhook
```

Put the printed `whsec_...` in `apps/api/.dev.vars` as `STRIPE_WEBHOOK_SECRET`, next to `STRIPE_SECRET_KEY`
(a test-mode `sk_test_...` key), then restart `pnpm dev:api`. Test card: `4242 4242 4242 4242`, any future date
and CVC. Declined: `4000 0000 0000 9995`.

```sh
curl -s -X POST http://localhost:8787/api/checkout -H "Content-Type: application/json" \
  -d '{"items":[{"variantId":1,"quantity":2}],"email":"guest@example.com"}'
```

### Admin

All admin routes live under `/api/admin/*` and are grouped in Swagger as **Admin · Categories / Products /
Variants / Images / Orders / Contact inbox**.

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
- **Orders**: `GET /api/admin/orders` hides `pending` (unpaid) checkouts unless you ask for `?status=pending`;
  `?status=paid` is the "to ship" list. `?q=` matches the email, or the order number (`12` or `#12`).
  The only manual change is shipping: `PATCH /api/admin/orders/{id}` with `{ "status": "fulfilled", "trackingNumber": "..." }`,
  allowed on `paid` and `fulfilled` orders (409 otherwise). Refunds are made in the Stripe dashboard; the webhook then marks
  the order `refunded`.
- Body-less requests (DELETE) and uploads from curl need `-H "Origin: http://localhost:5174"`; browsers send it.
