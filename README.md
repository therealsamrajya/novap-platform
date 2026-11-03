# NŌVAP Platform

E-commerce platform on Cloudflare (Workers, D1, R2) with Stripe Checkout.
The old static site (`novap-website-v6-3d-vials`) is used as a UI reference only.

## Structure

```
apps/
  api/        Cloudflare Worker — Hono API, D1 database, R2 images, Stripe
  shop/       customer storefront            (phase 8)
  admin/      admin dashboard (React + Vite)
packages/
  shared/     zod schemas + types shared by all apps
```

## Requirements

- Node 20+ and pnpm (`npm i -g pnpm`)
- A Cloudflare account is only needed to deploy; local dev runs fully offline.

## Getting started

```sh
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm dev:api          # http://localhost:8787/api/health
pnpm dev:admin        # http://localhost:5174 (log in as admin@novap.local / novap-admin-dev)
```

Checkout also needs a Stripe test-mode key and the [Stripe CLI](https://docs.stripe.com/stripe-cli) for webhooks.
See [docs/api.md](docs/api.md#checkout).

## Useful commands

| Command | What it does |
|---|---|
| `pnpm dev:api` | Run the API locally (D1 + R2 simulated in `apps/api/.wrangler/`). Swagger UI: http://localhost:8787/api/docs |
| `pnpm dev:admin` | Run the admin dashboard at http://localhost:5174 (needs `pnpm dev:api` running) |
| `pnpm typecheck` | Type-check every package |
| `pnpm --filter @novap/api types` | Regenerate `Env` types after editing `wrangler.jsonc` |
| `pnpm --filter @novap/api db:generate` | Create a new SQL migration after editing `src/db/schema.ts` |
| `pnpm --filter @novap/api db:migrate:local` | Apply migrations to the local database |
| `pnpm --filter @novap/api db:reset:local` | Wipe local DB, migrate, load `seed.sql` sample data. Stop `pnpm dev:api` first |

## Database workflow

1. Edit tables in `apps/api/src/db/schema.ts`
2. `db:generate` writes a new SQL file to `src/db/migrations/` (commit it)
3. `db:migrate:local` applies it locally; `db:migrate:remote` applies it in production

Never edit an old migration file — always generate a new one.

## Conventions

- Money is integer cents in AUD. Prices are GST-inclusive (Australian retail standard).
- Never trust client prices — checkout looks up prices from the database.
- Auth uses session cookies (httpOnly), stored in D1.
- Orders are recorded for guests and registered users in one table; guests have no `user_id`.
- Only the Stripe webhook marks an order as paid. Stock is held from checkout until payment or session expiry.
- Branching, commits and PRs: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

- [docs/architecture.md](docs/architecture.md) — layers, request flow, data model, key decisions
- [docs/diagrams.md](docs/diagrams.md) — ER diagram, domain class diagram, API layer diagram (Mermaid)
- [docs/api.md](docs/api.md) — API conventions; full interactive reference at http://localhost:8787/api/docs (Swagger UI)
- [CLAUDE.md](CLAUDE.md) + `.claude/skills/` — instructions for Claude Code

## Roadmap

1. [x] Scaffold — monorepo, Worker, D1 + R2 bindings, shared package
2. [x] Database — Drizzle schema, migrations, seed data
3. [x] Public API — products, categories, filters, pagination, contact form
4. [x] Auth — register, login, sessions, admin role
5. [x] Admin API — product/variant/category CRUD, image upload to R2, contact inbox
6. [x] Checkout — Stripe Checkout, webhook, stock, guest + user orders
7. [x] Emails + account — confirmations, password reset, order history, contact notifications
8. [ ] Frontends — admin dashboard, storefront
9. [ ] Hardening + deploy — rate limits, logging, environments, domain
