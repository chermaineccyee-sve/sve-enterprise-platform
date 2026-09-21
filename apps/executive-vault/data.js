/**
 * Executive Vault — mock dataset (Phase 3 prototype, v2).
 *
 * Every value here is illustrative sample data written for this prototype.
 * NONE of it comes from a real Google Drive account, and no code in this
 * app makes a network call of any kind — see README.md. Google Drive
 * URLs/paths below are plausible-looking placeholders only.
 *
 * v2 reflects the approved architecture in
 * docs/architecture/executive-document-vault.md §3.1/§3a/§5.1/§5.2:
 *   Client -> Engagement -> Project/Matter -> Workstream -> Document
 * (CLIENTS, ENGAGEMENTS, MATTERS below), the 8-value Function vocabulary,
 * the 19-value Document Type vocabulary (18 approved + "Other" as the
 * deliberate escape hatch), and the Legacy business-line flag (§3a) — see
 * the "legacy-sabah-resort" CLIENTS entry.
 *
 * Loaded before app.js via a plain <script> tag (no bundler, no modules —
 * matches apps/executive-briefing's convention). Declares exactly one
 * global: window.VAULT_DATA. Everything else is wrapped in an IIFE so it
 * cannot collide with app.js's own top-level `const` declarations, which
 * destructure these same field names back out of window.VAULT_DATA — two
 * top-level `const`s with the same name in the same shared script scope
 * would otherwise be a SyntaxError.
 */
