# CMS Production Cutover Checklist

**Cutover** means the live public website reads its editorial content from the
Admin Portal (`CONTENT_SOURCE=cms`) instead of the typed files. It is a
separate approval. Completing B1B does not authorise it.

**Mechanics.** The change is one reviewed commit to `netlify.toml`
(`[context.production.environment] CONTENT_SOURCE = "cms"`), then a production
deploy. Undo is the reverse commit, or *Publish deploy* on the previous deploy.
That restores the typed-file site in about a minute, with no data loss.

Every item needs **GO** before cutover. One **NO-GO** stops it.

## A. Infrastructure

| # | Check | How to verify | GO / NO-GO |
|---|---|---|---|
| A1 | Neon project in AWS Singapore (`ap-southeast-1`), separate `production` and `preview` branches | Neon console | |
| A2 | Production `DATABASE_URL` is the **pooled** endpoint, `DATABASE_URL_UNPOOLED` the direct one, both TLS | Deploy log: `✓ environment`, `TLS on` | |
| A3 | Production database marked `production`, preview marked `preview` | Deploy log: `database belongs to the production data environment` | |
| A4 | Production schema current | `/api/cms-health` → `"schema":"current"` | |
| A5 | S3 production bucket in `ap-southeast-1`: Block Public Access on, ACLs disabled, SSE-S3, versioning on, CORS limited to the production origin | AWS console | |
| A6 | Direct anonymous request to an object URL is refused | `curl -I https://<bucket>.s3.ap-southeast-1.amazonaws.com/<key>` → 403 | |
| A7 | IAM keys scoped to one bucket each, no ListBucket; stored only in Netlify as secrets | AWS IAM + Netlify env | |
| A8 | `PAYLOAD_SECRET` unique per context (production ≠ preview) | Netlify env (values not displayed) | |
| A9 | Point-in-time restore ≥ 7 days on production; a restore rehearsed once on a scratch branch | Neon console | |
| A10 | `/api/cms-health` watched by an uptime monitor | Monitor dashboard | |

## B. Content

| # | Check | How to verify | GO / NO-GO |
|---|---|---|---|
| B1 | Production import ran once (`CMS_IMPORT_ON_DEPLOY=true`) and the flag was then removed | Deploy log import counts; Netlify env | |
| B2 | CMS content equals the typed files except deliberate edits | `npm run cms:verify-equivalence` against production (read-only) | |
| B3 | No TEST/demo records or accounts in production | Admin lists; Audit Log | |
| B4 | Classifications reviewed. Nothing is *Approved Corporate Content* unless an Admin confirmed it. Illustrative content still shows as illustrative. | Admin filters | |
| B5 | Every item that should be visible is **Published**, with a future *Re-review by* date where required | Editorial dashboard | |
| B6 | Pages not yet in the CMS (homepage copy, About, Contact, legal, navigation) stay code-controlled, as intended | — | |

## C. People and access

| # | Check | How to verify | GO / NO-GO |
|---|---|---|---|
| C1 | First Admin created through the bootstrap window; `CMS_BOOTSTRAP_TOKEN` removed and redeployed | Deploy log has no bootstrap warning; `/admin/bootstrap` says set-up is closed | |
| C2 | Named accounts only, with correct roles. At least one Editor and one Reviewer who are different people. Two Admins (no single point of failure). | Users | |
| C3 | Anonymous account creation refused | `scripts/regression/bootstrap-and-access.mjs` against production (safe part) | |
| C4 | Password-reset procedure known (an Admin resets until email exists) | — | |
| C5 | MFA/SSO position accepted for go-live (docs/DEPLOYMENT.md §9) | Management decision | |

## D. Behaviour (on the branch deploy, then once on production with Admin only)

| # | Check | How to verify | GO / NO-GO |
|---|---|---|---|
| D1 | Edit → Draft → Preview → Review → Publish works online | docs/DEPLOYMENT.md §10 | |
| D2 | Drafts never visible to anonymous visitors; preview requires a session | `preview-sec` checks / private window | |
| D3 | Publishing updates every page that shows the item, without a rebuild; withdrawing removes it | `publish-revalidation.mjs` (branch deploy) | |
| D4 | Discard draft changes leaves the live version untouched | Admin + private window | |
| D5 | Media uploads go to S3; unapproved files not public; approval needs licence | `media-access.mjs` (branch deploy) | |
| D6 | Unknown legal URLs (`/legal/xyz`, `/legal/PRIVACY`) return the styled 404 with the "Page not found" title and need no JavaScript; valid legal pages survive publishing | `publish-revalidation.mjs` | |
| D7 | Market data, ticker, CURRENT TIME / MARKET SNAPSHOT and MYT / SGT unchanged | Public parity vs `e803790` | |

## E. Public-site parity at the moment of cutover

| # | Check | How to verify | GO / NO-GO |
|---|---|---|---|
| E1 | CMS-source build matches the typed-file build route by route (HTML, CSS, APIs, metadata), except deliberate content edits | `node scripts/parity/parity.mjs --base <local-source build> --head <cms-source build>` | |
| E2 | Accessibility unchanged | axe comparison | |
| E3 | Interaction suites pass on the CMS-source build | browser suites | |

## F. Operations

| # | Check | How to verify | GO / NO-GO |
|---|---|---|---|
| F1 | A named person watches the deploy and the first hour of logs (`cms.*`, `auth.*` events) | — | |
| F2 | Rollback rehearsed: *Publish deploy* on the previous production deploy | Netlify | |
| F3 | Pre-cutover Neon backup branch `backup-YYYYMMDD-HHMM` created | Neon console | |
| F4 | Cutover window agreed (low-traffic, MYT business hours for support) | — | |

## Decisions for management (open)

1. Production **Neon plan and compute**:
   - the restore window (≥ 7 days recommended)
   - whether production keeps a warm minimum (no cold start)
2. **Production Admin before cutover?**
   - Option: connect the production database now, so editors work in the
     real Admin while the public site still reads the typed files.
   - Or keep all editing on the branch deploy until cutover. Its content
     would then be re-entered or imported into production.
3. **Email provider** for password reset: Amazon SES (Singapore) recommended
   (DEPLOYMENT.md §8).
4. **MFA:** accept compensating controls until Entra ID SSO with MFA, or
   require SSO before cutover (DEPLOYMENT.md §9).
5. **Uptime monitor** for `/api/cms-health`, and who receives alerts.
6. **Off-Neon backup** (weekly `pg_dump` to S3): yes / no.
7. **Who holds the two Admin accounts**, and the named Editor(s) and
   Reviewer(s).
8. **Password protection of the branch-deploy Admin test site** (Netlify plan
   feature): yes / no.
