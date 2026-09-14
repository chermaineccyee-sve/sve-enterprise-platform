/**
 * SVE Group Enterprise Platform — Executive Briefing
 * Phase 1: Screens 01–03. Phase 2: Screen 04. Phase 3: Screen 05. Vanilla
 * JS, no build step, no framework — matches apps/svegip's own convention.
 * This app is fully isolated from apps/svegip: it does not import, fetch,
 * or link to anything there.
 *
 * SCREENS is an ordered registry so Screens 06–15 can be appended later
 * without redesigning navigation, keyboard handling, or the progress chrome.
 */

const STATUS_META = {
  working: { label: "Working / Implemented", cls: "status-working" },
  architecture: { label: "Architecture Defined", cls: "status-architecture" },
  planned: { label: "Planned Development", cls: "status-planned" },
  future: { label: "Future Capability", cls: "status-future" },
};

/**
 * Screen 02 content. Each stage lists ONLY the capabilities introduced at
 * that stage; getAccumulatedCapabilities() below builds the "carried
 * forward" view so clicking through stages visibly accumulates capability
 * rather than just swapping text. Stage 4 is explicitly labelled a target
 * direction, not a claim that Payroll/iClaims/Accounting Pro/multi-entity/
 * deployment portability already exist.
 */
const STAGE_DATA = [
  {
    id: "portal",
    number: 1,
    name: "Internal Information Portal",
    summary:
      "A single internal portal for SVE Group communications, governance and controlled documents — the original SVEGIP.",
    capabilities: [
      { label: "Employee authentication & role-based portal navigation", status: "working" },
      { label: "Group announcements, projects, policies & meetings", status: "working" },
      { label: "Controlled document registry with per-document access control", status: "working" },
    ],
  },
  {
    id: "governed",
    number: 2,
    name: "Governed Information & Intelligence",
    summary:
      "Access became based on each person's role and their specific SVE entity, decisions became tracked, and a dedicated strategic intelligence workspace appeared.",
    capabilities: [
      { label: "Access control based on role and SVE entity, enforced on every request", status: "working" },
      { label: "Management decision tracker with audit trail", status: "working" },
      { label: "SVE Data Vault workspace — the visible strategic & legal intelligence screen in use today", status: "working" },
    ],
  },
  {
    id: "foundation",
    number: 3,
    name: "Operational Platform Foundation",
    summary:
      "The platform now has reusable foundations for identity and access, organisation and employee records, Human Resources lifecycle management, workflow and approvals.",
    capabilities: [
      { label: "SVE Identity & Access foundation — secure sign-in, multi-factor authentication, role-based permissions and a full audit trail", status: "working" },
      { label: "Organisation structure & Employee Master", status: "working" },
      { label: "HR lifecycle: onboarding, probation, employment changes, offboarding", status: "working" },
      { label: "Shared workflow & approvals engine", status: "working" },
      { label: "Server-backed Data Vault foundation — a newer, more secure base than the existing screen currently uses", status: "working", caveat: "UI integration pending" },
    ],
  },
  {
    id: "integrated",
    number: 4,
    name: "Integrated Enterprise Platform",
    tag: "Target direction — not yet complete",
    summary:
      "The direction the platform is being built toward: HRMS, Workflow, Payroll, iClaims, Accounting Pro, Data Vault and management intelligence operating as one connected system across every SVE Group entity.",
    capabilities: [
      { label: "Payroll, payslips & iClaims", status: "architecture" },
      { label: "SVE Accounting Pro", status: "architecture" },
      { label: "Group-wide management & intelligence services", status: "future" },
      { label: "Multi-entity, multi-jurisdiction operation", status: "architecture" },
      { label: "Private-server / AWS deployment portability", status: "architecture" },
    ],
  },
];

/**
 * Screen 03 content — the four architectural layers and their modules.
 * Status choices are grounded in the repository inspection (see the
 * inspection report): a platform-services/* module with real, tested src/
 * is "working"; one with only a documented README (boundaries, dependency
 * direction, API namespace, data classification — real architecture
 * decisions, zero business logic) is "architecture"; anything with no
 * scaffolding anywhere in the repository, mentioned only as direction, is
 * "future".
 */
