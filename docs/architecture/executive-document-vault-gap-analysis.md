# Executive Vault — Information Architecture Gap Analysis (v1)

Status: **analysis only.** No change has been made to `docs/architecture/executive-document-vault.md`, to `apps/executive-vault/`, or to any code, per explicit instruction. This document records findings and recommendations for the next revision; applying them is separate, future work pending sign-off.

## Inputs this analysis is actually built from

**No literal Drive folder tree was received** — it was requested twice and both times the placeholder came through unfilled. Rather than block a third time, this analysis uses the category-level signal actually provided, specifically:

1. The overlap-check list from the gap-analysis request: *Corporate Governance, Executive Level, Investment & Finance, Accounting & Finance, Operations, Project Management, HR, Legal, Compliance, Executive Scheduling.*
2. The Sabah correction: the old hierarchy contains *Sabah business development*, *Sabah environmental/land-use compliance*, and *resort development* — now explicitly legacy, not to be carried into the active architecture.
3. The "what I'm actually doing now" list: Corporate Governance & Strategy, Executive Management/Executive Office, Clients & Consulting Engagements, HR Governance & Policy, HR Digitalisation/HRMS Workflows, Performance Management, Legal & Compliance, Project/Programme Management, Management Papers & Decision Materials, Meetings/Minutes & Executive Summaries, Enterprise Platform/Data Vault Development, Research & Intelligence, Implementation Frameworks, Client Deliverables, Internal Governance.
4. The jurisdiction correction: Malaysia/Singapore/Labuan-style geography should be metadata, not a permanent top-level folder, "unless genuinely required by a particular client, project, legal matter or document."

Everything below is checked against what actually exists today in `docs/architecture/executive-document-vault.md` and `apps/executive-vault/data.js`/`app.js` (the real `FUNCTIONS` enum, root folder list, and `ENGAGEMENTS`/`DOCUMENTS` mock records) — not re-derived from memory.

---

## A. What should remain a physical Google Drive folder

Holds up, largely unchanged from the existing design:

- **Client/engagement folders** (`03 – Clients & Engagements/<name>`, `04 – Projects & Programmes/<name>`) — you browse and hand things to people by client, so this stays a real folder. No change.
- **The functional group roots** (`02 Governance & Strategy`, `05 Legal & Compliance`, `06 HR & Org`, `07 Finance & Investment`, `08 Operations`, `09 Research & Intelligence`, `10 Templates & Reference`) — but only for material that is *genuinely not* tied to one engagement (group policy masters, templates, reference research). Confirmed correct, no change.
- **`00 – Executive Inbox`** and **`99 – Archive`** — unchanged.
- **New finding: `99 – Archive` needs an internal split**, not a new root folder — see §F below.

No new top-level folder is needed for anything in your "current work" list (§H) — everything you named maps into the existing `00`–`10`/`90`/`99` skeleton. That's a genuinely good outcome of this check: **the root structure survives**, the gaps are in the metadata/Function layer, not the folder layer.

## B. What should become metadata instead

Confirmed as already-correct metadata (no folders): Confidentiality, Jurisdiction, Document Type, Status, Year, Version. See §G for the jurisdiction correction specifically.

**Newly surfaced items that should be metadata, not new folders** (this is the main output of checking your current-work list against the existing model):

