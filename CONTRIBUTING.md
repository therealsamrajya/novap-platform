# Contributing

## Branches

`main` is always deployable. Never commit to it directly — every change goes
through a branch and a pull request.

Branch names: `<type>/<short-kebab-description>`

| Type | Use for | Example |
|---|---|---|
| `feat/` | New functionality | `feat/public-products-api` |
| `fix/` | Bug fixes | `fix/cart-total-rounding` |
| `chore/` | Tooling, config, dependencies | `chore/bump-wrangler` |
| `refactor/` | Code changes with no behaviour change | `refactor/split-order-service` |
| `docs/` | Documentation only | `docs/deploy-guide` |
| `db/` | Schema changes + migrations | `db/add-coupons-table` |
| `hotfix/` | Urgent production fixes | `hotfix/webhook-signature` |

Roadmap phases get their own branch: `feat/phase-3-public-api`.
Keep branches short-lived; rebase on `main` if it falls behind.

```sh
git switch main && git pull
git switch -c feat/phase-3-public-api
# ...work, commit...
git push -u origin feat/phase-3-public-api
# open a PR on GitHub
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>(<scope>): <summary in imperative mood>
```

- Types match branch types: `feat`, `fix`, `chore`, `refactor`, `docs`, `db`, `test`
- Scope is optional: `api`, `shared`, `shop`, `admin`, `db`
- Examples: `feat(api): add product list endpoint`, `fix(shared): round GST to nearest cent`

## Pull requests

- Fill in the PR template (loaded automatically).
- `pnpm typecheck` must pass.
- One logical change per PR. A phase may be split across several PRs.
- **Squash and merge** — the PR title becomes the commit on `main`, so write it
  as a Conventional Commit.
- Delete the branch after merging.

## Database changes

- Schema edits go in `apps/api/src/db/schema.ts`, followed by `db:generate`.
- Commit the generated migration in the same PR.
- Never edit or delete a migration that has been merged to `main`.

## Secrets

Never commit secrets. Local values live in `apps/api/.dev.vars` (gitignored);
production values are set with `wrangler secret put <NAME>`. If you add a new
secret, add a placeholder line to `.dev.vars.example`.
