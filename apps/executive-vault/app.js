/**
 * Executive Vault — Phase 3 prototype, v2. Vanilla JS, no framework, no
 * build step, no network calls of any kind — matches
 * apps/executive-briefing's convention. All data comes from data.js's
 * window.VAULT_DATA (mock only, see README.md). Classification/tagging
 * edits made in this prototype are held in memory only and are lost on
 * reload — there is no backend.
 *
 * v2 implements the approved Client -> Engagement -> Project/Matter ->
 * Workstream model (docs/architecture/executive-document-vault.md §3.1),
 * the Legacy business-line rule (§3a), and the revised Function/Document
 * Type vocabularies (§5.1/§5.2). A Document carries clientId (required for
 * anything client/project-scoped) and matterId (optional, finer nesting);
 * Engagement is derived through Matter, not stored directly on Document,
 * since most documents care which Matter they belong to, not which
 * contract wrapper — see the architecture doc §5's field table.
 *
 * Structure: data helpers -> router -> action handlers -> nav -> screen
 * renderers -> dispatcher/init. Screens are rendered as full innerHTML
 * strings with inline onclick="" handlers calling the top-level functions
 * below (so this file works unmodified inside a bare vm sandbox in tests,
 * exactly like apps/executive-briefing/app.js).
 */

const D = window.VAULT_DATA;
const {
  CLASSIFICATIONS, STATUSES, FUNCTIONS, DOCUMENT_TYPES,
  CLIENTS, ENGAGEMENTS, MATTERS, DOCUMENTS, MEETINGS, TASKS, PROGRESS_NOTES, TODAY, NOW, USER_NAME,
} = D;
const DECISION_TYPES = ["Resolution", "Management Paper"];
const MANAGEMENT_STATUSES = ["In Progress", "Awaiting Input", "Decision Required", "Complete", "On Hold"];
const ATTENTION_LEVELS = ["Decision Required", "For Review", "Direction Required", "Approval Required"];

const DRAFT_STATUSES = ["Draft", "Working Draft"];
const REVIEW_STATUSES = ["Internal Review", "Management Review", "Client Review", "Pending Information"];
const FINAL_STATUSES = ["Final", "Issued", "Approved"];
const CLOSED_STATUSES = ["Superseded", "Archived"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATE = {
  sidebarOpen: false,
  previewId: null,
  previewMeetingId: null,
  previewMatterId: null,
  meetingPrepMode: false,
  attentionOpen: false,
  userMenuOpen: false,
  showGenerateUpdate: false,
  updateFormat: "email",
  vaultSort: { key: "modified", dir: "desc" },
  expandedFolders: new Set(),
  showLegend: false,
  toast: null,
};
let toastSeq = 0;
let matterSeq = 0;

/**
 * Executive Command Centre Login (Layer 1) — session state only. See
 * docs/architecture/executive-command-centre-authentication.md. This is
 * unrelated to the future Layer 2 Microsoft Account Connection: nothing
 * here ever holds, requests, or transmits a Microsoft credential.
 *
 * `authenticated` starts false and `render()` (bottom of this file) shows
 * the login screen instead of the app shell until it becomes true — either
 * via a verified /api/session check (initApp, real browser) or immediately
 * in the non-browser test sandbox, where there is no server to check
 * against and every existing test expects the app shell to render directly
 * (see test/loadApp.mjs — no fetch is stubbed there on purpose).
 */
const AUTH = { authenticated: false, checked: false, user: null, error: null, showPassword: false };
function currentUserDisplayName() { return (AUTH.user && AUTH.user.name) || USER_NAME; }
function currentUserInitials() {
  const parts = currentUserDisplayName().trim().split(/\s+/);
  return ((parts[0] || "")[0] || "") .concat((parts[1] || "")[0] || "").toUpperCase() || "?";
}

/* ============================== Utilities ============================== */

const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
function fmtDateLong(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd}, ${d} ${FULL_MONTHS[m - 1]} ${y}`;
}
function daysBetween(isoA, isoB) {
  const [ay, am, ad] = isoA.split("-").map(Number);
  const [by, bm, bd] = isoB.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
function daysSince(iso) { return daysBetween(iso, TODAY); }
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
/** Monday-start week (TODAY is a Monday in this prototype's fixed calendar, but this works regardless). */
function weekStart(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, offset);
}
function greetingWord() {
  const hour = Number((NOW || "09:00").split(":")[0]);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
function fmtTimeRange(m) { return m.startTime && m.endTime ? `${m.startTime} – ${m.endTime}` : (m.startTime || ""); }
function meetingTemporalState(m) {
  if (m.date > TODAY) return "upcoming";
  if (m.date < TODAY) return "past";
  if (!m.startTime) return "upcoming";
  return m.startTime <= NOW ? (m.endTime && m.endTime <= NOW ? "past" : "now") : "upcoming";
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function jsStr(s) { return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
function attrSafe(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function call(fnName, ...args) { return attrSafe(`${fnName}(${args.map((a) => `'${jsStr(a)}'`).join(",")})`); }
/** Like call(), but appends a trailing live `this.value` (unquoted) as the last argument — for onchange="" handlers. */
function callWithValue(fnName, ...fixedArgs) {
  const parts = fixedArgs.map((a) => `'${jsStr(a)}'`).concat(["this.value"]);
  return attrSafe(`${fnName}(${parts.join(",")})`);
}

/* ============================ Data helpers =============================== */

function getClient(id) { return CLIENTS.find((c) => c.id === id) || null; }
function getEngagementRecord(id) { return ENGAGEMENTS.find((e) => e.id === id) || null; }
function getMatter(id) { return MATTERS.find((m) => m.id === id) || null; }
function getDocument(id) { return DOCUMENTS.find((d) => d.id === id) || null; }
function clientName(id) { const c = getClient(id); return c ? c.name : "—"; }
function matterName(id) { const m = getMatter(id); return m ? m.name : null; }
function classificationMeta(id) { return CLASSIFICATIONS.find((c) => c.id === id) || CLASSIFICATIONS[4]; }

function engagementsForClient(clientId) { return ENGAGEMENTS.filter((e) => e.clientId === clientId); }
function mattersForClient(clientId) {
  const engIds = engagementsForClient(clientId).map((e) => e.id);
  return MATTERS.filter((m) => engIds.includes(m.engagementId));
}
function isLegacyDoc(d) { const c = d.clientId && getClient(d.clientId); return !!(c && c.legacy); }

function getMeeting(id) { return MEETINGS.find((m) => m.id === id) || null; }
function meetingsOnDate(iso) { return MEETINGS.filter((m) => m.date === iso).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")); }
function meetingsInRange(startIso, endIso) { return MEETINGS.filter((m) => m.date >= startIso && m.date <= endIso).sort((a, b) => (a.date + (a.startTime || "")).localeCompare(b.date + (b.startTime || ""))); }
function relatedWorkstreamsLabel(m) { return (m.workstreams || []).join(", "); }

function tierChip(id, withDot = true) {
  const c = classificationMeta(id);
  return `<span class="chip ${c.cls}">${withDot ? '<span class="chip-dot"></span>' : ""}${c.label}</span>`;
}
function statusChip(status) {
  if (!status) return `<span class="chip">—</span>`;
  return `<span class="chip status-chip-${status.replace(/\s+/g, "-")}">${status}</span>`;
}
function fnChip(fn) { return fn ? `<span class="chip fn-chip">${fn}</span>` : `<span class="chip fn-chip">Unclassified</span>`; }

function classifiedDocs() { return DOCUMENTS.filter((d) => d.classified); }
function unclassifiedDocs() { return DOCUMENTS.filter((d) => !d.classified); }
/** Classified docs, excluding Legacy business-line material (architecture doc §3a) — the default working set. */
function activeClassifiedDocs() { return classifiedDocs().filter((d) => !isLegacyDoc(d)); }

function computeAttention() {
  const c = activeClassifiedDocs();
  return {
    awaitingReview: c.filter((d) => REVIEW_STATUSES.includes(d.status)),
    unclassified: unclassifiedDocs(),
    duplicates: c.filter((d) => d.possibleDuplicateOf),
    staleDrafts: c.filter((d) => DRAFT_STATUSES.includes(d.status) && daysSince(d.modified) > 60),
    missingVersion: c.filter((d) => !d.version),
    confidentialFlagged: c.filter((d) => d.confidentiality === "highly-confidential"),
    followUps: TASKS.filter((t) => !t.done && !t.waitingOn),
    waitingOn: TASKS.filter((t) => !t.done && t.waitingOn),
  };
}
/** Documents whose shape is decision-facing (Resolution/Management Paper) and not yet Final/Approved/Issued/closed — architecture doc §15.1. */
function computeDecisionsRequired() {
  return activeClassifiedDocs().filter((d) => DECISION_TYPES.includes(d.docType) && !FINAL_STATUSES.includes(d.status) && !CLOSED_STATUSES.includes(d.status));
}
/** Every open (not-done) task, on-me and waiting-on-others combined — used for the nav badge and the summary strip, where "still outstanding" is what matters regardless of whose turn it is. */
function openTasksCount() { return TASKS.filter((t) => !t.done).length; }

/* ==================== Management Progress (architecture doc §16) ==================== */
// Privacy-by-default (§16.3): every function below only ever ADDS a filter
// on top of the ordinary data — it never has a separate "show everything"
// mode. isMatterManagementVisible() is the single gate every other
// management-progress function is built from, so the Legacy check and the
// managementVisible check only ever need to be written once.
function isMatterManagementVisible(m) {
  if (!m || !m.managementVisible) return false;
  const eng = getEngagementRecord(m.engagementId);
  const cl = eng ? getClient(eng.clientId) : null;
  return !!(cl && !cl.legacy);
}
function managementVisibleMatters() { return MATTERS.filter(isMatterManagementVisible); }
function managementVisibleDocs() {
  return activeClassifiedDocs().filter((d) => {
    const vis = d.managementVisibility || "None";
    if (vis === "None") return false;
    const m = d.matterId ? getMatter(d.matterId) : null;
    if (m) return isMatterManagementVisible(m);
    // A management-visible document with no Matter (e.g. an engagement-level
    // paper) still needs SOME visible anchor — its Client must own at least
    // one visible Matter, otherwise a document could leak a Client's
    // existence onto the page with nothing else visible to give it context.
    const cl = d.clientId ? getClient(d.clientId) : null;
    return !!(cl && !cl.legacy && managementVisibleMatters().some((mm) => getEngagementRecord(mm.engagementId).clientId === d.clientId));
  });
}
function computeManagementDecisions() {
  return computeDecisionsRequired().filter((d) => (d.managementVisibility || "None") !== "None" && managementVisibleDocs().includes(d));
}
function decisionDisplayStatus(d) {
  if (FINAL_STATUSES.includes(d.status)) return "Decided";
  if (CLOSED_STATUSES.includes(d.status)) return "Superseded";
  return "Pending";
}
function managementWaitingOn() {
  return TASKS.filter((t) => !t.done && t.waitingOn && t.managementVisible && isMatterManagementVisible(getMatter(t.matterId)));
}
function managementProgressNotes() {
  const visibleIds = new Set(managementVisibleMatters().map((m) => m.id));
  return PROGRESS_NOTES.filter((p) => p.includeInManagementUpdate && visibleIds.has(p.matterId)).sort((a, b) => b.date.localeCompare(a.date));
}
function managementMeetings() {
  const in7 = addDays(TODAY, 7);
  return meetingsInRange(TODAY, in7).filter((m) => m.matterId && isMatterManagementVisible(getMatter(m.matterId)));
}
function computeManagementSummary() {
  const matters = managementVisibleMatters();
  return {
    activeMatters: matters.filter((m) => m.managementStatus !== "Complete").length,
    forReview: computeManagementDecisions().length,
    awaitingInput: matters.filter((m) => m.managementStatus === "Awaiting Input").length,
    decisionRequired: matters.filter((m) => m.managementStatus === "Decision Required").length,
  };
}
function lastManagementUpdate() {
  const dates = managementVisibleMatters().map((m) => m.managementUpdated).filter(Boolean);
  return dates.length ? dates.sort().slice(-1)[0] : null;
}

function computeVaultDocs(query) {
  let list = activeClassifiedDocs();
  if (query.clientId) list = list.filter((d) => d.clientId === query.clientId);
  if (query.matterId) list = list.filter((d) => d.matterId === query.matterId);
  if (query.function) list = list.filter((d) => d.function === query.function);
  if (query.docType) list = list.filter((d) => d.docType === query.docType);
  if (query.status) list = list.filter((d) => d.status === query.status);
  if (query.confidentiality) list = list.filter((d) => d.confidentiality === query.confidentiality);
  if (query.tag) list = list.filter((d) => d.tags.includes(query.tag));
  if (query.bucket === "draft") list = list.filter((d) => DRAFT_STATUSES.includes(d.status));
  else if (query.bucket === "review") list = list.filter((d) => REVIEW_STATUSES.includes(d.status));
  else if (query.bucket === "final") list = list.filter((d) => FINAL_STATUSES.includes(d.status));
  else if (query.bucket === "starred") list = list.filter((d) => d.starred);
  else if (query.bucket === "active") list = list.filter((d) => !CLOSED_STATUSES.includes(d.status));
  if (query.q) {
    const needle = query.q.toLowerCase();
    list = list.filter((d) => `${d.title} ${d.docId || ""}`.toLowerCase().includes(needle));
  }
  return list;
}

function sortDocs(docs) {
  const { key, dir } = STATE.vaultSort;
  const copy = docs.slice();
  copy.sort((a, b) => {
    let av = key === "clientId" ? clientName(a.clientId) : a[key] || "";
    let bv = key === "clientId" ? clientName(b.clientId) : b[key] || "";
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
  return copy;
}

function searchAll(q, includeLegacy) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const pool = includeLegacy ? DOCUMENTS : DOCUMENTS.filter((d) => !isLegacyDoc(d));
  const results = [];
  pool.forEach((d) => {
    const cn = clientName(d.clientId);
    const metaBlob = `${d.docId || ""} ${d.title} ${cn} ${d.function || ""} ${d.docType || ""} ${(d.tags || []).join(" ")}`.toLowerCase();
    if (metaBlob.includes(needle)) { results.push({ doc: d, match: "metadata" }); return; }
    if ((d.notes || "").toLowerCase().includes(needle)) { results.push({ doc: d, match: "content" }); }
  });
  results.sort((a, b) => (a.match === b.match ? 0 : a.match === "metadata" ? -1 : 1));
  return results;
}

/* Folder tree */
function buildTree(docs) {
  const root = { name: "", key: "", children: {}, docs: [] };
  docs.forEach((d) => {
    const parts = (d.drivePath || "Unfiled").split("/").map((s) => s.trim()).filter(Boolean);
    let node = root;
    let keyPath = "";
    parts.forEach((p) => {
      keyPath += "/" + p;
      if (!node.children[p]) node.children[p] = { name: p, key: keyPath, children: {}, docs: [] };
      node = node.children[p];
    });
    node.docs.push(d);
  });
  return root;
}
function countRecursive(node) {
  let n = node.docs.length;
  Object.values(node.children).forEach((c) => (n += countRecursive(c)));
  return n;
}
function isExpanded(key, depth) {
  const manual = STATE.expandedFolders.has(key);
  const defaultOpen = depth === 0;
  return manual ? !defaultOpen : defaultOpen;
}

/* ============================== Router =================================== */

function parseHash() {
  let h = (typeof location !== "undefined" && location.hash) || "#/home";
  h = h.replace(/^#/, "");
  if (!h.startsWith("/")) h = "/" + h;
  const [path, qs] = h.split("?");
  const query = {};
  if (qs) qs.split("&").forEach((pair) => {
    if (!pair) return;
    const [k, v] = pair.split("=");
    query[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return { path: path || "/home", query };
}
function buildHash(path, query) {
  const entries = Object.entries(query || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `#${path}${qs ? "?" + qs : ""}`;
}
function navigate(hash) {
  if (typeof location !== "undefined") location.hash = hash;
  STATE.sidebarOpen = false;
  STATE.attentionOpen = false;
  render();
}
function applyFilter(key, value) {
  const { path, query } = parseHash();
  const next = Object.assign({}, query);
  if (value) next[key] = value; else delete next[key];
  navigate(buildHash(path, next));
}
function applyFilterAndGo(key, value) { navigate(buildHash("/vault", { [key]: value })); }
function goVaultBucket(bucket) { navigate(buildHash("/vault", bucket ? { bucket } : {})); }