| Item you named | Should become | Not a folder because |
|---|---|---|
| HR Governance & Policy / HR Digitalisation & HRMS Workflows / Performance Management | **Workstream** values (or free tags) inside the existing `Human Resources` Function — not three separate Functions | These are three lenses on one discipline, not three different subject areas. Splitting them into top-level Functions would recreate the exact fragmentation problem the brief opened with. `HR-124` (Lark Digital Acknowledgement Workflow) is already correctly Function=HR, Workstream="HR Transformation" in the prototype — the gap is that "HRMS Workflows" and "Performance Management" aren't yet available as **Workstream** values to pick from. |
| Management Papers & Decision Materials | New **Document Type** value: `Management Paper` (or `Board Paper`) | A management paper is a document shape, not a subject area — it can be about governance, HR, finance, anything. Filing it by folder would force a false choice; tagging it by type lets it be found either by its Function or by "show me every management paper," which is what you actually want. |
| Implementation Frameworks | New **Document Type** value: `Framework` | Same reasoning — a framework document belongs wherever its engagement/function already puts it. |
| Executive Summaries | New **Document Type** value: `Executive Summary` (currently collapsed into the generic `Note` type) | |
| "Executive Scheduling" material (briefing packs, itineraries ahead of a meeting) | **Document Type**: `Briefing Note` / `Itinerary`, Function = `Executive Office` | This is the one place the correction matters directly: you said not to add Outlook Calendar yet — correctly, because "Executive Scheduling" in the old hierarchy most likely held *documents about* scheduled things (packs, itineraries), not a live calendar. Modelling it as a document type keeps it inside the vault's actual job (documents) without pulling in a calendar integration. |
| Client Deliverables | Already a valid **Document Type** (`Deliverable` exists in the prototype's type list) — needs a **saved view**, not a folder | "Client Deliverables" reads as "show me everything Document Type = Deliverable, across all clients" — a filter, not a place. |

## C. What's duplicated or overlapping — the 10 named categories

| Pair | The overlap | How the architecture resolves it |
|---|---|---|
| **Corporate Governance** vs. **Executive Level** | Both tend to accumulate board papers, executive correspondence, decision records | Split by *what the document is about*, not *whose desk it passed through*. Governance & Strategy Function = the content (board papers, group policy, strategic decisions) regardless of who drafted it. Executive Office Function = things that are inherently about running your own office (personal OKRs, exec admin, briefing packs) — never a duplicate copy of governance content, just a different lens on different material. |
| **Investment & Finance** vs. **Accounting & Finance** | Classic finance/accounting split named as a known problem in the original brief too | One Function — `Finance & Investment` — covers strategic/investment material you personally handle (fund structuring notes, financial board papers). Ordinary bookkeeping/statutory accounting is **explicitly out of scope for this personal vault** — that's operational accounting territory (the platform already has a separate, scaffolded `Accounting Pro` service planned for that), not an executive document vault concern. Stating this boundary explicitly resolves the overlap by removing one side of it from this system entirely, rather than trying to subdivide it further. |
| **Operations** vs. **Project Management** | Steady-state admin vs. initiative-specific delivery, easily conflated | `Operations & Administration` (root `08`) = ongoing material not tied to a discrete initiative. **New Function: `Project & Programme Management`** (see §D) = status reports, RAID logs, steering packs — filed inside the relevant client/project engagement folder (`03`/`04`), never under `08`. |
| **HR** vs. **Legal** vs. **Compliance** | Employment material is simultaneously HR and legally binding | Unchanged principle from the existing doc, now with a concrete worked pair already sitting in the prototype: `VT-LG-004` (Employment Contract Template) is Function=Legal & Compliance because it's a legal instrument; `HR-025` (Offboarding Policy) is Function=HR because it's a process/policy document, even though it references legal requirements. Document Type is what actually disambiguates — Function follows the primary lens, not the fact that HR and Legal both touch almost everything eventually. |
| **Executive Scheduling** | Named as its own category with no current home | See §B — resolved as a Document Type + Function=Executive Office, not a calendar feature and not a folder. |

## D. What's missing from the architecture already designed

Concrete gaps found by checking your current-work list against the real `FUNCTIONS` array and root structure in the repo today:

1. **No `Project & Programme Management` Function.** Today it's absorbed into nothing — `Operations` is the closest fit and that's wrong (see §C). You named Project/Programme Management as a distinct current-work category; the taxonomy should reflect that.
2. **No representation for Management Papers / Decision Materials.** The original architecture doc's §11 ("what not to build yet") deferred a full Decision Tracker — that deferral still holds (no tracker *module*), but "Management Paper" not existing as a **Document Type** at all is a real gap, not a deferred feature — it costs nothing to add and you named it as current, active work.
3. **Function-naming inconsistency.** The root Drive folder is `09 – Research & Intelligence`, but the `FUNCTIONS` array in `apps/executive-vault/data.js` has it as `"Research & Reference"`. You independently used "Research & Intelligence" in your current-work list — that's the name that should win; the mismatch should be fixed.
4. **The Client/Engagement/Project-Matter model is flatter than what you're now asking for.** See §E — this is the most structurally significant finding.
5. **No distinct handling for discontinued business lines.** The existing `99 – Archive` model was designed for *superseded versions of active-client work* (a document that's still conceptually part of a live client relationship, just an old version of it). It was never designed for *an entire business line that no longer exists* (Sabah). Treating both the same way means Sabah-era material would still show up in the Client/Function pickers used to classify new documents, exactly what you said not to let happen. See §F.
6. **HR needs Workstream-level granularity it doesn't yet have values for** — see §B; the field exists, the vocabulary doesn't yet.

## E. Reorganising around Client → Engagement → Project/Matter → Workstream

This is the most important structural finding, and the original architecture undersells it.

**What exists today:** `ENGAGEMENTS` conflates Client and Engagement into one record — a "client" *is* an engagement (one `engagementType: client|project`, one `workstreams[]` array directly underneath it). VT Worldwide the client and "the VT Worldwide HR Transformation engagement" are the same row.

**What you're now describing:** a genuine five-level chain —

```
Client              (an enduring relationship — e.g. VT Worldwide)
  └─ Engagement      (a discrete, time-bound contract/SOW — VT Worldwide could have more than one
                       over time, or two running concurrently: e.g. "2026 HR Transformation" and,
                       separately, a 2027 renewal or an unrelated legal matter)
      └─ Project/Matter   (a specific initiative or matter inside that engagement)
          └─ Workstream   (a thread of work inside that project/matter)
              └─ Document
```

**Why the flattened model breaks down:** it works fine for a client with exactly one ongoing engagement (which is true of VT Worldwide, MRE Asia, and Nusantara in the prototype today) — but it can't represent a *repeat* client with two separate engagements a year apart, or a client running an HR advisory and a separate legal matter concurrently, without either merging unrelated work into one record or duplicating the client as two unrelated rows (which loses the "this is the same relationship" fact you'd actually want).

**Recommendation:** promote Client to its own top-level record (name, relationship summary, all-time contact history, pinned status), with Engagement as a child record under it (what's active today for VT Worldwide/MRE Asia/Nusantara would become exactly one Engagement each — so nothing you'd see changes for them right now). Project/Matter and Workstream stay as they are conceptually, just formally nested one level deeper than Engagement rather than treated as the same thing as Engagement. This is a data-model change, not a UI rewrite — deferred to the actual rebuild, not done now.

## F. Legacy/Sabah treatment

**Rule to carry forward:** legacy business lines (Sabah business development, Sabah environmental/land-use compliance, resort development) get a distinct **Legacy** partition, not ordinary Archive treatment:

- Physically: `99 – Archive / Legacy Business Lines / Sabah …` — still reachable, never deleted, but visibly separated from the "superseded version of an active client's work" material that ordinary Archive holds.
- In the metadata model: Legacy material is **excluded from every active picker** — the Client selector, the Function dropdown, and any autocomplete used when classifying a *new* document — so it structurally cannot be reused going forward, rather than relying on nobody happening to pick it.
- On Executive Home: excluded from every dashboard count (Total/Active/Drafts/Review/Final and the Attention Required buckets) — it should be findable on purpose, never surfaced as if it were current.
- **Verified as already clean:** the current mock dataset in `apps/executive-vault/data.js` contains zero Sabah/resort-development references — there is nothing to remove from the prototype itself. This rule matters for the *next* revision and for whenever real Drive content is imported, not for anything currently built.

## G. Jurisdiction-as-metadata — validated, no change needed

Already correct in the existing architecture: §5 (metadata model) and §10 (folder-vs-metadata table) of `executive-document-vault.md` both already treat Jurisdiction (Malaysia/Singapore/Labuan/…) as a document-level tag, and the proposed root structure (§2) has no geography in it at all. This correction is confirmed as already satisfied — flagging it here as "checked," not as a finding that requires a change.

## H. Current-work category coverage checklist

| Category you named | Coverage today | Gap / action |
|---|---|---|
| Corporate Governance & Strategy | Covered — Function + root `02` | None |
| Executive Management / Executive Office | Covered — Function + root `01` | None |
| Clients & Consulting Engagements | Covered — root `03`, Client/Engagement dimension | Extend per §E when rebuilt |
| HR Governance & Policy | Partially — under HR Function, no Workstream vocabulary yet | Add Workstream values, §B |
| HR Digitalisation / HRMS Workflows | Partially — `HR-124` already models this shape | Add Workstream value, §B |
| Performance Management | Named only in mock notes today | Add Workstream value, §B |
| Legal & Compliance | Covered — Function + root `05` | None |
| Project / Programme Management | **Gap** | Add as its own Function, §C/§D |
| Management Papers & Decision Materials | **Gap** | Add Document Type, §B/§D |
| Meetings, Minutes & Executive Summaries | Mostly covered (Meetings & Decisions screen, `Minutes` type) | Add `Executive Summary` Document Type, §B |
| Enterprise Platform / Data Vault Development | Covered — already modelled as the SVE Group Enterprise Platform project | None |
| Research & Intelligence | Covered, but naming mismatch | Rename Function to match, §D |
| Implementation Frameworks | **Gap** | Add Document Type, §B |
| Client Deliverables | Covered as a Document Type | Add as a saved view, §B |
| Internal Governance | Covered — already an existing project | None |

Net: **6 of 15 categories need a small addition (mostly new metadata option values, not structural changes); 1 needs a genuine structural extension (§E); the rest are already correctly represented.**

## I. Recommended Function taxonomy (for the next revision)

Deliberately kept short and stable — the fix for HR's internal variety is Workstream/tag values (§B), not more top-level Functions, to avoid recreating the fragmentation the whole brief opened by objecting to:

```
Executive Office
Governance & Strategy
Legal & Compliance
Human Resources
Project & Programme Management   ← new
Finance & Investment
Operations
Research & Intelligence          ← renamed from "Research & Reference"
```

"Clients & Consulting Engagements" is deliberately **not** added as a Function value — Client/Engagement is already its own dimension (§E); making it a Function too would collapse two orthogonal axes back into one, the exact anti-pattern the architecture exists to avoid.

## J. Net verdict and what changes at the next revision

The root Drive folder structure and the overall Folder-vs-metadata split both hold up well against this check — no new top-level folders needed. The real gaps are one structural change (§E, Client/Engagement/Project-Matter) and a set of small, additive metadata changes (§B/§I): one new Function, a renamed Function, several new Document Type values, new Workstream vocabulary for HR, a Legacy partition rule for Archive, and confirmation that Jurisdiction was already correctly modelled.

**Proposed next steps (not started — pending your go-ahead):**
1. Update `docs/architecture/executive-document-vault.md` with the Function taxonomy change, the Client/Engagement/Project-Matter model, and the Legacy/Archive rule.
2. Update `apps/executive-vault/data.js`/`app.js` to match — new Function list, new Document Types, Workstream vocabulary, Legacy handling — still mock data, still no Drive integration.
3. Only after that: revisit whether the literal folder tree is worth pasting for a line-by-line pass, or whether this category-level analysis was sufficient.

Google Drive integration and Outlook Calendar remain untouched and out of scope, as instructed.

---

# Addendum — Literal Folder Tree Validation (v2)

Status: **analysis only, appended to the existing document rather than replacing it**, per instruction. The literal historical "Executive Office Hub" tree has now been provided and is validated branch-by-branch below against the v1 findings above. **No change has been made to `docs/architecture/executive-document-vault.md` or `apps/executive-vault/` in this pass either.**

**Overall result: v1 holds up well.** Every v1 finding is either confirmed outright or sharpened with concrete evidence from the real tree; nothing in v1 is contradicted. The literal tree also surfaces a small number of genuinely new items v1's category-level pass could not have caught (Succession Planning, the wholesale legacy status of the old operating-company material, and the Accounting/bookkeeping scope boundary needing to be stated more forcefully than v1 stated it).

## 1–6. Branch-by-branch validation

### 1. CORPORATE GOVERNANCE & STRATEGY

- **Board Level, Articles of Incorporation, Shareholders' Agreements, Board Minutes & Resolutions, Corporate Strategy Documents** → all confirmed **Governance & Strategy**, all **move to metadata** (Document Type: Constitutional Document / Shareholders Agreement / Resolution / Minutes / Strategy Paper). No folder depth needed beyond root `02`.
- **Mergers & Acquisitions** → new finding (missed in v1): an M&A situation is episodic and pulls in legal, financial and governance material at once — it should be its own **Project/Matter** when active (e.g. under Internal Governance, or its own matter workspace), not a standing folder that sits empty between deals. **Move to Client/Project.**
- **Legal Compliance & Regulatory Filings → MAS / IRAS / ACRA** → these are regulator names, not a folder hierarchy. New metadata value needed: **Regulator** (MAS/IRAS/ACRA/…), alongside the existing Jurisdiction field. **Move to metadata.**
- **Confidential Investment Proposals** → Document Type = Proposal, Confidentiality = Highly Confidential already covers the word "Confidential" in the old name — exactly the outcome §G of v1 predicted (classification metadata absorbing what used to be baked into a folder name). **Confirmed, move to metadata.**
- **Joint Venture Agreements → Malaysia / Singapore** → textbook jurisdiction-as-folder, exactly what the correction asked to stop doing. **Move to metadata** (Document Type = Contract/Agreement, Jurisdiction tag).
- **"Executive-Level" (the whole sub-branch: Financial Reports, Risk Management & Internal Audit, Investor Relations, Major Contracts, Partnership & Licensing Agreements, Company Policies & Governance Codes)** → this is the single most useful validation in the whole tree: it **proves** the Corporate-Governance-vs-Executive-Level overlap v1 predicted in §C. None of this content is actually "executive office administration" — it's governance and finance content that got filed under an "Executive" banner simply because of *whose desk it passed through*. v1's resolution rule (Function follows subject matter, not who handled it) is confirmed as the right fix, not merely plausible.
  - Financial Reports (Annual/Quarterly/P&L/Balance Sheet) → **Finance & Investment**, Document Type = Report, with **Annual/Quarterly as a Period metadata value**, not folder depth (new finding).
  - Risk Management & Internal Audit → **Governance & Strategy**, Document Type = Report.
  - Investor Relations Documents → no match anywhere in the current-work list. See §3 below — **retire as an active category**; any real historical documents go to Legacy/Archive, not deleted.
  - Major Contracts → Resort Development / Fundraising / Property Deals: **Resort Development is legacy** (see §4 — this is its first of three appearances in the tree, which matters). Fundraising/Property Deals → Document Type = Contract/Agreement, metadata tag for the subtype.
  - Partnership & Licensing Agreements, Company Policies & Governance Codes → Document Type = Contract/Agreement and Policy respectively, Function = Governance & Strategy. Confirmed, metadata.

### 2. INVESTMENT & FINANCIAL DOCUMENTS

- **Investment sub-branch** (Proposals & Feasibility Studies, Private Equity & Debt Agreements, Financial Forecasts & Valuation Reports, Loan & Banking Agreements, Funding Applications, Taxation Reports, Asset/Property Ownership) → all **Finance & Investment**, all move to metadata (Document Type = Proposal/Report/Contract + a free tag for the specific flavour). Confirmed.
- **Accounting & Finance sub-branch** (General Ledger & Financial Statements, Tax Compliance [GST/Corporate Tax], Payroll & Employee Compensation Reports, Procurement & Vendor Payment Records, Budgeting & Cost Control, Expense Reports & Reimbursements) → **this sharpens v1's finding rather than just confirming it.** v1 said ordinary bookkeeping is "out of scope." Seeing the actual branch makes the case harder, not softer: this is high-volume, recurring, transactional record-keeping — the job of a ledger/payroll system (the platform's own separately-scaffolded `platform-services/payroll`, or a bookkeeping tool), never a personal executive document vault. **Recommendation firms up to: this entire sub-branch is out of scope for Executive Vault, full stop** — not "add Document Types for it," not "file it under Finance & Investment." Existing/live accounting records should keep being managed wherever they are today; nothing here should be migrated into Executive Vault, active *or* archived, because it was never live in this tool to begin with.

