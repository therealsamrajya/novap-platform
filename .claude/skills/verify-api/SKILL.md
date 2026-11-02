---
name: verify-api
description: Verify NŌVAP API changes actually work. Use after editing apps/api or packages/shared, before saying a task is done or opening a PR. Runs typecheck, resets the local D1 database, starts the Worker with wrangler dev and smoke-tests endpoints with curl.
---

# Verify the API

## 1. Typecheck (always)

```sh
pnpm typecheck
```

Fix every error. Don't silence them with `any` or `@ts-ignore`.

## 2. Fresh local data (if the schema or seed changed, or the data looks stale)

```sh
pnpm --filter @novap/api db:reset:local
```

## 3. Run the Worker

Start it in the background with the Bash tool (`run_in_background: true`):

```sh
pnpm dev:api
```

Wait until it answers:

```sh
curl -s http://localhost:8787/api/health
```

Expect `"status":"ok","db":true,"storage":true`. Also open http://localhost:8787/api/docs: new endpoints must appear there. If port 8787 is busy, an earlier dev server is
still running. Reuse it, or stop that one task.

## 4. Smoke test

For each new or changed endpoint, cover at least these cases:

- happy path: correct status and body shape
- not found: 404 with `{ "error": ... }`
- bad input: 400 with `issues`
- every error response is `{ "error": string }`, plus `issues` only on 400s. No other shape.
- edge: empty result, last page, inactive product hidden, out-of-stock variant

```sh
curl -s "http://localhost:8787/api/products?page=1&limit=2"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/api/products/nope
curl -s -X POST http://localhost:8787/api/contact \
  -H "Content-Type: application/json" -d '{"email":"bad"}'
```

Check the results against `seed.sql` (known products, prices, stock). Don't just check that it returns 200.

## 5. Clean up and report

- Stop the background dev server when you're done.
- Report what you ran and the real results. Say plainly if something failed or was skipped.
- Put the useful curl commands into the PR's "How to test" section.
