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

- `index.html` — app shell (sidebar, topbar, persona switcher, content area, right panel)
- `styles.css` — Lark-style visual design system
- `data.js` — fictional demo data (employees, policy text, KPI examples, etc.)
- `workflow.js` — reusable interactive workflow-stage visualiser used across every demo
- `app.js` — application state, router, and all demo logic (Overtime, Overtime exception,
  Policy Acknowledgement, Leave, Medical Leave, Attendance Correction, Performance, Probation,
  Offboarding, Policy→Lark view, Current vs Proposed view, Workshop Mode)

## Priority demos

Overtime (`ot-demo` / `ot-exception`) and Digital Policy Acknowledgement (`policy-demo`) are the
most complete end-to-end flows, built first per the working session priorities. Use the persona
switcher at the top of the page to move between Employee, Manager/HOD, Human Resources and
Management views at any point in a demo.
