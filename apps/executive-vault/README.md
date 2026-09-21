# Executive Vault — Phase 3 Prototype

A personal executive document vault and lightweight command centre, designed to sit over Google Drive rather than replace it. This is a **visual/interaction prototype only** — see `docs/architecture/executive-document-vault.md` at the repository root for the full Phase 1 (information architecture) and Phase 2 (UX architecture) it implements.

**This is not a company-wide document management system and not the same product as `platform-services/data-vault`** — see §0 of the architecture document for how the two relate. Executive Vault is a single-user personal tool.

**v2** implements the Client → Engagement → Project/Matter → Workstream model, the Legacy business-line rule, and the revised Function/Document Type vocabularies approved after validating the architecture against the actual historical folder tree — see `docs/architecture/executive-document-vault-gap-analysis.md` for that validation record.

## What this is — and isn't

- **All data is mock data**, written in `data.js` for this prototype (VT Worldwide, MRE Asia, Nusantara Project, SVE Group Enterprise Platform, Internal Governance, a Legacy business line, and 40+ illustrative documents). None of it comes from a real Google Drive account.
- **No network call of any kind is made anywhere in this app.** "Open Original in Drive," "Copy Drive Location," "Upload," "Connect Google Drive," and "New Client Workspace" are all clearly labelled mock actions (a toast explaining what the real action will do once Phase 4 is built) — never presented as a live integration. See the Settings screen.
- **Classification/tagging edits you make while using the prototype are real, but in-memory only** — they demonstrate progressive disclosure and quick reclassification (e.g. filing an Executive Inbox item, changing a document's status or confidentiality from the preview drawer) and are lost on reload. There is no backend and no database.
- **This app is fully isolated** from `apps/svegip/`, `apps/executive-briefing/`, and every `platform-services/*`/`packages/*` module. It does not import, fetch, link to, or depend on any of them.

## Screens implemented

Executive Home · My Document Vault (Folder View + Intelligent View/Registry, saved views, filters, sort) · Clients & Engagements / Projects & Programmes (workspace list + individual workspace with Overview — including a nested Engagement → Project/Matter → Workstream summary with a live "Promote to Matter" action — plus Documents/Meetings & Decisions/Action Items & Deliverables/Archive tabs) · Universal Search (metadata vs. content-match distinction, with a Legacy-inclusion toggle) · Document Detail (slide-in preview drawer with cascading Client → Matter → Workstream selects, used everywhere a document is opened) · Executive Inbox · Archive (with an "All Archived" / "Legacy Only" filter) · Tasks / Follow-Up · Meetings & Decisions · Tags & Classification (confidentiality tiers + the full Function/Document Type vocabularies) · Templates · Settings · Google Drive (placeholder).

Try the search examples from the brief this was built against: **"VT overtime policy," "Nusantara minutes September," "MRE proposal," "HR-124," "Eric review," "Labuan fund," "Performance Management."** To see the promotion feature, open the VT Worldwide client workspace and click "Promote to Matter" next to any of its workstreams.

## Stack

Vanilla HTML/CSS/JS. No framework, no bundler, no build step — matches `apps/svegip` and `apps/executive-briefing`'s own convention. `package.json` has no runtime dependencies; `test` runs Node's built-in test runner (`node --test`) against `test/*.test.mjs`.

## Structure

```
index.html     entry point — loads data.js then app.js as plain <script> tags
data.js        mock dataset (window.VAULT_DATA) — wrapped in an IIFE so its
               internals never collide with app.js's own top-level consts
               of the same field names
styles.css     design tokens (navy/brass executive command-centre palette,
               system fonts only) + layout
app.js         router (hash-based), data/filter/search helpers, action
               handlers, and every screen renderer
test/          node:test suites, run with `npm test`
```

## Running locally

Any static file server works, e.g.:

```
npx --yes http-server apps/executive-vault
```

or simply open `index.html` directly in a browser.

## Tests

```
cd apps/executive-vault
npm test
```

## What Phase 4 (not built here) will change

Per `docs/architecture/executive-document-vault.md` §8: real Google OAuth (minimum-necessary scopes — `drive.readonly` + `drive.file`, never a blanket `drive` scope), real Drive API calls for browse/upload/move/rename/search, and a real metadata database behind classification/tags/relationships/saved views. None of that exists yet, by design — this prototype exists to validate the information architecture and screens first.