### 3. OPERATIONAL & PROJECT MANAGEMENT DOCUMENTS

- **Operations & Logistics sub-branch** (Real Estate & Resort Development Plans, Infrastructure Development Agreements, Logistics & Supply Chain Agreements, Construction & Infrastructure Agreements) → this is the old physical-development/resort operating business, the same era as Sabah. **"Resort Development" appears here for the second time** (see §1 and §6) — three independent appearances of the same phrase across three different root branches is strong corroborating evidence that the whole physical-development line is legacy, not just the two spots you explicitly tagged. **Recommended: Legacy/Archive**, flagged here for your explicit confirmation since only Sabah and the literal words "Resort Development" were tagged by you directly — I'm extending the inference to the surrounding infrastructure/logistics/construction material on the grounds that it has no plausible home in any current-work category and shares the same era. Tell me if any of it is still live and I'll pull it back out.
  - **Business Development Plans → Singapore / Sabah**: Sabah branch → confirmed Legacy/Archive. Singapore → if still active, Document Type = Business Development Plan (new type, or just "Proposal" + tag), Jurisdiction metadata, Function = Governance & Strategy.
  - **Property & Lease Agreements, Vendor & Supplier Contracts, Safety & Security Compliance** → genuinely ambiguous — every organisation needs an office lease and vendor contracts regardless of business model, so these *could* still be live. Recommended: **move to metadata** (Document Type = Contract, Function = Operations) rather than retiring outright, but flagged for your confirmation rather than asserted.
  - **Environmental & Compliance Reports → Malaysia / Singapore** → **this duplicates §6's "Environmental & Land Use Compliance" branch exactly** (same subject, two different root categories — Operations here, Legal & Compliance there). This is concrete, textual proof of the kind of duplication the original brief opened by warning about. **Merge**: one Document Type (Environmental Compliance Report), Function = Legal & Compliance, Jurisdiction metadata. Sabah's instance specifically → Legacy/Archive.
