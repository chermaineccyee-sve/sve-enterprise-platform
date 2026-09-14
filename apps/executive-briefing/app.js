/**
 * SVE Group Enterprise Platform — Executive Briefing
 * Phase 1: Screens 01–03 only. Vanilla JS, no build step, no framework —
 * matches apps/svegip's own convention. This app is fully isolated from
 * apps/svegip: it does not import, fetch, or link to anything there.
 *
 * SCREENS is an ordered registry so Screens 04–15 can be appended later
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

const SCREENS = [
  { id: "opening", number: 1, title: "Executive Opening", render: renderScreenOpening },
  { id: "prototype-to-platform", number: 2, title: "From Prototype to Platform", render: renderScreenProgression },
  { id: "architecture", number: 3, title: "Enterprise Platform Architecture", render: renderScreenArchitecture },
];

let currentIndex = 0;
let selectedStageIndex = 0;
let selectedModule = null; // { layerIndex, moduleIndex } | null
// Shared by desktop and mobile: Screen 03 opens with all four layers
// collapsed (-1) so the architecture reads as four connected blocks before
// any module is revealed — progressive disclosure, not a wall of modules.
let openAccordionLayerIndex = -1;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function getStatusMeta(key) {
  return STATUS_META[key] || STATUS_META.future;
}

function statusPillHtml(statusKey, caveat) {
  const meta = getStatusMeta(statusKey);
  const caveatHtml = caveat ? `<span class="caveat-chip">${esc(caveat)}</span>` : "";
  return `<span class="status-pill ${meta.cls}"><span class="status-dot"></span>${esc(meta.label)}</span>${caveatHtml}`;
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
