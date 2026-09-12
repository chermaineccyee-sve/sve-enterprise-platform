# Migration record — importing `svegip` into `sve-enterprise-platform`

**Date:** 12 September 2026
**Method:** `git subtree add --prefix=apps/svegip <svegip remote> main` (full history preserved, no squash).
**Source repository:** `chermaineccyee-sve/svegip` (private) — fetched read-only, never pushed to.

## What this migration branch contains

1. The existing `SVEGIP_ENTERPRISE_ASSESSMENT.md` (from the prior assessment step).
2. A subtree merge commit importing `svegip`'s `main` branch, in full, under `apps/svegip/`.
3. A local reference branch, `reference/svegip-feature-data-vault-rebuild`, pointing at `svegip`'s unmerged `feature/data-vault-rebuild` branch tip (`ee7a99a`) exactly as-is — **not merged into this branch or into `apps/svegip/`**. It exists purely so that in-progress Data Vault rebuild work isn't lost or forgotten once `sve-enterprise-platform` becomes the primary repo people look at.

## Source repository facts, verified before and after import

- `svegip` `main` @ `af02ba769d03b575503506ebae7830f8fff6eeb4` — same SHA before this migration was planned, and after the fetch used to perform it. Nothing was pushed to `svegip`; the remote added locally (`svegip-origin`) has its push URL deliberately set to an invalid value (`DISABLED-DO-NOT-PUSH`) so an accidental push is not just avoided by discipline but impossible from this working copy.
- `svegip` `main` history is genuinely only 2 commits: `ad18024` ("Initial commit") and `af02ba7` ("Establish SVEGIP Phase 1 V26.2 baseline"). The detailed V25/V26.1/V26.2 progression described in the repo's own `.txt` notes was not committed incrementally — it lives only in prose inside those notes files, not as separate commits. Full history was still preserved and imported as-is; there simply isn't more of it than these 2 commits.
- `svegip` also has a `develop` branch, identical to `main` (same SHA) — not separately imported, since it points at the same commit.
- `svegip`'s `feature/data-vault-rebuild` @ `ee7a99a769d03b575503506ebae7830f8fff6eeb4`(diverged, 5 commits ahead of `main`'s `af02ba7`) is preserved via the reference branch above, deliberately **not** merged into `apps/svegip/` at this stage.

## Why `apps/svegip/` and not the repo root

`sve-enterprise-platform` is intended to eventually also hold `platform-services/` (identity, HRMS, payroll, iClaims, accounting, workflow, audit, and a server-backed Data Vault). Importing `svegip` at the repo root would collide with those future top-level directories and blur the line between "the existing app" and "the new platform." Namespacing it under `apps/svegip/` keeps it a fully self-contained, independently deployable unit during the transition.

## What was deliberately *not* done in this step

- `platform-services/` was not scaffolded. This migration is code-import only; no Phase A implementation has started.
- `feature/data-vault-rebuild` was not merged — it is a reference pointer only, per instruction.
- Nothing was changed, pushed, or force-pushed against `chermaineccyee-sve/svegip`.
- No Netlify configuration was touched or repointed.
