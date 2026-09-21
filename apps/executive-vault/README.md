# Executive Vault → Personal Executive Command Centre — Prototype

A personal executive command centre, designed to sit over Google Drive and Outlook Calendar rather than replace either. The Document Vault is one module inside it. This is a **visual/interaction prototype only** — see `docs/architecture/executive-document-vault.md` at the repository root for the full information/UX architecture it implements (§0–§14 the Document Vault, §15 the Command Centre evolution).

**This is not a company-wide document management system and not the same product as `platform-services/data-vault`** — see §0 of the architecture document for how the two relate. Executive Vault is a single-user personal tool.

**v2** implements the Client → Engagement → Project/Matter → Workstream model, the Legacy business-line rule, and the revised Function/Document Type vocabularies approved after validating the architecture against the actual historical folder tree — see `docs/architecture/executive-document-vault-gap-analysis.md` for that validation record.

**v3** adds the Command Centre layer (architecture doc §15): a redesigned Executive Home (work dashboard, not a document-count dashboard), My Day, This Week, the Meeting Brief, a cross-client Projects/Matters register, an On-Me/Waiting-On split for follow-ups, a header notifications popover, and the Outlook Calendar integration architecture (still mock data/architecture-only — no live Microsoft account connection).

**v4** adds the Management Progress Snapshot (architecture doc §16): a boss-facing, privacy-by-default curated view over the same Command Centre data — never a second dataset. See the Final Report delivered alongside this phase for the full privacy/reuse/field breakdown. Production Outlook/Drive wiring and any real sharing/send mechanism remain explicitly out of scope.

**v5** adds the **Production Foundation — Executive Command Centre Login** (Layer 1 only; see `docs/architecture/executive-command-centre-authentication.md`): a real, single-user login gate in front of the whole app, backed by Netlify Functions and a Postgres `command_centre_users` table (via Netlify DB — the same mechanism `apps/svegip` already uses), with a PBKDF2-hashed password tied to one named account (Ching Yee), never a bare shared application password. This is deliberately **not** the Microsoft Account Connection — Layer 2 (Outlook OAuth, `docs/architecture/outlook-calendar-readiness-review.md`) remains architecture-only; nothing here requests, stores, or transmits a Microsoft credential.

## What this is — and isn't