- **Project Management sub-branch** → this branch **is the direct historical ancestor of v1's "add a Project & Programme Management Function" recommendation** — its existence in the real tree confirms that recommendation was correctly targeted, not a guess.
  - Project Proposals & Execution Plans → Document Type = Proposal/Framework, Function = Project & Programme Management.
  - Milestone Reports & Progress Updates, Budget & Resource Allocation → these are inherently scoped to one project, not to a standing group-level folder — **move to Client/Project** (filed inside whichever engagement's Project/Matter they belong to).
  - Construction & Infrastructure Agreements → same legacy cluster as above.
  - Training & Capacity-Building Plans → overlaps with HR's "Training & Development" branch below. Resolved by audience, not folder: capacity-building **for a client**, as part of a consulting engagement → move to Client/Project; internal/personal development → stays a Human Resources tag (see §4).
  - Safety & Security Compliance Documents → same ambiguous case as Property/Vendor above; flagged, not assumed retired.

### 4. HR & EMPLOYEE-RELATED DOCUMENTS

Strongest validation in the whole tree for v1's HR recommendation.

- **HR Governance** → confirms the current-work category "HR Governance & Policy" directly. Workstream value under Function = Human Resources, as v1 already proposed. Confirmed, no change.
- **Employee Contracts & Agreements** → Document Type = Contract, Function judgment call between HR and Legal & Compliance exactly as v1's §C already described (already correctly modelled in the prototype via `VT-LG-004`). Confirmed.
- **Compensation & Benefits Plans** vs. **Payroll & Employee Compensation Reports** (under Accounting, §2) → useful disambiguation surfaced by seeing both side by side: **Plans** (policy/design documents — HR's job, Function = Human Resources) are in scope; **Reports** (payroll run outputs — a payroll system's job) are the out-of-scope Accounting material from §2. Same word, two different documents, resolved by which side of the design/design vs. transactional-output line they're on.
- **Performance Reviews & Appraisal Reports** and **Key Performance Indicators & Workforce Analytics** → confirm the current-work category "Performance Management" directly. Workstream value, as v1 proposed.
- **Succession Planning & Leadership Development** → **genuinely new, missed by v1's category-level pass.** Doesn't cleanly map to Performance Management or HR Digitalisation. Recommendation: Document Type = Report or Framework (not a new dedicated type — see §9), Function = Human Resources for general leadership-pipeline material, Function = Governance & Strategy specifically for board-level/CEO succession (again: subject decides Function, not the folder it happened to sit in historically).
- **Workplace Safety & Employee Well-being Policies** → Document Type = Policy, Function = Human Resources. Confirmed, metadata.
- **Training & Development sub-branch** (Learning & Development Plans, Employee Training Records, Competency & Skills Assessment Reports) → flagged in your "pay particular attention" list, and rightly so: it has no match in your current-work list. Recommendation: **merge** into Human Resources as ordinary Document Type/tag material — no dedicated Function, no dedicated Workstream unless it becomes active again. Not legacy (not discontinued), just no longer warranting its own structural billing.
- **HR Digitalisation Strategy → Appraisal / Workforce Analytics** → confirms "HR Digitalisation / HRMS Workflows" directly, and its nesting *under* Training & Development in the old tree (rather than as its own branch) is itself informative — it shows the old hierarchy already sensed this was different from ordinary L&D but had nowhere else to put it. Given its weight in your current-work list, recommend treating it as more than a tag: if it's a real ongoing programme with its own milestones (which `HR-124`'s existence suggests it is), it deserves its own **Project/Matter** record — e.g. nested under Internal Governance or the Enterprise Platform project — with "HR Digitalisation / HRMS Workflows" as both that Project's name and the Workstream tag used on its documents.

