## What

<!-- What does this PR change? One or two sentences. -->

## Why

<!-- Problem it solves or roadmap phase it belongs to. Link issues: "Closes #12". -->

## Type

- [ ] feat — new functionality
- [ ] fix — bug fix
- [ ] db — schema change / migration
- [ ] refactor — no behaviour change
- [ ] chore / docs

## How to test

<!-- Steps a reviewer can run locally, e.g. curl commands against http://localhost:8787 -->

1.

## Checklist

- [ ] Branch follows `<type>/<description>` naming
- [ ] PR title is a Conventional Commit (`feat(api): ...`) — it becomes the squash commit
- [ ] `pnpm typecheck` passes
- [ ] Tested locally with `pnpm dev:api`
- [ ] New migration generated and committed (if `schema.ts` changed)
- [ ] No secrets committed; new env vars added to `.dev.vars.example`
- [ ] README / docs updated (if behaviour or commands changed)

## Notes for reviewer

<!-- Anything risky, follow-ups, or screenshots. Delete if none. -->
