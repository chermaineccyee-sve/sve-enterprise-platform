# Contributing to sve-enterprise-platform

## Workflow

- `main` is protected: no direct commits or pushes to `main`.
- All work happens on a branch, opened as a pull request, reviewed, and merged into `main` — never pushed directly.
- Keep PRs scoped to one purpose (e.g. a hygiene change, a single service, one bug fix) rather than mixing unrelated changes.
- CI (`.github/workflows/ci.yml`) runs automatically on every pull request targeting `main` and must pass before merge.

## Repository layout

- `apps/svegip/` — the existing SVEGIP application. Self-contained: its own `package.json`, `netlify.toml`, and Netlify Functions. Treat changes here as changes to a live, deployed application.
- `platform-services/` — shared enterprise services (identity, HRMS, payroll, iClaims, accounting, workflow, audit, Data Vault backend). Scaffolded (each has a `README.md` describing its boundaries) but not implemented yet — read `docs/architecture/platform-architecture.md` and the target module's own `README.md` before adding real code to it.
- `packages/` — shared contracts (`types`, `security`, `shared`, `config`) that `platform-services/*` will depend on. Interface-only today; no build tooling is wired up until the first module needs it (see `docs/architecture/platform-architecture.md` "Deferred tooling").
- `docs/` — architecture documentation, the baseline assessment, and migration records.

## Environment variables and secrets

- Never commit a real `.env` file or any secret value. `.gitignore` excludes `.env`/`.env.*` but explicitly keeps `*.env.example` files trackable — that's the pattern to follow for documenting new variables.
- Each app/service should keep its own `.env.example` (see `apps/svegip/.env.example`) listing variable **names** only, with safe placeholder values, verified against what the code actually reads — not assumed or copied from memory.
- CI does not have access to production secrets and should not need them; validation steps should be limited to what can run without a live database or session secret (syntax/lint checks, not integration tests against real services).

## Dependencies

- Dependencies are pinned to exact versions in each app's `package.json`, with a committed lockfile (`package-lock.json`) as the source of truth for reproducible installs (`npm ci`, not `npm install`, in CI and for clean local setups).
- Don't upgrade a pinned dependency as a side effect of an unrelated change — bump it deliberately, in its own PR, with a note on why.
