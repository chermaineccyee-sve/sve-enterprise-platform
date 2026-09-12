# Data Vault Rebuild Branch — Assessment

Status: **read-only assessment**. `reference/svegip-feature-data-vault-rebuild` was inspected (diffed and read) for this document and was not merged, built on, or modified. It remains a separate, untouched branch. This document does not fix, remediate, or change Data Vault behaviour — the CRITICAL finding below remains fully open.

## The CRITICAL finding, restated and reconfirmed

`SVEGIP_ENTERPRISE_ASSESSMENT.md` recorded that `apps/svegip/data-vault/index.html`'s actual business content (`sveRecords` — matters, evidence, risks, tasks, deliverables) is stored entirely in browser `localStorage`, not a database. **This remains true and unresolved as of this PR.** The reference branch assessed here does not change that — see "What it does not do" below.

## What `reference/svegip-feature-data-vault-rebuild` actually contains

Five commits ahead of `svegip`'s `main` (`0a70fe7` → `ee7a99a`), touching four files: `data-vault/index.html`, a new `data-vault/router.js`, a new `scripts/integrate-data-vault-router.mjs`, and a new `.github/workflows/integrate-data-vault-router.yml`. Verified by diff, not assumed:

- **`data-vault/router.js`** extracts page navigation — the page registry, history stack, sidebar sync, mobile-menu close behaviour, and matter/project context tracking — out of `index.html`'s inline script into one standalone, self-contained router (`window.SVEVaultRouter`). It consolidates what the branch's own commit history shows were multiple competing inline routing layers (a "V15.4 canonical Home routing" block, a `sidebar-single-active-fix` script, and a `v261-routing-fixes` script) into a single implementation.
- It also removes the unsupported standalone "Research & Data Collection" page and turns "Consulting Method" into a static reference instead of a broken clickable route — both consistent with intent already recorded in `apps/svegip`'s own `V25_IMPLEMENTATION_NOTES.txt`/`V26_2_IMPLEMENTATION_NOTES.txt`.
- **`scripts/integrate-data-vault-router.mjs`** is a one-time codemod: targeted regex replacements that strip the old inline router/legacy scripts out of `index.html` and insert a `<script src="./router.js">` tag, plus a small compatibility hook so the existing "set current matter" code also calls into the new router's `setMatter`.
- **`.github/workflows/integrate-data-vault-router.yml`** runs that codemod on push to a branch literally named `feature/data-vault-rebuild`, validates the result (checks the legacy router functions are gone and the new script tag is present), and — notably — **commits and pushes the result back to that same branch automatically** (`permissions: contents: write`, ends with `git push origin HEAD:feature/data-vault-rebuild`).

## What it does not do

- **It does not touch data persistence at all.** No line in this branch's diff reads or writes `sveRecords` or changes how/where Data Vault records are stored. Grepped directly: zero occurrences of `sveRecords` anywhere in this branch's changes.
- **It adds a new `localStorage`-backed feature of its own** (`router.js`'s `openOperatingStage`, keyed `svegip_operating_model_stage_v1_<index>`) — so the branch net-increases, not decreases, the amount of confidential-adjacent state kept client-side only.
- It does not add any authentication, entitlement, or classification check beyond what already exists in `apps/svegip` today (the Edge Function + `/api/vault-authorize` gate, unaffected by this branch).

## What appears reusable

- **The router consolidation itself is good, verifiable engineering** and directly addresses a real problem (multiple competing inline routing layers) documented in SVEGIP's own progress notes. A future Data Vault rebuild PR should treat `router.js`'s navigation/history/matter-context model as a legitimate starting point for *navigation*, not something to redo from scratch.
- The instinct to extract inline logic into a standalone, testable file (rather than more inline `<script>` blocks) is the right direction and consistent with `platform-architecture.md`'s general preference for clear boundaries over accretive patches.

## What should not be reused as-is

- **The `localStorage`-based `sveRecords` persistence must not be carried forward** — it is the CRITICAL issue itself, and this branch neither fixes it nor claims to. A rebuilt, server-backed Data Vault (`platform-services/data-vault`, per its README) needs an entirely new data-access layer, not a port of the existing client-side store.
- **The new `openOperatingStage` `localStorage` feature must not be carried forward as-is** — it repeats the same anti-pattern for a different data shape and should instead be redesigned to persist through whatever server-backed store the rebuild introduces.
- **The self-committing GitHub Actions workflow pattern should not be reused.** A CI job that auto-commits and force-pushes generated output back onto the branch that triggered it is a pattern worth avoiding in this repository regardless of Data Vault specifically — it obscures history (bot commits interleaved with human commits) and, more importantly, is unnecessary once the codemod's transformation is simply applied once, by hand or in a reviewed PR, rather than kept as a standing, self-perpetuating job. Note also, as a safety observation rather than an incident: this workflow's trigger (`on: push: branches: [feature/data-vault-rebuild]`) does not match this repository's preserved reference branch name (`reference/svegip-feature-data-vault-rebuild`), so it did not and will not fire here — but it should not be copied forward verbatim into any future branch that does match that name.

## How this should inform the dedicated future remediation PR

1. Treat the branch's navigation/router consolidation as reusable *reference material* for cleaning up Data Vault's navigation, separately from the data-persistence rebuild — they are two different problems, and this branch only ever addressed the first one.
2. Design the server-backed record store first (schema, API, `platform-services/data-vault` implementation, classification-aware access control) — porting or re-deriving the router afterward is comparatively low-risk once real records aren't sitting in the browser.
3. Do not adopt the self-committing CI pattern for whatever workflow lands the eventual rebuild — use a normal reviewed PR instead.
4. This assessment does not authorize merging `reference/svegip-feature-data-vault-rebuild` — it remains a preserved, unmerged reference branch, exactly as instructed.