const LAYERS = [
  {
    id: "experience",
    name: "Experience",
    blurb: "What people use",
    modules: [
      { id: "svegip", name: "SVEGIP", status: "working", note: "The existing SVE Group internal portal — the platform's front door today." },
      { id: "mysve", name: "My SVE", status: "working", note: "Employee self-service workspace: profile, tasks and reporting structure." },
      { id: "people", name: "People", status: "working", note: "The HR lifecycle & approvals experience — onboarding, probation, employment changes, offboarding, and manager/HR approvals." },
      { id: "management", name: "Management", status: "working", note: "Existing decision-tracking and management workspace capabilities within SVEGIP; deeper management intelligence integration remains under development." },
      { id: "finance", name: "Finance", status: "future", note: "No finance workspace exists yet. It depends on Payroll and Accounting Pro, which today exist only as documented designs, not working software." },
      { id: "intelligence", name: "Intelligence", status: "architecture", note: "Today's SVE Data Vault screen is in active use, but the information entered into it is currently stored on the user's own device rather than in a central, backed-up database. A newer, server-based Data Vault has been built (see Business Systems below) to replace this in a future phase; that changeover has not happened yet." },
    ],
  },
  {
    id: "domain",
    name: "Business Systems",
    blurb: "Where work happens",
    modules: [
      { id: "identity", name: "Identity & Access", status: "working", note: "Manages user accounts, roles, permissions, secure sign-in and multi-factor authentication, with a full security audit trail — real and tested. SVEGIP's own sign-in still works independently and has not yet been connected to this foundation." },
      { id: "organisation", name: "Organisation & Employee Master", status: "working", note: "Organisation structure and the Employee Master record — real, tested, and backed by a production database." },
      { id: "hrms", name: "HRMS", status: "working", note: "Onboarding, probation, employment changes and offboarding, integrated with approvals and Identity." },
      { id: "workflow", name: "Workflow", status: "working", note: "A shared, reusable approvals engine — routing, escalation and decisions, built once rather than separately for every business area." },
      { id: "datavault", name: "Data Vault", status: "working", caveat: "UI integration pending", note: "Server architecture implemented / UI integration pending. The underlying service that will securely store Data Vault information and enforce access rules has been built and tested. The screen users see today has not yet been connected to it — that changeover is future work." },
      { id: "payroll", name: "Payroll", status: "architecture", note: "The design approach has been documented. No payroll calculation, payslip, or statutory logic exists yet." },
      { id: "iclaims", name: "iClaims", status: "architecture", note: "The design approach has been documented; it will depend on HRMS and Payroll. No claims logic exists yet." },
      { id: "accounting", name: "Accounting Pro", status: "architecture", note: "The design approach has been documented. No ledger, journal or accounting logic exists anywhere in the platform yet." },
      { id: "mgmtintel", name: "Management & Intelligence", status: "future", note: "Not yet built as its own dedicated service. Today's decision-tracking and reporting live inside SVEGIP itself." },
    ],
  },
  {
    id: "shared",
    name: "Shared Platform Services",
    blurb: "Common controls and services used across the platform",
    modules: [
      { id: "security", name: "Security", status: "architecture", note: "A shared security approach has been designed. Real security controls already exist inside Identity today, but are not yet shared as common infrastructure every service uses." },
      { id: "permissions", name: "Permissions", status: "working", note: "Controls over who can do what, and for which SVE entity, are real and independently verified across Identity, Organisation, HRMS, Workflow and Data Vault today — including SK Lai & Partners' separate, more restricted access tier." },
      { id: "audit", name: "Audit", status: "architecture", note: "A single, group-wide audit service is planned, not built. Each service already keeps its own real, working audit trail today; consolidating them is future work." },
      { id: "documents", name: "Documents", status: "architecture", note: "A shared, group-wide document-management service is planned. SVEGIP's own controlled-document registry already works today but stands alone." },
      { id: "notifications", name: "Notifications", status: "architecture", note: "The approach has been documented, but no notification service exists yet." },
      { id: "configuration", name: "Configuration", status: "architecture", note: "A shared approach to system configuration has been designed; each service still manages its own settings independently today." },
      { id: "contracts", name: "Shared Contracts", status: "architecture", note: "Common data definitions (entities, responses, audit events) have been designed so every future service speaks the same language." },
    ],
  },
  {
    id: "data",
    name: "Data & Infrastructure",
    blurb: "Where information lives and runs",
    modules: [
      { id: "postgres", name: "PostgreSQL", status: "working", note: "Every real service (Identity, Organisation, HRMS, Workflow, Data Vault) stores its data in a real, tested production database today." },
      { id: "storage", name: "Storage", status: "architecture", note: "A design for secure file storage exists on paper, but a working file-storage capability does not exist yet — including in the existing portal, where document storage is currently only a placeholder." },
      { id: "secrets", name: "Secrets", status: "working", note: "A basic, working method for storing system credentials securely exists and is used by Identity today. A dedicated, enterprise-grade secrets-management service is future work." },
      { id: "logging", name: "Logging", status: "architecture", note: "A shared approach to system logging has been designed; only basic, developer-level logging runs today. A full monitoring capability is future work." },
      { id: "deployment", name: "SVE Server / AWS", status: "architecture", note: "A plan for moving to SVE's own servers or AWS has been documented, but not built. The platform currently runs on a third-party hosting provider (Netlify)." },
    ],
  },
];

/**
 * Screen 04 content — the seven capability groups that make up the
 * "Operational Foundation Established" evidence screen. Every group here
 * is Working/Implemented (Data Vault carries its "UI integration pending"
 * caveat, as it does on Screens 02/03) — this screen exists to demonstrate
 * what already exists, not to preview Payroll/iClaims/Accounting Pro or
 * any other future module. "enablesNext" text names future systems this
 * foundation is designed to support; it never claims they are built.
 * evidence.* fields feed the secondary "View Build Evidence" disclosure —
 * plain-language, no PR numbers or raw internal identifiers.
 */
