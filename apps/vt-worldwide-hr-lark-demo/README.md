# VT Worldwide — Conceptual Lark HR Workflow Visualisation

A static, single-page prototype built for SVE's working session with VT Worldwide. It visually
demonstrates how VT Worldwide's HR processes (overtime, leave, medical leave, attendance
correction, policy acknowledgement, performance review, probation review, offboarding) could
operate inside a Lark-style workplace platform — what the employee sees, what the manager/HOD
sees, what HR sees, how approvals move, and what happens on an exception.

**This is a conceptual visualisation, not an integration with Lark.** No real Lark API is called;
all data is fictional. See the in-app disclaimer footer and the "Conceptual Lark Workflow
Visualisation" label on the Home page.

## Running locally

Plain static HTML/CSS/JS — no build step or dependencies. Serve the folder with any static file
server, e.g.:

```
npx http-server . -p 8930
# or
python3 -m http.server 8930
```

Then open `http://localhost:8930/`.

## Structure

- `index.html` — app shell (sidebar, topbar, persona switcher, content area, right panel,
  presentation-mode controls)
- `styles.css` — Lark-style visual design system, animations, presentation/print styles
- `data.js` — fictional demo data (employees, policy text, KPI examples, etc.)
- `workflow.js` — reusable interactive workflow visualiser (`WF.block`/`WF.render`), workflow
  history log, responsibility-transfer card, advisory note and policy-control components
- `app.js` — application state, router, and all demo logic (Overtime, Overtime exception,
  Policy Acknowledgement, Leave, Medical Leave, Attendance Correction, Performance, Probation,
  Offboarding, Live Workflow, Policy→Lark view, Current vs Proposed view, Workshop Mode,
  Workshop Summary), plus the Guided Demo narration engine

## Priority demos

Overtime (`ot-demo` / `ot-exception`) and Digital Policy Acknowledgement (`policy-demo`) are the
most complete end-to-end flows, built first per the working session priorities. Use the persona
switcher at the top of the page to move between Employee, Manager/HOD, Human Resources and
Management views at any point in a demo.

## Client-session features (layered on top of the working prototype)

- **Guided Demo** (button on the Overtime and Policy pages) — narrates each stage
  (`STEP X OF N`) with Previous/Continue/Exit while the presenter still clicks the real
  buttons manually.
- **Presentation Mode** (topbar) — hides sidebar/search/notifications, keeps brand, persona,
  workflow, current action and history, and shows a discreet "Prepared by SVE International /
  Proposed Future-State Workflow" label plus a page-jump selector for meeting-room screens.
- **Responsibility transfer cards** — every handover between Employee → Manager/HOD → Human
  Resources → Management now shows an explicit "Responsibility transferred to…" card with a
  `VIEW AS <ROLE>` action, rather than a plain "switch view" button.
- **Live Workflow** (Home → Client Presentation Views) — a single always-current view of the
  Overtime demo's real state, with actor/action/timestamp per stage.
- **OT exception branch diagram** — the Standard Process and Exception Process are shown side
  by side so the 7-day-window discussion doesn't read as a flat rejection.
- **Policy Control panel** and **SVE Implementation Note** (collapsible `<details>`) — short,
  professional advisory callouts on select pages; content only, not new functionality.
- **Workshop Mode v2** — five markers (Confirmed / Proposed / Requires VT Confirmation / Gap
  Identified / Management Decision) plus a per-area note field, and a **Workshop Summary** page
  that groups the session's markers with Copy Summary and a print-friendly view. Session-only
  state — nothing is persisted to a database.

All of the above is layered onto the existing workflow engine and state; no working demo path
from the first build was removed or rebuilt.

## Performance Management (`performance-demo`)

A proposed future-state visualisation only — **not** VT Worldwide's confirmed Performance
Management framework. Every rating, weighting, target and approval authority shown is
illustrative ("SAMPLE ONLY" tags on the KPI card) and labelled with its status against the same
five-marker vocabulary used in Workshop Mode (Confirmed / Proposed Configuration / Requires VT
Confirmation / Gap Identified / Management Decision Required):

- **Home** shows Performance Management as one of four principal workflow columns (Time &
  Attendance, Policy & Acknowledgement, Performance Management, Employee Lifecycle).
- The **12-stage landing overview** (Performance Cycle Setup → Next Performance Cycle) is fully
  clickable and reference-only.
- The **live interactive flow** — Cycle Setup (HR) → Self-Assessment (Employee) → Manager
  Assessment → Calibration (Management persona, standing in for Department Head / Calibration
  authority) → HR governance control (checks completeness, does *not* set the rating) → Final
  Outcome (three branches, none auto-selected) → Employee Acknowledgement (explicitly not
  agreement) — uses the same `WF.block`, transfer-card and history-log components as every other
  demo.
- **Branch C (Performance Concern Identified)** links to the existing Probation demo's
  Performance Improvement Plan outcome via "Open Performance Improvement Plan Workflow" rather
  than duplicating it, and states plainly that PIP initiation is not automatic.
- A **Performance Cycle Status dashboard** (illustrative sample numbers) shows for HR/Management
  personas.
- **Start Performance Demo** — a 9-step Guided Demo narration, since this is a priority
  discussion item for the working session.
- **Workshop Mode** carries a dedicated 15-item "Performance Management — Detailed Validation"
  panel (Current VT Practice / Proposed SVE Workflow / marker / note per item), seeded with SVE's
  proposed starting position — 14 items default to "Requires VT Confirmation", Employee
  Acknowledgement defaults to "Proposed Configuration" — and every item stays changeable live.
  **Workshop Summary** automatically rolls these up into their own "Performance Management"
  section alongside the general summary.