### 5. MARKETING & PUBLIC RELATIONS DOCUMENTS

Flagged in your "pay particular attention" list. **Zero overlap with the current-work list.** Recommendation: **retire the entire root category** — no Function, no root folder, no Document Types minted for it. One exception: **Market Research & Competitive Analysis** has an obvious live home and should not be retired with the rest — it merges directly into the existing **Research & Intelligence** Function (Document Type = Report, tag = market/competitive research). Everything else (Marketing Strategy, Branding & Communication Guidelines, Digital & Social Media Strategies, Advertising Budgets & Campaign Plans, Press Releases, Investor Presentation Decks, CSR Initiatives, Website & Promotional Materials) → retire as active categories; any real historical documents → Legacy/Archive, not deleted.

### 6. LEGAL & COMPLIANCE DOCUMENTS

- **Contracts & Agreements → Fundraising / Resort Development** → Resort Development's **third** appearance (§1, §3, §6) — see §4 of the summary below. Fundraising → metadata, as elsewhere.
- **Litigation & Dispute Resolution Files** → new finding: litigation is inherently matter-based (one dispute = one matter, with its own document set and its own sensitivity). **Move to Client/Project** — a litigation matter gets its own Project/Matter record (under Internal Governance if the company is a party, or under the relevant client's Engagement if it's engagement-related), Confidentiality = Highly Confidential by default, Document Type = Litigation File (new — see §9).
- **Intellectual Property → Trademarks / Copyrights** → Document Type = Certificate/Registration (new, consolidated — see §9), Function = Legal & Compliance, IP type as a free tag rather than a folder split.
- **Data Protection & Privacy Policies** → already correctly modelled in the prototype (`INT-LG-005`). Confirmed, no change.
- **Employment Law Compliance Reports** → Document Type = Report, Function = Legal & Compliance.
- **Anti-Money Laundering & Know Your Customer Files** → refined from v1: KYC/AML files are compiled **per client/counterparty**, so this is a **move to Client/Project** case, not a generic group-level folder — filed inside that client's own Engagement (e.g. under "02 – Information Received"), not a standing AML root.
- **Business Licences & Permits** → Document Type = Certificate/Registration, Entity + Jurisdiction metadata. Low-volume, stable — stays at root `05`, no folder depth.
- **Environmental & Land Use Compliance → Sabah / Singapore** → confirmed duplicate of §3's Operations branch — see the merge recommendation there. Sabah's instance → Legacy/Archive.
- **Internal Policies & Ethics Guidelines** → Document Type = Policy, Function = Governance & Strategy or Legal & Compliance (either is defensible; not worth forcing a single answer).