(function () {

const CLASSIFICATIONS = [
  { id: "highly-confidential", label: "Highly Confidential", cls: "tier-hc",
    test: "Board, shareholder, investment, legal privilege, or sensitive executive matters." },
  { id: "confidential", label: "Confidential", cls: "tier-c",
    test: "Named-individual HR/personnel data, contract terms, or client-sensitive commercial detail." },
  { id: "restricted", label: "Restricted", cls: "tier-r",
    test: "Internal project, operational or management material not for general circulation." },
  { id: "controlled", label: "Controlled", cls: "tier-ct",
    test: "Internal working documentation with a defined but wider internal circulation." },
  { id: "general", label: "General", cls: "tier-g",
    test: "Ordinary internal or reference material with no particular sensitivity." },
];

const STATUSES = [
  "Draft", "Working Draft", "Internal Review", "Management Review", "Client Review",
  "Pending Information", "Approved", "Final", "Issued", "Superseded", "Archived",
];

// Approved Function vocabulary — architecture doc §5.1. Eight values,
// deliberately short and stable; HR's internal variety is carried by
// Workstream (§3.1), not by splitting this list further.
const FUNCTIONS = [
  "Executive Office", "Governance & Strategy", "Legal & Compliance", "Human Resources",
  "Project & Programme Management", "Finance & Investment", "Operations & Administration",
  "Research & Intelligence",
];

// Approved Document Type vocabulary — architecture doc §5.2 (18 values) plus
// "Other" as the explicit escape hatch for the rare document that doesn't
// fit — never a reason to mint a 20th named type instead.
const DOCUMENT_TYPES = [
  "Policy", "Contract / Agreement", "Minutes", "Agenda", "Resolution", "Proposal", "Report",
  "Management Paper", "Framework", "Deliverable", "Template", "Correspondence", "Note",
  "Executive Summary", "Certificate / Registration", "Briefing Note", "Itinerary",
  "Litigation File", "Other",
];

// CLIENTS: the enduring, top-level relationship (§3.1). A client with
// legacy:true is a discontinued business line — excluded from active
// pickers/dashboards/nav (§3a) but still reachable via Archive.
const CLIENTS = [
  {
    id: "vt-worldwide", code: "VT", name: "VT Worldwide", type: "client", status: "active",
    owner: "Me", pinned: true, legacy: false,
    summary: "Group-wide HR transformation and policy modernisation engagement, running since Q2 2026.",
    contacts: [
      { name: "Ravi Menon", role: "Group CHRO (client sponsor)" },
      { name: "Aisha Rahman", role: "HR Transformation Lead" },
    ],
    keyDates: [
      { label: "Engagement renewal", date: "2027-01-31" },
      { label: "HR-025 client sign-off due", date: "2026-09-30" },
    ],
    driveFolder: "Clients & Engagements / VT Worldwide",
  },
  {
    id: "mre-asia", code: "MRE", name: "MRE Asia", type: "client", status: "active",
    owner: "Me", pinned: true, legacy: false,
    summary: "Advisory on a group-wide HR operating model, proposal stage.",
    contacts: [{ name: "Daniel Foo", role: "COO, MRE Asia" }],
    keyDates: [{ label: "Proposal decision expected", date: "2026-10-10" }],
    driveFolder: "Clients & Engagements / MRE Asia",
  },
  {
    id: "nusantara", code: "NUS", name: "Nusantara Project", type: "client", status: "active",
    owner: "Me", pinned: false, legacy: false,
    summary: "Strategic advisory engagement for the Nusantara regional expansion programme.",
    contacts: [{ name: "Wulan Sari", role: "Programme Director" }],
    keyDates: [{ label: "Executive summary review", date: "2026-09-25" }],
    driveFolder: "Clients & Engagements / Nusantara Project",
  },
  {
    id: "sve-gep", code: "SVEGIP", name: "SVE Group Enterprise Platform", type: "project", status: "active",
    owner: "Me", pinned: true, legacy: false,
    summary: "Internal programme consolidating SVEGIP and shared enterprise services into one platform.",
    contacts: [{ name: "Eric Tang", role: "Executive Sponsor" }],
    keyDates: [{ label: "Management review due", date: "2026-09-28" }],
    driveFolder: "Projects & Programmes / SVE Group Enterprise Platform",
  },
  {
    id: "internal-governance", code: "INT", name: "Internal Governance", type: "project", status: "active",
    owner: "Me", pinned: false, legacy: false,
    summary: "Group governance, board administration, and internal policy ownership — not tied to one client.",
    contacts: [{ name: "Board Secretariat", role: "Coordination" }],
    keyDates: [{ label: "Board calendar refresh", date: "2026-11-01" }],
    driveFolder: "Projects & Programmes / Internal Governance",
  },
  {
    id: "legacy-sabah-resort", code: "SAB", name: "Sabah & Resort Development (Legacy)", type: "project", status: "closed",
    owner: "Me", pinned: false, legacy: true,
    summary: "Historical physical-development and resort operations business line — discontinued. Retained for record only; excluded from active Client/Engagement pickers, dashboard counts, and default search per the Legacy business-line rule (architecture doc §3a).",
    contacts: [], keyDates: [],
    driveFolder: "99 – Archive / Legacy Business Lines / Sabah & Resort Development",
  },
];

// ENGAGEMENTS: a discrete, time-bound contract/SOW under a Client (§3.1).
// Most clients today have exactly one — the model exists so a repeat or
// multi-matter client isn't forced to merge unrelated work into one record.
const ENGAGEMENTS = [
  { id: "eng-vt-hr", clientId: "vt-worldwide", name: "HR Transformation / HR Advisory", status: "active" },
  { id: "eng-mre-hr", clientId: "mre-asia", name: "HR Operating Model Advisory", status: "active" },
  { id: "eng-nus-strategy", clientId: "nusantara", name: "Strategic Advisory", status: "active" },
  { id: "eng-svegip", clientId: "sve-gep", name: "Enterprise Platform Programme", status: "active" },
  { id: "eng-intgov", clientId: "internal-governance", name: "Group Governance & Policy", status: "active" },
  { id: "eng-legacy-sabah", clientId: "legacy-sabah-resort", name: "Sabah Operations (Historical)", status: "closed" },
];

// MATTERS (Project/Matter): a specific initiative inside an Engagement
// (§3.1), holding the Workstream vocabulary documents are tagged against.
// A workstream can be promoted to its own standalone Matter later —
// app.js's promoteWorkstreamToMatter() demonstrates this live.
const MATTERS = [
  {
    id: "matter-vt-hrtransform", engagementId: "eng-vt-hr", name: "HR Transformation", status: "active",
    owner: "Me", startDate: "2026-04-01", targetDate: "2027-01-31", currentStage: "Delivery",
    workstreams: ["HR Policy Framework", "HR Digitalisation / HRMS", "Performance Management", "Implementation / Training"],
  },
  {
    id: "matter-mre-opmodel", engagementId: "eng-mre-hr", name: "HR Operating Model Design", status: "active",
    owner: "Me", startDate: "2026-08-15", targetDate: "2026-11-30", currentStage: "Proposal",
    workstreams: ["Operating Model Design"],
  },
  {
    id: "matter-nus-strategy", engagementId: "eng-nus-strategy", name: "Strategic Advisory Programme", status: "active",
    owner: "Me", startDate: "2026-09-01", targetDate: null, currentStage: "Advisory",
    workstreams: ["Strategic Advisory"],
  },
  {
    id: "matter-svegip-platform", engagementId: "eng-svegip", name: "Platform Architecture & Rollout", status: "active",
    owner: "Me", startDate: "2026-02-01", targetDate: null, currentStage: "Build",
    workstreams: ["Platform Architecture", "Management Reporting"],
  },
  {
    id: "matter-intgov-policy", engagementId: "eng-intgov", name: "Group Policy & Governance Administration", status: "active",
    owner: "Me", startDate: "2026-01-01", targetDate: null, currentStage: "Ongoing",
    workstreams: ["Board & Governance", "Group Policy"],
  },
  {
    id: "matter-intgov-litigation", engagementId: "eng-intgov", name: "Contract Dispute — Vendor XYZ", status: "active",
    owner: "Me", startDate: "2026-08-01", targetDate: null, currentStage: "Active Dispute",
    workstreams: [],
  },
  {
    id: "matter-legacy-resort", engagementId: "eng-legacy-sabah", name: "Resort Development Programme (Historical)", status: "closed",
    owner: "Me", startDate: "2019-01-01", targetDate: "2024-12-31", currentStage: "Closed",
    workstreams: [],
  },
];

// documents: the single source of truth for every screen.
// classified:false => sits only in the Executive Inbox until filed.
// clientId (§3.1) is required for anything client/project-scoped; matterId
// is optional finer nesting; workstream is a free tag scoped to that matter.
const DOCUMENTS = [
  {
    id: "d01", docId: "HR-124", title: "Lark Digital Acknowledgement Workflow Specification",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "HR Digitalisation / HRMS", function: "Human Resources",
    docType: "Policy", version: "v0.1", versionChain: ["v0.1"], status: "Working Draft",
    confidentiality: "controlled", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-09-10", modified: "2026-09-18", reviewDate: "2026-09-29", starred: true,
    classified: true, tags: ["onboarding", "e-signature"],
    driveUrl: "https://drive.google.com/file/d/mock-hr124/view",
    drivePath: "Clients & Engagements / VT Worldwide / 03 – Working Documents / HR Digitalisation",
    notes: "First draft of the digital acknowledgement workflow for the Lark HR system rollout.",
  },
  {
    id: "d02", docId: "HR-025", title: "Resignation, Termination & Offboarding Policy",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "HR Policy Framework", function: "Human Resources",
    docType: "Policy", version: "v0.4", versionChain: ["v0.1", "v0.2", "v0.3", "v0.4"], status: "Client Review",
    confidentiality: "confidential", jurisdiction: "Malaysia", owner: "Me", reviewer: "Ravi Menon",
    created: "2026-06-02", modified: "2026-09-20", reviewDate: "2026-09-30", starred: true,
    classified: true, tags: ["offboarding"],
    driveUrl: "https://drive.google.com/file/d/mock-hr025/view",
    drivePath: "Clients & Engagements / VT Worldwide / 06 – Client Review & Feedback",
    notes: "Sent to Ravi for sign-off on 20 Sep; awaiting confirmation before v1.0 Final.",
  },
  {
    id: "d03", docId: "VT-HR-SET3", title: "VT Worldwide HR Company Policy Framework – Set 3",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "HR Policy Framework", function: "Human Resources",
    docType: "Framework", version: "v1.0 Final", versionChain: ["v0.1", "v0.2", "v1.0 Final"], status: "Final",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-04-01", modified: "2026-08-14", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-vthrset3/view",
    drivePath: "Clients & Engagements / VT Worldwide / 07 – Final / Issued",
    notes: "",
  },
  {
    id: "d04", docId: "VT-HR-026", title: "Working Time & Overtime Policy",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "HR Policy Framework", function: "Human Resources",
    docType: "Policy", version: "v0.3", versionChain: ["v0.1", "v0.2", "v0.3"], status: "Internal Review",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-08-05", modified: "2026-09-15", reviewDate: "2026-09-26", starred: false,
    classified: true, tags: ["overtime", "working time"],
    driveUrl: "https://drive.google.com/file/d/mock-vthr026/view",
    drivePath: "Clients & Engagements / VT Worldwide / 03 – Working Documents / HR Policy Framework",
    notes: "Malaysia overtime calculation clause under review with internal legal.",
  },
  {
    id: "d05", docId: "VT-LG-004", title: "Employment Contract Template (Malaysia)",
    clientId: "vt-worldwide", matterId: null, workstream: null, function: "Legal & Compliance",
    docType: "Template", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "confidential", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-05-20", modified: "2026-05-20", reviewDate: null, starred: false,
    classified: true, tags: ["template"],
    driveUrl: "https://drive.google.com/file/d/mock-vtlg004/view",
    drivePath: "Clients & Engagements / VT Worldwide / 08 – Reference",
    notes: "",
  },
  {
    id: "d06", docId: "VT-GV-002", title: "Engagement Letter — HR Transformation Programme",
    clientId: "vt-worldwide", matterId: null, workstream: null, function: "Governance & Strategy",
    docType: "Contract / Agreement", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "confidential", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-02-01", modified: "2026-02-03", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-vtgv002/view",
    drivePath: "Clients & Engagements / VT Worldwide / 01 – Engagement & Scope",
    notes: "",
  },
  {
    id: "d07", docId: "VT-MT-014", title: "Steering Committee Minutes — September 2026",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: null, function: "Governance & Strategy",
    docType: "Minutes", version: null, versionChain: [], status: "Final",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-09-16", modified: "2026-09-16", reviewDate: null, starred: false,
    classified: true, tags: ["steering committee"],
    driveUrl: "https://drive.google.com/file/d/mock-vtmt014/view",
    drivePath: "Clients & Engagements / VT Worldwide / 04 – Meetings & Correspondence",
    notes: "",
  },
  {
    id: "d07b", docId: "VT-MT-013", title: "Steering Committee Agenda — September 2026",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: null, function: "Governance & Strategy",
    docType: "Agenda", version: null, versionChain: [], status: "Final",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-09-12", modified: "2026-09-12", reviewDate: null, starred: false,
    classified: true, tags: ["steering committee"],
    driveUrl: "https://drive.google.com/file/d/mock-vtmt013/view",
    drivePath: "Clients & Engagements / VT Worldwide / 04 – Meetings & Correspondence",
    notes: "",
  },
  {
    id: "d08", docId: "MRE-HR-001", title: "HR Operating Model Proposal",
    clientId: "mre-asia", matterId: "matter-mre-opmodel", workstream: "Operating Model Design", function: "Human Resources",
    docType: "Proposal", version: "v0.1", versionChain: ["v0.1"], status: "Working Draft",
    confidentiality: "restricted", jurisdiction: "Singapore", owner: "Me", reviewer: null,
    created: "2026-09-08", modified: "2026-09-17", reviewDate: "2026-10-05", starred: true,
    classified: true, tags: ["operating model"],
    driveUrl: "https://drive.google.com/file/d/mock-mrehr001/view",
    drivePath: "Clients & Engagements / MRE Asia / 03 – Working Documents",
    notes: "First-pass proposal for MRE Asia's regional HR operating model.",
  },
  {
    id: "d09", docId: "MRE-GV-002", title: "Fee Proposal & Engagement Letter",
    clientId: "mre-asia", matterId: null, workstream: null, function: "Governance & Strategy",
    docType: "Contract / Agreement", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "confidential", jurisdiction: "Singapore", owner: "Me", reviewer: null,
    created: "2026-08-20", modified: "2026-08-22", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-mregv002/view",
    drivePath: "Clients & Engagements / MRE Asia / 01 – Engagement & Scope",
    notes: "",
  },
  {
    id: "d09b", docId: "MRE-DL-001", title: "HR Operating Model Deliverable Pack v1.0",
    clientId: "mre-asia", matterId: "matter-mre-opmodel", workstream: "Operating Model Design", function: "Human Resources",
    docType: "Deliverable", version: "v1.0 Final", versionChain: ["v0.1", "v1.0 Final"], status: "Issued",
    confidentiality: "restricted", jurisdiction: "Singapore", owner: "Me", reviewer: null,
    created: "2026-09-18", modified: "2026-09-19", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-mredl001/view",
    drivePath: "Clients & Engagements / MRE Asia / 07 – Final / Issued",
    notes: "",
  },
  {
    id: "d09c", docId: "MRE-CR-001", title: "Correspondence — Scope Clarification Email Thread",
    clientId: "mre-asia", matterId: null, workstream: null, function: "Governance & Strategy",
    docType: "Correspondence", version: null, versionChain: [], status: "Final",
    confidentiality: "confidential", jurisdiction: "Singapore", owner: "Me", reviewer: null,
    created: "2026-09-05", modified: "2026-09-05", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-mrecr001/view",
    drivePath: "Clients & Engagements / MRE Asia / 04 – Meetings & Correspondence",
    notes: "",
  },
  {
    id: "d10", docId: "NUS-EX-001", title: "Nusantara — Executive Summary Note",
    clientId: "nusantara", matterId: "matter-nus-strategy", workstream: "Strategic Advisory", function: "Governance & Strategy",
    docType: "Executive Summary", version: "v1.0 Final", versionChain: ["v0.1", "v1.0 Final"], status: "Final",
    confidentiality: "general", jurisdiction: "ASEAN", owner: "Me", reviewer: null,
    created: "2026-08-01", modified: "2026-09-12", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-nusex001/view",
    drivePath: "Clients & Engagements / Nusantara Project / 07 – Final / Issued",
    notes: "",
  },
  {
    id: "d11", docId: "NUS-MT-002", title: "Nusantara Project Kickoff Minutes — September 2026",
    clientId: "nusantara", matterId: "matter-nus-strategy", workstream: "Strategic Advisory", function: "Governance & Strategy",
    docType: "Minutes", version: null, versionChain: [], status: "Final",
    confidentiality: "restricted", jurisdiction: "ASEAN", owner: "Me", reviewer: null,
    created: "2026-09-04", modified: "2026-09-04", reviewDate: null, starred: false,
    classified: true, tags: ["kickoff"],
    driveUrl: "https://drive.google.com/file/d/mock-nusmt002/view",
    drivePath: "Clients & Engagements / Nusantara Project / 04 – Meetings & Correspondence",
    notes: "",
  },
  {
    id: "d12", docId: "SVEGIP-MG-001", title: "SVE Group Enterprise Platform — Management Review",
    clientId: "sve-gep", matterId: "matter-svegip-platform", workstream: "Management Reporting", function: "Governance & Strategy",
    docType: "Management Paper", version: "v0.1", versionChain: ["v0.1"], status: "Internal Review",
    confidentiality: "restricted", jurisdiction: "Global", owner: "Me", reviewer: "Eric Tang",
    created: "2026-09-14", modified: "2026-09-19", reviewDate: "2026-09-28", starred: true,
    classified: true, tags: ["management review"],
    driveUrl: "https://drive.google.com/file/d/mock-svegipmg001/view",
    drivePath: "Projects & Programmes / SVE Group Enterprise Platform / 03 – Working Documents",
    notes: "Awaiting Eric's review before circulation to the wider steering group.",
  },
  {
    id: "d13", docId: "SVEGIP-GV-002", title: "Enterprise Architecture Briefing Notes",
    clientId: "sve-gep", matterId: "matter-svegip-platform", workstream: "Platform Architecture", function: "Governance & Strategy",
    docType: "Briefing Note", version: "v1.0 Final", versionChain: ["v0.1", "v1.0 Final"], status: "Final",
    confidentiality: "restricted", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-08-10", modified: "2026-08-28", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-svegipgv002/view",
    drivePath: "Projects & Programmes / SVE Group Enterprise Platform / 07 – Final / Issued",
    notes: "",
  },
  {
    id: "d13b", docId: "SVEGIP-PM-003", title: "Enterprise Platform Rollout — Milestone & Progress Report",
    clientId: "sve-gep", matterId: "matter-svegip-platform", workstream: "Platform Architecture", function: "Project & Programme Management",
    docType: "Report", version: "v0.3", versionChain: ["v0.1", "v0.2", "v0.3"], status: "Internal Review",
    confidentiality: "restricted", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-08-25", modified: "2026-09-17", reviewDate: "2026-10-01", starred: false,
    classified: true, tags: ["milestones"],
    driveUrl: "https://drive.google.com/file/d/mock-svegippm003/view",
    drivePath: "Projects & Programmes / SVE Group Enterprise Platform / 03 – Working Documents",
    notes: "",
  },
  {
    id: "d14", docId: "INT-GV-001", title: "Board Governance Calendar 2026",
    clientId: "internal-governance", matterId: "matter-intgov-policy", workstream: "Board & Governance", function: "Governance & Strategy",
    docType: "Report", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "highly-confidential", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-01-05", modified: "2026-09-01", reviewDate: "2026-11-01", starred: false,
    classified: true, tags: ["board"],
    driveUrl: "https://drive.google.com/file/d/mock-intgv001/view",
    drivePath: "Projects & Programmes / Internal Governance / 08 – Reference",
    notes: "",
  },
  {
    id: "d14b", docId: "INT-GV-002", title: "Board Resolution — FY2027 Budget Approval",
    clientId: "internal-governance", matterId: null, workstream: null, function: "Governance & Strategy",
    docType: "Resolution", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "highly-confidential", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-09-05", modified: "2026-09-05", reviewDate: null, starred: false,
    classified: true, tags: ["board", "budget"],
    driveUrl: "https://drive.google.com/file/d/mock-intgv002/view",
    drivePath: "Projects & Programmes / Internal Governance / 08 – Reference",
    notes: "",
  },
  {
    id: "d14c", docId: "INT-GV-003", title: "Board & CEO Succession Framework",
    clientId: "internal-governance", matterId: null, workstream: null, function: "Governance & Strategy",
    docType: "Framework", version: "v0.2", versionChain: ["v0.1", "v0.2"], status: "Management Review",
    confidentiality: "highly-confidential", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-07-01", modified: "2026-09-10", reviewDate: "2026-10-15", starred: false,
    classified: true, tags: ["succession"],
    driveUrl: "https://drive.google.com/file/d/mock-intgv003/view",
    drivePath: "Projects & Programmes / Internal Governance / 03 – Working Documents",
    notes: "Board-level succession — Governance & Strategy, not Human Resources, per the context-based split.",
  },
  {
    id: "d15", docId: "INT-HR-010", title: "Group Performance Management Framework",
    clientId: "internal-governance", matterId: "matter-intgov-policy", workstream: "Group Policy", function: "Human Resources",
    docType: "Policy", version: "v0.2", versionChain: ["v0.1", "v0.2"], status: "Working Draft",
    confidentiality: "controlled", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-04-18", modified: "2026-05-12", reviewDate: "2026-06-01", starred: false,
    classified: true, tags: ["performance management"],
    driveUrl: "https://drive.google.com/file/d/mock-inthr010/view",
    drivePath: "Human Resources & Org",
    notes: "Stalled since May — needs a decision on whether this restarts or is superseded.",
  },
  {
    id: "d15b", docId: "INT-HR-011", title: "Leadership Development & Succession Pipeline",
    clientId: "internal-governance", matterId: "matter-intgov-policy", workstream: "Group Policy", function: "Human Resources",
    docType: "Framework", version: "v0.1", versionChain: ["v0.1"], status: "Working Draft",
    confidentiality: "confidential", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-08-20", modified: "2026-09-05", reviewDate: "2026-10-20", starred: false,
    classified: true, tags: ["succession"],
    driveUrl: "https://drive.google.com/file/d/mock-inthr011/view",
    drivePath: "Human Resources & Org",
    notes: "Ordinary leadership-pipeline succession — Human Resources, not Governance, per the context-based split.",
  },
  {
    id: "d16", docId: "INT-FN-003", title: "Labuan Fund Structuring Note",
    clientId: "internal-governance", matterId: null, workstream: null, function: "Finance & Investment",
    docType: "Note", version: "v0.1", versionChain: ["v0.1"], status: "Working Draft",
    confidentiality: "highly-confidential", jurisdiction: "Labuan", owner: "Me", reviewer: null,
    created: "2026-09-02", modified: "2026-09-11", reviewDate: "2026-09-25", starred: true,
    classified: true, tags: ["fund structuring"],
    driveUrl: "https://drive.google.com/file/d/mock-intfn003/view",
    drivePath: "Finance & Investment",
    notes: "",
  },
  {
    id: "d16b", docId: "INT-FN-004", title: "Group Management Financial Report — Q3 2026",
    clientId: "internal-governance", matterId: null, workstream: null, function: "Finance & Investment",
    docType: "Report", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "confidential", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-09-16", modified: "2026-09-16", reviewDate: null, starred: false,
    classified: true, tags: ["management financial report"],
    driveUrl: "https://drive.google.com/file/d/mock-intfn004/view",
    drivePath: "Finance & Investment",
    notes: "Management-level financial reporting — in scope; routine bookkeeping/ledger processing is not (see architecture doc §5.1).",
  },
  {
    id: "d17", docId: "INT-LG-005", title: "Group Data Protection Policy",
    clientId: "internal-governance", matterId: "matter-intgov-policy", workstream: "Group Policy", function: "Legal & Compliance",
    docType: "Policy", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "general", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-03-01", modified: "2026-03-01", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-intlg005/view",
    drivePath: "Legal & Compliance",
    notes: "",
  },
  {
    id: "d17b", docId: "INT-LG-006", title: "SVE Group Trademark Registration",
    clientId: "internal-governance", matterId: null, workstream: null, function: "Legal & Compliance",
    docType: "Certificate / Registration", version: null, versionChain: [], status: "Final",
    confidentiality: "confidential", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2025-11-01", modified: "2025-11-01", reviewDate: "2028-11-01", starred: false,
    classified: true, tags: ["trademark", "IP"],
    driveUrl: "https://drive.google.com/file/d/mock-intlg006/view",
    drivePath: "Legal & Compliance",
    notes: "",
  },
  {
    id: "d17c", docId: "INT-LT-001", title: "Litigation File — Vendor XYZ Contract Dispute",
    clientId: "internal-governance", matterId: "matter-intgov-litigation", workstream: null, function: "Legal & Compliance",
    docType: "Litigation File", version: null, versionChain: [], status: "Internal Review",
    confidentiality: "highly-confidential", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-08-05", modified: "2026-09-14", reviewDate: "2026-10-10", starred: true,
    classified: true, tags: ["litigation"],
    driveUrl: "https://drive.google.com/file/d/mock-intlt001/view",
    drivePath: "Projects & Programmes / Internal Governance / 03 – Working Documents / Contract Dispute — Vendor XYZ",
    notes: "Litigation is matter-based — its own Project/Matter under the Internal Governance engagement, not a standing group-level folder (architecture doc §3.1).",
  },
  {
    id: "d17d", docId: "INT-GV-004", title: "Board Resolution — Litigation Settlement Authority",
    clientId: "internal-governance", matterId: "matter-intgov-litigation", workstream: null, function: "Governance & Strategy",
    docType: "Resolution", version: "v0.2", versionChain: ["v0.1", "v0.2"], status: "Management Review",
    confidentiality: "highly-confidential", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-09-12", modified: "2026-09-19", reviewDate: "2026-09-23", starred: true,
    classified: true, tags: ["litigation", "board"],
    driveUrl: "https://drive.google.com/file/d/mock-intgv004/view",
    drivePath: "Projects & Programmes / Internal Governance / 03 – Working Documents / Contract Dispute — Vendor XYZ",
    notes: "Genuinely pending a board decision — surfaces on Executive Home's Requires Review or Decision section (a Resolution/Management Paper not yet Final/Approved), discussed at the Wed litigation strategy call.",
  },
  {
    id: "d18", docId: "HR-124", title: "Lark Digital Acknowledgement Workflow Spec (copy)",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "HR Digitalisation / HRMS", function: "Human Resources",
    docType: "Policy", version: "v0.1", versionChain: ["v0.1"], status: "Working Draft",
    confidentiality: "controlled", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-09-10", modified: "2026-09-10", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-hr124-copy/view",
    drivePath: "Clients & Engagements / VT Worldwide / 02 – Information Received",
    notes: "",
    possibleDuplicateOf: "d01",
  },
  {
    id: "d19", docId: null, title: "VT Worldwide – Employee Handbook Draft",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "HR Policy Framework", function: "Human Resources",
    docType: "Policy", version: null, versionChain: [], status: "Working Draft",
    confidentiality: "controlled", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-07-01", modified: "2026-07-01", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-vthandbook/view",
    drivePath: "Clients & Engagements / VT Worldwide / 03 – Working Documents / HR Policy Framework",
    notes: "",
  },
  {
    id: "d19b", docId: "VT-HR-032", title: "Performance Management Framework Proposal",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "Performance Management", function: "Human Resources",
    docType: "Proposal", version: "v0.1", versionChain: ["v0.1"], status: "Working Draft",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-09-11", modified: "2026-09-19", reviewDate: "2026-10-03", starred: false,
    classified: true, tags: ["performance management"],
    driveUrl: "https://drive.google.com/file/d/mock-vthr032/view",
    drivePath: "Clients & Engagements / VT Worldwide / 03 – Working Documents / Performance Management",
    notes: "",
  },
  {
    id: "d19c", docId: "VT-HR-033", title: "HRMS Change Management & Training Plan",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "Implementation / Training", function: "Human Resources",
    docType: "Framework", version: "v0.1", versionChain: ["v0.1"], status: "Working Draft",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-09-13", modified: "2026-09-17", reviewDate: "2026-10-08", starred: false,
    classified: true, tags: ["training", "change management"],
    driveUrl: "https://drive.google.com/file/d/mock-vthr033/view",
    drivePath: "Clients & Engagements / VT Worldwide / 03 – Working Documents / Implementation & Training",
    notes: "",
  },
  {
    id: "d20", docId: "INT-OP-007", title: "Business Continuity Plan Update",
    clientId: "internal-governance", matterId: "matter-intgov-policy", workstream: null, function: "Operations & Administration",
    docType: "Report", version: "v0.2", versionChain: ["v0.1", "v0.2"], status: "Working Draft",
    confidentiality: "restricted", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-04-02", modified: "2026-05-09", reviewDate: "2026-06-01", starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-intop007/view",
    drivePath: "Operations & Administration",
    notes: "No activity since May — candidate for either restart or archive.",
  },
  {
    id: "d20b", docId: "INT-OP-008", title: "Head Office Lease Renewal Agreement",
    clientId: "internal-governance", matterId: null, workstream: null, function: "Operations & Administration",
    docType: "Contract / Agreement", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "confidential", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2026-06-01", modified: "2026-06-01", reviewDate: "2027-06-01", starred: false,
    classified: true, tags: ["lease"],
    driveUrl: "https://drive.google.com/file/d/mock-intop008/view",
    drivePath: "Operations & Administration",
    notes: "Property/lease material arises contextually under Operations — no dedicated folder (architecture doc §5.1).",
  },
  {
    id: "d21", docId: "VT-HR-018", title: "Legacy Leave Policy (Superseded)",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstream: "HR Policy Framework", function: "Human Resources",
    docType: "Policy", version: "v2.3", versionChain: ["v2.0", "v2.1", "v2.2", "v2.3"], status: "Superseded",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2024-01-10", modified: "2026-04-01", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-vthr018/view",
    drivePath: "Clients & Engagements / VT Worldwide / 99 – Archive",
    notes: "Superseded by VT Worldwide HR Company Policy Framework — Set 3.",
  },
  {
    id: "d22", docId: "TPL-001", title: "Engagement Letter Template",
    clientId: null, matterId: null, workstream: null, function: "Governance & Strategy",
    docType: "Template", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "general", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-01-01", modified: "2026-01-01", reviewDate: null, starred: false,
    classified: true, tags: ["template"],
    driveUrl: "https://drive.google.com/file/d/mock-tpl001/view",
    drivePath: "Templates & Reference",
    notes: "",
  },
  {
    id: "d23", docId: "TPL-002", title: "Board Paper Template",
    clientId: null, matterId: null, workstream: null, function: "Governance & Strategy",
    docType: "Template", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "general", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-01-01", modified: "2026-01-01", reviewDate: null, starred: false,
    classified: true, tags: ["template"],
    driveUrl: "https://drive.google.com/file/d/mock-tpl002/view",
    drivePath: "Templates & Reference",
    notes: "",
  },
  {
    id: "d23b", docId: "INT-RI-001", title: "Regional HR Market & Competitive Intelligence Note",
    clientId: null, matterId: null, workstream: null, function: "Research & Intelligence",
    docType: "Report", version: "v1.0 Final", versionChain: ["v1.0 Final"], status: "Final",
    confidentiality: "restricted", jurisdiction: "ASEAN", owner: "Me", reviewer: null,
    created: "2026-08-15", modified: "2026-08-15", reviewDate: null, starred: false,
    classified: true, tags: ["market research", "competitive analysis"],
    driveUrl: "https://drive.google.com/file/d/mock-intri001/view",
    drivePath: "Research & Intelligence",
    notes: "Market/competitive research merges into Research & Intelligence rather than a separate Marketing function (architecture doc; see gap analysis §5).",
  },
  {
    id: "d24", docId: null, title: "Scan_2026-09-19.pdf",
    clientId: null, matterId: null, workstream: null, function: null,
    docType: null, version: null, versionChain: [], status: "Working Draft",
    confidentiality: "general", jurisdiction: null, owner: "Me", reviewer: null,
    created: "2026-09-19", modified: "2026-09-19", reviewDate: null, starred: false,
    classified: false, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-scan0919/view",
    drivePath: "Executive Inbox",
    notes: "",
  },
  {
    id: "d25", docId: null, title: "IMG_Board_Pack_Sept.pdf",
    clientId: null, matterId: null, workstream: null, function: null,
    docType: null, version: null, versionChain: [], status: "Working Draft",
    confidentiality: "general", jurisdiction: null, owner: "Me", reviewer: null,
    created: "2026-09-20", modified: "2026-09-20", reviewDate: null, starred: false,
    classified: false, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-imgboardpack/view",
    drivePath: "Executive Inbox",
    notes: "",
  },
  {
    id: "eo01", docId: "INT-EO-001", title: "Board Meeting Briefing Note — September 2026",
    clientId: "internal-governance", matterId: null, workstream: null, function: "Executive Office",
    docType: "Briefing Note", version: null, versionChain: [], status: "Final",
    confidentiality: "confidential", jurisdiction: "Global", owner: "Me", reviewer: null,
    created: "2026-09-15", modified: "2026-09-15", reviewDate: null, starred: false,
    classified: true, tags: [],
    driveUrl: "https://drive.google.com/file/d/mock-inteo001/view",
    drivePath: "Executive Office",
    notes: "",
  },
  {
    id: "eo02", docId: "INT-EO-002", title: "Singapore Trip Itinerary — September 2026",
    clientId: "internal-governance", matterId: null, workstream: null, function: "Executive Office",
    docType: "Itinerary", version: null, versionChain: [], status: "Final",
    confidentiality: "general", jurisdiction: "Singapore", owner: "Me", reviewer: null,
    created: "2026-09-20", modified: "2026-09-20", reviewDate: null, starred: true,
    classified: true, tags: ["travel"],
    driveUrl: "https://drive.google.com/file/d/mock-inteo002/view",
    drivePath: "Executive Office",
    notes: "",
  },
  // Legacy business-line material (§3a) — excluded from active pickers,
  // dashboard counts, workspace lists and default search; reachable only
  // from Archive with an explicit Legacy filter.
  {
    id: "sab01", docId: "SAB-RE-001", title: "Sabah Resort Development Master Plan (Historical)",
    clientId: "legacy-sabah-resort", matterId: "matter-legacy-resort", workstream: null, function: null,
    docType: "Framework", version: "v2.0", versionChain: ["v1.0", "v2.0"], status: "Archived",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2020-03-01", modified: "2023-11-01", reviewDate: null, starred: false,
    classified: true, tags: ["legacy", "resort development"],
    driveUrl: "https://drive.google.com/file/d/mock-sabre001/view",
    drivePath: "99 – Archive / Legacy Business Lines / Sabah & Resort Development",
    notes: "Discontinued business line — retained for record only, not part of the active architecture.",
  },
  {
    id: "sab02", docId: "SAB-EV-002", title: "Sabah Environmental & Land Use Compliance Report (Historical)",
    clientId: "legacy-sabah-resort", matterId: "matter-legacy-resort", workstream: null, function: null,
    docType: "Report", version: null, versionChain: [], status: "Archived",
    confidentiality: "restricted", jurisdiction: "Malaysia", owner: "Me", reviewer: null,
    created: "2021-06-01", modified: "2021-06-01", reviewDate: null, starred: false,
    classified: true, tags: ["legacy", "environmental compliance"],
    driveUrl: "https://drive.google.com/file/d/mock-sabev002/view",
    drivePath: "99 – Archive / Legacy Business Lines / Sabah & Resort Development",
    notes: "Merged with the equivalent Operations-root branch in the historical tree — one record, one Function, per the gap analysis §3.",
  },
];

// MEETINGS: calendar events (mock — no live Outlook connection, architecture
// doc §15.6/§15.7). clientId/matterId/workstreams mirror the exact same
// optional reference chain a Document carries (§3.1/§15.4) — never a
// parallel project dataset. TODAY (2026-09-21) is a Monday; the four
// 09-21 entries below match the brief's own My Day worked example exactly.
// documentId links a meeting's recorded Minutes; agendaDocId its Agenda —
// both optional and both just references into DOCUMENTS, never a copy.
const MEETINGS = [
  { id: "m1", title: "Steering Committee — September 2026", date: "2026-09-16", startTime: "09:00", endTime: "10:00",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstreams: [],
    participants: [{ name: "Ravi Menon", role: "Group CHRO" }, { name: "Aisha Rahman", role: "HR Transformation Lead" }],
    location: "Microsoft Teams", status: "Completed", agendaDocId: "d07b", documentId: "d07",
    decisions: ["Approved v0.3 of the Working Time & Overtime Policy for internal legal review."] },
  { id: "m2", title: "Nusantara Project Kickoff", date: "2026-09-04", startTime: "09:30", endTime: "10:30",
    clientId: "nusantara", matterId: "matter-nus-strategy", workstreams: ["Strategic Advisory"],
    participants: [{ name: "Wulan Sari", role: "Programme Director" }],
    location: "Microsoft Teams", status: "Completed", agendaDocId: null, documentId: "d11",
    decisions: ["Confirmed Strategic Advisory as the sole workstream for Phase 1."] },
  { id: "m3", title: "Internal Management Review", date: "2026-09-21", startTime: "09:00", endTime: "09:30",
    clientId: "internal-governance", matterId: "matter-intgov-policy", workstreams: ["Board & Governance"],
    participants: [{ name: "Board Secretariat", role: "Coordination" }],
    location: "Microsoft Teams", status: "Confirmed", agendaDocId: null, documentId: null, decisions: [] },
  { id: "m4", title: "VT Worldwide — HR Transformation Review", date: "2026-09-21", startTime: "11:00", endTime: "13:00",
    clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", workstreams: ["HR Policy Framework", "HR Digitalisation / HRMS"],
    participants: [{ name: "Ravi Menon", role: "Group CHRO" }, { name: "Aisha Rahman", role: "HR Transformation Lead" }],
    location: "Microsoft Teams", status: "Confirmed", agendaDocId: "d07b", documentId: null, decisions: [] },
  { id: "m5", title: "MRE Asia — HR Operating Model Follow-Up", date: "2026-09-21", startTime: "14:30", endTime: "15:15",
    clientId: "mre-asia", matterId: "matter-mre-opmodel", workstreams: ["Operating Model Design"],
    participants: [{ name: "Daniel Foo", role: "COO, MRE Asia" }],
    location: "Zoom", status: "Confirmed", agendaDocId: null, documentId: null, decisions: [] },
  { id: "m6", title: "Nusantara — Documentation Review", date: "2026-09-21", startTime: "16:00", endTime: "16:30",
    clientId: "nusantara", matterId: "matter-nus-strategy", workstreams: ["Strategic Advisory"],
    participants: [{ name: "Wulan Sari", role: "Programme Director" }],
    location: "Microsoft Teams", status: "Confirmed", agendaDocId: null, documentId: null, decisions: [] },
  { id: "m7", title: "SVE Group Enterprise Platform — Steering Group", date: "2026-09-22", startTime: "10:00", endTime: "11:00",
    clientId: "sve-gep", matterId: "matter-svegip-platform", workstreams: ["Platform Architecture", "Management Reporting"],
    participants: [{ name: "Eric Tang", role: "Executive Sponsor" }],
    location: "Boardroom, HQ", status: "Confirmed", agendaDocId: null, documentId: null, decisions: [] },
  { id: "m8", title: "Internal Governance — Litigation Strategy Call", date: "2026-09-23", startTime: "11:00", endTime: "11:45",
    clientId: "internal-governance", matterId: "matter-intgov-litigation", workstreams: [],
    participants: [{ name: "External Counsel", role: "Litigation Advisor" }],
    location: "Microsoft Teams", status: "Tentative", agendaDocId: null, documentId: null, decisions: [] },
  { id: "m9", title: "MRE Asia — Proposal Walkthrough", date: "2026-09-24", startTime: "15:00", endTime: "16:00",
    clientId: "mre-asia", matterId: "matter-mre-opmodel", workstreams: ["Operating Model Design"],
    participants: [{ name: "Daniel Foo", role: "COO, MRE Asia" }],
    location: "Zoom", status: "Confirmed", agendaDocId: null, documentId: null, decisions: [] },
  { id: "m10", title: "Board & Governance — FY2027 Budget Discussion", date: "2026-09-25", startTime: "14:00", endTime: "14:30",
    clientId: "internal-governance", matterId: "matter-intgov-policy", workstreams: ["Board & Governance"],
    participants: [{ name: "Board Secretariat", role: "Coordination" }],
    location: "Boardroom, HQ", status: "Confirmed", agendaDocId: null, documentId: "d14b", decisions: [] },
];

// TASKS (Actions & Follow-Up): waitingOn names who the NEXT action actually
// belongs to (architecture doc §15.4) — null/omitted means it's on me.
const TASKS = [
  { id: "t1", title: "Confirm VT overtime policy wording with internal legal", clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", due: "2026-09-26", done: false, documentId: "d04", waitingOn: null },
  { id: "t2", title: "Send MRE Operating Model proposal v0.2 to Daniel Foo", clientId: "mre-asia", matterId: "matter-mre-opmodel", due: "2026-09-30", done: false, documentId: "d08", waitingOn: null },
  { id: "t3", title: "Get Ravi Menon's sign-off on HR-025 v0.4", clientId: "vt-worldwide", matterId: "matter-vt-hrtransform", due: "2026-09-30", done: false, documentId: "d02", waitingOn: "Ravi Menon" },
  { id: "t4", title: "Circulate Management Review to Eric Tang", clientId: "sve-gep", matterId: "matter-svegip-platform", due: "2026-09-28", done: false, documentId: "d12", waitingOn: null },
  { id: "t5", title: "Decide: restart or archive Business Continuity Plan Update", clientId: "internal-governance", matterId: "matter-intgov-policy", due: "2026-09-27", done: false, documentId: "d20", waitingOn: null },
  { id: "t6", title: "Prepare Internal Management Review pack", clientId: "internal-governance", matterId: "matter-intgov-policy", due: "2026-09-21", done: false, documentId: "d16b", waitingOn: null },
  { id: "t7", title: "Confirm Litigation Strategy Call agenda with external counsel", clientId: "internal-governance", matterId: "matter-intgov-litigation", due: "2026-09-23", done: false, documentId: "d17c", waitingOn: "External Counsel" },
];

window.VAULT_DATA = {
  CLASSIFICATIONS, STATUSES, FUNCTIONS, DOCUMENT_TYPES,
  CLIENTS, ENGAGEMENTS, MATTERS, DOCUMENTS, MEETINGS, TASKS,
  TODAY: "2026-09-21", NOW: "08:30", USER_NAME: "Ching Yee",
};

})();