const BUILT_DATA = [
  {
    id: "controlled-access",
    name: "Controlled Access",
    meaning: "Access can be controlled according to authorised role, SVE entity, information classification and responsibility.",
    status: "working",
    whatExists: "A tested identity and access foundation — user accounts, roles, permissions, sessions and multi-factor authentication.",
    whyItMatters: "System Administrator status does not automatically grant Human Resources, Finance, management or privileged legal access — each must be separately authorised.",
    enablesNext: "Extending the same controlled-access model to Payroll, Finance and future management systems as they are built.",
    evidence: {
      service: "SVE Identity & Access foundation",
      foundation: "A dedicated database foundation covering users, roles, permissions and sessions.",
      tests: "Covered by an automated test suite, including multi-factor authentication and access-control scenarios.",
      experience: "Runs independently of SVEGIP's existing sign-in today.",
      milestone: "Identity & Access Foundation",
    },
  },
  {
    id: "organisation-employee-master",
    name: "Organisation & Employee Master",
    meaning: "A governed organisational and employee-record foundation now exists for legal entity, organisational structure, position, assignment and reporting relationships.",
    status: "working",
    whatExists: "A tested organisation and Employee Master foundation covering legal entity, business unit, department, position, and effective-dated employment assignments.",
    whyItMatters: "Every future Human Resources, Payroll or Finance system can build on one governed employee record instead of each keeping its own copy.",
    enablesNext: "Payroll, iClaims, and future reporting-line-aware management tools.",
    evidence: {
      service: "Organisation & Employee Master",
      foundation: "A dedicated database foundation for organisational structure and employee records.",
      tests: "Covered by an automated test suite, including reporting-structure integrity checks.",
      experience: "Powers the Employee Directory and employee profile in My SVE.",
      milestone: "Organisation & Employee Master Foundation",
    },
  },
  {
    id: "hr-lifecycle",
    name: "Human Resources Lifecycle",
    meaning: "Employee lifecycle processes now have a controlled foundation covering onboarding, probation, confirmation or extension, employment change and offboarding.",
    status: "working",
    whatExists: "A tested lifecycle-case foundation governing onboarding, probation, confirmation/extension, employment change and offboarding.",
    whyItMatters: "Each lifecycle stage now follows one controlled, auditable process instead of ad hoc handling.",
    enablesNext: "Leave, attendance and other Human Resources processes, which are not yet built.",
    evidence: {
      service: "HRMS Employee Lifecycle foundation",
      foundation: "A dedicated database foundation for lifecycle cases, milestones and probation reviews.",
      tests: "Covered by an automated test suite across each lifecycle stage.",
      experience: "Powers the People / HR Lifecycle screens in SVEGIP.",
      milestone: "HRMS Employee Lifecycle Foundation",
    },
  },
  {
    id: "workflow-approvals",
    name: "Workflow & Approvals",
    meaning: "A reusable approval and decision-routing foundation now exists rather than approval logic needing to be rebuilt independently for every future module.",
    status: "working",
    whatExists: "A reusable workflow and approval engine.",
    whyItMatters: "Approval controls can be reused rather than rebuilt separately for each SVE system.",
    enablesNext: "Leave, claims, payroll approvals, finance workflows and future management processes.",
    evidence: {
      service: "Workflow & Approval engine",
      foundation: "A dedicated database foundation for workflow definitions, routing and decisions.",
      tests: "Covered by an automated test suite, including approval-routing and escalation scenarios.",
      experience: "Already used today to route HRMS employment-change and offboarding approvals.",
      milestone: "Workflow & Approval Foundation, integrated with HRMS",
    },
  },
  {
    id: "security-revocation",
    name: "Security & Access Revocation",
    meaning: "Offboarding can trigger controlled Identity access deactivation and session revocation while preserving historical records.",
    status: "working",
    whatExists: "A tested integration where completing an employee's offboarding automatically deactivates their Identity access and revokes active sessions.",
    whyItMatters: "Access is removed in a controlled way the moment employment ends, rather than depending on a separate manual step — while historical records are preserved, not deleted. This is distinct from Controlled Access: Controlled Access governs who receives access; this governs how access is removed when authority ends.",
    enablesNext: "The same controlled-revocation pattern applied to future Payroll, Finance and system-administration access.",
    evidence: {
      service: "Identity Access Revocation & Offboarding integration",
      foundation: "Builds on the Identity and HRMS foundations already in place.",
      tests: "Covered by an automated test suite verifying access is revoked exactly when offboarding completes.",
      experience: "Triggered automatically from the offboarding lifecycle case in People / HR.",
      milestone: "Identity Offboarding & Revocation integration",
    },
  },
  {
    id: "my-sve-people",
    name: "My SVE & People",
    meaning: "Employees and Human Resources now have a usable application experience over the Employee Master, lifecycle and approval foundations.",
    status: "working",
    whatExists: "A working employee and Human Resources experience — profile, employee directory, lifecycle cases and approvals — built on the foundations above.",
    whyItMatters: "The underlying platform foundations are not just backend services; people already use them through a real application experience today.",
    enablesNext: "Extending the same experience to Payroll, Leave and future Human Resources self-service.",
    evidence: {
      service: "SVEGIP People / My SVE application experience",
      foundation: "Built directly on the Organisation, HRMS and Workflow foundations — no separate data store of its own.",
      tests: "Covered by an automated test suite, including a check that no Human Resources data is stored in the browser.",
      experience: "The People, My SVE and Employee Directory screens in SVEGIP today.",
      milestone: "HRMS Application Shell, Employee Master / My SVE, and HR Lifecycle & Approval experience",
    },
  },
  {
    id: "data-vault-foundation",
    name: "Data Vault Foundation",
    meaning: "A newer server-backed information-control foundation has been implemented and tested.",
    status: "working",
    caveat: "UI integration pending",
    whatExists: "A tested, server-backed information-control service with its own access rules.",
    whyItMatters: "Confidential information can now be governed by a real, database-backed service, rather than depending on what happens to be stored in a single browser.",
    enablesNext: "Connecting the existing Data Vault workspace to this foundation, and extending it to broader management intelligence.",
    evidence: {
      service: "Data Vault (server-backed foundation)",
      foundation: "A dedicated database foundation for Data Vault records and access rules.",
      tests: "Covered by an automated test suite, including entity- and classification-based access checks.",
      experience: "Not yet connected to the visible Data Vault workspace, which still runs on its original design.",
      milestone: "Data Vault server-side remediation",
    },
  },
];

/**
 * Screen 05 content — the People / HRMS employee journey. Executive-facing
 * stage labels (JOIN / PROBATION / MOVEMENT / EXIT) are deliberately
 * distinct from the underlying repository terminology, which is preserved
 * in each stage's `systemLabel` (matching apps/svegip's own
 * HRMS_LIFECYCLE_LABELS exactly: Onboarding, Probation & Confirmation,
 * Employment Changes, Offboarding) — "Movement" is a presentation label
 * over "Employment Change", never a rename of the underlying capability.
 *
 * All four stages are Working/Implemented. JOIN and PROBATION carry a
 * qualification: real HR lifecycle tracking, but not Workflow-connected.
 * EXIT carries the qualification the inspection specifically flagged:
 * Identity deactivation is a real, tested, controlled processing step,
 * but nothing currently triggers it on a schedule — this must stay
 * visible in the main stage experience, not buried behind an extra click.
 *
 * `preview.*` fields feed each stage's presentation-native application
 * preview — entirely fictional (a single illustrative employee, "Aisha
 * Rahman", carried across all four stages for narrative continuity), no
 * real employee/case/assignment identifiers, no salary/bank/tax data, no
 * runtime connection of any kind to apps/svegip.
 */