### 7. EXECUTIVE SCHEDULING & COORDINATION

Flagged in your "pay particular attention" list (C-Suite Travel specifically) — and this branch turns out to need the *least* correction of any of them; it validates v1's §B/§C resolution almost exactly as written.

- **C-Suite Travel Itineraries** → Document Type = Itinerary, Function = Executive Office. This is the literal example v1 predicted before ever seeing the real tree — confirmed, not revised.
- **Meeting Agendas & Minutes** → refinement, not a reversal: the *scheduling artefact* (an agenda, a coordination note) is Executive Office, but *what the meeting was actually about* belongs to whatever Function/Client that content concerns — a VT Worldwide steering committee's minutes file under VT Worldwide's engagement, Function = whatever was discussed, not automatically Executive Office just because it was a meeting.
- **Task Assignments & Action Items** → already fully modelled by the prototype's existing Tasks/Follow-Up feature (`TASKS`) — this isn't even a document category, it's exactly the lightweight tracker already built. No change needed, and a good confirmation that that screen was scoped correctly the first time.

### Classification terms (Confidential / Restricted / Controlled)

Confirmed already correctly absorbed by the existing 5-tier model (Highly Confidential / Confidential / Restricted / Controlled / General) designed in the original architecture doc — no change. These three words appearing throughout the old tree's document names is itself evidence the 5-tier metadata model is doing its job: none of them need to reappear in a folder name again.