/* ============================ Action handlers ============================= */

function showToast(msg) {
  const id = ++toastSeq;
  STATE.toast = { msg, id };
  render();
  setTimeout(() => { if (STATE.toast && STATE.toast.id === id) { STATE.toast = null; render(); } }, 3200);
}
function mockAction(msg) { showToast(msg); }
function toggleSidebar() { STATE.sidebarOpen = !STATE.sidebarOpen; render(); }
function openDocument(id) { STATE.previewId = id; STATE.previewMeetingId = null; STATE.previewMatterId = null; STATE.meetingPrepMode = false; STATE.showLegend = false; render(); }
function closeDrawer() { STATE.previewId = null; STATE.previewMeetingId = null; STATE.previewMatterId = null; STATE.meetingPrepMode = false; render(); }
function openMeeting(id) { STATE.previewMeetingId = id; STATE.previewId = null; STATE.previewMatterId = null; STATE.meetingPrepMode = false; render(); }
/** Opens the same Meeting Brief drawer directly into its consolidated Prepare Meeting state (architecture: structured-data-driven, no AI summarisation, no new dataset — see meetingPrepContent()). */
function openMeetingPrep(id) { STATE.previewMeetingId = id; STATE.previewId = null; STATE.previewMatterId = null; STATE.meetingPrepMode = true; render(); }
function backToMeetingBrief() { STATE.meetingPrepMode = false; render(); }
function toggleStar(id, ev) { if (ev) ev.stopPropagation(); const d = getDocument(id); if (d) d.starred = !d.starred; render(); }
function togglePin(id, ev) { if (ev) ev.stopPropagation(); const c = getClient(id); if (c) c.pinned = !c.pinned; render(); }
function sortTable(key) {
  if (STATE.vaultSort.key === key) STATE.vaultSort.dir = STATE.vaultSort.dir === "asc" ? "desc" : "asc";
  else STATE.vaultSort = { key, dir: key === "modified" ? "desc" : "asc" };
  render();
}
function toggleFolder(key) {
  if (STATE.expandedFolders.has(key)) STATE.expandedFolders.delete(key); else STATE.expandedFolders.add(key);
  render();
}
function toggleLegend() { STATE.showLegend = !STATE.showLegend; render(); }
function toggleTask(id) { const t = TASKS.find((x) => x.id === id); if (t) t.done = !t.done; render(); }
function updateDocField(id, field, value) {
  const d = getDocument(id);
  if (!d) return;
  d[field] = value === "" ? null : value;
  // Cascading resets: a Matter only makes sense under its own Client, and a
  // Workstream only makes sense under its own Matter (§3.1) — clearing the
  // dependent fields on change avoids leaving a document pointed at a
  // Matter/Workstream that no longer matches its Client.
  if (field === "clientId") { d.matterId = null; d.workstream = null; }
  if (field === "matterId") { d.workstream = null; }
  render();
}

/** Mutates the existing Matter record in place — architecture doc §16.6 — never a separate report record. */
function updateMatterField(id, field, value) {
  const m = getMatter(id);
  if (!m) return;
  if (field === "managementVisible") { m.managementVisible = value === "true" || value === true; }
  else { m[field] = value === "" ? null : value; }
  m.managementUpdated = TODAY;
  render();
}
function openMatterEditor(id) { STATE.previewMatterId = id; STATE.previewId = null; STATE.previewMeetingId = null; STATE.meetingPrepMode = false; render(); }
function saveMatterEditor() { showToast("Management snapshot saved."); STATE.previewMatterId = null; render(); }

function toggleGenerateUpdate() { STATE.showGenerateUpdate = !STATE.showGenerateUpdate; render(); }
function setUpdateFormat(fmt) { STATE.updateFormat = fmt; render(); }
function generateUpdateText(format) {
  const matters = managementVisibleMatters();
  const lines = [];
  const heading = format === "brief" ? `CURRENT WORK UPDATE — ${fmtDateLong(TODAY)}` : `Current Work Update — ${fmtDate(TODAY)}`;
  lines.push(heading, "");
  matters.forEach((m) => {
    const cn = clientName(getEngagementRecord(m.engagementId).clientId);
    const bullet = format === "whatsapp" ? "•" : "";
    const label = `${cn} — ${m.name}`;
    const body = `${m.currentPosition || ""}${m.nextStep ? ` Next: ${m.nextStep}` : ""}`.trim();
    lines.push(format === "email" ? `${label}\n${body}` : `${bullet} ${label}: ${body}`.trim());
    if (format === "email") lines.push("");
  });
  const attention = matters.filter((m) => m.managementAttentionLevel);
  if (attention.length) {
    lines.push(format === "whatsapp" ? "Management attention:" : "Management attention:");
    attention.forEach((m) => {
      const cn = clientName(getEngagementRecord(m.engagementId).clientId);
      lines.push(`${format === "whatsapp" ? "•" : "-"} ${cn} — ${m.managementAttentionLevel.toLowerCase()}${m.managementAttentionNote ? `: ${m.managementAttentionNote}` : ""}`);
    });
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function copyGeneratedUpdate() {
  const text = generateUpdateText(STATE.updateFormat || "email");
  try { if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text); } catch (e) { /* clipboard unavailable */ }
  showToast("Update text copied. Nothing is sent automatically — paste it wherever you need it.");
}

function fileToVault(id) {
  const d = getDocument(id);
  if (!d) return;
  d.classified = true;
  if (!d.status) d.status = "Working Draft";
  showToast(`Filed to My Document Vault as “${d.title}.”`);
  STATE.previewId = null;
  navigate("#/vault");
}
function archiveDocument(id, ev) {
  if (ev) ev.stopPropagation();
  const d = getDocument(id);
  if (!d) return;
  d.status = "Archived";
  showToast("Marked Archived. Drive relocation to 99 – Archive is a mock action in this prototype.");
  render();
}
function unarchiveDocument(id) {
  const d = getDocument(id);
  if (!d) return;
  d.status = "Working Draft";
  showToast("Restored from Archive.");
  render();
}
function openInDrive() { showToast("Opens the real file in Google Drive once Phase 4 (live OAuth integration) is built — this is mock data with no live Drive connection."); }
function copyDriveLocation(path) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(path);
    }
  } catch (e) { /* clipboard unavailable — fall through to toast only */ }
  showToast("Drive location copied.");
}
function runGlobalSearch(value) { navigate(buildHash("/search", { q: value })); }

/** Promotes a Workstream to its own standalone Project/Matter under the same
 * Engagement (architecture doc §3.1) — creates the new Matter, reassigns
 * every document carrying that Workstream under the source Matter to it,
 * and removes the Workstream from the source Matter's own list. A data
 * operation, not a Drive folder move. */
function promoteWorkstreamToMatter(sourceMatterId, workstreamName) {
  const source = getMatter(sourceMatterId);
  if (!source) return;
  const newId = "matter-" + slug(workstreamName) + "-" + (++matterSeq);
  const newMatter = {
    id: newId, engagementId: source.engagementId, name: workstreamName, status: "active",
    owner: "Me", startDate: TODAY, targetDate: null, currentStage: "Newly Promoted", workstreams: [],
  };
  MATTERS.push(newMatter);
  DOCUMENTS.forEach((d) => {
    if (d.matterId === sourceMatterId && d.workstream === workstreamName) {
      d.matterId = newId;
      d.workstream = null;
    }
  });
  source.workstreams = source.workstreams.filter((w) => w !== workstreamName);
  showToast(`“${workstreamName}” promoted to its own standalone Project/Matter.`);
  render();
}

/* ================================= Nav ==================================== */

function attention() { return computeAttention(); }

/**
 * Grouped per the UI-alignment pass's requested structure (COMMAND/WORK/
 * VAULT/MANAGEMENT/CONNECTED/SYSTEM) — reachability of every existing
 * screen is preserved even where a group is shorter than before: the
 * Document Vault buckets trimmed from VAULT (Starred, Working Drafts,
 * Final/Issued) stay one click away as saved-view chips inside "My
 * Document Vault" itself (SAVED_VIEWS/goVaultBucket), and the former
 * "Knowledge" function-browsing shortcuts stay reachable via that same
 * screen's own Function filter (filterBarHtml) — nothing here removes a
 * route, only where its shortcut lives in the sidebar.
 */
function navSections() {
  const a = attention();
  const todayCount = meetingsOnDate(TODAY).length;
  return [
    { label: "Command", items: [
      { id: "home", label: "Executive Home", hash: "#/home" },
      { id: "myday", label: "My Day", hash: "#/myday", count: todayCount },
      { id: "week", label: "This Week", hash: "#/week" },
    ]},
    { label: "Work", items: [
      { id: "clients", label: "Clients & Engagements", hash: "#/clients" },
      { id: "projects", label: "Projects & Programmes", hash: "#/projects" },
      { id: "matters", label: "Projects / Matters", hash: "#/matters" },
      { id: "meetings", label: "Meetings & Decisions", hash: "#/meetings" },
      { id: "actions", label: "Actions & Follow-Up", hash: "#/actions", count: openTasksCount() },
    ]},
    { label: "Vault", items: [
      { id: "vault", label: "Document Vault", hash: "#/vault" },
      { id: "inbox", label: "Executive Inbox", hash: "#/inbox", count: a.unclassified.length },
      { id: "recent", label: "Recent Documents", hash: "#/vault?bucket=recent" },
      { id: "review", label: "For Review", hash: "#/vault?bucket=review", count: a.awaitingReview.length },
      { id: "archived", label: "Archive & Legacy", hash: "#/archive" },
    ]},
    { label: "Management", items: [
      { id: "management", label: "Management Progress", hash: "#/management" },
    ]},
    { label: "Connected", items: [
      { id: "drive", label: "Google Drive", hash: "#/drive" },
      { id: "outlook", label: "Outlook Calendar", hash: "#/outlook" },
    ]},
    { label: "System", items: [
      { id: "tags", label: "Tags & Classification", hash: "#/tags" },
      { id: "templates", label: "Templates", hash: "#/templates" },
      { id: "settings", label: "Settings", hash: "#/settings" },
    ]},
  ];
}

function renderSidebar(currentHash) {
  const sections = navSections();
  const groups = sections.map((s) => `
    <div class="nav-group">
      ${s.label ? `<div class="nav-group-label">${s.label}</div>` : ""}
      ${s.items.map((it) => {
        const active = currentHash === it.hash || (it.id === "vault" && currentHash === "#/vault");
        return `<button class="nav-item${active ? " active" : ""}" onclick="${call("navigate", it.hash.startsWith("#") ? it.hash : "#" + it.hash)}">
          <span>${it.label}</span>
          ${it.count ? `<span class="n-count">${it.count}</span>` : ""}
        </button>`;
      }).join("")}
    </div>`).join("");
  return `
    <nav class="sidebar${STATE.sidebarOpen ? " open" : ""}">
      <div class="sidebar-brand">
        <div class="brand-mark">V</div>
        <div>
          <div class="brand-text-title">Executive Vault</div>
          <div class="brand-text-sub">Personal Document Intelligence</div>
        </div>
      </div>
      <div class="sidebar-scroll">${groups}</div>
      <div class="sidebar-foot">${attrSafe(currentUserDisplayName())} · Personal Executive Command Centre<br/>Document/meeting data is mock · No live Google Drive or Outlook connection</div>
    </nav>`;
}

function renderNotificationsPopover() {
  if (!STATE.attentionOpen) return "";
  const a = attention();
  const decisions = computeDecisionsRequired();
  const row = (label, count, hash) => count ? `<div class="quick-row" onclick="${call("navigate", hash)}"><span>${label}</span><span class="muted" style="margin-left:auto">${count}</span></div>` : "";
  const rows = [
    row("Awaiting review", a.awaitingReview.length, "#/vault?bucket=review"),
    row("Unclassified in Inbox", a.unclassified.length, "#/inbox"),
    row("Decisions required", decisions.length, "#/home"),
    row("Waiting on others", a.waitingOn.length, "#/actions"),
    row("Follow-ups on me", a.followUps.length, "#/actions"),
  ].filter(Boolean);
  return `
    <div class="notif-popover">
      <div class="dfield-label" style="margin-bottom:6px">Attention</div>
      ${rows.length ? rows.join("") : '<div class="muted" style="padding:6px 0">Nothing needs you right now.</div>'}
      <div style="margin-top:8px"><a style="cursor:pointer;color:var(--gold-deep);font-weight:700;font-size:12px" onclick="${call("navigate", "#/home")}">Open Executive Home →</a></div>
    </div>`;
}
function toggleAttentionPopover(ev) { if (ev) ev.stopPropagation(); STATE.attentionOpen = !STATE.attentionOpen; render(); }

