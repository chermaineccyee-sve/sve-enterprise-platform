# Executive Vault — Personal Executive Document Vault

Status: **Phase 1 (information architecture) + Phase 2 (UX architecture), validated against the actual historical Executive Office Hub folder tree and approved.** Phase 3 (visual prototype, mock data) is built at `apps/executive-vault/` — see that app's own `README.md`. **Phase 4 (production Google Drive integration) is intentionally not started** — per the brief, it only gets designed once the interface and information architecture below are confirmed.

This is a **personal** professional workspace for one user (initially Chermaine/the account this repository belongs to), not a company-wide document management system, not a multi-tenant product, and not the same thing as `platform-services/data-vault` (see [§0](#0-relationship-to-the-existing-sve-data-vault) — that is a separate, RBAC-gated, Postgres-native evidence register for SVE Group governance; this is a Drive-backed personal filing and retrieval layer). Nothing in this document changes, depends on, or is consumed by `apps/svegip`, `platform-services/*`, or `packages/*`.

**Validation record:** the root structure, classification model, Function vocabulary, Document Type vocabulary, and the Client/Engagement/Project-Matter/Workstream model below were checked line-by-line against the actual historical "Executive Office Hub" folder tree and revised in light of it. The full reasoning — what was found duplicated, what was retired, what became metadata, what was confirmed unchanged — is recorded in `docs/architecture/executive-document-vault-gap-analysis.md` and is not repeated here; this document states the *resulting, approved* architecture only.

---

## 0. Relationship to the existing SVE Data Vault

`platform-services/data-vault` (see `docs/architecture/data-vault-rebuild-assessment.md` and the PR #5 remediation record) is a different product solving a different problem: a classification-gated, multi-entity, RBAC-enforced **evidence/matter register** for SVE Group governance, with its own PostgreSQL tables, its own audit trail, and no relationship to Google Drive at all. Executive Vault is a **single-user, Drive-backed filing and retrieval layer** — no RBAC, no multi-entity access grants, no server-side audit sink beyond ordinary application logs. They are intentionally not merged:

- Executive Vault's classification model (§4) is a *display and filtering convenience* for one person, not an access-control boundary — nothing in it prevents a read.
- If Executive Vault is ever opened to more than one person, the natural evolution is to sit it *on top of* `platform-services/identity` + a future generalized `platform-services/documents` (already scaffolded, unimplemented) rather than reinvent RBAC a second time — see §11.
- Until then, building any of Data Vault's machinery (entity grants, permission ceilings, `.privileged` keys, CSRF/session bridges) into Executive Vault would be solving a problem this tool doesn't have yet.

---

## 1. System concept and name

**Proposed name: Executive Vault.** Tagline: *Personal Executive Document Intelligence.* Google Drive is the vault's contents; this application is the index, the lens, and the desk on top of it — never a second copy of the contents.

Positioning in one line, to keep scope honest at every future decision point:

> Executive Vault answers "what am I working on, where is it, and what needs me" across everything I do — governance, strategy, client and project work, legal/compliance, HR, and my own executive office — using Google Drive as the single, authoritative file store underneath it.

---

## 2. Recommended root Drive architecture

The proposed root in §14 of the brief is sound and is adopted with one adjustment (Governance and Strategy merged into one root, matching the "Corporate Governance & Strategy" pairing already used in the proposed nav's KNOWLEDGE section — carrying two near-identical top-level folders forward would recreate the exact overlap problem the brief asks to eliminate):

```
00 – Executive Inbox              Unclassified landing zone. Nothing is "wrong" here — it's meant to fill up.
01 – Executive Office             Personal role: correspondence, personal OKRs, board/exec calendar packs, exec admin.
02 – Governance & Strategy        Board/shareholder papers, group strategy, policy-at-the-group-level, minutes that
                                   are NOT tied to one client/project.
03 – Clients & Engagements        One subfolder per client, each following the standard in §3. This is the busiest
                                   root folder and stays that way by design — see the "no orphaned client material" rule below.
04 – Projects & Programmes        Same standard as §3, for internal (non-client) initiatives — e.g. the SVE Group
                                   Enterprise Platform programme, an internal transformation initiative.
05 – Legal & Compliance           Group-level legal/compliance material not tied to one client/project (templates,
                                   regulatory filings, group contracts, group policy register).
06 – Human Resources & Org        Group-level HR: group policy master copies, org design, executive HR matters.
07 – Finance & Investment         Group-level finance/investment material not tied to one client/project.
08 – Operations & Administration  Group-level operational/admin material.
09 – Research & Intelligence      Market/sector/competitor research, reference intelligence, not tied to one engagement.
10 – Templates & Reference        Document templates, style guides, boilerplate clauses, naming-convention reference.
90 – Personal Working Files       Genuinely personal scratch material — not a "everything I haven't filed" dumping
                                   ground (that's 00); this is stuff that will never become a permanent record.
99 – Archive                      Superseded/closed material relocated out of active folders (see §7's lifecycle),
                                   plus a distinct "Legacy Business Lines" partition (see §3a) for material from a
                                   discontinued line of work — kept apart from ordinary superseded-version archiving.
```

**Root structure confirmed unchanged by the literal folder-tree validation.** Every branch of the actual historical Executive Office Hub tree maps into this existing skeleton via metadata, a Client/Engagement/Project-Matter relocation, or the Legacy/Retire treatment in §3a — zero new top-level folders were required. See the gap analysis document for the branch-by-branch evidence.

**The rule that resolves the overlap problem named throughout the brief:** *if a document belongs to a specific client, project, or matter, it lives under `03`/`04` under that engagement's folder — full stop, even if its subject matter is HR, Legal, Finance, or Governance.* The functional roots (`02`, `05`–`09`) hold only material that is genuinely **not** tied to one engagement — group policy masters, templates, reference research. A VT Worldwide HR policy is filed once, under `03 – Clients & Engagements / VT Worldwide / …`, and is *findable* under "Human Resources" in the application through the **Function** metadata tag (§6), not through a second copy or a second folder. This is exactly why the application's Intelligent View (§9.2, screen 2) and Knowledge nav section (§9's nav table) exist: Drive folders answer "where does this physically live," the app's tags answer "what else is this," and a document never needs two homes to answer both questions.

**Year is metadata, not a folder layer.** Do not add `2026/` folders under clients or functions — it fragments an engagement's history across years for no retrieval benefit the app's Year filter doesn't already give you, and it forces a filing decision ("which year does this belong to — created or effective?") that adds friction for zero payoff.

---

## 3. Client & engagement folder standard

The brief's proposed `00`–`99` client structure is fundamentally sound; kept with one refinement — **workstream subfolders under `03` are created on demand, never scaffolded upfront.** A single-workstream client (most of them) should never present eight empty folders.

```
<Client Name>/
  00 – Client Overview            One-pager: relationship summary, key contacts, key dates. Usually a single doc.
  01 – Engagement & Scope         Engagement letters, SOWs, fee proposals, contracts.
  02 – Information Received       Source material the client gave you — inputs, not your work product.
  03 – Working Documents/         Your drafts. Add a workstream subfolder only once a client has 2+ concurrent
    [Workstream A]/                workstreams running (e.g. "HR Transformation", "Restructuring") — the app's
    [Workstream B]/                Workstream tag (§6) is what carries this for single-workstream clients.
  04 – Meetings & Correspondence  Minutes, call notes, email threads saved as PDF/doc.
  05 – Deliverables               Deliverables still in progress (pre-issue drafts of the actual output).
  06 – Client Review & Feedback   What you sent for their comment, and what came back.
  07 – Final / Issued             What was actually sent/delivered — the record of what the client has.
  08 – Reference                  Background material relevant to this client that isn't a deliverable or input.
  99 – Archive                    Superseded engagement material (closed workstreams, prior-year renewals, etc.)
```

Every new client workspace is created from this same template (§9, screen "Client Workspace" has a "New Client Workspace" action that scaffolds exactly `00`–`08`, `99` and nothing else — no workstream folders, no year folders).

**Projects/Programmes (`04` root) use the identical template.** The application does not model "Client" and "Project" as different data types — both are instances of one underlying record, distinguished only by a `type: client | internal-project` field.

### 3.1 Client → Engagement → Project/Matter → Workstream

**Revised from the original Phase 1 draft**, which flattened Client and Engagement into one record. The gap analysis (see `executive-document-vault-gap-analysis.md` §E) found that flattening breaks down for a repeat client with two engagements a year apart, or a client running two genuinely separate pieces of work at once (e.g. an HR advisory and an unrelated legal matter, simultaneously) — both real situations, not edge cases invented for their own sake. The approved model is a four-level chain:

```
Client              An enduring relationship — e.g. "VT Worldwide." Owns the contact list, the relationship
                     summary, and the Drive folder root (§3's template). Pinned/browsable as a top-level entity.
  └─ Engagement      A discrete, time-bound contract or SOW — e.g. "HR Transformation / HR Advisory." A client can
                     have more than one, concurrently or over time (a 2027 renewal, an unrelated matter).
      └─ Project/Matter   A specific initiative inside that engagement — e.g. "HR Transformation." Has its own
                     status, owner, target date and current stage (§16 of the brief, "Project/Matter Dashboard").
          └─ Workstream   A thread of work inside that project/matter — e.g. "HR Digitalisation / HRMS,"
                     "Performance Management," "HR Policy Framework," "Implementation / Training." A tag on the
                     document, scoped to its Project/Matter, not a folder.
              └─ Document
```

**Worked example**, matching the one this was approved against — `HR-124 – Lark Digital Acknowledgement Workflow Specification` sits at:

```
Client:        VT Worldwide
  Engagement:  HR Transformation / HR Advisory
    Matter:    HR Transformation
      Workstream: HR Digitalisation / HRMS
        Document: HR-124
```

**For most clients today, this collapses to exactly what existed before** — one Client, one Engagement, one Matter — so nothing changes for VT Worldwide, MRE Asia, or Nusantara as they stand; the model exists so it *doesn't break* the day a client needs a second engagement or a separate matter, rather than because today's roster needs four visible levels.

**A Workstream can be promoted to its own standalone Project/Matter later**, when its scope becomes sufficiently independent to warrant it (e.g. HR Digitalisation growing from "a workstream inside HR Transformation" into its own tracked initiative with its own milestones). Promotion creates a new Project/Matter record under the same Engagement and reassigns that workstream's documents to it — a data operation, not a folder move; the underlying Drive location is unaffected unless a physical reorganisation is separately requested.

**Why this doesn't become four separate CRUD screens:** the Client Workspace (§13.3) is still the one screen a client is managed from — it lists its Engagement(s), each expandable to its Matter(s) and their Workstreams, rather than requiring separate top-level navigation for Engagement and Matter. The nesting is a data model decision, not a UI proliferation decision.

### 3a. Legacy business lines

**The distinction that matters:** *historical business-line structure* is Legacy; *future subject matter arising through a live engagement* is Active — these are independent questions, not the same thing. A discontinued line of work (e.g. a past physical-development/resort-operations business, or a past regional business-development effort in a jurisdiction no longer active) does not get an active root folder, an active Function, or a slot in the Client/Engagement picker used to classify new documents — but if a *future* client or project genuinely involves infrastructure, logistics, construction, property, or that same jurisdiction again, those new documents are never blocked from entering normally through Client → Engagement → Project/Matter → Workstream with whatever Function/Document Type/tags actually fit. Nothing about a subject matter is permanently excluded — only the old *business-line-as-structure* is retired.

**Mechanically:** a Client (or, exceptionally, an individual document) can be flagged `legacy: true`. A legacy-flagged Client:
- is excluded from the active Client/Engagement picker used when classifying a new or Inbox document, so it cannot accidentally be reused as a home for new work;
- is excluded from every Executive Home dashboard count (Total/Active/Drafts/Review/Final and every Attention Required bucket);
- is excluded from the Clients & Engagements / Projects & Programmes workspace lists;
- remains fully reachable from the Archive screen, with its own visible "Legacy" filter — findable on purpose, never surfaced as if it were current, never deleted.

Physically, legacy material sits under `99 – Archive / Legacy Business Lines / …`, kept apart from ordinary Superseded/Archived material (which is old *versions* of still-active client/project work, a different thing — see §7).

---

## 4. Document classification model (confidentiality)

Five tiers, each with a fixed color and a one-line test — shown as a legend wherever a classification chip appears, not left for the user to memorize:

| Tier | Color | Test: use this tier when the document contains… | Typical examples |
|---|---|---|---|
| **Highly Confidential** | Deep red | Board/shareholder material, live M&A or investment terms, legal privilege, or a matter where disclosure would be a governance or legal event | Board papers, term sheets, privileged legal advice, live investment structuring |
| **Confidential** | Amber | Named individuals' HR/personnel data, contract terms, or client-sensitive commercial detail | Personnel files, signed contracts, client financials, disciplinary matters |
| **Restricted** | Blue | Internal project/operational/management material not meant for general circulation but not personally or legally sensitive | Internal project plans, management reviews, operating models |
| **Controlled** | Slate | Internal working documentation with a defined but wider internal circulation | Working policy drafts, internal SOPs pre-issue |
| **General** | Grey | Ordinary internal/reference material with no sensitivity | Templates, published policies, public-facing material |

This directly supersedes the ad hoc "Confidential / Restricted / Controlled" set already used informally — it keeps those three labels' meaning, adds the two ends the brief specifically asked for (a tier above Confidential for board/legal-privilege material, and a tier below Controlled for ordinary material), and gives all five a visual identity instead of a text label alone. **This is a filtering and visual-flagging model, not an access-control system** (§0) — every tier is visible to the one user of this vault; the tiers exist so the "Confidential/Restricted material" item on Executive Home (§9.1) and the vault's classification filter mean something consistent.

---

## 5. Metadata model

One record per document. **Only Document Name and a Google Drive reference are ever required** — everything else is optional at save time and completable later (§9.2's "Upload → Client → Type → Save" flow; the Executive Inbox in §9.8 exists precisely so this constraint is real, not aspirational).

| Field | Required? | Type | Notes |
|---|---|---|---|
| Document Name | **Required** | text | See naming convention, §6 |
| Google Drive File ID / URL | **Required** | text (system-set on save/link) | The single source of truth for the actual file |
| Document ID | Optional | text | e.g. `HR-124`; auto-suggested per Function+sequence, editable |
| Client / Entity | Optional | reference → Client | One Client per document (a document that genuinely serves two clients gets a second lightweight link, not a duplicate record) |
| Engagement | Optional | reference → Engagement (child of Client) | §3.1 — usually implied once Client is set, since most clients have exactly one |
| Project / Matter | Optional | reference → Project/Matter (child of Engagement) | §3.1 |
| Workstream | Optional | tag, scoped to the chosen Project/Matter | §3.1 — free text, but the app suggests the values already used on that Matter |
| Function | Optional | tag (single-select, fixed list — §2's functional roots) | `Executive Office`, `Governance & Strategy`, `Legal & Compliance`, `Human Resources`, `Project & Programme Management`, `Finance & Investment`, `Operations & Administration`, `Research & Intelligence` — eight, deliberately short and stable (see §5.1) |
| Document Type | Optional | tag (single-select, fixed list — see §5.2) | |
| Jurisdiction | Optional | tag (multi-select) | Malaysia, Singapore, Labuan, Hong Kong, UAE, Timor-Leste, ASEAN, Global, … |
| Version | Optional | text, freeform but pattern-checked | `v0.1`…`v1.0 Final` — see §7 |
| Status | Optional, defaults to **Working Draft** | enum | See lifecycle, §7 |
| Confidentiality | Optional, defaults to **General** | enum (§4) | |
| Owner | Optional, defaults to the account holder | text | Present because a future multi-user evolution needs it; meaningless (always "me") today |
| Created Date | System-set | date | From Drive metadata |
| Modified Date | System-set, kept live | date | From Drive metadata, refreshed on sync (§8) |
| Review Date | Optional | date | Drives the "Upcoming Reviews" / "For Review" surfaces |
| Tags | Optional | free tags, multi | Anything not covered by a structured field |
| Notes | Optional | text | Freeform |
| Starred / Priority | Optional | boolean | |

**Why Client/Project/Function/Type/Jurisdiction/Status/Confidentiality/Version/Year are metadata and never folders:** every one of them is a dimension a single document can need simultaneously (the brief's own VT Worldwide/HR/Policy/Working Time/v0.3 example needs Client **and** Function **and** Type **and** Status **and** Confidentiality **and** Jurisdiction **and** Version all at once) — a folder tree can only ever express one hierarchy at a time. Client and Function/Type are asymmetric on purpose: Client *is* a folder (§2's rule) because "where does this physically live" needs exactly one right answer; Function/Type/etc. are tags because "what else is this" needs several right answers.

### 5.1 Function vocabulary — approved

```
Executive Office
Governance & Strategy
Legal & Compliance
Human Resources
Project & Programme Management
Finance & Investment
Operations & Administration
Research & Intelligence
```

Kept deliberately short and stable — validated against the literal folder-tree gap analysis, which found no case needing a ninth. In particular, HR's real internal variety (Governance & Policy, Digitalisation/HRMS, Performance Management) is carried by **Workstream** (§3.1), not by splitting Human Resources into three Functions — the same fragmentation the brief opened by objecting to. "Clients & Consulting Engagements" is deliberately *not* a Function value: Client/Engagement is already its own dimension (§3.1); making it a Function too would collapse two orthogonal axes back into one.

**Succession Planning is the one topic that genuinely splits by context rather than defaulting to a single Function:** ordinary succession/leadership-development material is `Human Resources`; board- or executive-level succession (CEO succession, board composition planning) is `Governance & Strategy`. The document's actual audience and stakes decide which, not a fixed rule — consistent with the general principle that Function follows subject matter, not who happens to be handling it (§C of the gap analysis).

**Finance & Investment scope boundary:** this Function covers executive/strategic/investment-level financial documentation the account holder personally handles — management financial reports, investment papers, financial forecasts, valuation reports, funding/banking documentation, project budgets, fund/investment structuring notes, and financial information supporting a management decision or forming part of a client/project/matter. It explicitly **excludes** operational accounting/bookkeeping — general ledger processing, routine bookkeeping, payroll processing, routine expense processing, and other transactional accounting operations. That material is out of scope for Executive Vault entirely (it belongs to a ledger/payroll system — the platform's own separately-scaffolded `platform-services/payroll`, or an external bookkeeping tool) and is never migrated into this vault, active or archived. The dividing line: **accounting transaction processing is out of scope; executive/strategic/investment/project financial documentation is in scope.**

**Property, vendor, and safety/security material** (office leases, vendor and supplier contracts, safety/security compliance documents) gets **no dedicated Function or folder** — it may legitimately arise under `Operations & Administration`, inside a Client Engagement or Project/Matter, or under `Legal & Compliance`, depending entirely on context. Document Type and free tags carry it; no permanent branch is created for it.

### 5.2 Document Type vocabulary — approved

```
Policy                       Contract / Agreement          Minutes                       Agenda
Resolution                   Proposal                      Report                        Management Paper
Framework                    Deliverable                   Template                      Correspondence
Note                         Executive Summary              Certificate / Registration    Briefing Note
Itinerary                    Litigation File
```

Eighteen values — each a genuinely distinct document *shape*, never a subject-matter variant. The literal folder tree's regulator/jurisdiction/tax-type folder splits (MAS/IRAS/ACRA, GST/Corporate Tax, Trademark/Copyright, Malaysia/Singapore) are exactly the pattern this model exists to absorb: those become free tags on top of one of the eighteen types (e.g. `Certificate / Registration` + tag `Trademark`), never a nineteenth, twentieth, twenty-first type. `Management Paper` covers board/decision-facing papers (governance content, any Function); `Litigation File` is used on documents inside a Litigation Matter (§3.1 — litigation is matter-based, not a standing folder); `Briefing Note`/`Itinerary`/`Agenda` cover Executive Office scheduling-adjacent material without needing an Outlook Calendar integration (explicitly out of scope, §11) — they're documents *about* scheduled things, not a live calendar.

---

## 6. Document naming convention

```
[Client/Entity Code or "INT" for internal] – [Function Code]-[Sequence] – [Document Title] – [Version] [– Status, if not obvious from version]
```

Examples, matching the brief's own:
- `VT-HR-025 – Resignation, Termination & Offboarding Policy – v0.4 – Client Review`
- `HR-124 – Lark Digital Acknowledgement Workflow Specification – v0.1`
- `MRE – HR Operating Model Proposal – v0.1`
- `NUS – Executive Summary Note`

The Document ID (`VT-HR-025`, `HR-124`) is **suggested, not enforced** — the app proposes `[ClientCode]-[FunctionCode]-[next sequence]` when a Client and Function are both set, but a document can be saved with no ID at all. Client codes are short, user-defined aliases set once per engagement (VT, MRE, NUS…), stored on the Engagement record, not re-derived from the name string each time.

---

## 7. Document lifecycle

```
Draft → Working Draft → Internal Review → Management Review → Client Review → Pending Information
  → Approved → Final → Issued → Superseded → Archived
```

Not every document passes through every stage — a template goes straight to `Final`; an internal-only policy may never see `Client Review`. The stage set above is the full vocabulary; a given document's own path through it is whatever subset applies.

**Version display, without inventing a parallel version-control system:** the app shows the chain of *logical version labels* the user has assigned over time (`v0.1 → v0.2 → v0.3 → v0.4 → v1.0 Final`) as a simple horizontal strip on the Document Detail screen (§9.6). Each label is a metadata record pointing at the Drive file (and, once available, a specific Drive revision ID) at the moment that label was assigned — it is a **label history, not a diffing or storage system**. Google Drive's own native "Version history" (File → Version history) remains the actual byte-level record and is opened via a direct link from the same screen, never re-implemented. If a document is renamed/replaced with a genuinely new Drive file at a major version boundary (common for `v1.0 Final`, less common for point revisions), the app links the two file records as a **version chain** rather than treating the new file as an unrelated document — this is the one place Executive Vault needs its own relationship, because Drive's version history cannot span two different file IDs.

**Superseded → Archived is a relocation, not a delete.** Marking a document "Superseded" or "Archived" in the app optionally offers to move the underlying Drive file into that engagement's `99 – Archive` folder (or the root `99 – Archive` for non-engagement documents) — the app never deletes a Drive file.

---

## 8. Google Drive integration architecture

**Principle: Drive is authoritative for file bytes and folder structure; the application database is authoritative for classification, tags, relationships, and saved views. Never the reverse, and never a duplicated file body.**

### Auth & scopes
- Google OAuth 2.0, user-consent flow, refresh token stored server-side (encrypted at rest), never in the browser.
- **Minimum scopes**, requested incrementally rather than all at once:
  - `drive.readonly` — browse/read metadata and content for anything the user's Drive account can already see. Needed for the Folder View, search, and preview.
  - `drive.file` — create/rename/move files and folders **the app itself creates or that the user explicitly opens through the app's picker.** This is the least-privileged way to allow uploads and folder creation without requesting blanket write access to the user's entire Drive.
  - Explicitly **not requested**: `drive` (full read/write scope) or `drive.metadata` beyond what `readonly` already covers. If a future feature genuinely needs broader write access (e.g. renaming files the user *didn't* open through the app), that is a deliberate, separately-justified scope escalation, not a default.
- No credentials, client secrets, or tokens are ever hard-coded; standard `.env.example`-documented variable names only, following this repository's existing convention (`CONTRIBUTING.md` "Environment variables and secrets").

### What the API is actually used for

| Capability | Google API surface | Notes / limitations |
|---|---|---|
| Browse authorised folders, list files | Drive API v3 `files.list` (`q=` parameter) | Straightforward |
| Open the original file | Drive API `webViewLink` | Just opens Drive/Docs/Sheets in a new tab — the app never renders a competing editor |
| Upload a file | Drive API `files.create` (multipart) | Under `drive.file` scope, so only files the app itself uploads are writable by the app afterward |
| Create a folder | Drive API `files.create` (mimeType `application/vnd.google-apps.folder`) | Used only by the "New Client Workspace" scaffolding action (§3) |
| Move / reclassify a file's physical location | Drive API `files.update` (`addParents`/`removeParents`) | Only for files the app has write access to under `drive.file` |
| Rename a file | Drive API `files.update` | Same scope constraint |
| Retrieve metadata (modified time, owners, size, mimeType) | Drive API `files.get`/`files.list` fields mask | Cached into the app DB, refreshed on sync |
| Retrieve a shareable link | Drive API `webViewLink`/`webContentLink` | Copy-to-clipboard action in the UI |
| Identify recently modified files | Drive API `files.list` sorted by `modifiedTime`, or the Drive Activity API | Activity API gives richer "what changed" events but is a separate, additional scope/API enablement — start with `modifiedTime` sorting; adopt Activity API only if "recently modified" proves insufficient in practice |
| Sync changes | Drive API `changes.list` with a stored `startPageToken` | Incremental sync, not a full re-list on every load |
| Search titles/metadata | Drive API `files.list` with `q=name contains …` | Always available |
| Search document **contents** | Drive API `files.list` with `q=fullText contains …` | **Real limitation, stated plainly rather than assumed away:** full-text search works well for native Google Docs/Sheets/Slides and for PDFs/images Drive has already OCR'd (which happens automatically for files opened in Drive, not instantly on upload). It does **not** reliably index arbitrary uploaded binary formats (e.g. some `.docx`/`.pptx` uploaded via API rather than opened in Drive's UI, scanned images with no OCR pass yet). The app's search (§10) is transparent about this: content-search hits are visually distinguished from title/metadata hits, and a result set is never presented as "we searched everything" when it didn't. |

### What is deliberately not built via the Drive API
- No re-implementation of Drive's own version history, sharing/permissions UI, or in-browser document editing — the app opens Drive for all of that.
- No background full-text indexing pipeline of the app's own (e.g. downloading file bytes to run OCR/embeddings) — that is exactly the "unnecessary duplicate store" the brief warns against, and Drive's own `fullText` search is used as-is, limitations included, until/unless there is a specific proven need to do more (§11).

---

## 9. Search architecture

Universal, command-style search (§9.9 below covers the UI). Under the hood, one search request fans out to two sources and merges:

1. **Application metadata search** (title, Document ID, Client, Project, Function, Document Type, Tags, Notes) — a straightforward indexed query against the app database. Instant, and the primary source of the rich result context the brief asks for ("VT Worldwide · HR-124 · Policy · v0.1 · Working Draft · Modified 18 Sep 2026 · Google Drive › Clients › VT Worldwide › HR Transformation").
2. **Drive content search** (`fullText contains`, §8) — run in parallel for the same query string, results merged in and marked as content matches rather than metadata matches.

Ranking: exact Document ID match first, then title match, then metadata-field match, then content-only match. Filters (Client, Engagement, Project/Matter, Document Type, Year, Status, Confidentiality, Jurisdiction, File Type) apply to the merged set. A query with no metadata record for a file that Drive still knows about (i.e., something in Drive that was never opened/classified in the app) still surfaces — labeled unclassified — rather than being invisible until someone files it. Legacy-flagged clients (§3a) are excluded from search by default, with an explicit "include Legacy" toggle to bring them back in when actually looking for old material.

---

## 10. Physical Drive folder vs. application metadata — the governing table

| Concept | Physical Drive folder? | Application metadata/tag? |
|---|---|---|
| Client | **Yes** (`03`/`04` root) | Also a reference field, for filtering/search/workspace grouping |
| Engagement / Project-Matter | No — nested *inside* the Client's Drive folder only via the Workstream subfolder-on-demand rule (§3), never their own folder layer | **Yes** — §3.1's reference chain, always available for filtering/grouping regardless of physical layout |
| Function (HR, Legal, Governance, …) | Only at the *group* level (§2 roots `02`,`05`–`09`) — never duplicated inside a client folder | **Yes**, always — this is how a client's HR document surfaces under "Human Resources" |
| Document Type | No | Yes |
| Status | No | Yes |
| Confidentiality | No (folder-level access control is not this tool's model, §0/§4) | Yes |
| Version | No (Drive's native revision history covers byte-level version; the label chain is metadata, §7) | Yes |
| Jurisdiction | No | Yes |
| Year | No | Derived from Created/Modified date, not stored separately |
| Workstream | Only once a client has 2+ concurrent workstreams (§3) | Always available as a tag regardless, scoped to its Project/Matter (§3.1) |
| Regulator (MAS/IRAS/ACRA, …) | No | Yes — a free tag alongside Jurisdiction, not a folder split |
| Legacy business line | No — never an active root folder | Client-level `legacy: true` flag (§3a); physically relocated to `99 – Archive / Legacy Business Lines` |
| Confidentiality-tier visual flag | No | Yes (display only, §4) |

---

## 11. What should NOT be built yet

Directly from the brief's own §12/§17 instruction, plus scope calls made while designing the above:

- **No multi-user permission system.** Confidentiality tiers are display/filtering only (§4/§0). If Executive Vault ever needs real access control, that is `platform-services/identity` + RBAC, reused, not reinvented — never a second bespoke permission model in this app.
- **No custom content-indexing/OCR/embeddings pipeline.** Drive's own `fullText` search is used as-is (§8/§9), limitations disclosed in the UI, not silently patched over with a parallel index.
- **No AI-driven auto-classification.** Simple rule-based *suggestions* (e.g. "this filename looks like a HR-series ID, suggest Function = HR") are fine later; predictive/ML classification is out of scope now.
- **No workflow/approval engine.** "For Review"/"Client Review" are status values a person sets, not a routed approval process with notifications and escalation (that already exists, deliberately separately, as `platform-services/workflow`).
- **No Decision Tracker, Policy Monitor, Meeting Intelligence, Risk & Escalation register, Report Data Packs, or Audit Trail module** (brief §17's own list) — these are plausible *future* directions once the core vault is validated, not part of this build.
- **No real-time collaborative editing surface.** Editing always happens in Drive/Docs/Sheets/Slides via "Open Original."
- **No native mobile app.** Responsive web only, desktop-primary, per the brief.
- **No server-side audit sink beyond ordinary logs.** Data Vault's `security_audit_events` model is a governance requirement for a shared, RBAC-gated system; a personal single-user tool doesn't have the threat model that justifies it yet.
- **No production Google OAuth wiring in this phase** — Phase 3 (`apps/executive-vault/`) runs entirely on mock data; Phase 4 is a separate, later design/build pass, explicitly gated on this document and the prototype being validated first.

---

## 12. Recommended navigation (revised)

The brief's proposed nav (§4) is a good starting draft. Two changes, both aimed at removing duplicate "places that do the same job":

1. **Document Registry is not a separate root item** — it's the *Intelligent View* tab inside "My Document Vault" (§9.2). Keeping it as a second SYSTEM-level nav entry would recreate exactly the "same document reachable two different, inconsistent ways" problem the brief is trying to eliminate. It is still reachable directly (deep link + its own screen identity, §9.7) — it's demoted from a root nav item to a vault tab.
2. **Governance & Strategy is one KNOWLEDGE entry**, matching the merged root folder in §2 (avoids maintaining two names — "Corporate Governance" in the nav, "Governance & Strategy" as a folder — for the same thing).

```
HOME
  Executive Home

DOCUMENTS
  My Document Vault        (Folder View + Intelligent View, incl. Registry — §9.2/§9.7)
  Recent Documents
  Starred / Priority
  Working Drafts
  For Review
  Final / Issued
  Archive & Superseded

WORK
  Clients & Engagements    (workspace list → §9.3)
  Projects & Programmes    (workspace list → §9.4, same underlying screen as Clients)
  Meetings & Decisions
  Tasks / Follow-Up

KNOWLEDGE
  Governance & Strategy
  Legal & Compliance
  Human Resources
  Project & Programme Management
  Finance & Investment
  Operations & Administration
  Research & Intelligence

SYSTEM
  Executive Inbox           (§9.8 — promoted out of DOCUMENTS since it's a distinct workflow, not a filed state)
  Google Drive              (opens Drive directly)
  Tags & Classification
  Templates
  Settings
```

"Working Drafts" / "For Review" / "Final / Issued" / "Archive & Superseded" under DOCUMENTS are **saved views** over the same Intelligent View table (status = X), not separate screens with separate code paths — this keeps the lifecycle statuses in §7 as the single source of truth for what "Draft," "For Review," etc. mean everywhere they appear.

---

## 13. UX architecture — screen by screen

### 13.1 Executive Home
**Purpose:** answer "what's going on" in one glance; the only screen designed to be read top-to-bottom rather than searched.
**Contains:** Document Overview counts (Total/Active/Working Drafts/For Review/Final/Archived — each count click-through filters straight into the Intelligent View), My Current Work (active clients/projects/workstreams + upcoming reviews, each a card linking to its Workspace), Attention Required (awaiting review, unclassified, potential duplicates, stale drafts, missing version, confidential items, follow-ups — each a filtered list, not a vague banner), Recently Modified, Quick Access (Recent/Starred/Pinned Clients/Pinned Projects/Templates), Upload and New Workspace actions, and the universal search bar anchored at the top of every screen, not just this one.
**Interaction:** everything here is a shortcut into a filtered Intelligent View or a Workspace — Home holds no data of its own that isn't derivable elsewhere.

### 13.2 My Document Vault
**Purpose:** the primary working surface — browse and manage documents both the way Drive already organizes them and the way the metadata model organizes them.
**Folder View:** a conventional tree mirroring Drive's actual structure (§2), read-heavy, minimal chrome — for when the user already knows physically where something is.
**Intelligent View:** the database/table registry (columns per §5's field list), with filter/sort/search, saved views, inline classification (quick-set Client/Type/Status without opening the full record), preview drawer (§13.6), bulk actions (archive, reclassify, star). This *is* the Document Registry (§12) — same screen, addressed directly when the brief calls for a registry.
**Interaction:** the two views share one underlying dataset and one preview drawer; switching views never loses the current filter/search state.

### 13.3 Client Workspace / 13.4 Project Workspace
**Purpose:** answer the brief's own six questions for one client — what's been done, what's outstanding, latest document, what version was sent, what the client confirmed, what still needs closing — without leaving the client's context.
**Contains:** Overview (key contacts/dates, plus a compact Engagement → Project/Matter → Workstream summary per §3.1 — not a separate screen, just a nested list with document counts per level), the client's Drive subfolder structure (§3) as a scoped Folder View, a scoped Intelligent View for just this client's documents (filterable by Engagement/Matter/Workstream), Meetings & Decisions, Action Items/Deliverables, and an Archive tab.
**Client vs. Project:** the same screen template, since both are the same underlying record type (§3) — a Project Workspace simply has no "Client Overview" contact-card content and is filed under root `04` instead of `03`.
**Interaction:** "What was the latest document?" and "What version was sent?" are answered by the Deliverables/Final-Issued tabs plus the version chain (§7) on any given document — not a separate feature. A Workstream row in the Overview's nested summary carries a "Promote to standalone Project/Matter" action (§3.1) for the case where a workstream has outgrown its parent matter.

### 13.5 Search Results
**Purpose:** the command-palette query's landing screen when more than a quick jump is needed (the palette itself can also jump directly to a single unambiguous result).
**Contains:** merged metadata+content results (§9), each shown with the brief's own example context format (Client · Doc ID/Title · Type · Version · Status · Modified date · Drive path breadcrumb), filter rail (Client/Project/Type/Year/Status/Confidentiality/Jurisdiction/File Type), and a visible distinction between metadata matches and Drive-content-only matches (§8's disclosed limitation).

### 13.6 Document Detail / Preview
**Purpose:** the single place every "open a document" action lands, whether reached from Vault, Search, or a Workspace.
**Contains:** metadata panel (editable inline, progressive — only Name is ever mandatory), version chain strip (§7), classification chip with the tier legend on hover, "Open Original" (Drive `webViewLink`), "Copy Drive Location," Drive breadcrumb path, and — where the file type supports it — an inline preview via Drive's embeddable preview, not a re-implemented renderer.
**Interaction:** available as a full screen (deep-linkable, e.g. from Search) or as a slide-in drawer over the Vault/Workspace table, so classifying a batch of documents never requires a full navigation round-trip.

### 13.7 Document Registry
Addressed as the Intelligent View tab of My Document Vault (§13.2) rather than a separate screen — see §12 for why.

### 13.8 Executive Inbox
**Purpose:** the deliberate release valve named in the brief — "classify later" made real. A file can be uploaded or dropped here with *zero* required fields beyond the file itself.
**Contains:** a simple, flat list of unclassified items, each with a one-click "Classify" action that opens the same progressive metadata panel as Document Detail, and a visible count that feeds Executive Home's Attention Required section.
**Interaction:** items never auto-expire or auto-file themselves out of the Inbox — leaving something here is a valid, indefinite state, not a mistake the UI nags about beyond the one Attention Required line.

### 13.9 Archive
**Purpose:** where Superseded/Archived documents (§7) live, kept easily reachable rather than hidden, because "what did I used to have" is a real executive question.
**Contains:** the same Intelligent View, filtered to Status ∈ {Superseded, Archived}, with an "Unarchive" action (reverses the status, and offers to move the Drive file back out of `99 – Archive` if it was relocated there).

---

## 14. Summary — what happens next

1. ~~Review this document~~ — **done.** The root folder set (§2), the client template (§3), the classification tiers (§4), the Client/Engagement/Project-Matter/Workstream model (§3.1), the Legacy treatment (§3a), and the Function/Document Type vocabularies (§5.1/§5.2) have all been validated against the actual historical Executive Office Hub folder tree and approved — see `executive-document-vault-gap-analysis.md` for the full reasoning.
2. ~~Share the actual existing Drive hierarchy~~ — **done**, and validated branch-by-branch.
3. `apps/executive-vault/` is being updated to match this approved architecture (Client/Engagement/Project-Matter/Workstream nesting, the revised vocabularies, Legacy handling, workstream promotion) — still mock data, still no live Drive connection.
4. Only after 3 is settled: scope Phase 4 (real OAuth, real Drive API wiring, real sync) as its own, separate piece of work.