## 7. Confirm or revise: Client → Engagement → Project/Matter → Workstream

**Confirmed, and reinforced rather than merely repeated.** Three independent findings from the literal tree all point the same direction: M&A activity (§1), Litigation (§6), and KYC/AML files (§6) each need Matter-level granularity that sits *below* a Client's main Engagement, not inside it — a client could have an ongoing HR Transformation Engagement and, separately, an unrelated Litigation Matter, at the same time. v1's proposed five-level chain (Client → Engagement → Project/Matter → Workstream → Document) is the right shape; this pass didn't surface anything that would change it, only more reasons it's needed.

## 8. Final Function vocabulary — confirmed

```
Executive Office
Governance & Strategy
Legal & Compliance
Human Resources
Project & Programme Management
Finance & Investment
Operations & Administration      ← minor rename from "Operations" for consistency with
                                    the root folder name (same fix already applied to
                                    Research & Intelligence in v1 §D)
Research & Intelligence
```

Eight Functions, unchanged in count and substance from v1 — the literal tree validated every one of them and required no ninth. Marketing/PR and Accounting, the two branches with no current-work match, get **no** Function of their own (retired/out of scope respectively), rather than being kept "just in case."

## 9. Final Document Type vocabulary — confirmed, consolidated

The literal tree's regulator/jurisdiction/tax-type folder splits (MAS/IRAS/ACRA, GST/Corporate Tax, Trademark/Copyright, Malaysia/Singapore/Sabah) are exactly the pattern the metadata model exists to absorb — so rather than minting a new Document Type for every named variant in the old tree (which would just rebuild the same fragmentation one layer down, as a 30-value dropdown instead of a folder tree), the same "short, stable list + free tags carry the detail" principle already used for Functions and HR Workstreams is applied here too:

```
Policy
Contract / Agreement
Minutes
Agenda
Resolution
Proposal
Report
Management Paper
Framework
Deliverable
Template
Correspondence
Note
Executive Summary
Certificate / Registration
Briefing Note
Itinerary
Litigation File
```

Finer distinctions the old tree carried as folder names — GST vs. Corporate Tax, Trademark vs. Copyright, Loan Agreement vs. Funding Application vs. Shareholders Agreement, Annual vs. Quarterly — become free tags or the existing Notes field on top of one of the eighteen types above, not new controlled values. `Succession Plan` and `Environmental Compliance Report`, both named directly in the tree, are deliberately *not* added as their own types for the same reason — they're `Report`/`Framework` plus a tag.

## 10. Final active root structure — confirmed, unchanged

```
00 – Executive Inbox
01 – Executive Office
02 – Governance & Strategy
03 – Clients & Engagements
04 – Projects & Programmes
05 – Legal & Compliance
06 – Human Resources & Org
07 – Finance & Investment
08 – Operations & Administration
09 – Research & Intelligence
10 – Templates & Reference
90 – Personal Working Files
99 – Archive          (now with an internal "Legacy Business Lines" partition — see below)
```

**Zero new root folders were needed even after validating against the literal tree** — every real branch in the old hierarchy maps into this existing skeleton via metadata, a Client/Project relocation, or a Legacy/Archive/Retire decision. That the root survives a literal, line-by-line check unchanged is the strongest evidence yet that the architecture's folder-vs-metadata split was designed correctly the first time.

## Final summary