function renderTopbar(query) {
  const a = attention();
  const decisions = computeDecisionsRequired();
  const attnCount = a.awaitingReview.length + a.unclassified.length + decisions.length + a.waitingOn.length;
  return `
    <header class="topbar">
      <button class="hamburger" onclick="${call("toggleSidebar")}" aria-label="Menu">☰</button>
      <div class="search-wrap">
        <span class="search-icon">⌕</span>
        <input class="search-input" id="globalSearch" placeholder="Search — try “VT overtime policy”, “HR-124”, “Labuan fund”, “Eric review”…"
          value="${attrSafe(query && query.q ? query.q : "")}"
          onkeydown="if(event.key==='Enter'){navigate('#/search?q='+encodeURIComponent(this.value))}"/>
        <span class="search-kbd">Enter ↵</span>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-gold btn-sm" onclick="${call("mockAction", "Upload is mocked in this prototype: pick a file → optionally set Client and Document Type → Save. Everything else can be completed later from the Executive Inbox.")}">⭱<span class="new-label"> New</span></button>
        <div style="position:relative">
          <button class="btn btn-icon" onclick="${call("toggleAttentionPopover")}" title="Notifications / Attention" aria-label="Notifications">🔔${attnCount ? `<span class="n-badge">${attnCount}</span>` : ""}</button>
          ${renderNotificationsPopover()}
        </div>
        <button class="btn btn-icon" onclick="${call("navigate", "#/settings")}" title="Settings" aria-label="Settings">⚙</button>
        <div style="position:relative">
          <button class="topbar-user" onclick="${call("toggleUserMenu")}" title="${attrSafe(currentUserDisplayName())} — Personal Executive Command Centre" aria-label="Account">${attrSafe(currentUserInitials())}</button>
          ${renderUserMenuPopover()}
        </div>
      </div>
    </header>`;
}

function toggleUserMenu(ev) { if (ev) ev.stopPropagation(); STATE.userMenuOpen = !STATE.userMenuOpen; render(); }
function renderUserMenuPopover() {
  if (!STATE.userMenuOpen) return "";
  return `
    <div class="notif-popover" style="width:220px">
      <div class="dfield-label" style="margin-bottom:2px">Signed in as</div>
      <div style="font-weight:700;margin-bottom:2px">${attrSafe(currentUserDisplayName())}</div>
      <div class="muted" style="font-size:11.5px;margin-bottom:12px">${attrSafe((AUTH.user && AUTH.user.email) || "")}</div>
      <button class="btn btn-sm" style="width:100%" onclick="${call("signOut")}">Sign Out</button>
    </div>`;
}

/* ================================ Drawer =================================== */

function tierLegendHtml() {
  return `<div class="tier-legend">${CLASSIFICATIONS.map((c) => `
    <div class="tier-legend-row"><span class="chip ${c.cls}"><span class="chip-dot"></span>${c.label}</span><span>${c.test}</span></div>
  `).join("")}</div>`;
}

function docFieldSelects(d) {
  const selectableClients = CLIENTS.filter((c) => !c.legacy || c.id === d.clientId);
  const clientOptions = [`<option value="">—</option>`].concat(
    selectableClients.map((c) => `<option value="${c.id}" ${d.clientId === c.id ? "selected" : ""}>${c.name}${c.legacy ? " (Legacy)" : ""}</option>`)
  ).join("");
  const matters = d.clientId ? mattersForClient(d.clientId) : [];
  const matterOptions = [`<option value="">— (Engagement-level, no specific Matter)</option>`].concat(
    matters.map((m) => `<option value="${m.id}" ${d.matterId === m.id ? "selected" : ""}>${m.name}</option>`)
  ).join("");
  const fnOptions = [`<option value="">—</option>`].concat(
    FUNCTIONS.map((f) => `<option value="${f}" ${d.function === f ? "selected" : ""}>${f}</option>`)
  ).join("");
  const typeOptionsHtml = [`<option value="">—</option>`].concat(
    DOCUMENT_TYPES.map((t) => `<option value="${t}" ${d.docType === t ? "selected" : ""}>${t}</option>`)
  ).join("");
  const statusOptionsHtml = STATUSES.map((s) => `<option value="${s}" ${d.status === s ? "selected" : ""}>${s}</option>`).join("");
  const confOptionsHtml = CLASSIFICATIONS.map((c) => `<option value="${c.id}" ${d.confidentiality === c.id ? "selected" : ""}>${c.label}</option>`).join("");
  const currentMatter = d.matterId ? getMatter(d.matterId) : null;
  const workstreamSuggestions = currentMatter ? currentMatter.workstreams : [];
  return { clientOptions, matterOptions, fnOptions, typeOptionsHtml, statusOptionsHtml, confOptionsHtml, workstreamSuggestions };
}

function drawerContent(d) {
  const o = docFieldSelects(d);
  const versionChain = (d.versionChain && d.versionChain.length ? d.versionChain : [d.version]).filter(Boolean);
  const legacyDoc = isLegacyDoc(d);
  return `
    <div class="drawer-head">
      <div>
        <div class="breadcrumbs">${d.docId ? d.docId + " · " : ""}${clientName(d.clientId)}${matterName(d.matterId) ? " · " + matterName(d.matterId) : ""}</div>
        <h3 style="font-size:17px;max-width:340px">${d.title}</h3>
      </div>
      <button class="drawer-close" onclick="${call("closeDrawer")}">✕</button>
    </div>
    <div class="drawer-body">
      ${!d.classified ? `<div class="callout" style="margin-bottom:16px"><span>📥</span><div><b>Sitting in the Executive Inbox.</b> Set a Client and Function below, then <em>File to Vault</em> — everything else can stay blank for now.</div></div>` : ""}
      ${legacyDoc ? `<div class="callout" style="margin-bottom:16px"><span>🗄</span><div><b>Legacy business line.</b> Historical material from a discontinued line of work — excluded from active pickers, dashboard counts and default search (architecture doc §3a).</div></div>` : ""}
      <div class="dfield">
        <div class="dfield-label">Classification
          <a style="cursor:pointer;color:var(--gold-deep);font-weight:700" onclick="${call("toggleLegend")}"> ${STATE.showLegend ? "(hide legend)" : "(what do these mean?)"}</a>
        </div>
        <select class="filter-select" style="width:100%" onchange="${callWithValue("updateDocField", d.id, "confidentiality")}">${o.confOptionsHtml}</select>
        ${STATE.showLegend ? tierLegendHtml() : ""}
      </div>
      <div class="dfield"><div class="dfield-label">Client / Entity</div>
        <select class="filter-select" style="width:100%" onchange="${callWithValue("updateDocField", d.id, "clientId")}">${o.clientOptions}</select>
      </div>
      <div class="dfield"><div class="dfield-label">Project / Matter</div>
        <select class="filter-select" style="width:100%" onchange="${callWithValue("updateDocField", d.id, "matterId")}" ${!d.clientId ? "disabled" : ""}>${o.matterOptions}</select>
      </div>
      <div class="dfield"><div class="dfield-label">Workstream</div>
        <input class="filter-search" style="width:100%" list="workstream-suggestions" value="${attrSafe(d.workstream || "")}"
          placeholder="${o.workstreamSuggestions.length ? "Pick or type a new one" : "Free text, scoped to the Matter above"}"
          onchange="${callWithValue("updateDocField", d.id, "workstream")}"/>
        <datalist id="workstream-suggestions">${o.workstreamSuggestions.map((w) => `<option value="${attrSafe(w)}"></option>`).join("")}</datalist>
      </div>
      <div class="grid grid-2" style="gap:10px">
        <div class="dfield"><div class="dfield-label">Function</div>
          <select class="filter-select" style="width:100%" onchange="${callWithValue("updateDocField", d.id, "function")}">${o.fnOptions}</select>
        </div>
        <div class="dfield"><div class="dfield-label">Document Type</div>
          <select class="filter-select" style="width:100%" onchange="${callWithValue("updateDocField", d.id, "docType")}">${o.typeOptionsHtml}</select>
        </div>
        <div class="dfield"><div class="dfield-label">Status</div>
          <select class="filter-select" style="width:100%" onchange="${callWithValue("updateDocField", d.id, "status")}">${o.statusOptionsHtml}</select>
        </div>
      </div>
      <div class="dfield">
        <div class="dfield-label">Version history (label chain — Drive's own Version History holds the byte-level record)</div>
        <div class="version-chain">
          ${versionChain.length ? versionChain.map((v, i) => `<span class="version-chip${i === versionChain.length - 1 ? " current" : ""}">${v}</span>${i < versionChain.length - 1 ? '<span class="version-arrow">→</span>' : ""}`).join("") : '<span class="muted">No version recorded</span>'}
        </div>
      </div>
      <div class="grid grid-2" style="gap:10px">
        <div class="dfield"><div class="dfield-label">Jurisdiction</div><div class="dfield-value">${d.jurisdiction || "—"}</div></div>
        <div class="dfield"><div class="dfield-label">Owner</div><div class="dfield-value">${d.owner || "—"}</div></div>
        <div class="dfield"><div class="dfield-label">Created</div><div class="dfield-value">${fmtDate(d.created)}</div></div>
        <div class="dfield"><div class="dfield-label">Modified</div><div class="dfield-value">${fmtDate(d.modified)}</div></div>
        <div class="dfield"><div class="dfield-label">Review Date</div><div class="dfield-value">${fmtDate(d.reviewDate)}</div></div>
        <div class="dfield"><div class="dfield-label">Reviewer</div><div class="dfield-value">${d.reviewer || "—"}</div></div>
      </div>
      ${d.tags && d.tags.length ? `<div class="dfield"><div class="dfield-label">Tags</div><div class="pill-select">${d.tags.map((t) => `<span class="chip fn-chip" style="cursor:pointer" onclick="${call("applyFilterAndGo", "tag", t)}">${t}</span>`).join("")}</div></div>` : ""}
      <div class="dfield">
        <div class="dfield-label">Google Drive location</div>
        <div class="dfield-value muted">${d.drivePath}</div>
      </div>
      ${d.managementVisibility && d.managementVisibility !== "None" ? `<div class="dfield"><span class="chip fn-chip" style="font-size:9px" title="Shown on the Management Progress page">Management: ${d.managementVisibility}</span></div>` : ""}
      ${d.notes ? `<div class="dfield"><div class="dfield-label">Notes</div><div class="notes-box">${d.notes}</div></div>` : ""}
      ${d.possibleDuplicateOf ? `<div class="callout"><span>⚠</span><div>Flagged as a <b>possible duplicate</b> of ${getDocument(d.possibleDuplicateOf) ? getDocument(d.possibleDuplicateOf).title : "another document"}.</div></div>` : ""}
      <div class="drawer-actions">
        ${!d.classified ? `<button class="btn btn-gold" onclick="${call("fileToVault", d.id)}">File to Vault</button>` : ""}
        <button class="btn btn-primary" onclick="${call("openInDrive")}">Open Original in Drive</button>
        <button class="btn" onclick="${call("copyDriveLocation", d.drivePath)}">Copy Drive Location</button>
        ${d.classified && !CLOSED_STATUSES.includes(d.status) ? `<button class="btn btn-ghost" onclick="${call("archiveDocument", d.id)}">Archive</button>` : ""}
        ${d.classified && CLOSED_STATUSES.includes(d.status) ? `<button class="btn btn-ghost" onclick="${call("unarchiveDocument", d.id)}">Unarchive</button>` : ""}
      </div>
    </div>`;
}