const PEOPLE_STAGES = [
  {
    id: "join",
    label: "JOIN",
    systemLabel: "Onboarding",
    status: "working",
    qualification: "Onboarding is tracked as a Human Resources lifecycle capability; it is not currently connected to the Workflow approval engine.",
    whatHappens: "A new employee's record is established within one governed employment and organisational foundation — not as an isolated record in a standalone system.",
    connects: [
      { label: "Employee Record", detail: "Legal name, employee number and core identity." },
      { label: "Legal Entity & Organisation", detail: "The SVE entity, business unit and department the employee belongs to." },
      { label: "Position / Assignment", detail: "Role and effective-dated employment terms." },
      { label: "Reporting Relationship", detail: "Who the employee reports to, resolved by name and title." },
      { label: "Onboarding Lifecycle", detail: "A tracked case governing the joining process." },
      { label: "Milestones / History", detail: "Joining milestones and a retained record from day one." },
    ],
    whyItMatters: "Every later stage of employment — probation, movement, eventual exit — builds on this same governed record, rather than a separate system re-entering the same information.",
    preview: {
      kind: "record",
      title: "New Employee Record",
      fields: [
        ["Name", "Aisha Rahman"],
        ["Legal Entity", "SVE International Sdn. Bhd."],
        ["Department", "Group Finance"],
        ["Position", "Finance Associate"],
        ["Reports To", "Priya Nathan — Finance Manager"],
        ["Start Date", "3 March 2026"],
      ],
      badge: { label: "Onboarding — In Progress", tone: "info" },
    },
  },
  {
    id: "probation",
    label: "PROBATION",
    systemLabel: "Probation & Confirmation",
    status: "working",
    qualification: "Probation review is tracked as a Human Resources lifecycle capability; it is not currently connected to the Workflow approval engine.",
    whatHappens: "A probation period is tracked through to a review date, ending in one recorded outcome.",
    connects: [
      { label: "Probation Period", detail: "A tracked start date and review due date." },
      { label: "Review", detail: "A recorded review against that due date." },
      { label: "Outcome", detail: "Confirm, extend, or unsuccessful — recorded once, on the same case." },
    ],
    whyItMatters: "Confirmation is not a separate stage of its own — it is one governed outcome of probation, recorded on the same history as everything else in the employee's foundation.",
    preview: {
      kind: "probation",
      title: "Probation Review",
      fields: [
        ["Probation Start", "3 March 2026"],
        ["Review Due", "3 June 2026"],
        ["Review Status", "Completed"],
      ],
      outcomes: [
        { label: "Confirm", selected: true },
        { label: "Extend", selected: false },
        { label: "Unsuccessful", selected: false },
      ],
      badge: { label: "Outcome — Confirmed", tone: "good" },
    },
  },
  {
    id: "movement",
    label: "MOVEMENT",
    systemLabel: "Employment Change",
    status: "working",
    qualification: null,
    whatHappens: "A proposed change to an employee's position, department or reporting arrangement is submitted for authorised approval before it takes effect.",
    connects: [
      { label: "Employee Master", detail: "Current employment and organisational structure." },
      { label: "Human Resources Lifecycle", detail: "The proposed movement, recorded as a case." },
      { label: "Workflow & Approval", detail: "Routed to an authorised approver — never self-approved." },
      { label: "Organisation", detail: "Once approved, the new assignment becomes effective." },
      { label: "History", detail: "The movement and the decision behind it are both retained." },
    ],
    whyItMatters: "Movement is not someone editing a profile. It is a governed transaction: proposed, authorised by someone other than the requester, then applied — with the decision retained in history.",
    preview: {
      kind: "movement",
      title: "Current vs Proposed Movement",
      current: [
        ["Position", "Finance Associate"],
        ["Department", "Group Finance"],
        ["Reporting To", "Priya Nathan — Finance Manager"],
        ["Legal Entity", "SVE International Sdn. Bhd."],
      ],
      proposed: [
        ["Proposed Position", "Senior Finance Associate"],
        ["Proposed Department", "Group Finance"],
        ["Proposed Reporting Relationship", "Daniel Ong — Senior Finance Manager"],
        ["Effective Date", "1 September 2026"],
      ],
      badge: { label: "Approval Status — Pending Approval", tone: "pending" },
    },
  },
  {
    id: "exit",
    label: "EXIT",
    systemLabel: "Offboarding",
    status: "working",
    caveat: "Scheduling not yet configured",
    qualification: "Access deactivation is implemented as a controlled processing step; automated scheduling is not yet configured.",
    whatHappens: "Offboarding is approved, employment ends, and access is withdrawn through a controlled sequence rather than a manual afterthought.",
    connects: [
      { label: "Offboarding", detail: "A tracked case for the employee's departure." },
      { label: "Authorised Approval", detail: "Routed to an authorised approver — never self-approved." },
      { label: "Employment Ends", detail: "The assignment ends in the organisational record." },
      { label: "Access Withdrawal Requested", detail: "A controlled request is created automatically, in the same transaction." },
      { label: "Identity Deactivation Processing", detail: "A separate, controlled step processes the request." },
      { label: "Account & Active Sessions Revoked", detail: "Once processed, the account is disabled and every active session is revoked together." },
      { label: "History Preserved", detail: "Employment and decision history are retained throughout, not deleted." },
    ],
    whyItMatters: "Access does not depend on someone remembering to disable an account. It follows a controlled, auditable sequence, with history preserved throughout.",
    preview: {
      kind: "exit",
      title: "Offboarding Status",
      fields: [
        ["Offboarding Status", "Approved"],
        ["Approval Status", "Approved"],
        ["Employment End Date", "30 November 2026"],
        ["Access Withdrawal Requested", "Yes — requested automatically on approval"],
        ["Identity Deactivation Status", "Requested — pending processing"],
      ],
      badge: { label: "History — Retained", tone: "good" },
    },
  },
];

const SCREENS = [
  { id: "opening", number: 1, title: "Executive Opening", render: renderScreenOpening },
  { id: "prototype-to-platform", number: 2, title: "From Prototype to Platform", render: renderScreenProgression },
  { id: "architecture", number: 3, title: "Enterprise Platform Architecture", render: renderScreenArchitecture },
  { id: "what-built", number: 4, title: "What Has Already Been Built", render: renderScreenBuilt },
  { id: "people", number: 5, title: "People / HRMS", render: renderScreenPeople },
];

let currentIndex = 0;
let selectedStageIndex = 0;
let selectedModule = null; // { layerIndex, moduleIndex } | null
// Shared by desktop and mobile: Screen 03 opens with all four layers
// collapsed (-1) so the architecture reads as four connected blocks before
// any module is revealed — progressive disclosure, not a wall of modules.
let openAccordionLayerIndex = -1;
// Screen 04: which capability (if any) is expanded, shared by desktop's
// tile+detail layout and mobile's accordion — same convention as Screen 03.
let activeCapabilityIndex = -1;
let buildEvidenceOpen = false;
// Screen 05: which employee-journey stage (if any) is expanded, shared by
// desktop's stage-track+detail layout and mobile's accordion — same
// convention as Screens 03/04. Starts collapsed so Eric sees the four-stage
// journey on its own before any detail is revealed.
let activePeopleStageIndex = -1;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function getStatusMeta(key) {
  return STATUS_META[key] || STATUS_META.future;
}

function statusPillHtml(statusKey, caveat) {
  const meta = getStatusMeta(statusKey);
  const caveatHtml = caveat ? `<span class="caveat-chip">${esc(caveat)}</span>` : "";
  // Wrapped in one group so the pill and its caveat chip (when present)
  // always stay visually together as a single unit — without this, a
  // flex row using justify-content:space-between (e.g. a detail header)
  // would space the two apart as independent items, stranding the caveat
  // chip at the far edge, disconnected from the status it qualifies.
  return `<span class="status-pill-group"><span class="status-pill ${meta.cls}"><span class="status-dot"></span>${esc(meta.label)}</span>${caveatHtml}</span>`;
}

function getScreens() {
  return SCREENS;
}

function clampIndex(i) {
  return Math.max(0, Math.min(SCREENS.length - 1, i));
}

function getCurrentIndex() {
  return currentIndex;
}

function goToScreen(i) {
  const target = clampIndex(i);
  if (target === currentIndex) return;
  currentIndex = target;
  render();
}

function nextScreen() {
  goToScreen(currentIndex + 1);
}

function prevScreen() {
  goToScreen(currentIndex - 1);
}

function handleKeydown(e) {
  const key = e && e.key;
  if (key === "ArrowRight") {
    nextScreen();
  } else if (key === "ArrowLeft") {
    prevScreen();
  }
}

function getStageData() {
  return STAGE_DATA;
}

function getSelectedStage() {
  return selectedStageIndex;
}