| Historical category | Disposition |
|---|---|
| Board Level / Articles of Incorporation / Shareholders' Agreements / Board Minutes & Resolutions / Corporate Strategy | **KEEP** — Governance & Strategy, metadata-driven |
| Mergers & Acquisitions | **MOVE TO CLIENT/PROJECT** — episodic Matter, not a standing folder |
| Legal Compliance & Regulatory Filings (MAS/IRAS/ACRA) | **MOVE TO METADATA** — new Regulator field |
| Confidential Investment Proposals | **MOVE TO METADATA** — classification + Document Type already cover it |
| Joint Venture Agreements (Malaysia/Singapore) | **MOVE TO METADATA** — Jurisdiction tag |
| "Executive-Level" bucket as a whole | **MERGE** — split by actual subject into Governance & Strategy / Finance & Investment, not kept as one bucket |
| Financial Reports (Annual/Quarterly/P&L/Balance Sheet) | **MOVE TO METADATA** — Finance & Investment, Period tag |
| Risk Management & Internal Audit | **KEEP** — Governance & Strategy, metadata |
| Investor Relations Documents | **RETIRE** as active category; historical docs → **LEGACY/ARCHIVE** |
| Major Contracts — Resort Development | **LEGACY/ARCHIVE** |
| Major Contracts — Fundraising / Property Deals | **MOVE TO METADATA** |
| Partnership & Licensing Agreements / Company Policies | **KEEP** — metadata |
| Investment sub-branch (Proposals, PE/Debt, Forecasts, Loans, Funding, Tax, Asset Mgmt) | **MOVE TO METADATA** — Finance & Investment |
| Accounting & Finance sub-branch (GL, Tax Compliance, Payroll, Procurement, Budgeting, Expenses) | **RETIRE** — out of scope for this tool entirely, not migrated active or archived |
| Real Estate & Resort Development Plans / Infrastructure / Logistics & Supply Chain / Construction | **LEGACY/ARCHIVE** (flagged for your confirmation — inferred, not explicitly tagged by you) |
| Business Development Plans — Sabah | **LEGACY/ARCHIVE** |
| Business Development Plans — Singapore | **MOVE TO METADATA** |
| Property & Lease Agreements / Vendor & Supplier Contracts / Safety & Security | **MOVE TO METADATA** (flagged — genuinely ambiguous, confirm if still live) |
| Environmental & Compliance Reports (Ops) + Environmental & Land Use Compliance (Legal) | **MERGE** — one Document Type, one Function; Sabah instance → Legacy/Archive |
| Project Management sub-branch (Proposals/Execution Plans, Milestones, Budget, Training) | **KEEP** as new Function (Project & Programme Management) / **MOVE TO CLIENT/PROJECT** for milestone/budget/training content specifically |
| HR Governance | **KEEP** — Workstream under Human Resources |
| Employee Contracts & Agreements | **KEEP** — metadata, HR or Legal per document |
| Compensation & Benefits Plans | **KEEP** — Human Resources, metadata |
| Performance Reviews / KPIs / Workforce Analytics | **KEEP** — Workstream "Performance Management" |
| Succession Planning & Leadership Development | **KEEP** (new — missed by v1) — Human Resources or Governance & Strategy, metadata |
| Workplace Safety & Well-being Policies | **KEEP** — metadata |
| Training & Development sub-branch | **MERGE** into Human Resources, no dedicated structure |
| HR Digitalisation Strategy | **KEEP**, elevated — **MOVE TO CLIENT/PROJECT** as its own Project/Matter, not just a tag |
| Marketing & Public Relations (whole root, except Market Research) | **RETIRE**; historical docs → **LEGACY/ARCHIVE** |
| Market Research & Competitive Analysis | **MERGE** into Research & Intelligence |
| Contracts & Agreements — Fundraising | **MOVE TO METADATA** |
| Contracts & Agreements — Resort Development | **LEGACY/ARCHIVE** |
| Litigation & Dispute Resolution Files | **MOVE TO CLIENT/PROJECT** — matter-based |
| Intellectual Property (Trademarks/Copyrights) | **MOVE TO METADATA** — Certificate/Registration type |
| Data Protection & Privacy Policies | **KEEP** — already modelled |
| Employment Law Compliance Reports | **KEEP** — metadata |
| AML/KYC Files | **MOVE TO CLIENT/PROJECT** — per-client |
| Business Licences & Permits | **MOVE TO METADATA** |
| Internal Policies & Ethics Guidelines | **KEEP** — metadata |
| C-Suite Travel Itineraries | **KEEP** — confirmed exactly as v1 predicted |
| Meeting Agendas & Minutes | **KEEP** — metadata, filed by actual subject not "scheduling" |
| Task Assignments & Action Items | **KEEP** — already built (Tasks/Follow-Up screen), not a document category at all |
| Confidential / Restricted / Controlled labels | **MOVE TO METADATA** — already fully absorbed by the 5-tier classification model, confirmed |

**Still no code, architecture document, Drive integration, or Outlook Calendar changes made in this pass.** The proposed next step is unchanged from v1 §J: fold this validated vocabulary (§8/§9/§10 above) into `executive-document-vault.md` and then `apps/executive-vault/`, once you've confirmed the three flagged/ambiguous items above (the broader Operations legacy inference, Property/Vendor/Safety documents, and whether HR Digitalisation should become its own Project record).
