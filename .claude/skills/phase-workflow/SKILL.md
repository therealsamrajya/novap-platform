---
name: phase-workflow
description: Start, carry out and finish a NŌVAP roadmap phase (README roadmap, phases 3-9). Use when the user says "start phase N", "what's in phase N", "finish/wrap up the phase", or asks to plan phase work. Covers scoping, branch, PR split, docs and the roadmap checkbox.
---

# Roadmap phase workflow

## Start

1. Read the roadmap in `README.md` and the phase line. Only build what that line covers.
   Note anything that belongs to a later phase and leave it out (e.g. emails = phase 7, rate limits = phase 9).
2. Read the relevant tables in `apps/api/src/db/schema.ts` and the existing routes/services.
3. Give the user a short plan: endpoints, files, shared schemas, schema changes (if any), open questions.
   Ask about real product decisions only. Pick sensible defaults for the rest and state them.
4. When the user approves, create the branch (only if the user wants git work done):
   ```sh
   git switch main && git pull && git switch -c feat/phase-N-<name>
   ```

## Build

- One slice at a time. Each endpoint follows the `new-endpoint` skill; schema changes follow `db-change`.
- After each slice, run `verify-api`.
- Split into several PRs if the phase is large (CONTRIBUTING: one logical change per PR),
  e.g. phase 3 = catalog PR + contact PR.
- Commit only when the user asks. Use Conventional Commit messages.

## Finish

- [ ] `pnpm typecheck` passes
- [ ] All new endpoints appear in Swagger (`/api/docs`) with params, response schemas and error statuses
- [ ] `docs/architecture.md` is updated if a new pattern or layer was introduced
- [ ] New env vars are in `wrangler.jsonc` / `.dev.vars.example`; `types` regenerated
- [ ] Roadmap checkbox ticked in `README.md` (in the last PR of the phase)
- [ ] `CLAUDE.md` is updated if conventions changed (e.g. phase 4 adds auth middleware usage)
- [ ] PR body follows `.github/pull_request_template.md`, with curl steps under "How to test"
