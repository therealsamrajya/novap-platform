# CLAUDE.md

Guide for Claude Code working in this repo. Human docs: [README.md](README.md),
[CONTRIBUTING.md](CONTRIBUTING.md), [docs/](docs/).

## What this is

NŌVAP e-commerce platform. pnpm monorepo on Cloudflare:

- `apps/api` — Cloudflare Worker, Hono 4, Drizzle ORM on D1 (SQLite), R2 for images, Stripe (phase 6)
- `packages/shared` (`@novap/shared`) — zod 4 schemas, inferred types, money helpers. Imported by api now, shop/admin later
- `apps/shop`, `apps/admin` — not created yet (phase 8)

The old static site (`novap-website-v6-3d-vials`) is a UI reference only. Never copy code from it into this repo.

Roadmap and current phase: see the checklist in [README.md](README.md#roadmap).

## Commands

Run from repo root.

```sh
pnpm typecheck                                  # must pass before any PR
pnpm dev:api                                    # http://localhost:8787, Swagger UI at /api/docs
pnpm --filter @novap/api db:generate            # after editing schema.ts
pnpm --filter @novap/api db:migrate:local
pnpm --filter @novap/api db:reset:local         # wipe + migrate + seed.sql
pnpm --filter @novap/api types                  # after editing wrangler.jsonc
```

No test runner yet. Verify by typecheck plus curl against `pnpm dev:api` (see the `verify-api` skill).

Dev machine is Windows. Bash tool is Git Bash; `curl` works there.
Running wrangler directly (e.g. `d1 execute`, `r2 object put`) from the Bash tool: `npx wrangler` hangs
and `pnpm exec wrangler` prints nothing. Use the following from `apps/api`, with `CI=true`:
`node node_modules/wrangler/bin/wrangler.js <cmd> --local`. The `pnpm --filter` scripts above work fine.

## Code layout (api)

```
apps/api/src/
  index.ts            app (OpenAPIHono), global middleware, route mounting, OpenAPI doc + Swagger UI, exports AppEnv
  routes/<name>.ts    one createRouter() per resource, routes declared with createRoute; thin: validated input -> service -> JSON
  services/<name>.ts  DB queries + business logic; take `db: Db` as first arg; no Hono imports
  lib/                small pure helpers (pagination, slugs, ...)
  middleware/         error handler; auth.ts (loadSession, requireAuth, requireAdmin, currentUser, cookie helpers)
  db/schema.ts        Drizzle tables + relations (single file)
  db/migrations/      generated SQL; never hand-edit merged ones
  db/seed.sql         local sample data
```

## Conventions (follow strictly)

- **Routes + docs**: every endpoint is declared with `createRoute` (`@hono/zod-openapi`) on a
  `createRouter()` from `lib/openapi.ts`. Input and response schemas come from `@novap/shared` (plain zod
  with `.meta()`; shared must not import Hono). This one declaration validates the request and generates
  the OpenAPI spec (`/api/openapi.json`) and Swagger UI (`/api/docs`). Never hand-write endpoint docs.
  Read input with `c.req.valid(...)`. The router hook rethrows validation errors, so they become 400s in
  `middleware/error.ts`.
- **Errors**: see "Error responses" below. Never return stack traces or DB errors.
- **DB access**: `const db = getDb(c.env.DB)` once per request (`db/client.ts`). Prefer
  `db.query.<table>.findMany({ with })` for nested reads, query builder for filters/aggregates.
- **Joins and subqueries**: every selected column name must be unique. When joined tables
  share names (`id`, `slug`, `name`), alias them with ``sql`${t.col}`.as("t_col")``. D1 merges result
  columns with the same name, so values silently shift into the wrong fields. This happens in plain
  `select().from().leftJoin()` too, not only in subqueries. See `services/catalog.ts`, `services/admin-catalog.ts`.
- **Lists**: extend `paginationQuerySchema`, return `paginated(...)` (`lib/pagination.ts`), and give the sort a stable
  tie-breaker (`id`) so pages never overlap. Text search goes through `containsText` (`lib/sql.ts`), which escapes LIKE wildcards.
- **Money**: integer cents, AUD, GST-inclusive. Never floats. Format only in frontends (`formatAud`).
- **Prices from the client are never trusted.** Checkout re-reads prices from the DB.
- **Public catalog** returns only `active` products and `active` variants.
- **Timestamps**: Drizzle `mode: "timestamp"` gives a JS `Date`, serialized as an ISO string in JSON.
- **Typing**: `new Hono<AppEnv>()` in every route file. `Env` comes from generated `worker-configuration.d.ts`.
- **Comments**: short, explain *why*. The codebase is read by someone learning the stack, so
  a one-line rationale comment on non-obvious choices is welcome.
- New env var: add to `wrangler.jsonc` `vars` (non-secret) or `.dev.vars.example` (secret), then `types`.

## Auth

- `loadSession` runs on every `/api/*` request and sets `c.var.user` (`User | null`). It never rejects.
- Need the user in a handler: `const user = currentUser(c)`. It returns the `User` or throws 401.
  Also add `security: cookieAuth` and `401: errors[401]` to the `createRoute` so Swagger shows the lock.
- Admin routes: mount them under `/api/admin/...`. `index.ts` already guards `/api/admin/*` with
  `requireAdmin` (401/403), so don't add the check per route. List `401` and `403` in each route's `responses`.
- Owner checks (e.g. "your own order") return 404, so other users' ids aren't confirmed to exist.
- Never return a raw `users` row. Map it with `toUser` (`services/auth.ts`) so `passwordHash` can't leak.
- Dev logins (seed): `admin@novap.local` / `novap-admin-dev`, `customer@novap.local` / `novap-customer-dev`.
  For curl, use a cookie jar (`-c`/`-b`). A body-less POST also needs `-H "Origin: http://localhost:5173"`.

## Error responses (strict rule)

Every non-2xx response from the API has exactly this shape, with no exceptions:

```json
{ "error": "Human-readable message", "issues": [ /* only for 400 validation errors */ ] }
```

- The message always goes in `error` (a string). Never use `message`, `msg`, `errors`, a nested
  object, plain text, or an empty body. The frontend then reads one field: `res.error`.
- `issues` appears only on validation failures (zod issues). Add no other ad-hoc fields.
- **Separation of concerns:** routes and services never build error JSON themselves. They
  `throw new HTTPException(status, { message })` or let a `ZodError` throw.
- **DRY:** only `middleware/error.ts` (`app.onError`) and `app.notFound` in `index.ts` turn errors
  into responses. Change the shape there and nowhere else. Never write `return c.json({ error: ... }, 4xx)` in a route.
- Services don't know HTTP. They return `undefined` or `null` for "not found" and the route maps it to a 404.
  For a business-rule failure (e.g. out of stock), a service may throw `HTTPException` too, so
  the rule lives in one place.
- Messages are short, safe to show the user, and don't leak internals (no SQL, no stack, no whether an email exists on login).
- 500s always use the generic `"Internal server error"`. Real details go only to `console.error`.

## Git workflow

- Branch `<type>/<description>`; roadmap phases use `feat/phase-N-<name>`. Never commit to `main`.
- Conventional Commits: `feat(api): ...`, scopes `api | shared | shop | admin | db`.
- PR uses `.github/pull_request_template.md`, squash-merged. One logical change per PR.
- Commit or push only when the user asks.

## Project skills

In `.claude/skills/`:

- `new-endpoint`: add an API route (shared schema, service, route, mount, docs)
- `db-change`: schema edit, migration, seed
- `verify-api`: typecheck, reset DB, run the Worker, curl smoke tests
- `phase-workflow`: start, track and finish a roadmap phase (branch, PR split, docs, roadmap tick)
