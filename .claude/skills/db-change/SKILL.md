---
name: db-change
description: Change the NŌVAP database schema (Drizzle + Cloudflare D1). Use when adding/altering tables, columns, indexes or relations in apps/api/src/db/schema.ts, generating migrations, or updating seed data.
---

# Database change

## Rules

- `apps/api/src/db/schema.ts` is the only source of truth. Never write migration SQL by hand.
- Never edit or delete a migration already merged to `main`. Fix forward with a new one.
- The schema change and its generated migration go in the same commit/PR, on a `db/<name>` branch
  (or inside the phase branch if the phase needs it).
- Follow the conventions in the header of schema.ts: integer ids, money in integer cents,
  `createdAt()`/`updatedAt()` helpers, `mode: "json"` for JSON, `mode: "boolean"` for flags.
- Add an `index(...)` for every foreign key and for columns used in filters.
- Add or update `relations(...)` when adding foreign keys so `db.query ... with` works.

## Steps

```sh
# 1. edit apps/api/src/db/schema.ts
pnpm --filter @novap/api db:generate        # writes src/db/migrations/NNNN_*.sql + meta
# 2. read the generated SQL and check it does what you meant
pnpm --filter @novap/api db:migrate:local
pnpm typecheck
```

## Watch for (SQLite / D1)

- Adding a NOT NULL column to a table with rows needs a `.default(...)`. Otherwise drizzle-kit
  generates a table rebuild, and existing data may fail.
- Renames: drizzle-kit may ask interactively whether a column was renamed or dropped and recreated.
  The Bash tool can't answer prompts. If it hangs, stop and tell the user to run `db:generate` in their own terminal.
- Data-destroying SQL (`DROP TABLE`, a table rebuild that drops columns): stop and confirm with the user
  before applying to anything but local. `db:migrate:remote` touches production. Never run it unless the user asks explicitly.

## Seed data

`apps/api/src/db/seed.sql` holds placeholder data for local dev only. Keep it valid against the
newest schema. Use explicit ids so relations line up. Test with:

```sh
pnpm --filter @novap/api db:reset:local
```

Stop `pnpm dev:api` first if it's running (Windows locks the sqlite files).