function selectStage(n) {
  const clamped = Math.max(0, Math.min(STAGE_DATA.length - 1, n));
  if (clamped === selectedStageIndex) return;
  selectedStageIndex = clamped;
  render();
}

/**
 * Returns every stage up to and including stageIndex, each tagged
 * isCurrent so the render layer can visually distinguish "just introduced
 * at this stage" from "carried forward from an earlier one" — this is what
 * makes clicking through stages read as accumulation, not text-swapping.
 */
function getAccumulatedCapabilities(stageIndex) {
  const clamped = Math.max(0, Math.min(STAGE_DATA.length - 1, stageIndex));
  return STAGE_DATA.slice(0, clamped + 1).map((stage, i) => ({
    stage,
    isCurrent: i === clamped,
  }));
}

function getLayers() {
  return LAYERS;
}

function getSelectedModule() {
  return selectedModule;
}

function selectModule(layerIndex, moduleIndex) {
  if (
    selectedModule &&
    selectedModule.layerIndex === layerIndex &&
    selectedModule.moduleIndex === moduleIndex
  ) {
    selectedModule = null;
  } else {
    selectedModule = { layerIndex, moduleIndex };
  }
  render();
}

/** Convenience lookup by stable ids, used by tests and safe against reordering. */
function getModuleStatus(layerId, moduleId) {
  const layer = LAYERS.find((l) => l.id === layerId);
  if (!layer) return null;
  const mod = layer.modules.find((m) => m.id === moduleId);
  return mod ? mod.status : null;
}

function toggleAccordion(layerIndex) {
  openAccordionLayerIndex = openAccordionLayerIndex === layerIndex ? -1 : layerIndex;
  // Selecting a different layer (or collapsing the open one) always drops
  // back to "see its modules" — never leaves a module's detail panel
  // showing for a layer that's no longer expanded.
  selectedModule = null;
  render();
}

function getBuiltCapabilities() {
  return BUILT_DATA;
}

function getActiveCapabilityIndex() {
  return activeCapabilityIndex;
}

function selectCapability(index) {
  activeCapabilityIndex = activeCapabilityIndex === index ? -1 : index;
  // A fresh selection (or closing the current one) always collapses the
  // build-evidence disclosure — it should never persist open for a
  // capability that is no longer the one in view.
  buildEvidenceOpen = false;
  render();
}

function getBuildEvidenceOpen() {
  return buildEvidenceOpen;
}

function toggleBuildEvidence() {
  if (activeCapabilityIndex === -1) return;
  buildEvidenceOpen = !buildEvidenceOpen;
  render();
}

/** Convenience lookup by stable id, used by tests and safe against reordering. */
function getCapabilityStatus(id) {
  const cap = BUILT_DATA.find((c) => c.id === id);
  return cap ? cap.status : null;
}

function getPeopleStages() {
  return PEOPLE_STAGES;
}

function getActivePeopleStageIndex() {
  return activePeopleStageIndex;
}

function selectPeopleStage(index) {
  activePeopleStageIndex = activePeopleStageIndex === index ? -1 : index;
  render();
}

/** Convenience lookup by stable id, used by tests and safe against reordering. */
function getPeopleStageSystemLabel(id) {
  const stage = PEOPLE_STAGES.find((s) => s.id === id);
  return stage ? stage.systemLabel : null;
}

/* ===================== Rendering ===================== */

function renderChromeTop() {
  const screen = SCREENS[currentIndex];
  const dots = SCREENS.map(
    (s, i) =>
      `<button class="chrome-dot${i === currentIndex ? " active" : ""}" data-action="goto" data-index="${i}" aria-label="Go to screen ${s.number}: ${esc(s.title)}"></button>`
  ).join("");
  return `
    <div class="chrome-top">
      <div class="chrome-brand">
        <img src="assets/sve-logo.jpeg" alt="SVE Group"/>
        <div class="chrome-brand-text">
          <div class="chrome-brand-title">SVE GROUP ENTERPRISE PLATFORM</div>
          <div class="chrome-brand-sub">Executive Briefing</div>
        </div>
      </div>
      <div class="chrome-progress">
        <span><strong>${String(screen.number).padStart(2, "0")}</strong> / ${String(SCREENS.length).padStart(2, "0")} — ${esc(screen.title)}</span>
        <span class="chrome-dots" role="tablist" aria-label="Briefing screens">${dots}</span>
      </div>
    </div>`;
}

function renderChromeBottom() {
  const atStart = currentIndex === 0;
  const atEnd = currentIndex === SCREENS.length - 1;
  return `
    <div class="chrome-bottom">
      <button class="nav-btn" data-action="prev" ${atStart ? "disabled" : ""} aria-label="Previous screen">&larr; Previous</button>
      <button class="nav-btn primary" data-action="next" ${atEnd ? "disabled" : ""} aria-label="Next screen">Next &rarr;</button>
    </div>`;
}

function renderScreenOpening() {
  return `
    <div class="opening">
      <div class="opening-inner">
        <div class="opening-eyebrow">SVE Group Enterprise Platform</div>
        <h1 class="opening-title">
          <span>From Information</span>
          <span>to Intelligence</span>
          <span>to Operations.</span>
        </h1>
        <p class="opening-lede">One connected internal platform designed to bring together information, people, workflow, governance, finance and management intelligence across SVE Group.</p>
        <div class="opening-status">
          <span class="briefing-marker"><span class="marker-dot"></span>Management Review</span>
        </div>
        <div class="opening-cta">
          <button data-action="next">Explore the Platform &rarr;</button>
        </div>
      </div>
    </div>`;
}

