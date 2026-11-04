# Deploying to Cloudflare

Production is three Workers on one Cloudflare account:

```
browser ──► novap-shop   (dist/ assets + worker/index.ts) ──┐ service binding
browser ──► novap-admin  (dist/ assets + worker/index.ts) ──┤ (/api/* only)
Stripe  ──► novap-shop/api/stripe/webhook ──────────────────┤
                                                            ▼
                                     novap-api (env.production, no public URL)
                                       ├─ D1  novap-db-production
                                       ├─ R2  novap-images-production
                                       └─ cron every 15 min (src/scheduled.ts)
```

The shop and admin forward `/api/*` to the API, so each browser only talks to one origin. That is why login
cookies, CSRF checks and images work on `*.workers.dev` addresses, which browsers treat as separate sites.
The shop's forwarder refuses `/api/admin/*`; admin endpoints are only reachable through the admin's address.

Run every command from the repo root unless it says otherwise. `wrangler` below means
`pnpm --filter @novap/api exec wrangler` (or run it inside `apps/api`).

## First deploy

0. **Account prerequisites** (Cloudflare dashboard, once per account):
   - **R2 → Enable R2**. It needs a card or PayPal on file even on the free tier (10 GB free).
   - Open **Workers & Pages** once. That creates the account's `workers.dev` subdomain; without it, cron
     triggers and `workers.dev` URLs fail to deploy. A new subdomain's TLS certificate can take a few minutes,
     so the first requests may fail with a TLS handshake error.
1. **Log in**: `wrangler login` (opens the browser; if it doesn't, open the printed link yourself).
2. **Create the database and bucket** (inside `apps/api`):
   ```sh
   wrangler d1 create novap-db-production        # copy the printed database_id
   wrangler r2 bucket create novap-images-production
   ```
   Put the `database_id` into `env.production.d1_databases` in `apps/api/wrangler.jsonc`.
3. **Run the migrations**: `pnpm --filter @novap/api db:migrate:remote`. Production gets no seed data.
4. **Deploy the API with its secrets.** A new Worker can't be created without its required secrets, and
   `wrangler secret put` only works once it exists, so the first deploy reads them from a file. Create
   `apps/api/.prod.secrets` (gitignored) with:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_placeholder
   RESEND_API_KEY=re_...
   ```
   Keep the Stripe **test** key until the shop is ready to take real payments. Then, inside `apps/api`:
   ```sh
   wrangler deploy --env production --secrets-file .prod.secrets
   ```
   and delete the file. Later deploys keep the secrets; change one with
   `wrangler secret put <NAME> --env production` (it prompts for the value, so it never lands in shell history).
5. **Deploy the shop and admin** (they bind to the API, so after it):
   ```sh
   pnpm --filter @novap/shop run deploy      # prints https://novap-shop.<subdomain>.workers.dev
   pnpm --filter @novap/admin run deploy     # prints https://novap-admin.<subdomain>.workers.dev
   ```
6. **Set the URLs**: put the two printed URLs into `SHOP_URL` and `ADMIN_URL` under `env.production.vars`, set
   `ADMIN_NOTIFY_EMAIL`, then run `pnpm --filter @novap/api types` and `pnpm --filter @novap/api run deploy`.
7. **Stripe webhook**: in the Stripe dashboard (same mode as the key), go to Developers → Webhooks and add an
   endpoint `https://novap-shop.<subdomain>.workers.dev/api/stripe/webhook` with the events
   `checkout.session.completed`, `checkout.session.expired` and `charge.refunded`. Copy its signing secret:
   ```sh
   wrangler secret put STRIPE_WEBHOOK_SECRET --env production
   ```
8. **First admin**: register in the shop, then promote the account (no API route can grant the role):
   ```sh
   wrangler d1 execute novap-db-production --remote --env production \
     --command "UPDATE users SET role = 'admin' WHERE email = 'you@example.com'"
   ```
   Log out and in again on the admin site (an existing session keeps the customer lifetime).
9. **Check**: `https://novap-shop.<subdomain>.workers.dev/api/health` answers `{"status":"ok",...}`.
   Add a category, a product, a variant and an image in the admin, then buy it with card `4242 4242 4242 4242`.

## Later deploys

```sh
pnpm --filter @novap/api db:migrate:remote   # only when there are new migrations; before the deploy
pnpm --filter @novap/api run deploy
pnpm --filter @novap/shop run deploy
pnpm --filter @novap/admin run deploy
```

Logs: Cloudflare dashboard → Workers & Pages → `novap-api` → Logs. Every API response has an `X-Request-Id`;
search the logs for it. Live tail: `wrangler tail --env production` (inside `apps/api`).

## Limits until there is a domain

- **Email**: with `onboarding@resend.dev` as sender, Resend only delivers to the Resend account owner's address.
  Customers get no confirmations, resets or verification links until a domain is verified in Resend and
  `EMAIL_FROM` uses it.
- **Two logins**: the shop and admin are different sites, so an admin logs in separately on each.

## Adding the domain later

1. Add the domain to Cloudflare (or buy it with Cloudflare Registrar).
2. Give the shop and admin Workers custom domains, e.g. `example.com` and `admin.example.com`
   (`"routes": [{ "pattern": "example.com", "custom_domain": true }]` in their `wrangler.jsonc`).
   The `/api` forwarding stays as it is; the API still needs no public URL.
3. Update `SHOP_URL`, `ADMIN_URL` and the Stripe webhook URL; deploy the API.
4. Verify the domain in Resend and set `EMAIL_FROM` to an address on it, e.g. `NŌVAP <shop@example.com>`.

## Going live with real payments

Only after the store's products, terms, privacy policy and any legal requirements for what it sells have been
checked. Then: switch `STRIPE_SECRET_KEY` to `sk_live_...`, create the webhook endpoint again in live mode and
put its signing secret, and run one small real purchase and refund.