function meetingBriefContent(m) {
  const cn = clientName(m.clientId);
  const eng = m.matterId ? getEngagementRecord(getMatter(m.matterId).engagementId) : null;
  const state = meetingTemporalState(m);
  return `
    <div class="drawer-head">
      <div>
        <div class="breadcrumbs">${fmtDateLong(m.date)}${state === "now" ? ' · <span style="color:var(--gold-deep)">Happening now</span>' : ""}</div>
        <h3 style="font-size:17px;max-width:340px">${m.title}</h3>
      </div>
      <button class="drawer-close" onclick="${call("closeDrawer")}">✕</button>
    </div>
    <div class="drawer-body">
      <div class="dfield">
        <div class="dfield-value">${fmtTimeRange(m)} &nbsp;·&nbsp; ${statusChip(m.status)} &nbsp;·&nbsp; ${m.location || "—"}</div>
      </div>
      ${m.clientId ? `
      <div class="grid grid-2" style="gap:10px">
        <div class="dfield"><div class="dfield-label">Client</div><div class="dfield-value">${cn}</div></div>
        <div class="dfield"><div class="dfield-label">Engagement</div><div class="dfield-value">${eng ? eng.name : "—"}</div></div>
        <div class="dfield"><div class="dfield-label">Project / Matter</div><div class="dfield-value">${matterName(m.matterId) || "—"}</div></div>
        <div class="dfield"><div class="dfield-label">Related Workstreams</div><div class="dfield-value">${relatedWorkstreamsLabel(m) || "—"}</div></div>
      </div>` : `<div class="callout"><span>ℹ</span><div>No Client set — this meeting has no work context linked (architecture doc §15.4).</div></div>`}
      <div class="dfield">
        <div class="dfield-label">Participants</div>
        <div class="dfield-value">${(m.participants || []).length ? m.participants.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(", ") : "—"}</div>
      </div>
      ${m.agendaDocId ? `<div class="dfield"><div class="dfield-label">Agenda</div><div><a style="cursor:pointer;color:var(--gold-deep);font-weight:700" onclick="${call("openDocument", m.agendaDocId)}">${getDocument(m.agendaDocId) ? getDocument(m.agendaDocId).title : m.agendaDocId} →</a></div></div>` : ""}
      <div class="dfield">
        <div class="dfield-label">Minutes</div>
        ${m.documentId ? `<div><a style="cursor:pointer;color:var(--gold-deep);font-weight:700" onclick="${call("openDocument", m.documentId)}">${getDocument(m.documentId) ? getDocument(m.documentId).title : m.documentId} →</a></div>` : `<div class="muted">${state === "past" ? "Not yet recorded." : "Not yet recorded — this meeting hasn't happened yet."}</div>`}
      </div>
      ${m.decisions && m.decisions.length ? `<div class="dfield"><div class="dfield-label">Decisions</div><ul style="margin:4px 0 0;padding-left:18px">${m.decisions.map((dec) => `<li style="margin-bottom:4px;font-size:12.5px">${dec}</li>`).join("")}</ul></div>` : ""}
      <div class="drawer-actions">
        <button class="btn btn-primary" onclick="${call("mockAction", "Opens the real meeting in Microsoft Teams/Zoom once Phase 5 (live Outlook Calendar integration) is built — see architecture doc §15.6.")}">Join / Open Meeting</button>
        ${m.clientId && state !== "past" ? `<button class="btn btn-gold" onclick="${call("openMeetingPrep", m.id)}">Prepare Meeting</button>` : ""}
        ${m.clientId ? `<button class="btn" onclick="${call("navigate", "#/client/" + m.clientId + (m.matterId ? "?tab=documents&matter=" + m.matterId : ""))}">Open Related Matter</button>` : ""}
      </div>
    </div>`;
}

/**
 * Prepare Meeting (formalising the Meeting Brief's existing pre-meeting
 * workflow, not a new parallel dataset): every value here comes from
 * existing records — documents, tasks, meetings — filtered to this
 * meeting's Client/Matter scope. No AI summarisation, no Outlook
 * dependency, no new storage; this is purely a read-only, structured-data
 * assembly of what already exists elsewhere in the app.
 */
function computeMeetingPrep(m) {
  const inScope = (recClientId, recMatterId) => m.clientId && recClientId === m.clientId && (!m.matterId || recMatterId === m.matterId);
  const scopeDocs = activeClassifiedDocs().filter((d) => inScope(d.clientId, d.matterId));
  const latestDocs = scopeDocs.slice().sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 5);
  const forReview = scopeDocs.filter((d) => REVIEW_STATUSES.includes(d.status));
  const decisions = computeDecisionsRequired().filter((d) => inScope(d.clientId, d.matterId));
  const scopeTasks = TASKS.filter((t) => !t.done && inScope(t.clientId, t.matterId));
  const outstandingActions = scopeTasks.filter((t) => !t.waitingOn);
  const waitingOn = scopeTasks.filter((t) => t.waitingOn);
  const previousMeeting = MEETINGS.filter((mm) => mm.id !== m.id && inScope(mm.clientId, mm.matterId) && mm.date < m.date)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startTime || "").localeCompare(a.startTime || ""))[0] || null;
  return { latestDocs, forReview, decisions, outstandingActions, waitingOn, previousMeeting };
}

function meetingPrepContent(m) {
  const cn = clientName(m.clientId);
  const eng = m.matterId ? getEngagementRecord(getMatter(m.matterId).engagementId) : null;
  const prep = computeMeetingPrep(m);
  const docLine = (d) => `<div class="quick-row" onclick="${call("openDocument", d.id)}"><span>${d.title}</span><span class="muted" style="margin-left:auto">${statusChip(d.status)}</span></div>`;
  const taskLine = (t) => `<div class="quick-row"><span>${t.title}</span><span class="muted" style="margin-left:auto">${t.waitingOn ? `Waiting on ${t.waitingOn}` : `Due ${fmtDate(t.due)}`}</span></div>`;
  return `
    <div class="drawer-head">
      <div>
        <div class="breadcrumbs">Prepare Meeting · ${fmtDateLong(m.date)}</div>
        <h3 style="font-size:17px;max-width:340px">${m.title}</h3>
      </div>
      <button class="drawer-close" onclick="${call("closeDrawer")}">✕</button>
    </div>
    <div class="drawer-body">
      <div class="dfield">
        <div class="dfield-value">${fmtTimeRange(m)} &nbsp;·&nbsp; ${statusChip(m.status)} &nbsp;·&nbsp; ${m.location || "—"}</div>
      </div>
      <div class="grid grid-2" style="gap:10px">
        <div class="dfield"><div class="dfield-label">Client</div><div class="dfield-value">${cn}</div></div>
        <div class="dfield"><div class="dfield-label">Engagement</div><div class="dfield-value">${eng ? eng.name : "—"}</div></div>
        <div class="dfield"><div class="dfield-label">Project / Matter</div><div class="dfield-value">${matterName(m.matterId) || "—"}</div></div>
        <div class="dfield"><div class="dfield-label">Related Workstreams</div><div class="dfield-value">${relatedWorkstreamsLabel(m) || "—"}</div></div>
      </div>

      <div class="dfield"><div class="dfield-label">Latest Relevant Documents</div>
        ${prep.latestDocs.length ? prep.latestDocs.map(docLine).join("") : '<div class="muted" style="font-size:12.5px">Nothing on file yet for this Matter.</div>'}
      </div>
      <div class="dfield"><div class="dfield-label">Documents For Review</div>
        ${prep.forReview.length ? prep.forReview.map(docLine).join("") : '<div class="muted" style="font-size:12.5px">Nothing currently in review.</div>'}
      </div>
      <div class="dfield"><div class="dfield-label">Outstanding Actions</div>
        ${prep.outstandingActions.length ? prep.outstandingActions.map(taskLine).join("") : '<div class="muted" style="font-size:12.5px">Nothing outstanding on me for this Matter.</div>'}
      </div>
      <div class="dfield"><div class="dfield-label">Waiting On</div>
        ${prep.waitingOn.length ? prep.waitingOn.map(taskLine).join("") : '<div class="muted" style="font-size:12.5px">Not waiting on anyone for this Matter.</div>'}
      </div>
      <div class="dfield"><div class="dfield-label">Pending Decisions</div>
        ${prep.decisions.length ? prep.decisions.map(docLine).join("") : '<div class="muted" style="font-size:12.5px">No decision-type document currently outstanding.</div>'}
      </div>
      <div class="dfield"><div class="dfield-label">Previous Related Meeting</div>
        ${prep.previousMeeting
          ? `<div class="quick-row" onclick="${call("openMeeting", prep.previousMeeting.id)}"><span>${prep.previousMeeting.title}</span><span class="muted" style="margin-left:auto">${fmtDate(prep.previousMeeting.date)}</span></div>`
          : '<div class="muted" style="font-size:12.5px">No earlier meeting recorded for this Matter.</div>'}
      </div>

      <div class="drawer-actions">
        <button class="btn" onclick="${call("backToMeetingBrief")}">← Back to Meeting Brief</button>
      </div>
    </div>`;
}

function matterEditorContent(m) {
  const eng = getEngagementRecord(m.engagementId);
  const cn = clientName(eng.clientId);
  const statusOptions = [`<option value="">—</option>`].concat(MANAGEMENT_STATUSES.map((s) => `<option value="${s}" ${m.managementStatus === s ? "selected" : ""}>${s}</option>`)).join("");
  const levelOptions = [`<option value="">None (routine)</option>`].concat(ATTENTION_LEVELS.map((s) => `<option value="${s}" ${m.managementAttentionLevel === s ? "selected" : ""}>${s}</option>`)).join("");
  return `
    <div class="drawer-head">
      <div>
        <div class="breadcrumbs">${cn} · Management Snapshot</div>
        <h3 style="font-size:17px;max-width:340px">${m.name}</h3>
      </div>
      <button class="drawer-close" onclick="${call("closeDrawer")}">✕</button>
    </div>
    <div class="drawer-body">
      <div class="callout" style="margin-bottom:16px"><span>ℹ</span><div>These fields supplement this Matter's own record — nothing here creates a separate report (architecture doc §16.6). Only visible on Management Progress when "Show on Management Progress" is checked.</div></div>
      <label class="dfield" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" ${m.managementVisible ? "checked" : ""} onchange="${callWithValue("updateMatterField", m.id, "managementVisible").replace("this.value", "this.checked")}"/>
        <span class="dfield-label" style="margin:0">Show on Management Progress</span>
      </label>
      <div class="dfield"><div class="dfield-label">Status</div>
        <select class="filter-select" style="width:100%" onchange="${callWithValue("updateMatterField", m.id, "managementStatus")}">${statusOptions}</select>
      </div>
      <div class="dfield"><div class="dfield-label">Current Position</div>
        <textarea class="filter-search" style="width:100%;min-height:60px" onchange="${callWithValue("updateMatterField", m.id, "currentPosition")}">${attrSafe(m.currentPosition || "")}</textarea>
      </div>
      <div class="dfield"><div class="dfield-label">Next Step</div>
        <textarea class="filter-search" style="width:100%;min-height:44px" onchange="${callWithValue("updateMatterField", m.id, "nextStep")}">${attrSafe(m.nextStep || "")}</textarea>
      </div>
      <div class="dfield"><div class="dfield-label">Management Attention Level</div>
        <select class="filter-select" style="width:100%" onchange="${callWithValue("updateMatterField", m.id, "managementAttentionLevel")}">${levelOptions}</select>
      </div>
      <div class="dfield"><div class="dfield-label">Management Attention Note</div>
        <input class="filter-search" style="width:100%" value="${attrSafe(m.managementAttentionNote || "")}" onchange="${callWithValue("updateMatterField", m.id, "managementAttentionNote")}"/>
      </div>
      <div class="dfield"><div class="dfield-label">Last Updated</div><div class="dfield-value">${fmtDate(m.managementUpdated)}</div></div>
      <div class="drawer-actions">
        <button class="btn btn-gold" onclick="${call("saveMatterEditor")}">Done</button>
        <button class="btn" onclick="${call("navigate", "#/management")}">Preview Management View</button>
      </div>
    </div>`;
}

function renderDrawer() {
  const d = STATE.previewId ? getDocument(STATE.previewId) : null;
  const m = STATE.previewMeetingId ? getMeeting(STATE.previewMeetingId) : null;
  const mt = STATE.previewMatterId ? getMatter(STATE.previewMatterId) : null;
  const open = !!(d || m || mt);
  return `
    <div class="overlay${open ? " show" : ""}" onclick="${call("closeDrawer")}"></div>
    <aside class="drawer${open ? " open" : ""}">${d ? drawerContent(d) : (m ? (STATE.meetingPrepMode ? meetingPrepContent(m) : meetingBriefContent(m)) : (mt ? matterEditorContent(mt) : ""))}</aside>`;
}

/* ============================ Shared table/tree ============================ */

const REG_COLUMNS = [
  { key: "title", label: "Document" },
  { key: "clientId", label: "Client / Entity" },
  { key: "function", label: "Function" },
  { key: "docType", label: "Type" },
  { key: "version", label: "Version" },
  { key: "status", label: "Status" },
  { key: "confidentiality", label: "Confidentiality" },
  { key: "modified", label: "Modified" },
  { key: "reviewDate", label: "Review Date" },
];

/** Identity/Context/State/Action only — Function, Version, dates stay in the Document Detail drawer one tap away, not duplicated here. */
function docRecordCardHtml(d) {
  const contextParts = [clientName(d.clientId)];
  if (matterName(d.matterId)) contextParts.push(matterName(d.matterId));
  else if (d.workstream) contextParts.push(d.workstream);
  return `
    <div class="record-card" onclick="${call("openDocument", d.id)}">
      <div class="record-card-id">${d.docId ? d.docId + " · " : ""}${d.title}</div>
      <div class="record-card-context">${contextParts.join(" · ")}</div>
      <div class="record-card-state">
        ${statusChip(d.status)}${tierChip(d.confidentiality)}
        <span class="record-card-meta">${d.version || "no version"}</span>
      </div>
    </div>`;
}

function renderRegistryTable(docs, emptyLabel) {
  if (!docs.length) {
    return `<div class="table-wrap"><div class="empty-state"><h3>No documents match</h3><div>${emptyLabel || "Try clearing a filter or searching from the top bar."}</div></div></div>`;
  }
  const sorted = sortDocs(docs);
  const { key: sortKey, dir } = STATE.vaultSort;
  const rows = sorted.map((d) => {
    const subParts = [d.docId || "no document ID"];
    if (matterName(d.matterId)) subParts.push(matterName(d.matterId));
    if (d.workstream) subParts.push(d.workstream);
    return `
    <tr onclick="${call("openDocument", d.id)}">
      <td>
        <span class="star${d.starred ? "" : " off"}" onclick="${call("toggleStar", d.id)}">★</span>
      </td>
      <td>
        <div class="doc-title-cell">
          <span class="doc-title-main">${d.title}</span>
          <span class="doc-title-id">${subParts.join(" · ")}</span>
        </div>
      </td>
      <td>${clientName(d.clientId)}</td>
      <td>${d.function || '<span class="muted">—</span>'}</td>
      <td>${d.docType || '<span class="muted">—</span>'}</td>
      <td>${d.version || '<span class="muted">missing</span>'}</td>
      <td>${statusChip(d.status)}</td>
      <td>${tierChip(d.confidentiality)}</td>
      <td>${fmtDate(d.modified)}</td>
      <td>${fmtDate(d.reviewDate)}</td>
    </tr>`;
  }).join("");
  const heads = REG_COLUMNS.map((c) => `<th onclick="${call("sortTable", c.key)}">${c.label}${sortKey === c.key ? (dir === "asc" ? " ▲" : " ▼") : ""}</th>`).join("");
  return `
    <div class="table-wrap desktop-register">
      <table class="reg">
        <thead><tr><th></th>${heads}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="record-list">${sorted.map(docRecordCardHtml).join("")}</div>`;
}

function renderFolderNode(node, depth) {
  const folders = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
  const expanded = depth === -1 ? true : isExpanded(node.key, depth);
  if (depth >= 0 && !expanded) return "";
  return `
    ${folders.map((f) => {
      const fExpanded = isExpanded(f.key, depth + 1);
      const total = countRecursive(f);
      return `
        <div class="folder-node">
          <div class="folder-row" onclick="${call("toggleFolder", f.key)}">
            <span class="fi">${fExpanded ? "▾" : "▸"} 📁</span>
            <span>${f.name}</span>
            <span class="muted" style="margin-left:auto;font-size:11px">${total}</span>
          </div>
          ${fExpanded ? `<div class="folder-children">${renderFolderNode(f, depth + 1)}${f.docs.map((d) => `
            <div class="folder-doc-row" onclick="${call("openDocument", d.id)}">
              <span>📄</span><span>${d.title}</span>${statusChip(d.status)}
            </div>`).join("")}</div>` : ""}
        </div>`;
    }).join("")}`;
}
function renderFolderView(docs) {
  const tree = buildTree(docs);
  return `<div class="folder-tree">${renderFolderNode(tree, -1)}</div>`;
}

/* ================================ Screens ================================== */

function meetingRow(m, opts) {
  opts = opts || {};
  const state = meetingTemporalState(m);
  const parts = [clientName(m.clientId)];
  if (matterName(m.matterId)) parts.push(matterName(m.matterId));
  if (!opts.compact && relatedWorkstreamsLabel(m)) parts.push(relatedWorkstreamsLabel(m));
  return `
    <div class="meeting-row temporal-${state}" onclick="${call("openMeeting", m.id)}">
      <div class="meeting-time">${m.startTime || "—"}</div>
      <div class="meeting-main">
        <div class="meeting-title">${state === "now" ? '<span class="live-dot" title="Happening now"></span>' : ""}${m.title}</div>
        <div class="meeting-sub">${m.clientId ? parts.join(" · ") : "No Client linked"}</div>
      </div>
      ${statusChip(m.status)}
    </div>`;
}

function renderHome() {
  const c = activeClassifiedDocs();
  const a = attention();
  const decisions = computeDecisionsRequired();
  const activeMatterIds = new Set(mattersForActiveClients().map((m) => m.id));
  const activeMattersCount = activeMatterIds.size;
  const todayMeetings = meetingsOnDate(TODAY);
  const recent = c.slice().sort((x, y) => y.modified.localeCompare(x.modified)).slice(0, 6);

  const summaryChips = [
    { num: activeMattersCount, label: "Active Matters", hash: "#/matters" },
    { num: todayMeetings.length, label: "Meetings Today", hash: "#/myday" },
    { num: openTasksCount(), label: "Follow-Ups", hash: "#/actions" },
    { num: a.awaitingReview.length, label: "For Review", hash: "#/vault?bucket=review" },
    { num: decisions.length, label: decisions.length === 1 ? "Decision Required" : "Decisions Required", hash: "#/home", warn: decisions.length > 0 },
  ];

  const attentionRows = [
    { label: "Awaiting review", count: a.awaitingReview.length, icon: "⏳", hash: "#/vault?bucket=review", sub: "Internal, management or client review in progress" },
    { label: "Unclassified — sitting in Inbox", count: a.unclassified.length, icon: "📥", hash: "#/inbox", sub: "No Client, Function or Type set yet", sev: "info" },
    { label: "Potential duplicate documents", count: a.duplicates.length, icon: "⧉", hash: "#/vault?bucket=active", sub: "Same title/spec filed more than once", sev: "high" },
    { label: "Old working drafts (60+ days)", count: a.staleDrafts.length, icon: "🕓", hash: "#/vault?bucket=draft", sub: "Stalled — worth a restart-or-archive decision" },
    { label: "Missing version information", count: a.missingVersion.length, icon: "①", hash: "#/vault?bucket=active", sub: "No version label recorded", sev: "info" },
    { label: "Marked confidential (Highly Confidential)", count: a.confidentialFlagged.length, icon: "🔒", hash: "#/vault", sub: "Board, legal-privilege or investment-sensitive material", sev: "high" },
    { label: "Follow-ups on me", count: a.followUps.length, icon: "☑", hash: "#/actions", sub: "Open actions where the next move is mine" },
  ].filter((r) => r.count > 0);

  const meetingNowCount = todayMeetings.filter((m) => meetingTemporalState(m) === "now").length;

  return `
    <div class="page-head">
      <div><span class="eyebrow">Personal Executive Command Centre</span><div class="page-title">${greetingWord()}, ${currentUserDisplayName()}</div><div class="page-sub">${fmtDateLong(TODAY)}</div></div>
    </div>

    <div class="summary-strip">${summaryChips.map((s) => `<span class="summary-chip" onclick="${call("navigate", s.hash)}"><span class="summary-chip-num${s.warn ? " warn" : ""}">${s.num}</span><span class="summary-chip-label">${s.label}</span></span>`).join('<span class="summary-sep"></span>')}</div>

    <div class="grid grid-2" style="align-items:start;margin-top:20px">
      <div class="section">
        <div class="section-head"><div class="section-title">${meetingNowCount ? '<span class="live-dot" title="A meeting is happening now"></span>' : ""}Today</div><span class="section-link" onclick="${call("navigate", "#/myday")}">My Day →</span></div>
        <div class="card card-pad card-accent">
          ${todayMeetings.length ? todayMeetings.map((m) => meetingRow(m, { compact: true })).join("") : '<div class="muted" style="padding:6px 4px">Nothing on the calendar today.</div>'}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><div class="section-title">Attention Required</div></div>
        <div class="card card-pad${attentionRows.length ? " card-accent card-accent-warn" : ""}">
          ${attentionRows.length ? `<div class="attention-list">${attentionRows.map((r) => `
            <div class="attention-row" onclick="${call("navigate", r.hash)}">
              <div class="attention-icon${r.sev ? " sev-" + r.sev : ""}">${r.icon}</div>
              <div><div class="attention-label">${r.label}</div><div class="attention-sub">${r.sub}</div></div>
              <div class="attention-count">${r.count}</div>
            </div>`).join("")}</div>` : `<div class="muted" style="padding:10px 4px">Nothing needs attention right now.</div>`}
          ${a.waitingOn.length ? `
            <div class="section-title" style="margin:16px 0 6px;padding-top:14px;border-top:1px solid var(--line-soft)">Waiting On</div>
            <div class="quick-list">${a.waitingOn.map((t) => `
              <div class="quick-row" onclick="${call("navigate", "#/actions")}"><span>${t.title}</span><span class="muted" style="margin-left:auto">${t.waitingOn} · due ${fmtDate(t.due)}</span></div>
            `).join("")}</div>` : ""}
        </div>
      </div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div class="section">
        <div class="section-head"><div class="section-title">Recently Modified</div><span class="section-link" onclick="${call("navigate", "#/vault?bucket=recent")}">View all</span></div>
        <div class="card card-pad card-accent card-accent-blue">
          <div class="quick-list">${recent.map((d) => `
            <div class="quick-row" onclick="${call("openDocument", d.id)}">
              <span>${d.title}</span><span class="muted" style="margin-left:auto">${fmtDate(d.modified)}</span>
            </div>`).join("")}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><div class="section-title">Requires Review or Decision</div></div>
        <div class="card card-pad${decisions.length ? " card-accent card-accent-warn" : ""}">
          ${decisions.length ? `<div class="quick-list">${decisions.map((d) => `
            <div class="quick-row" onclick="${call("openDocument", d.id)}"><span>${d.title}</span>${statusChip(d.status)}<span class="muted" style="margin-left:auto">${clientName(d.clientId)}</span></div>
          `).join("")}</div>` : '<div class="muted" style="padding:4px">No board papers or resolutions pending decision.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderMyDay() {
  const meetings = meetingsOnDate(TODAY);
  const dueToday = TASKS.filter((t) => !t.done && t.due === TODAY);
  return `
    <div class="page-head">
      <div><div class="page-title">My Day</div><div class="page-sub">${fmtDateLong(TODAY)}</div></div>
    </div>
    <div class="section">
      <div class="section-head"><div class="section-title">Today's Schedule</div></div>
      <div class="card card-pad">
        ${meetings.length ? meetings.map((m) => meetingRow(m)).join("") : '<div class="muted" style="padding:6px 4px">Nothing on the calendar today.</div>'}
      </div>
    </div>
    <div class="section">
      <div class="section-head"><div class="section-title">Due Today</div></div>
      <div class="card card-pad">
        ${dueToday.length ? dueToday.map((t) => `
          <div class="quick-row" style="padding:9px 4px">
            <input type="checkbox" onchange="${call("toggleTask", t.id)}"/>
            <span>${t.title}</span>
            <span class="muted">· ${clientName(t.clientId)}</span>
            ${t.waitingOn ? `<span class="muted" style="margin-left:auto">Waiting on ${t.waitingOn}</span>` : '<span class="muted" style="margin-left:auto">On me</span>'}
          </div>`).join("") : '<div class="muted" style="padding:6px 4px">Nothing due today.</div>'}
      </div>
    </div>
  `;
}

function renderThisWeek() {
  const start = weekStart(TODAY);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return `
    <div class="page-head">
      <div><div class="page-title">This Week</div><div class="page-sub">${fmtDate(start)} – ${fmtDate(addDays(start, 6))}</div></div>
    </div>
    ${days.map((iso) => {
      const meetings = meetingsOnDate(iso);
      const due = TASKS.filter((t) => !t.done && t.due === iso);
      const isToday = iso === TODAY;
      if (!meetings.length && !due.length) {
        return `<div class="section"><div class="section-head"><div class="section-title">${fmtDateLong(iso)}${isToday ? " · Today" : ""}</div></div><div class="card card-pad"><div class="muted" style="padding:2px 4px">Nothing scheduled.</div></div></div>`;
      }
      return `
        <div class="section">
          <div class="section-head"><div class="section-title">${fmtDateLong(iso)}${isToday ? " · Today" : ""}</div></div>
          <div class="card card-pad">
            ${meetings.map((m) => meetingRow(m, { compact: true })).join("")}
            ${due.map((t) => `
              <div class="quick-row" style="padding:9px 4px">
                <input type="checkbox" onchange="${call("toggleTask", t.id)}"/>
                <span>☑ ${t.title}</span><span class="muted" style="margin-left:auto">${clientName(t.clientId)}</span>
              </div>`).join("")}
          </div>
        </div>`;
    }).join("")}
  `;
}
function mattersForActiveClients() {
  const activeClientIds = new Set(CLIENTS.filter((c) => !c.legacy).map((c) => c.id));
  const activeEngIds = new Set(ENGAGEMENTS.filter((e) => activeClientIds.has(e.clientId)).map((e) => e.id));
  return MATTERS.filter((m) => activeEngIds.has(m.engagementId));
}

function filterBarHtml(query, extra) {
  const clientOptions = [`<option value="">All Clients / Engagements</option>`].concat(
    CLIENTS.filter((c) => !c.legacy).map((c) => `<option value="${c.id}" ${query.clientId === c.id ? "selected" : ""}>${c.name}</option>`)
  ).join("");
  const fnOptions = [`<option value="">All Functions</option>`].concat(
    FUNCTIONS.map((f) => `<option value="${f}" ${query.function === f ? "selected" : ""}>${f}</option>`)
  ).join("");
  const typeOptions = [`<option value="">All Document Types</option>`].concat(
    DOCUMENT_TYPES.map((t) => `<option value="${t}" ${query.docType === t ? "selected" : ""}>${t}</option>`)
  ).join("");
  const statusOptions = [`<option value="">All Statuses</option>`].concat(
    STATUSES.map((s) => `<option value="${s}" ${query.status === s ? "selected" : ""}>${s}</option>`)
  ).join("");
  const confOptions = [`<option value="">All Confidentiality</option>`].concat(
    CLASSIFICATIONS.map((c) => `<option value="${c.id}" ${query.confidentiality === c.id ? "selected" : ""}>${c.label}</option>`)
  ).join("");
  return `
    <div class="filter-bar">
      <input class="filter-search" placeholder="Filter this view…" value="${attrSafe(query.q || "")}"
        onkeydown="if(event.key==='Enter'){applyFilter('q', this.value)}"
      />
      <select class="filter-select" onchange="${callWithValue("applyFilter", "clientId")}">${clientOptions}</select>
      <select class="filter-select" onchange="${callWithValue("applyFilter", "function")}">${fnOptions}</select>
      <select class="filter-select" onchange="${callWithValue("applyFilter", "docType")}">${typeOptions}</select>
      <select class="filter-select" onchange="${callWithValue("applyFilter", "status")}">${statusOptions}</select>
      <select class="filter-select" onchange="${callWithValue("applyFilter", "confidentiality")}">${confOptions}</select>
      ${extra || ""}
    </div>`;
}

const SAVED_VIEWS = [
  { id: "", label: "All Documents" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Working Drafts" },
  { id: "review", label: "For Review" },
  { id: "final", label: "Final / Issued" },
  { id: "starred", label: "Starred" },
  { id: "recent", label: "Recent" },
];

function renderVaultScreen(query) {
  const layout = query.layout === "folder" ? "folder" : "table";
  let docs = computeVaultDocs(query);
  const heading = query.function ? `Knowledge · ${query.function}` : "My Document Vault";
  const sub = query.function
    ? `Everything tagged Function = “${query.function}”, wherever it physically lives in Drive — client/engagement material included, never duplicated.`
    : "Folder View mirrors Google Drive exactly. Intelligent View is the metadata-driven registry — filter, sort, save views, and reclassify without leaving the table.";
  return `
    <div class="page-head">
      <div><div class="page-title">${heading}</div><div class="page-sub">${sub}</div></div>
      <div class="page-head-actions">
        <button class="btn btn-gold btn-sm" onclick="${call("mockAction", "Upload is mocked in this prototype.")}">⭱ Upload Here</button>
      </div>
    </div>
    <div class="saved-views">${SAVED_VIEWS.map((v) => `<button class="saved-view-chip${(query.bucket || "") === v.id ? " active" : ""}" onclick="${call("goVaultBucket", v.id)}">${v.label}</button>`).join("")}</div>
    ${filterBarHtml(query, `
      <button class="btn btn-sm btn-ghost" onclick="${call("navigate", "#/vault")}">Clear filters</button>
      <div class="view-toggle">
        <button class="${layout === "table" ? "active" : ""}" onclick="${call("applyFilter", "layout", "")}">Intelligent View</button>
        <button class="${layout === "folder" ? "active" : ""}" onclick="${call("applyFilter", "layout", "folder")}">Folder View</button>
      </div>
    `)}
    ${layout === "folder" ? renderFolderView(docs) : renderRegistryTable(docs)}
  `;
}

function clientCard(cl) {
  const docs = classifiedDocs().filter((d) => d.clientId === cl.id);
  const outstanding = docs.filter((d) => !FINAL_STATUSES.includes(d.status) && !CLOSED_STATUSES.includes(d.status)).length;
  return `
    <div class="card engagement-card" onclick="${call("navigate", "#/client/" + cl.id)}">
      <div class="eng-card-top">
        <div><div class="eng-name">${cl.name}</div><div class="eng-type">${cl.type === "client" ? "Client" : "Internal Project"}</div></div>
        <span class="pin-star" onclick="${call("togglePin", cl.id)}" title="Pin">${cl.pinned ? "★" : "☆"}</span>
      </div>
      <div class="eng-summary">${cl.summary}</div>
      <div class="eng-meta">${docs.length} documents · ${outstanding} outstanding</div>
    </div>`;
}

function renderClientListScreen(type) {
  const list = CLIENTS.filter((c) => c.type === type && !c.legacy);
  return `
    <div class="page-head">
      <div><div class="page-title">${type === "client" ? "Clients & Engagements" : "Projects & Programmes"}</div>
        <div class="page-sub">${type === "client" ? "One workspace per client, following the standard 00–99 folder template." : "Internal, non-client initiatives — same workspace template as a client engagement."}</div></div>
      <div class="page-head-actions"><button class="btn btn-primary btn-sm" onclick="${call("mockAction", "New Client Workspace scaffolds 00 – Client Overview through 99 – Archive in Drive, then lands you on the Overview tab to fill in what you know. (Mock action in this prototype.)")}">+ New ${type === "client" ? "Client Workspace" : "Project Workspace"}</button></div>
    </div>
    <div class="grid grid-3">${list.map(clientCard).join("")}</div>
  `;
}

function renderClientStructureSummary(cl) {
  const engs = engagementsForClient(cl.id);
  if (!engs.length) return `<div class="muted">No Engagement recorded yet.</div>`;
  return engs.map((eng) => {
    const matters = MATTERS.filter((m) => m.engagementId === eng.id);
    return `
      <div style="margin-bottom:14px">
        <div style="font-weight:700;font-size:12.5px">${eng.name}<span class="muted" style="font-weight:400"> — Engagement</span></div>
        ${matters.map((m) => {
          const matterDocs = classifiedDocs().filter((d) => d.matterId === m.id);
          return `
          <div style="margin:6px 0 0 12px;padding-left:10px;border-left:2px solid var(--line)">
            <div style="font-size:12px;display:flex;align-items:center;gap:8px">
              <span><b>${m.name}</b> <span class="muted">— Project/Matter · ${statusChip(m.status)} · ${matterDocs.length} docs${m.managementVisible ? ' · <span class="chip fn-chip" title="Shown on the Management Progress page">Management Visible</span>' : ""}</span></span>
              <button class="btn btn-sm btn-ghost" style="margin-left:auto;padding:2px 9px;font-size:10.5px" onclick="${call("openMatterEditor", m.id)}">Edit Management Snapshot</button>
            </div>
            ${m.workstreams.length ? m.workstreams.map((w) => {
              const wDocs = matterDocs.filter((d) => d.workstream === w);
              return `
              <div style="display:flex;align-items:center;gap:8px;margin:4px 0 0 12px;font-size:11.5px;color:var(--ink-soft)">
                <span>↳ ${w} (${wDocs.length})</span>
                <button class="btn btn-sm btn-ghost" style="margin-left:auto;padding:2px 9px;font-size:10.5px" onclick="${call("promoteWorkstreamToMatter", m.id, w)}">Promote to Matter</button>
              </div>`;
            }).join("") : `<div style="margin:4px 0 0 12px;font-size:11.5px" class="muted">No workstreams yet.</div>`}
          </div>`;
        }).join("") || `<div class="muted" style="margin-left:12px;font-size:12px">No Project/Matter recorded yet.</div>`}
      </div>`;
  }).join("");
}

function renderClientWorkspace(id, tab, query) {
  query = query || {};
  const cl = getClient(id);
  if (!cl) return `<div class="empty-state"><h3>Not found</h3></div>`;
  tab = tab || "overview";
  const docs = classifiedDocs().filter((d) => d.clientId === id);
  const matterFilter = query.matter ? getMatter(query.matter) : null;
  const meetings = MEETINGS.filter((m) => m.clientId === id);
  const tasks = TASKS.filter((t) => t.clientId === id);
  const archived = docs.filter((d) => CLOSED_STATUSES.includes(d.status));
  const deliverables = docs.filter((d) => ["Deliverable", "Proposal", "Report"].includes(d.docType));
  const finalDocs = docs.filter((d) => FINAL_STATUSES.includes(d.status));
  const lastDoc = docs.slice().sort((a, b) => b.modified.localeCompare(a.modified))[0];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: `Documents (${docs.length})` },
    { id: "meetings", label: "Meetings & Decisions" },
    { id: "actions", label: `Action Items & Deliverables${tasks.filter((t) => !t.done).length ? ` (${tasks.filter((t) => !t.done).length})` : ""}` },
    { id: "archive", label: `Archive (${archived.length})` },
  ];

  let body = "";
  if (tab === "overview") {
    body = `
      ${cl.legacy ? `<div class="callout" style="margin-bottom:16px"><span>🗄</span><div><b>Legacy business line.</b> Discontinued — excluded from the active Clients &amp; Engagements / Projects &amp; Programmes lists, the Vault's default view, dashboard counts, and search unless explicitly included. Reachable here and from Archive only.</div></div>` : ""}
      <div class="grid grid-2" style="align-items:start">
        <div class="card card-pad">
          <div class="dfield-label" style="margin-bottom:8px">Contacts</div>
          ${cl.contacts.length ? cl.contacts.map((c) => `<div style="margin-bottom:6px"><b>${c.name}</b><br/><span class="muted">${c.role}</span></div>`).join("") : '<div class="muted">None recorded.</div>'}
          <div class="dfield-label" style="margin:14px 0 8px">Key Dates</div>
          ${cl.keyDates.length ? cl.keyDates.map((k) => `<div class="quick-row" style="padding-left:0">${fmtDate(k.date)} — ${k.label}</div>`).join("") : '<div class="muted">None recorded.</div>'}
          <div class="dfield-label" style="margin:14px 0 8px">Google Drive Folder</div>
          <div class="muted">${cl.driveFolder}</div>
        </div>
        <div class="card card-pad">
          <div class="dfield-label" style="margin-bottom:8px">What have I done for this client?</div>
          <div style="margin-bottom:14px">${finalDocs.length} final/issued document${finalDocs.length === 1 ? "" : "s"} · ${docs.length} total on file.</div>
          <div class="dfield-label" style="margin-bottom:8px">What's currently outstanding?</div>
          <div style="margin-bottom:14px">${tasks.filter((t) => !t.done).length} open follow-up item${tasks.filter((t) => !t.done).length === 1 ? "" : "s"}.</div>
          <div class="dfield-label" style="margin-bottom:8px">What was the latest document?</div>
          <div>${lastDoc ? `<a style="cursor:pointer;color:var(--gold-deep);font-weight:700" onclick="${call("openDocument", lastDoc.id)}">${lastDoc.title}</a> — ${statusChip(lastDoc.status)} · ${fmtDate(lastDoc.modified)}` : '<span class="muted">No documents yet.</span>'}</div>
        </div>
      </div>
      <div class="section" style="margin-top:20px">
        <div class="section-head"><div class="section-title">Engagement → Project/Matter → Workstream</div></div>
        <div class="card card-pad">${renderClientStructureSummary(cl)}</div>
      </div>`;
  } else if (tab === "documents") {
    let docsForTab = docs.filter((d) => !CLOSED_STATUSES.includes(d.status));
    if (matterFilter) docsForTab = docsForTab.filter((d) => d.matterId === matterFilter.id);
    body = `
      ${matterFilter ? `<div class="saved-views"><span class="saved-view-chip active">Matter: ${matterFilter.name} <a style="cursor:pointer;margin-left:6px" onclick="${call("navigate", "#/client/" + cl.id + "?tab=documents")}">✕</a></span></div>` : ""}
      ${renderRegistryTable(docsForTab, "No active documents for this engagement yet.")}`;
  } else if (tab === "meetings") {
    body = meetings.length ? meetings.map((m) => `
      <div class="card card-pad" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between"><b>${m.title}</b><span class="muted">${fmtDate(m.date)}</span></div>
        <ul style="margin:10px 0 0;padding-left:18px">${m.decisions.map((dec) => `<li style="margin-bottom:4px">${dec}</li>`).join("")}</ul>
        ${m.documentId ? `<div style="margin-top:10px"><a style="cursor:pointer;color:var(--gold-deep);font-weight:700" onclick="${call("openDocument", m.documentId)}">View minutes →</a></div>` : ""}
      </div>`).join("") : `<div class="empty-state"><h3>No meetings recorded</h3></div>`;
  } else if (tab === "actions") {
    body = `
      <div class="card card-pad" style="margin-bottom:16px">
        <div class="dfield-label" style="margin-bottom:8px">Outstanding Actions</div>
        ${tasks.length ? tasks.map((t) => `
          <div class="quick-row" style="padding-left:0">
            <input type="checkbox" ${t.done ? "checked" : ""} onchange="${call("toggleTask", t.id)}"/>
            <span style="${t.done ? "text-decoration:line-through;color:var(--ink-faint)" : ""}">${t.title}</span>
            <span class="muted" style="margin-left:auto">Due ${fmtDate(t.due)}</span>
          </div>`).join("") : '<div class="muted">No open actions.</div>'}
      </div>
      <div class="dfield-label" style="margin-bottom:8px">Deliverables</div>
      ${renderRegistryTable(deliverables, "No deliverables filed yet.")}`;
  } else if (tab === "archive") {
    body = renderRegistryTable(archived, "Nothing archived for this engagement yet.");
  }

  return `
    <div class="breadcrumbs"><a onclick="${call("navigate", cl.type === "client" ? "#/clients" : "#/projects")}">${cl.type === "client" ? "Clients & Engagements" : "Projects & Programmes"}</a> / ${cl.name}</div>
    <div class="page-head">
      <div><div class="page-title">${cl.name} <span class="pin-star" style="font-size:16px;cursor:pointer" onclick="${call("togglePin", cl.id)}">${cl.pinned ? "★" : "☆"}</span></div>
      <div class="page-sub">${cl.summary}</div></div>
    </div>
    <div class="tabs">${tabs.map((t) => `<button class="tab${tab === t.id ? " active" : ""}" onclick="${call("navigate", "#/client/" + cl.id + "?tab=" + t.id)}">${t.label}</button>`).join("")}</div>
    ${body}
  `;
}

function renderSearchScreen(query) {
  const q = query.q || "";
  const includeLegacy = query.legacy === "1";
  let results = searchAll(q, includeLegacy);
  if (query.clientId) results = results.filter((r) => r.doc.clientId === query.clientId);
  if (query.function) results = results.filter((r) => r.doc.function === query.function);
  if (query.status) results = results.filter((r) => r.doc.status === query.status);
  if (query.confidentiality) results = results.filter((r) => r.doc.confidentiality === query.confidentiality);

  return `
    <div class="page-head">
      <div><div class="page-title">Search</div><div class="page-sub">${q ? `Results for “${q}”` : "Type a query in the search bar above."}</div></div>
    </div>
    ${q ? filterBarHtml(query, "") : ""}
    ${q ? `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-soft);margin:-6px 0 14px"><input type="checkbox" ${includeLegacy ? "checked" : ""} onchange="${callWithValue("applyFilter", "legacy").replace("this.value", "this.checked?'1':''")}"/> Include Legacy business lines</label>` : ""}
    ${!q ? `<div class="empty-state"><h3>Nothing to show yet</h3><div>Try “VT overtime policy”, “HR-124”, “Nusantara minutes September”, “Labuan fund”, or “Eric review.”</div></div>` : ""}
    ${q && !results.length ? `<div class="empty-state"><h3>No matches</h3><div>No title, ID, tag, or note text matched “${q}.” Google Drive full-text search does not reliably cover every file type — see Settings for what's indexed.</div></div>` : ""}
    ${results.length ? `<div class="table-wrap">${results.map((r) => `
      <div class="search-result" onclick="${call("openDocument", r.doc.id)}">
        <div class="search-result-icon">${(r.doc.docType || "DOC").slice(0, 2).toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <b>${clientName(r.doc.clientId)}</b>
            <span class="match-badge${r.match === "content" ? " content" : ""}">${r.match === "content" ? "Content match" : "Metadata match"}</span>
            ${isLegacyDoc(r.doc) ? `<span class="match-badge">Legacy</span>` : ""}
          </div>
          <div style="margin-top:2px">${r.doc.docId ? r.doc.docId + " – " : ""}${r.doc.title}</div>
          <div class="search-meta-line">${r.doc.docType || "—"} · ${r.doc.version || "no version"} · ${statusChip(r.doc.status)} · Modified ${fmtDate(r.doc.modified)}</div>
          <div class="search-path">Google Drive › ${r.doc.drivePath}</div>
        </div>
      </div>`).join("")}</div>` : ""}
  `;
}

function renderInboxScreen() {
  const items = unclassifiedDocs();
  return `
    <div class="page-head">
      <div><div class="page-title">Executive Inbox</div><div class="page-sub">The deliberate landing zone. Nothing here is filed wrong — classify when you have a moment, not before.</div></div>
    </div>
    ${items.length ? `<div class="table-wrap">${items.map((d) => `
      <div class="inbox-row">
        <div class="inbox-icon">📄</div>
        <div style="flex:1"><b>${d.title}</b><div class="muted" style="font-size:11.5px">Added ${fmtDate(d.created)} · ${d.drivePath}</div></div>
        <button class="btn btn-gold btn-sm" onclick="${call("openDocument", d.id)}">Classify</button>
      </div>`).join("")}</div>` : `<div class="empty-state"><h3>Inbox is empty</h3><div>Everything uploaded so far has been classified.</div></div>`}
  `;
}

function renderArchiveScreen(query) {
  const legacyFilter = query.legacyFilter || "";
  let docs = classifiedDocs().filter((d) => CLOSED_STATUSES.includes(d.status));
  if (legacyFilter === "only") docs = docs.filter((d) => isLegacyDoc(d));
  return `
    <div class="page-head">
      <div><div class="page-title">Archive</div><div class="page-sub">Superseded and archived documents — kept reachable, never hidden. Legacy business-line material (§3a) lives here too, never in the active Vault.</div></div>
    </div>
    <div class="saved-views">
      <button class="saved-view-chip${legacyFilter === "" ? " active" : ""}" onclick="${call("applyFilter", "legacyFilter", "")}">All Archived</button>
      <button class="saved-view-chip${legacyFilter === "only" ? " active" : ""}" onclick="${call("applyFilter", "legacyFilter", "only")}">Legacy Only</button>
    </div>
    ${renderRegistryTable(docs, "Nothing archived yet.")}
  `;
}

function renderActionsScreen() {
  const onMe = TASKS.filter((t) => !t.done && !t.waitingOn);
  const waitingOn = TASKS.filter((t) => !t.done && t.waitingOn);
  const done = TASKS.filter((t) => t.done);
  const row = (t) => `
    <div class="quick-row action-row" style="padding:10px 4px">
      <input type="checkbox" ${t.done ? "checked" : ""} onchange="${call("toggleTask", t.id)}"/>
      <span style="${t.done ? "text-decoration:line-through;color:var(--ink-faint)" : ""}">${t.title}</span>
      <span class="muted">· ${clientName(t.clientId)}${matterName(t.matterId) ? " · " + matterName(t.matterId) : ""}</span>
      ${t.waitingOn ? `<span class="muted" style="margin-left:auto">Waiting on ${t.waitingOn} · due ${fmtDate(t.due)}</span>` : `<span class="muted" style="margin-left:auto">Due ${fmtDate(t.due)}</span>`}
    </div>`;
  return `
    <div class="page-head"><div><div class="page-title">Actions & Follow-Up</div><div class="page-sub">Outstanding items across every client and project, split by whose turn it is next.</div></div></div>
    <div class="card card-pad" style="margin-bottom:16px">
      <div class="dfield-label" style="margin-bottom:8px">On Me (${onMe.length})</div>
      ${onMe.map(row).join("") || '<div class="muted">Nothing outstanding on me.</div>'}
    </div>
    <div class="card card-pad" style="margin-bottom:16px">
      <div class="dfield-label" style="margin-bottom:8px">Waiting On Others (${waitingOn.length})</div>
      ${waitingOn.map(row).join("") || '<div class="muted">Not waiting on anyone right now.</div>'}
    </div>
    ${done.length ? `<div class="card card-pad"><div class="dfield-label" style="margin-bottom:8px">Done</div>${done.map(row).join("")}</div>` : ""}
  `;
}

/** Identity/Context/State/Action only — Stage, workstream/doc counts stay one tap away in the Client Workspace, not duplicated here. */
function matterRecordCardHtml(r) {
  return `
    <div class="record-card" onclick="${call("navigate", "#/client/" + r.cl.id + "?tab=documents&matter=" + r.m.id)}">
      <div class="record-card-id">${r.m.name}${r.m.managementVisible ? ' <span class="chip fn-chip" style="font-size:9px">Management Visible</span>' : ""}</div>
      <div class="record-card-context">${r.cl.name} · ${r.eng.name}</div>
      <div class="record-card-state">
        ${statusChip(r.m.status)}
        <span class="record-card-meta">Due ${fmtDate(r.m.targetDate)}</span>
      </div>
    </div>`;
}

function renderMattersScreen() {
  const rows = MATTERS.map((m) => {
    const eng = getEngagementRecord(m.engagementId);
    const cl = eng ? getClient(eng.clientId) : null;
    if (!cl || cl.legacy) return null;
    const docs = classifiedDocs().filter((d) => d.matterId === m.id && !CLOSED_STATUSES.includes(d.status));
    return { m, eng, cl, docCount: docs.length };
  }).filter(Boolean);
  return `
    <div class="page-head"><div><div class="page-title">Projects / Matters</div><div class="page-sub">Every Project/Matter across every Client and Engagement, in one register — the cross-client view of what's active (architecture doc §15.5).</div></div></div>
    <div class="table-wrap desktop-register">
      <table class="reg">
        <thead><tr><th>Matter</th><th>Client</th><th>Engagement</th><th>Status</th><th>Stage</th><th>Workstreams</th><th>Open Docs</th><th>Target Date</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr onclick="${call("navigate", "#/client/" + r.cl.id + "?tab=documents&matter=" + r.m.id)}">
            <td><b>${r.m.name}</b>${r.m.managementVisible ? ' <span class="chip fn-chip" style="font-size:9px" title="Shown on the Management Progress page">Management Visible</span>' : ""}</td>
            <td>${r.cl.name}</td>
            <td>${r.eng.name}</td>
            <td>${statusChip(r.m.status)}</td>
            <td>${r.m.currentStage || "—"}</td>
            <td>${r.m.workstreams.length}</td>
            <td>${r.docCount}</td>
            <td>${fmtDate(r.m.targetDate)}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="record-list">${rows.map(matterRecordCardHtml).join("")}</div>
  `;
}

function renderOutlookScreen() {
  return `
    <div class="page-head"><div><div class="page-title">Outlook Calendar</div><div class="page-sub">My Day and This Week are populated from mock data in this prototype — no live Microsoft account connection.</div></div></div>
    <div class="callout"><span>ℹ</span><div>Production integration is architecture-only for now: Microsoft Graph, MSAL OAuth, a read-only <code>Calendars.Read</code> scope, and an Unlinked Meetings queue that mirrors the Executive Inbox pattern for events Graph can't map to a Client/Matter/Workstream on its own. See <code>docs/architecture/executive-document-vault.md</code> §15.6.</div></div>
  `;
}

/* ============================ Management Progress ============================ */

/** "Client — Title" without the doubled-up look when Title already names the Client (several document/meeting titles do, by naming convention, §6) — checked loosely (the Client's first word) since a title may carry a shortened form ("Nusantara" for "Nusantara Project"). */
function mgmtLabel(clientId, title) {
  const cn = clientName(clientId);
  const firstWord = cn.split(" ")[0];
  return title.toLowerCase().includes(firstWord.toLowerCase()) ? title : `${cn} — ${title}`;
}

function mgmtMatterCard(m) {
  const eng = getEngagementRecord(m.engagementId);
  const cn = clientName(eng.clientId);
  return `
    <div class="mgmt-card">
      <div class="mgmt-card-top">
        <div>
          <div class="mgmt-card-client">${cn}</div>
          <div class="mgmt-card-name">${m.name}</div>
        </div>
        <span class="mgmt-status mgmt-status-${slug(m.managementStatus || "")}">${m.managementStatus || "—"}</span>
      </div>
      <div class="mgmt-field"><span class="mgmt-field-label">Current Position</span>${m.currentPosition || "—"}</div>
      ${m.workstreams.length ? `<div class="mgmt-field"><span class="mgmt-field-label">Active Workstreams</span>${m.workstreams.join(", ")}</div>` : ""}
      <div class="mgmt-field"><span class="mgmt-field-label">Next Step</span>${m.nextStep || "—"}</div>
      <div class="mgmt-field"><span class="mgmt-field-label">Management Attention</span>${m.managementAttentionNote || "None."}</div>
    </div>`;
}

function renderManagementProgress() {
  const matters = managementVisibleMatters();
  const summary = computeManagementSummary();
  const attentionMatters = matters.filter((m) => m.managementAttentionLevel);
  const waiting = managementWaitingOn();
  const notes = managementProgressNotes();
  const decisions = computeManagementDecisions();
  const docs = managementVisibleDocs();
  const meetings = managementMeetings();
  const lastUpdated = lastManagementUpdate();

  const summaryLine = [
    `${summary.activeMatters} Active Matter${summary.activeMatters === 1 ? "" : "s"}`,
    `${summary.forReview} For Review`,
    `${summary.awaitingInput} Awaiting Input`,
    `${summary.decisionRequired} Decision Required`,
  ].join(" · ");

  return `
    <div class="mgmt-preview-banner">
      <span>You are previewing the Management View — this is exactly what would be shared.</span>
      <button class="btn btn-sm" onclick="${call("navigate", "#/home")}">Exit Preview</button>
    </div>
    <div class="mgmt-page">
      <div class="mgmt-header">
        <div>
          <span class="eyebrow">Executive Briefing</span>
          <div class="mgmt-title">Management Progress</div>
          <div class="mgmt-subtitle">Executive Office — Current Work &amp; Priorities</div>
        </div>
        <div class="mgmt-updated">Last Updated: ${lastUpdated ? fmtDate(lastUpdated) : "—"}</div>
      </div>

      <div class="mgmt-summary">${summaryLine}</div>

      <div class="mgmt-section">
        <div class="mgmt-section-title">Current Priorities</div>
        ${matters.length ? matters.map(mgmtMatterCard).join("") : '<div class="mgmt-empty">No Matters currently selected for management visibility.</div>'}
      </div>

      <div class="mgmt-section">
        <div class="mgmt-section-title">Management Attention</div>
        ${attentionMatters.length ? attentionMatters.map((m) => {
          const eng = getEngagementRecord(m.engagementId);
          const cn = clientName(eng.clientId);
          const supportingDoc = docs.find((d) => d.matterId === m.id && d.managementVisibility === "For Review");
          return `
          <div class="mgmt-attention-card">
            <div class="mgmt-attention-top">
              <span class="mgmt-attention-level">${m.managementAttentionLevel}</span>
              <span class="mgmt-attention-who">${cn} — ${m.name}</span>
            </div>
            <div class="mgmt-attention-note">${m.managementAttentionNote || ""}</div>
            <div class="mgmt-attention-actions">
              <button class="btn btn-sm" onclick="${call("navigate", "#/client/" + eng.clientId + "?tab=documents&matter=" + m.id)}">View Matter</button>
              ${supportingDoc ? `<button class="btn btn-sm btn-ghost" onclick="${call("openDocument", supportingDoc.id)}">View Supporting Document</button>` : ""}
            </div>
          </div>`;
        }).join("") : '<div class="mgmt-empty">No immediate management action required.</div>'}
      </div>

      <div class="mgmt-section">
        <div class="mgmt-section-title">Waiting On — Awaiting Input / External Dependency</div>
        ${waiting.length ? waiting.map((t) => `
          <div class="mgmt-line"><b>${clientName(t.clientId)}</b> — ${t.title}${t.waitingOn ? ` <span class="muted">(${t.waitingOn})</span>` : ""}</div>
        `).join("") : '<div class="mgmt-empty">Nothing currently awaiting external input.</div>'}
      </div>

      <div class="grid grid-2" style="gap:24px;align-items:start">
        <div class="mgmt-section">
          <div class="mgmt-section-title">Progress Since Last Update</div>
          ${notes.length ? notes.map((n) => `<div class="mgmt-line">✓ ${n.text}</div>`).join("") : '<div class="mgmt-empty">Nothing selected yet.</div>'}
        </div>
        <div class="mgmt-section">
          <div class="mgmt-section-title">Next 7 Days</div>
          ${matters.filter((m) => m.nextStep).length ? matters.filter((m) => m.nextStep).map((m) => {
            const cn = clientName(getEngagementRecord(m.engagementId).clientId);
            return `<div class="mgmt-line"><b>${cn}</b> — ${m.nextStep}</div>`;
          }).join("") : '<div class="mgmt-empty">Nothing notable in the coming week.</div>'}
        </div>
      </div>

      <div class="mgmt-section">
        <div class="mgmt-section-title">Decisions / Direction Required</div>
        ${decisions.length ? decisions.map((d) => `
          <div class="mgmt-line mgmt-line-click" onclick="${call("openDocument", d.id)}">
            <b>${mgmtLabel(d.clientId, d.title)}</b> <span class="muted">· Requested ${fmtDate(d.created)} · ${decisionDisplayStatus(d)}</span>
          </div>`).join("") : '<div class="mgmt-empty">Nothing currently pending a decision.</div>'}
      </div>

      <div class="mgmt-section">
        <div class="mgmt-section-title">Supporting Documents</div>
        ${docs.length ? docs.map((d) => `
          <div class="mgmt-line mgmt-line-click" onclick="${call("openDocument", d.id)}">
            <span class="mgmt-doc-tag">${(d.managementVisibility || "None").toUpperCase()}</span> ${mgmtLabel(d.clientId, d.title)}
          </div>`).join("") : '<div class="mgmt-empty">No documents selected for management visibility.</div>'}
      </div>

      ${meetings.length ? `
      <div class="mgmt-section">
        <div class="mgmt-section-title">Meetings — Upcoming</div>
        ${meetings.map((m) => `
          <div class="mgmt-line mgmt-line-click" onclick="${call("openMeeting", m.id)}">${mgmtLabel(m.clientId, m.title)} <span class="muted">· ${fmtDate(m.date)} · ${m.startTime}</span></div>
        `).join("")}
      </div>` : ""}

      <div class="mgmt-generate">
        <button class="btn btn-primary" onclick="${call("toggleGenerateUpdate")}">${STATE.showGenerateUpdate ? "Hide" : "Generate Management Update"}</button>
        ${STATE.showGenerateUpdate ? `
          <div class="mgmt-generate-panel">
            <div class="view-toggle" style="margin-bottom:10px">
              ${["email", "whatsapp", "brief"].map((f) => `<button class="${(STATE.updateFormat || "email") === f ? "active" : ""}" onclick="${call("setUpdateFormat", f)}">${f === "email" ? "Email" : f === "whatsapp" ? "WhatsApp" : "Executive Brief"}</button>`).join("")}
            </div>
            <textarea class="filter-search" style="width:100%;min-height:220px;font-family:inherit">${attrSafe(generateUpdateText(STATE.updateFormat || "email"))}</textarea>
            <div class="drawer-actions" style="margin-top:10px">
              <button class="btn btn-gold" onclick="${call("copyGeneratedUpdate")}">Copy Text</button>
            </div>
            <div class="mgmt-empty" style="margin-top:8px">Editable above. No email or WhatsApp is sent from here — copy and paste wherever you need it.</div>
          </div>` : ""}
      </div>
    </div>
  `;
}

function renderMeetingsScreen() {
  const sorted = MEETINGS.slice().sort((a, b) => (b.date + (b.startTime || "")).localeCompare(a.date + (a.startTime || "")));
  return `
    <div class="page-head"><div><div class="page-title">Meetings & Decisions</div><div class="page-sub">Every meeting, past and upcoming — minutes and the decisions recorded in them, across every client and matter.</div></div></div>
    ${sorted.map((m) => `
      <div class="card card-pad" style="margin-bottom:12px;cursor:pointer" onclick="${call("openMeeting", m.id)}">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
          <b>${m.title}</b><span class="muted">${clientName(m.clientId)}${matterName(m.matterId) ? " · " + matterName(m.matterId) : ""} · ${fmtDate(m.date)} ${m.startTime || ""}</span>
        </div>
        ${m.decisions && m.decisions.length ? `<ul style="margin:10px 0 0;padding-left:18px">${m.decisions.map((dec) => `<li style="margin-bottom:4px">${dec}</li>`).join("")}</ul>` : `<div class="muted" style="margin-top:8px">${statusChip(m.status)}</div>`}
      </div>`).join("")}
  `;
}

function renderTagsScreen() {
  const tagCounts = {};
  activeClassifiedDocs().forEach((d) => (d.tags || []).forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)));
  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  return `
    <div class="page-head"><div><div class="page-title">Tags & Classification</div><div class="page-sub">The confidentiality model, the Function/Document Type vocabularies, and every free tag in current use.</div></div></div>
    <div class="section">
      <div class="section-title" style="margin-bottom:10px">Confidentiality Tiers</div>
      <div class="card card-pad">${tierLegendHtml()}</div>
    </div>
    <div class="section">
      <div class="section-title" style="margin-bottom:10px">Function Vocabulary (${FUNCTIONS.length})</div>
      <div class="card card-pad"><div class="pill-select">${FUNCTIONS.map((f) => `<span class="chip fn-chip" style="cursor:pointer" onclick="${call("applyFilterAndGo", "function", f)}">${f}</span>`).join("")}</div></div>
    </div>
    <div class="section">
      <div class="section-title" style="margin-bottom:10px">Document Type Vocabulary (${DOCUMENT_TYPES.length})</div>
      <div class="card card-pad"><div class="pill-select">${DOCUMENT_TYPES.map((t) => `<span class="chip fn-chip" style="cursor:pointer" onclick="${call("applyFilterAndGo", "docType", t)}">${t}</span>`).join("")}</div></div>
    </div>
    <div class="section">
      <div class="section-title" style="margin-bottom:10px">Tags in Use</div>
      <div class="card card-pad"><div class="pill-select">${tags.length ? tags.map(([t, n]) => `<span class="chip fn-chip" style="cursor:pointer" onclick="${call("applyFilterAndGo", "tag", t)}">${t} · ${n}</span>`).join("") : '<span class="muted">No tags yet.</span>'}</div></div>
    </div>
  `;
}

function renderTemplatesScreen() {
  const templates = activeClassifiedDocs().filter((d) => d.docType === "Template");
  return `
    <div class="page-head"><div><div class="page-title">Templates</div><div class="page-sub">Reusable starting points — engagement letters, board papers, policy templates.</div></div></div>
    ${renderRegistryTable(templates, "No templates on file yet.")}
  `;
}

function renderSettingsScreen() {
  return `
    <div class="page-head"><div><div class="page-title">Settings</div><div class="page-sub">Connection status and scope — nothing here talks to a live Google account yet.</div></div></div>
    <div class="grid grid-2" style="align-items:start">
      <div class="card card-pad">
        <div class="dfield-label" style="margin-bottom:8px">Google Drive Connection</div>
        <div style="margin-bottom:14px"><span class="chip status-chip-Archived">Not Connected</span> — Phase 3 prototype, mock data only. No network call to Google is made anywhere in this app.</div>
        <button class="btn btn-primary btn-sm" disabled style="opacity:.5;cursor:not-allowed">Connect Google Drive (Phase 4)</button>
        <div class="dfield-label" style="margin:18px 0 6px">Scopes Phase 4 will request</div>
        <div class="muted">drive.readonly — browse &amp; read · drive.file — create/write only what this app itself creates</div>
      </div>
      <div class="card card-pad">
        <div class="dfield-label" style="margin-bottom:8px">Workspace</div>
        <div style="margin-bottom:10px">Single-user personal workspace — no team members, sharing, or permission model in this phase.</div>
        <div class="dfield-label" style="margin-bottom:8px">Scope boundary</div>
        <div class="muted" style="margin-bottom:10px">This vault does not manage operational accounting — general ledger, routine bookkeeping, payroll processing, or routine expense processing. It does accommodate management/strategic financial documentation (management financial reports, investment papers, forecasts, valuations, funding/banking documentation, project budgets) under Finance &amp; Investment.</div>
        <div class="dfield-label" style="margin-bottom:6px">Reference</div>
        <div class="muted">See <code>docs/architecture/executive-document-vault.md</code> and <code>docs/architecture/executive-document-vault-gap-analysis.md</code> in this repository for the full information architecture behind this prototype.</div>
      </div>
    </div>
  `;
}

function renderDriveScreen() {
  return `
    <div class="page-head"><div><div class="page-title">Google Drive</div><div class="page-sub">In production, this opens your Drive directly in a new tab.</div></div></div>
    <div class="callout"><span>ℹ</span><div>This prototype has no live Google account connection (see Settings). Every "Open Original in Drive" / "Copy Drive Location" action here is a labelled mock — never presented as a real link.</div></div>
  `;
}

/* ============================ Dispatcher / init ============================ */

function renderScreen(path, query) {
  if (path === "/home") return renderHome();
  if (path === "/myday") return renderMyDay();
  if (path === "/week") return renderThisWeek();
  if (path === "/vault") return renderVaultScreen(query);
  if (path === "/clients") return renderClientListScreen("client");
  if (path === "/projects") return renderClientListScreen("project");
  if (path === "/matters") return renderMattersScreen();
  if (path.indexOf("/client/") === 0) return renderClientWorkspace(path.split("/")[2], query.tab, query);
  if (path === "/search") return renderSearchScreen(query);
  if (path === "/inbox") return renderInboxScreen();
  if (path === "/archive") return renderArchiveScreen(query);
  if (path === "/actions") return renderActionsScreen();
  if (path === "/meetings") return renderMeetingsScreen();
  if (path === "/tags") return renderTagsScreen();
  if (path === "/templates") return renderTemplatesScreen();
  if (path === "/settings") return renderSettingsScreen();
  if (path === "/drive") return renderDriveScreen();
  if (path === "/outlook") return renderOutlookScreen();
  if (path === "/management") return renderManagementProgress();
  if (path.indexOf("/document/") === 0) {
    STATE.previewId = path.split("/")[2];
    return renderVaultScreen({});
  }
  if (path.indexOf("/meeting/") === 0) {
    STATE.previewMeetingId = path.split("/")[2];
    return renderMyDay();
  }
  return renderHome();
}

/* ============================ Executive Command Centre Login ============================
 * Layer 1 only — "am I the authorised user of my own Command Centre." See
 * docs/architecture/executive-command-centre-authentication.md. Separate
 * and unrelated to the future Layer 2 Microsoft Account Connection
 * (Outlook OAuth): nothing below ever collects, stores, or transmits a
 * Microsoft credential — only this app's own email/password against its
 * own /api/login. */

/** Reads a remembered email from browser storage (client-side convenience only — never sent anywhere, never affects the session). Guarded for the non-browser test sandbox, which has no localStorage. */
function rememberedLoginEmail() {
  if (typeof localStorage === "undefined") return "";
  try { return localStorage.getItem("execvault_remember_email") || ""; } catch (e) { return ""; }
}

const LOGIN_ICON_EMAIL = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`;
const LOGIN_ICON_LOCK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const LOGIN_ICON_EYE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const LOGIN_ICON_EYE_OFF = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 5c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const LOGIN_ICON_SHIELD = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/></svg>`;

/** A stylised skyline silhouette for the brand panel — inline/self-contained (no external image asset), matching this app's existing no-network-dependency convention. Orange rects are the "micro-accent" lit windows. */
function loginSkylineSvg() {
  // Two depth groups (far/near) so desktop can apply a very subtle,
  // independent parallax drift to each; window rects sit outside both
  // groups so a couple can flicker without jittering along with the
  // parallax transform.
  return `<svg viewBox="0 0 600 150" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
    <g class="login-skyline-far">
      <rect x="0" y="85" width="40" height="65" fill="rgba(255,255,255,.06)"/>
      <rect x="84" y="95" width="28" height="55" fill="rgba(255,255,255,.06)"/>
      <rect x="170" y="70" width="30" height="80" fill="rgba(255,255,255,.07)"/>
      <rect x="262" y="60" width="36" height="90" fill="rgba(255,255,255,.08)"/>
      <rect x="350" y="80" width="30" height="70" fill="rgba(255,255,255,.06)"/>
      <rect x="438" y="90" width="32" height="60" fill="rgba(255,255,255,.07)"/>
      <rect x="530" y="65" width="34" height="85" fill="rgba(255,255,255,.08)"/>
      <rect x="569" y="95" width="31" height="55" fill="rgba(255,255,255,.06)"/>
    </g>
    <g class="login-skyline-near">
      <rect x="45" y="55" width="34" height="95" fill="rgba(255,255,255,.09)"/>
      <rect x="118" y="35" width="46" height="115" fill="rgba(255,255,255,.11)"/>
      <rect x="205" y="15" width="52" height="135" fill="rgba(255,255,255,.13)"/>
      <rect x="303" y="40" width="42" height="110" fill="rgba(255,255,255,.1)"/>
      <rect x="385" y="50" width="48" height="100" fill="rgba(255,255,255,.1)"/>
      <rect x="475" y="25" width="50" height="125" fill="rgba(255,255,255,.12)"/>
    </g>
    <rect x="212" y="30" width="4" height="6" fill="#ef7a1b" opacity=".85"/>
    <rect x="225" y="50" width="4" height="6" fill="#ef7a1b" opacity=".7" class="login-window-a"/>
    <rect x="490" y="43" width="4" height="6" fill="#ef7a1b" opacity=".8" class="login-window-b"/>
    <rect x="130" y="55" width="4" height="6" fill="#ef7a1b" opacity=".6"/>
    <rect x="395" y="65" width="4" height="6" fill="#ef7a1b" opacity=".75"/>
  </svg>`;
}

function renderLoginScreen() {
  const rememberedEmail = rememberedLoginEmail();
  const pwType = AUTH.showPassword ? "text" : "password";
  return `
    <div class="login-screen">
      <div class="login-brand-panel">
        <div class="login-sweep" aria-hidden="true"></div>
        <div class="login-wordmark">Executive Vault</div>
        <div class="login-panel-mid">
          <div class="eyebrow">Personal Executive Command Centre</div>
          <div class="login-pillars">PLAN<span>|</span>MANAGE<span>|</span>ADVANCE</div>
          <h1>A more focused tomorrow.</h1>
          <p>Your central workspace for clients, matters, priorities and progress.</p>
        </div>
        <div class="login-skyline">${loginSkylineSvg()}</div>
        <div class="login-panel-foot">
          <div class="login-panel-foot-name">Ching Yee</div>
          <div class="login-panel-foot-loc">Kuala Lumpur • Singapore • Beyond</div>
        </div>
      </div>
      <div class="login-form-panel">
        <div class="login-card">
          <div class="eyebrow">Welcome Back</div>
          <h2>Sign in to your Command Centre</h2>
          <p class="login-card-sub">Enter your credentials to access your personal executive workspace.</p>
          <div class="login-fields">
            <label class="login-label">Email
              <div class="login-input-wrap">
                <span class="login-input-icon">${LOGIN_ICON_EMAIL}</span>
                <input class="login-input" type="email" id="loginEmail" autocomplete="username" placeholder="you@example.com" value="${attrSafe(rememberedEmail)}"/>
              </div>
            </label>
            <label class="login-label">Password
              <div class="login-input-wrap">
                <span class="login-input-icon">${LOGIN_ICON_LOCK}</span>
                <input class="login-input" type="${pwType}" id="loginPassword" autocomplete="current-password" style="padding-right:40px"/>
                <button type="button" class="login-pw-toggle" id="loginPwToggle" onclick="${call("toggleLoginPasswordVisibility")}" aria-label="${AUTH.showPassword ? "Hide password" : "Show password"}">${AUTH.showPassword ? LOGIN_ICON_EYE_OFF : LOGIN_ICON_EYE}</button>
              </div>
            </label>
            <div class="login-remember-row">
              <label class="login-remember"><input type="checkbox" id="loginRemember" ${rememberedEmail ? "checked" : ""}/> Remember me on this device</label>
            </div>
            ${AUTH.error ? `<div class="login-error">${attrSafe(AUTH.error)}</div>` : ""}
            <button class="btn btn-primary login-submit" onclick="${call("handleLoginFormSubmit")}">Sign in →</button>
          </div>
          <div class="login-secure-panel">
            ${LOGIN_ICON_SHIELD}
            <div><b>Secure Access</b>Your credentials are transmitted over an encrypted connection and verified server-side. Only the authorised account holder can sign in.</div>
          </div>
          <div class="login-footnote">Single-user personal workspace.</div>
        </div>
      </div>
    </div>`;
}

function renderAuthGateShell() {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  appEl.innerHTML = renderLoginScreen();
}

/** Direct DOM manipulation, not a full renderAuthGateShell() re-render — a full re-render would wipe whatever the user has already typed into either field, which is exactly the kind of thing a password-visibility toggle must never do. */
function toggleLoginPasswordVisibility() {
  AUTH.showPassword = !AUTH.showPassword;
  const input = document.getElementById("loginPassword");
  const btn = document.getElementById("loginPwToggle");
  if (input) input.type = AUTH.showPassword ? "text" : "password";
  if (btn) {
    btn.innerHTML = AUTH.showPassword ? LOGIN_ICON_EYE_OFF : LOGIN_ICON_EYE;
    btn.setAttribute("aria-label", AUTH.showPassword ? "Hide password" : "Show password");
  }
}

function handleLoginFormSubmit() {
  const emailEl = document.getElementById("loginEmail");
  const passwordEl = document.getElementById("loginPassword");
  const rememberEl = document.getElementById("loginRemember");
  if (typeof localStorage !== "undefined") {
    try {
      if (rememberEl && rememberEl.checked && emailEl && emailEl.value) localStorage.setItem("execvault_remember_email", emailEl.value);
      else localStorage.removeItem("execvault_remember_email");
    } catch (e) { /* private-browsing/storage-blocked — remembering email is a convenience, not required */ }
  }
  submitLogin(emailEl ? emailEl.value : "", passwordEl ? passwordEl.value : "");
}

/** Exposed separately from handleLoginFormSubmit so it's directly testable without a DOM. */
async function submitLogin(email, password) {
  AUTH.error = null;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      AUTH.error = body.error || "Invalid email or password.";
      renderAuthGateShell();
      return;
    }
    AUTH.authenticated = true;
    AUTH.checked = true;
    AUTH.user = body.user;
    render();
  } catch (e) {
    AUTH.error = "Unable to reach the Command Centre. Check your connection and try again.";
    renderAuthGateShell();
  }
}

async function signOut() {
  try { await fetch("/api/logout", { method: "POST" }); } catch (e) { /* cookie may already be gone; still reset local state */ }
  AUTH.authenticated = false;
  AUTH.checked = true;
  AUTH.user = null;
  STATE.userMenuOpen = false;
  renderAuthGateShell();
}

/** Real-browser entry point (replaces the old unconditional render() at the bottom of this file). */
async function initApp() {
  if (typeof fetch !== "function") {
    // Non-browser test sandbox (test/loadApp.mjs): no server to check a
    // session against, and every existing test expects the app shell to
    // render directly — see this const's own doc comment above.
    AUTH.authenticated = true;
    AUTH.checked = true;
    render();
    return;
  }
  const appEl = document.getElementById("app");
  if (appEl) appEl.innerHTML = '<div class="auth-loading">Loading Executive Vault…</div>';
  try {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    if (res.ok) {
      const body = await res.json();
      AUTH.authenticated = !!body.authenticated;
      AUTH.user = body.user || null;
    } else {
      AUTH.authenticated = false;
    }
  } catch (e) {
    AUTH.authenticated = false;
    AUTH.error = "Unable to reach the Command Centre.";
  }
  AUTH.checked = true;
  if (AUTH.authenticated) render(); else renderAuthGateShell();
}

function render() {
  if (!AUTH.authenticated) { renderAuthGateShell(); return; }
  const { path, query } = parseHash();
  const content = renderScreen(path, query);
  const currentHash = buildHash(path, query);
  const appEl = document.getElementById("app");
  if (!appEl) return;
  appEl.innerHTML = `
    <div class="shell">
      ${renderSidebar(currentHash)}
      <div class="overlay nav-overlay${STATE.sidebarOpen ? " show" : ""}" onclick="${call("toggleSidebar")}"></div>
      <div class="main">
        ${renderTopbar(query)}
        <div class="content">${content}</div>
      </div>
    </div>
    ${renderDrawer()}
    ${STATE.toast ? `<div class="toast">${STATE.toast.msg}</div>` : ""}
  `;
}

function handleGlobalKeydown(e) {
  const tag = (e.target && e.target.tagName) || "";
  if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
    e.preventDefault && e.preventDefault();
    const el = document.getElementById("globalSearch");
    if (el && el.focus) el.focus();
  } else if (e.key === "Escape") {
    closeDrawer();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", handleGlobalKeydown);
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("hashchange", render);
}
initApp();