function renderScreenProgression() {
  const stages = STAGE_DATA;
  const current = stages[selectedStageIndex];
  const accumulated = getAccumulatedCapabilities(selectedStageIndex);

  const track = stages
    .map((stage, i) => {
      const state = i === selectedStageIndex ? "active" : i < selectedStageIndex ? "past" : "";
      return `
        <button class="stage-node ${state}" data-action="stage" data-stage="${i}" aria-current="${i === selectedStageIndex}">
          <div class="stage-node-top">
            <span class="stage-node-dot">${stage.number}</span>
          </div>
          <div class="stage-node-name">${esc(stage.name)}</div>
          ${stage.tag ? `<div class="stage-node-tag">${esc(stage.tag)}</div>` : ""}
        </button>`;
    })
    .join("");

  const carriedGroups = accumulated
    .map(({ stage, isCurrent }) => {
      const items = stage.capabilities
        .map(
          (cap, idx) => `
        <li class="capability-item ${isCurrent ? "" : "carried"}" style="animation-delay:${idx * 0.06}s">
          ${statusPillHtml(cap.status, cap.caveat)}
          <span class="capability-label">${esc(cap.label)}</span>
        </li>`
        )
        .join("");
      const heading = isCurrent
        ? `Introduced at Stage ${stage.number}`
        : `Carried forward from Stage ${stage.number} — ${esc(stage.name)}`;
      return `<div class="carried-heading">${heading}</div><ul class="capability-list">${items}</ul>`;
    })
    .join("");

  return `
    <div class="progression">
      <div class="section-wrap">
        <div class="progression-head">
          <div class="eyebrow">From Prototype to Platform</div>
          <h2>From an internal portal to an enterprise platform</h2>
          <p>What began as a central workspace for information and governance has progressively developed into a reusable operational foundation for SVE Group.</p>
        </div>
        <div class="stage-track" role="tablist" aria-label="Platform evolution stages">${track}</div>
        <div class="stage-detail">
          <div class="stage-detail-head">
            <div>
              <h3>Stage ${current.number} — ${esc(current.name)}</h3>
              ${current.tag ? `<span class="status-pill status-planned"><span class="status-dot"></span>${esc(current.tag)}</span>` : ""}
            </div>
          </div>
          <p class="stage-detail-summary">${esc(current.summary)}</p>
          ${carriedGroups}
        </div>
      </div>
    </div>`;
}

function moduleDetailHtml() {
  if (!selectedModule) {
    return `<div class="module-detail-empty">Select a layer above to reveal its systems, then select any system to see an executive-level explanation of what it is and its current status.</div>`;
  }
  const layer = LAYERS[selectedModule.layerIndex];
  const mod = layer && layer.modules[selectedModule.moduleIndex];
  if (!mod) return "";
  return `
    <div class="module-detail">
      <div class="module-detail-head">
        <h4>${esc(mod.name)}</h4>
        ${statusPillHtml(mod.status, mod.caveat)}
      </div>
      <p>${esc(mod.note)}</p>
    </div>`;
}