- **Document/meeting data is still mock data**, written in `data.js` (5 active clients/projects, a Legacy business line, 40+ illustrative documents, and a full week of calendar meetings). None of it comes from a real Google Drive or Microsoft account.
- **Signing in is now a real network call** (`POST /api/login`, `GET /api/session`, `POST /api/logout` — Netlify Functions under `netlify/functions/`, added in v5) — this is the one exception to the "no network call" posture earlier versions of this app held. Every *content* action remains a clearly labelled mock: "Open Original in Drive," "Copy Drive Location," "Upload," "Connect Google Drive," "Join / Open Meeting," "New Client Workspace," and (still not built) an actual Outlook connection all show a toast explaining what the real action will do once that specific integration is built — never presented as live. See the Settings and Outlook Calendar screens.
- **Classification/tagging edits you make while using the prototype are real, but in-memory only** — they demonstrate progressive disclosure and quick reclassification (e.g. filing an Executive Inbox item, changing a document's status or confidentiality from the preview drawer, promoting a workstream to its own Matter, ticking off a follow-up) and are lost on reload. There is no persistence for any of this yet — only the login layer (v5) touches a real database.
- **This app's frontend is still fully isolated** from `apps/svegip/`, `apps/executive-briefing/`, and every `platform-services/*`/`packages/*` module — no import, fetch, link, or dependency on any of them. Its new `netlify/functions/` backend (v5) does not import from them either; it independently reuses the same *pattern* `apps/svegip`'s own Functions already established (Netlify Functions + `@netlify/database` + an HMAC-signed cookie), not any of its code.

## Screens implemented

**Management Progress:** a curated, read-only, boss-facing page (`#/management`, reached via "Preview Management View") — compact header + Last Updated, a one-line derived summary, Current Priorities cards, Management Attention callouts, Waiting On, Progress Since Last Update, Next 7 Days, Decisions/Direction Required, Supporting Documents, upcoming Meetings, and Generate Management Update (Email/WhatsApp/Executive Brief text, editable, copy-only). An "Edit Management Snapshot" action on each Matter (in its Client Workspace) opens the same drawer mechanism to set its management fields. Privacy is default-off — see the architecture doc §16.3/§16.4.

**Command Centre:** Executive Home (compact header/greeting, summary strip, Today, Attention Required + Waiting On, Recently Modified + Requires Review or Decision) · My Day · This Week · Meeting Brief (drawer, opened from any calendar event) · Projects / Matters (cross-client register) · a header Notifications/Attention popover · Outlook Calendar (placeholder).

**Document Vault:** My Document Vault (Folder View + Intelligent View/Registry, saved views, filters, sort) · Clients & Engagements / Projects & Programmes (workspace list + individual workspace with Overview — including a nested Engagement → Project/Matter → Workstream summary with a live "Promote to Matter" action — plus Documents/Meetings & Decisions/Action Items & Deliverables/Archive tabs) · Universal Search (metadata vs. content-match distinction, with a Legacy-inclusion toggle) · Document Detail (slide-in preview drawer with cascading Client → Matter → Workstream selects, used everywhere a document is opened) · Executive Inbox · Archive (with an "All Archived" / "Legacy Only" filter) · Actions & Follow-Up (On Me / Waiting On Others) · Meetings & Decisions · Tags & Classification (confidentiality tiers + the full Function/Document Type vocabularies) · Templates · Settings · Google Drive (placeholder).

Try the search examples from the brief this was built against: **"VT overtime policy," "Nusantara minutes September," "MRE proposal," "HR-124," "Eric review," "Labuan fund," "Performance Management."** To see the promotion feature, open the VT Worldwide client workspace and click "Promote to Matter" next to any of its workstreams. To see the Meeting Brief, open My Day or This Week and click any meeting.

## Stack

**Frontend:** vanilla HTML/CSS/JS. No framework, no bundler, no build step — matches `apps/svegip` and `apps/executive-briefing`'s own convention.

**Backend (new in v5, Layer 1 login only):** Netlify Functions (`netlify/functions/*.mts`) + Postgres via `@netlify/database` (Netlify DB) — the identical pattern `apps/svegip` already runs in production, reused independently rather than shared code. `package.json` now lists `@netlify/database` (dependency) and `@netlify/functions` (devDependency, for local `netlify dev`); the frontend itself still has zero runtime dependencies. `test` runs Node's built-in test runner (`node --test`) against `test/*.test.mjs` — this exercises the frontend's routing/rendering/auth-gating logic in a `vm` sandbox with no real network or database; the Functions themselves are not covered by this suite (see "Tests" below).

## Structure

```
index.html     entry point — loads data.js then app.js as plain <script> tags
data.js        mock dataset (window.VAULT_DATA) — wrapped in an IIFE so its
               internals never collide with app.js's own top-level consts
               of the same field names
styles.css     design tokens (navy/brass executive command-centre palette,
               system fonts only) + layout
app.js         router (hash-based), data/filter/search helpers, action
               handlers, screen renderers, and (v5) the Executive Command
               Centre Login gate — AUTH state, renderLoginScreen(),
               submitLogin()/signOut(), initApp()
test/          node:test suites, run with `npm test`
netlify.toml   Netlify site config (v5) — publish dir + functions dir +
               security headers, matching apps/svegip/netlify.toml
netlify/functions/   Login/session/logout/one-time-bootstrap Functions (v5)
               — see docs/architecture/executive-command-centre-authentication.md
netlify/database/migrations/   command_centre_users table (v5)
.env.example   variable NAMES only, verified against every Netlify.env.get()
               call — never real values (v5)
```

## Running locally

**Frontend only, against mock data with no login gate exercised** (the login gate itself needs `fetch` to reach something — a browser opening this over a plain static server, with no `/api/*` present, gets a real 401/404 from those requests and correctly shows the sign-in screen rather than the app; there is no bypass):

```
npx --yes http-server apps/executive-vault
```

**With the Login gate and Netlify Functions actually working** (requires the Netlify CLI and a Netlify DB-enabled site):

```
cd apps/executive-vault
npm install
npm run dev   # netlify dev
```

Then, once, provision the one authorised account (see `.env.example` for `EXECUTIVE_VAULT_BOOTSTRAP_SECRET`):

```
curl -X POST http://localhost:8888/api/bootstrap-user \
  -H "x-bootstrap-secret: <the temporary secret you set>" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"Ching Yee","password":"<a real password>"}'
```

This endpoint self-disables the moment one account row exists — remove `EXECUTIVE_VAULT_BOOTSTRAP_SECRET` afterwards.

## Tests

```
cd apps/executive-vault
npm test
```

Covers frontend routing/rendering/data logic and (v5) the Login gate's client-side behaviour (login/logout state transitions, error handling, that a signed-out render never leaks the app shell or mock data) with a mocked `fetch` — it does not exercise the real Netlify Functions or a real database, which need `netlify dev`/a live Netlify DB to test end-to-end.

## What production integration (not built here) will change

- **Google Drive** — per architecture doc §8: real Google OAuth (minimum-necessary scopes — `drive.readonly` + `drive.file`, never a blanket `drive` scope), real Drive API calls for browse/upload/move/rename/search, and a real metadata database behind classification/tags/relationships/saved views.
- **Outlook Calendar (Microsoft Account Connection, Layer 2)** — per architecture doc §15.6 and `docs/architecture/outlook-calendar-readiness-review.md`: Microsoft Graph via MSAL OAuth, a read-only `Calendars.Read` scope, real calendar sync for My Day/This Week, and an Unlinked Meetings queue (mirroring the Executive Inbox) for events Graph can't map to a Client/Matter/Workstream on its own. This is a separate, later grant against Microsoft's own sign-in/consent flow — never a password collected by this app, and never mixed into the Executive Command Centre Login (Layer 1, v5) above.

Neither exists yet, by design — the Login gate (v5) is the first piece of this app that is genuinely production, not a prototype; Drive/Outlook remain to validate architecture first.
