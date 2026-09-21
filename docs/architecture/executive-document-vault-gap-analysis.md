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