function renderScreenArchitecture() {
  const legend = Object.keys(STATUS_META)
    .map((key) => statusPillHtml(key))
    .join("");

  // Progressive disclosure: the initial view shows only the four connected
  // layers (name + one-line blurb) so the whole architecture reads in
  // seconds. Selecting a layer expands it to reveal its modules; selecting
  // a module (once revealed) still opens the same executive detail panel
  // as before. openAccordionLayerIndex is shared with the mobile accordion
  // below, so desktop and mobile always agree on which layer is open.
  const anyLayerOpen = openAccordionLayerIndex !== -1;
  const desktopLayers = LAYERS.map((layer, layerIndex) => {
    const isOpen = openAccordionLayerIndex === layerIndex;
    const chips = layer.modules
      .map((mod, moduleIndex) => {
        const isSelected =
          selectedModule && selectedModule.layerIndex === layerIndex && selectedModule.moduleIndex === moduleIndex;
        const meta = getStatusMeta(mod.status);
        return `
          <button class="module-chip ${isSelected ? "selected" : ""}" data-action="module" data-layer="${layerIndex}" data-module="${moduleIndex}" aria-pressed="${!!isSelected}">
            <span class="status-dot ${meta.cls}" style="background:currentColor"></span>
            ${esc(mod.name)}
          </button>`;
      })
      .join("");
    const connector =
      layerIndex > 0
        ? `<div class="layer-connector ${anyLayerOpen ? "flowing" : ""}"><span class="connector-line"></span><span class="connector-arrow">&darr;</span><span class="connector-line"></span></div>`
        : "";
    return `
      ${connector}
      <div class="layer-band ${isOpen ? "open" : ""}">
        <button class="layer-toggle" data-action="accordion" data-layer="${layerIndex}" aria-expanded="${isOpen}">
          <div class="layer-toggle-text">
            <h3>${esc(layer.name)}</h3>
            <span class="layer-blurb">${esc(layer.blurb)}</span>
          </div>
          <span class="layer-caret">&#9662;</span>
        </button>
        ${isOpen ? `<div class="module-grid">${chips}</div>` : ""}
      </div>`;
  }).join("");

  const mobileLayers = LAYERS.map((layer, layerIndex) => {
    const open = openAccordionLayerIndex === layerIndex;
    const rows = layer.modules
      .map((mod, moduleIndex) => {
        const meta = getStatusMeta(mod.status);
        return `
          <div class="module-row">
            <button class="module-row-name" data-action="module" data-layer="${layerIndex}" data-module="${moduleIndex}">${esc(mod.name)}</button>
            <span class="module-row-status">${statusPillHtml(mod.status, mod.caveat)}</span>
          </div>`;
      })
      .join("");
    return `
      <div class="accordion-item ${open ? "open" : ""}">
        <button class="accordion-trigger" data-action="accordion" data-layer="${layerIndex}" aria-expanded="${open}">
          <h3>${esc(layer.name)}</h3>
          <span class="accordion-caret">&#9662;</span>
        </button>
        <div class="accordion-body">
          <div class="accordion-body-inner">
            <div class="accordion-blurb">${esc(layer.blurb)}</div>
            ${rows}
          </div>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="architecture">
      <div class="section-wrap">
        <div class="architecture-head">
          <div class="eyebrow">Enterprise Platform Architecture</div>
          <h2>Four connected layers, not a pile of features</h2>
          <p>Every screen people use sits on shared business services, which sit on shared platform services, which sit on shared data and infrastructure. Select a layer to see its systems, then select any system for its status and a short explanation.</p>
        </div>
        <div class="legend">${legend}</div>
        <div class="layer-stack">${desktopLayers}</div>
        <div class="mobile-architecture">${mobileLayers}</div>
        ${moduleDetailHtml()}
      </div>
    </div>`;
}

function capabilityEvidenceHtml(cap) {
  const ev = cap.evidence;
  const rows = [
    ["Underlying service", ev.service],
    ["Database foundation", ev.foundation],
    ["Test coverage", ev.tests],
    ["Application experience", ev.experience],
    ["Implementation milestone", ev.milestone],
  ];
  return `
    <div class="build-evidence">
      ${rows
        .map(
          ([label, value]) => `
        <div class="evidence-row">
          <span class="evidence-label">${esc(label)}</span>
          <span class="evidence-value">${esc(value)}</span>
        </div>`
        )
        .join("")}
    </div>`;
}

/**
 * The "What exists / Why it matters / Enables next" disclosure shared by
 * desktop's detail panel and mobile's expanded accordion row — identical
 * markup either way so the executive content is consistent across
 * breakpoints even though the surrounding layout differs.
 */
function capabilityDetailBodyHtml(cap, index) {
  const evidenceOpen = activeCapabilityIndex === index && buildEvidenceOpen;
  return `
    <div class="built-detail-grid">
      <div class="built-detail-block" style="animation-delay:.05s">
        <span class="built-detail-label">What exists</span>
        <p>${esc(cap.whatExists)}</p>
      </div>
      <div class="built-detail-block" style="animation-delay:.15s">
        <span class="built-detail-label">Why it matters</span>
        <p>${esc(cap.whyItMatters)}</p>
      </div>
      <div class="built-detail-block" style="animation-delay:.25s">
        <span class="built-detail-label">Enables next</span>
        <p>${esc(cap.enablesNext)}</p>
      </div>
    </div>
    <button class="evidence-toggle" data-action="evidence" aria-expanded="${evidenceOpen}">
      ${evidenceOpen ? "Hide Build Evidence" : "View Build Evidence"} <span class="evidence-caret">&#9662;</span>
    </button>
    ${evidenceOpen ? capabilityEvidenceHtml(cap) : ""}`;
}

function renderScreenBuilt() {
  const capabilities = BUILT_DATA;
  const anySelected = activeCapabilityIndex !== -1;

  const tiles = capabilities
    .map((cap, index) => {
      const isSelected = activeCapabilityIndex === index;
      return `
        <button class="capability-tile ${isSelected ? "selected" : ""}" data-action="capability" data-index="${index}" aria-pressed="${isSelected}">
          ${statusPillHtml(cap.status, cap.caveat)}
          <span class="capability-tile-name">${esc(cap.name)}</span>
          <span class="capability-tile-meaning">${esc(cap.meaning)}</span>
        </button>`;
    })
    .join("");

  const detail =
    activeCapabilityIndex === -1
      ? `<div class="module-detail-empty">Select a capability above to see what exists, why it matters, and what it enables next.</div>`
      : (() => {
          const cap = capabilities[activeCapabilityIndex];
          return `
            <div class="module-detail built-detail">
              <div class="module-detail-head">
                <h4>${esc(cap.name)}</h4>
                ${statusPillHtml(cap.status, cap.caveat)}
              </div>
              ${capabilityDetailBodyHtml(cap, activeCapabilityIndex)}
            </div>`;
        })();

  const mobileCapabilities = capabilities
    .map((cap, index) => {
      const open = activeCapabilityIndex === index;
      return `
        <div class="accordion-item ${open ? "open" : ""}">
          <button class="accordion-trigger capability-trigger" data-action="capability" data-index="${index}" aria-expanded="${open}">
            <span class="capability-trigger-row1">
              <h3>${esc(cap.name)}</h3>
              <span class="accordion-caret">&#9662;</span>
            </span>
            <span class="capability-trigger-status">${statusPillHtml(cap.status, cap.caveat)}</span>
            <span class="capability-trigger-meaning">${esc(cap.meaning)}</span>
          </button>
          <div class="accordion-body">
            <div class="accordion-body-inner">
              ${capabilityDetailBodyHtml(cap, index)}
            </div>
          </div>
        </div>`;
    })
    .join("");

  return `
    <div class="built">
      <div class="section-wrap">
        <div class="built-head">
          <div class="eyebrow">What Has Already Been Built</div>
          <h2>What Has Already Been Built</h2>
          <p>SVE Group's platform is no longer only an information portal. Core operational foundations — identity, organisation, employee lifecycle and workflow approvals — are already built, tested and being progressively connected into one SVE environment.</p>
        </div>
        <div class="foundation-hub">
          <h3>Operational Foundation Established</h3>
          <p>Seven implemented capabilities now form a reusable foundation for SVE's next operational systems.</p>
        </div>
        <div class="layer-connector ${anySelected ? "flowing" : ""}"><span class="connector-line"></span><span class="connector-arrow">&darr;</span><span class="connector-line"></span></div>
        <div class="capability-grid">${tiles}</div>
        <div class="built-detail-desktop">${detail}</div>
        <div class="mobile-capabilities">${mobileCapabilities}</div>
      </div>
    </div>`;
}

function peopleQualificationHtml(stage) {
  if (!stage.qualification) return "";
  return `
    <div class="stage-qualification">
      <span class="stage-qualification-label">Important qualification</span>
      <p>${esc(stage.qualification)}</p>
    </div>`;
}

/**
 * The "what connects" mini flow shared by desktop and mobile — reuses the
 * same connector visual grammar as Screens 03/04 (a short line-arrow-line
 * between blocks) rather than inventing a new diagram style.
 */
function peopleJourneyChainHtml(steps) {
  return `
    <div class="journey-chain">
      ${steps
        .map(
          (step, i) => `
        ${i > 0 ? `<div class="journey-connector"><span class="connector-line"></span><span class="connector-arrow">&darr;</span><span class="connector-line"></span></div>` : ""}
        <div class="journey-chain-step">
          <h5>${esc(step.label)}</h5>
          <p>${esc(step.detail)}</p>
        </div>`
        )
        .join("")}
    </div>`;
}

function peopleBadgeHtml(badge) {
  if (!badge) return "";
  return `<span class="app-badge tone-${esc(badge.tone)}">${esc(badge.label)}</span>`;
}

function peopleFieldListHtml(fields) {
  return `<dl class="app-field-list">${fields
    .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
    .join("")}</dl>`;
}

/**
 * Presentation-native, entirely fictional application preview — never a
 * live SVEGIP screenshot, iframe, or API call. Recreates the real People
 * application's own visual conventions (field-list cards, Current/Proposed
 * comparison, status badges) as new, independent markup/CSS.
 */
function peoplePreviewHtml(stage) {
  const p = stage.preview;
  if (p.kind === "movement") {
    return `
      <div class="app-preview-card">
        <div class="app-preview-head"><h4>${esc(p.title)}</h4>${peopleBadgeHtml(p.badge)}</div>
        <div class="app-preview-compare">
          <div class="app-preview-col"><h5>Current</h5>${peopleFieldListHtml(p.current)}</div>
          <div class="app-preview-col"><h5>Proposed Movement</h5>${peopleFieldListHtml(p.proposed)}</div>
        </div>
      </div>`;
  }
  if (p.kind === "probation") {
    const outcomes = `<div class="app-outcome-row">${p.outcomes
      .map((o) => `<span class="app-outcome-chip ${o.selected ? "selected" : ""}">${esc(o.label)}</span>`)
      .join("")}</div>`;
    return `
      <div class="app-preview-card">
        <div class="app-preview-head"><h4>${esc(p.title)}</h4>${peopleBadgeHtml(p.badge)}</div>
        ${peopleFieldListHtml(p.fields)}
        ${outcomes}
      </div>`;
  }
  // "record" (JOIN) and "exit" (EXIT) share the same simple field-list card shape.
  return `
    <div class="app-preview-card">
      <div class="app-preview-head"><h4>${esc(p.title)}</h4>${peopleBadgeHtml(p.badge)}</div>
      ${peopleFieldListHtml(p.fields)}
      ${p.kind === "exit" ? `<p class="app-preview-note">History is retained throughout — nothing above is deleted when access is withdrawn.</p>` : ""}
    </div>`;
}

/**
 * Shared by desktop's detail panel and mobile's expanded accordion row —
 * identical markup either way, matching the What-exists/Why-it-matters
 * pattern's own precedent from Screen 04. Order matches the brief exactly:
 * what happens -> what connects -> why it matters -> application preview,
 * with the qualification (where present) kept visible in the main flow,
 * never behind a secondary disclosure.
 */
function peopleDetailBodyHtml(stage) {
  return `
    <div class="built-detail-grid people-detail-grid">
      <div class="built-detail-block" style="animation-delay:.05s">
        <span class="built-detail-label">What happens</span>
        <p>${esc(stage.whatHappens)}</p>
      </div>
      <div class="built-detail-block" style="animation-delay:.15s">
        <span class="built-detail-label">What connects</span>
        ${peopleJourneyChainHtml(stage.connects)}
      </div>
      <div class="built-detail-block" style="animation-delay:.25s">
        <span class="built-detail-label">Why it matters</span>
        <p>${esc(stage.whyItMatters)}</p>
      </div>
      ${peopleQualificationHtml(stage)}
      <div class="built-detail-block" style="animation-delay:.35s">
        <span class="built-detail-label">Application experience</span>
        ${peoplePreviewHtml(stage)}
      </div>
    </div>`;
}

function renderScreenPeople() {
  const stages = PEOPLE_STAGES;
  const anySelected = activePeopleStageIndex !== -1;

  const track = stages
    .map((stage, i) => {
      const state = activePeopleStageIndex === i ? "active" : "";
      return `
        <button class="stage-node ${state}" data-action="peoplestage" data-index="${i}" aria-current="${activePeopleStageIndex === i}">
          <div class="stage-node-top">
            <span class="stage-node-dot">${i + 1}</span>
          </div>
          <div class="stage-node-name">${esc(stage.label)}</div>
          <div class="stage-node-tag">${esc(stage.systemLabel)}</div>
        </button>`;
    })
    .join("");

  const detail =
    activePeopleStageIndex === -1
      ? `<div class="module-detail-empty">Select a stage above to see what happens, what connects, why it matters, and the application experience behind it.</div>`
      : (() => {
          const stage = stages[activePeopleStageIndex];
          return `
            <div class="module-detail built-detail people-detail">
              <div class="module-detail-head">
                <h4>${esc(stage.label)} <span class="people-detail-system">— ${esc(stage.systemLabel)}</span></h4>
                ${statusPillHtml(stage.status, stage.caveat)}
              </div>
              ${peopleDetailBodyHtml(stage)}
            </div>`;
        })();

  const mobileStages = stages
    .map((stage, i) => {
      const open = activePeopleStageIndex === i;
      return `
        <div class="accordion-item ${open ? "open" : ""}">
          <button class="accordion-trigger capability-trigger" data-action="peoplestage" data-index="${i}" aria-expanded="${open}">
            <span class="capability-trigger-row1">
              <h3>${esc(stage.label)}</h3>
              <span class="accordion-caret">&#9662;</span>
            </span>
            <span class="capability-trigger-status">${statusPillHtml(stage.status, stage.caveat)}</span>
            <span class="capability-trigger-meaning">${esc(stage.systemLabel)} — ${esc(stage.whatHappens)}</span>
          </button>
          <div class="accordion-body">
            <div class="accordion-body-inner">
              ${peopleDetailBodyHtml(stage)}
            </div>
          </div>
        </div>`;
    })
    .join("");

  return `
    <div class="people">
      <div class="section-wrap">
        <div class="people-head">
          <div class="eyebrow">People / HRMS</div>
          <h2>One Employee Foundation. A Connected Employment Lifecycle.</h2>
          <p>SVE's People foundation connects employee information, organisational structure, lifecycle processes and approvals through one controlled platform architecture.</p>
        </div>
        <div class="stage-track people-stage-track" role="tablist" aria-label="Employee journey stages">${track}</div>
        <div class="layer-connector people-track-connector ${anySelected ? "flowing" : ""}"><span class="connector-line"></span><span class="connector-arrow">&darr;</span><span class="connector-line"></span></div>
        <div class="built-detail-desktop">${detail}</div>
        <div class="mobile-capabilities">${mobileStages}</div>
      </div>
    </div>`;
}

/* ===================== Shell / init ===================== */

function renderApp() {
  const screensHtml = SCREENS.map((s, i) => {
    const state = i === currentIndex ? "active" : "";
    return `<div class="screen ${state}" data-screen-id="${s.id}">${i === currentIndex ? s.render() : ""}</div>`;
  }).join("");
  return `
    <div class="app-shell">
      ${renderChromeTop()}
      <div class="screen-stage">${screensHtml}</div>
      ${renderChromeBottom()}
    </div>`;
}

function render() {
  const el = document.getElementById("app");
  if (!el) return;
  el.innerHTML = renderApp();
}

function onAppClick(e) {
  const el = e.target && typeof e.target.closest === "function" ? e.target.closest("[data-action]") : null;
  if (!el) return;
  const action = el.dataset.action;
  if (action === "next") nextScreen();
  else if (action === "prev") prevScreen();
  else if (action === "goto") goToScreen(Number(el.dataset.index));
  else if (action === "stage") selectStage(Number(el.dataset.stage));
  else if (action === "module") selectModule(Number(el.dataset.layer), Number(el.dataset.module));
  else if (action === "accordion") toggleAccordion(Number(el.dataset.layer));
  else if (action === "capability") selectCapability(Number(el.dataset.index));
  else if (action === "evidence") toggleBuildEvidence();
  else if (action === "peoplestage") selectPeopleStage(Number(el.dataset.index));
}

let touchStartX = null;
function handleTouchStart(e) {
  touchStartX = e && e.touches && e.touches[0] ? e.touches[0].clientX : null;
}
function handleTouchEnd(e) {
  if (touchStartX === null) return;
  const endX = e && e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : null;
  if (endX !== null) {
    const dx = endX - touchStartX;
    if (Math.abs(dx) > 60) {
      if (dx < 0) nextScreen();
      else prevScreen();
    }
  }
  touchStartX = null;
}

function init() {
  const appEl = document.getElementById("app");
  if (appEl && typeof appEl.addEventListener === "function") {
    appEl.addEventListener("click", onAppClick);
  }
  if (typeof document.addEventListener === "function") {
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
  }
  render();
}

init();
