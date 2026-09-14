/* ===========================================================
   VT Worldwide — Conceptual Lark HR Workflow Visualisation
   Prepared for discussion with VT Worldwide. Not an official
   Lark product or interface. Fictional demo data only.
   =========================================================== */

const NAV_ITEMS = [
  { key:'home', label:'Home', icon:'&#8962;' },
  { key:'hr-services', label:'HR Services', icon:'&#128188;' },
  { key:'approvals', label:'Approvals', icon:'&#9989;' },
  { key:'policies', label:'Policies', icon:'&#128220;' },
  { key:'performance', label:'Performance', icon:'&#127919;' },
  { key:'notifications', label:'Notifications', icon:'&#128276;' },
  { key:'my-requests', label:'My Requests', icon:'&#128203;' },
  { key:'hr-admin', label:'HR Administration', icon:'&#9881;' }
];

const STATE = {
  persona: 'EMPLOYEE',
  page: 'home',
  sidebarOpen: false,
  workshopMode: false,
  presentationMode: false,
  notifications: [...VT_DATA.notificationsSeed],
  notifPanelOpen: false,
  rightPanel: null,
  guided: { open:false, pageKey:null, stepIndex:0 },

  ot: { step:'form', form:null, history:[] },
  otx: { step:'employee', history:[] },
  policy: { step:'notify', checked:false, record:null, history:[] },
  leave: { step:'form', form:null, balance: VT_DATA.leave.balance, history:[] },
  medical: { step:'form', form:null, history:[] },
  attendance: { step:'log', form:null, history:[] },
  pm: {
    step:'employee',
    empRating:null, empComments:'', empEvidence:false,
    mgrRating:null, mgrComments:'', mgrObservations:'', mgrDevRec:'',
    calibProposedRating:null, calibComments:'',
    outcomeBranch:null,
    ackRecord:null,
    history:[]
  },
  probation: { outcome:null, history:[] },
  offboarding: { started:false, tasks: JSON.parse(JSON.stringify(VT_DATA.offboarding.tasks)) },
  cvp: {},
  workshop: {},
  workshopNotes: {}
};

// Seed the Performance Management workshop items with SVE's proposed starting
// position (see VT_DATA.pm.workshopItems) — a live-session default, not a
// pre-filled "finding"; every item remains changeable during Workshop Mode.
VT_DATA.pm.workshopItems.forEach(item => { STATE.workshop[item.label] = item.defaultMarker; });

/* ===================== UI CORE ===================== */
const UI = {

  init(){
    UI.renderShell();
    UI.goPage('home');
  },

  toggleSidebar(){
    STATE.sidebarOpen = !STATE.sidebarOpen;
    document.getElementById('sidebar').classList.toggle('open', STATE.sidebarOpen);
  },

  toggleWorkshopMode(){
    STATE.workshopMode = !STATE.workshopMode;
    document.getElementById('appshell').classList.toggle('workshop-mode', STATE.workshopMode);
    document.getElementById('workshopToggleBtn').classList.toggle('active', STATE.workshopMode);
    if (STATE.workshopMode) STATE.page = 'workshop';
    else STATE.page = 'home';
    UI.render();
  },

  togglePresentationMode(){
    STATE.presentationMode = !STATE.presentationMode;
    document.getElementById('appshell').classList.toggle('presentation-mode', STATE.presentationMode);
    document.getElementById('presentationToggleBtn').classList.toggle('active', STATE.presentationMode);
    UI.render();
  },

  toggleNotifPanel(){
    STATE.notifPanelOpen = !STATE.notifPanelOpen;
    UI.renderNotifPanel();
  },

  setPersona(p){
    STATE.persona = p;
    UI.renderShell();
    UI.render();
  },

  goPage(page){
    STATE.page = page;
    STATE.rightPanel = null;
    window.scrollTo({top:0, behavior:'smooth'});
    UI.render();
  },

  render(){
    UI.renderShell();
    const content = document.getElementById('content');
    const html = (STATE.workshopMode && STATE.page !== 'workshop-summary') ? Pages.workshop() : (Pages[STATE.page] ? Pages[STATE.page]() : Pages.home());
    content.innerHTML = `<div class="page-fade">${html}</div>`;
    UI.renderRightPanel();
    const jump = document.getElementById('presJump');
    if (jump && [...jump.options].some(o => o.value === STATE.page)) jump.value = STATE.page;
  },

  renderShell(){
    // nav
    const nav = document.getElementById('mainNav');
    nav.innerHTML = NAV_ITEMS.map(item => `
      <button class="${STATE.page===item.key && !STATE.workshopMode ? 'active':''}" onclick="UI.goPage('${item.key}')">
        <span class="navicon">${item.icon}</span>${item.label}
      </button>`).join('');

    // persona switcher
    const ps = document.getElementById('personaSwitch');
    ps.innerHTML = Object.values(VT_DATA.personas).map(p => `
      <button class="${STATE.persona===p.key?'active':''}" onclick="UI.setPersona('${p.key}')">${p.label}</button>
    `).join('');

    // profile chip
    const persona = VT_DATA.personas[STATE.persona];
    document.getElementById('profileChip').innerHTML = `
      <div class="avatar">${persona.initials}</div>
      <div><span>${persona.name}</span><span class="prole">${persona.role}</span></div>
    `;

    // notif dot
    document.getElementById('notifDot').classList.toggle('hidden', STATE.notifications.length===0);
    UI.renderNotifPanel();
  },

  renderNotifPanel(){
    const panel = document.getElementById('notifPanel');
    panel.classList.toggle('hidden', !STATE.notifPanelOpen);
    panel.innerHTML = `<h4>Notifications</h4>` + (STATE.notifications.length ? STATE.notifications.map(n => `
      <div class="notif-item"><b>${n.title}</b>${n.body}<div style="margin-top:4px"><span>${n.time}</span></div></div>
    `).join('') : `<div class="notif-item"><span>No notifications yet.</span></div>`);
  },

  pushNotification(title, body){
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    STATE.notifications.unshift({title, body, time});
    UI.renderShell();
    UI.toast(body || title, 'success');
  },

  toast(msg, type=''){
    const stack = document.getElementById('toastStack');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(), 300); }, 3200);
  },

  openModal(html){
    document.getElementById('modalBox').innerHTML = `<button class="modal-close" onclick="UI.closeModal()">&times;</button>${html}`;
    document.getElementById('modalOverlay').classList.remove('hidden');
  },
  closeModal(){ document.getElementById('modalOverlay').classList.add('hidden'); },

  openStagePanel(stage){
    STATE.rightPanel = stage;
    UI.renderRightPanel();
  },
  closeRightPanel(){ STATE.rightPanel = null; UI.renderRightPanel(); },

  renderRightPanel(){
    const rp = document.getElementById('rightPanel');
    if (!STATE.rightPanel || STATE.workshopMode) { rp.classList.add('hidden'); rp.innerHTML=''; return; }
    rp.classList.remove('hidden');
    const s = STATE.rightPanel;
    rp.innerHTML = `
      <button class="rp-close" onclick="UI.closeRightPanel()">&times;</button>
      <div class="eyebrow">Workflow Stage</div>
      <h3>${s.label}</h3>
      <div class="divider"></div>
      <div style="font-size:12.5px;display:grid;gap:12px">
        <div><b>Who is responsible?</b><div style="color:var(--muted);margin-top:3px">${s.responsible||'—'}</div></div>
        <div><b>What do they see?</b><div style="color:var(--muted);margin-top:3px">${s.sees||'—'}</div></div>
        <div><b>What action is required?</b><div style="color:var(--muted);margin-top:3px">${s.action||'—'}</div></div>
        <div><b>What is recorded?</b><div style="color:var(--muted);margin-top:3px">${s.recorded||'—'}</div></div>
        <div><b>What happens next?</b><div style="color:var(--muted);margin-top:3px">${s.next||'—'}</div></div>
      </div>
    `;
  }
};

/* ===================== SHARED HELPERS ===================== */
function cardGrid(items){
  return `<div class="grid grid-3">${items.map(c => `
    <div class="tile" onclick="UI.goPage('${c.page}')">
      <div class="tile-icon">${c.icon}</div>
      <h4>${c.label}</h4>
      <p>${c.desc||''}</p>
    </div>`).join('')}</div>`;
}

function pageHead(eyebrow, title, sub, tag){
  return `<div class="page-head">
    <div class="eyebrow">${eyebrow}</div>
    <div class="page-title">${title}</div>
    ${sub ? `<div class="page-sub">${sub}</div>` : ''}
    ${tag ? `<div class="tag-note">${tag}</div>` : ''}
  </div>`;
}

function nowStamp(){
  const d = new Date();
  return { date: d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}), time: d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
}

/* ===================== GUIDED DEMO ===================== */
const GUIDED = {
  scripts: {
    'ot-demo': [
      'Employee submits an overtime claim.',
      'The Department Head verifies that the overtime was required and performed.',
      'Human Resources verifies eligibility, attendance and working-hour controls.',
      'The approved claim becomes a payroll input.',
      'The completed workflow becomes part of the audit record.'
    ],
    'policy-demo': [
      'Employee receives a notification that a new policy requires acknowledgement.',
      'Employee opens and reads the policy.',
      'Employee confirms the acknowledgement statement and submits.',
      'Human Resources monitors acknowledgement completion across all assigned employees.',
      'Outstanding and overdue acknowledgements are followed up by Human Resources.'
    ],
    'performance-demo': [
      'Human Resources launches the performance cycle.',
      'Key Result Areas and Key Performance Indicators are established and aligned.',
      'Employee completes self-assessment.',
      'Manager completes assessment.',
      'Department Head / appropriate reviewer conducts review or calibration.',
      'Human Resources verifies workflow completion and governance requirements.',
      'Final performance outcome is recorded.',
      'Employee reviews and acknowledges the completed evaluation.',
      'Development, follow-up or Performance Improvement Plan workflow may follow where appropriate.'
    ]
  },
  toggleBtn(pageKey, onLabel){
    if (!GUIDED.scripts[pageKey]) return '';
    const isOpen = STATE.guided.open && STATE.guided.pageKey === pageKey;
    return `<button class="btn ${isOpen?'btn-primary':''}" onclick="${isOpen? 'GUIDED.exit()' : `GUIDED.start('${pageKey}')`}">${isOpen ? 'Exit Guided Demo' : (onLabel || 'Guided Demo')}</button>`;
  },
  start(pageKey){
    STATE.guided = { open:true, pageKey, stepIndex:0 };
    UI.render();
  },
  exit(){
    STATE.guided = { open:false, pageKey:null, stepIndex:0 };
    UI.render();
  },
  next(){
    const steps = GUIDED.scripts[STATE.guided.pageKey] || [];
    STATE.guided.stepIndex = Math.min(steps.length - 1, STATE.guided.stepIndex + 1);
    UI.render();
  },
  prev(){
    STATE.guided.stepIndex = Math.max(0, STATE.guided.stepIndex - 1);
    UI.render();
  },
  render(pageKey){
    if (!STATE.guided.open || STATE.guided.pageKey !== pageKey) return '';
    const steps = GUIDED.scripts[pageKey] || [];
    if (!steps.length) return '';
    const i = STATE.guided.stepIndex;
    return `<div class="guided-bar">
      <div class="guided-meta">STEP ${i+1} OF ${steps.length}</div>
      <div class="guided-text">${steps[i]}</div>
      <div class="guided-actions">
        <button class="btn" ${i===0?'disabled':''} onclick="GUIDED.prev()">Previous</button>
        ${i < steps.length-1 ? `<button class="btn btn-primary" onclick="GUIDED.next()">Continue</button>` : `<button class="btn btn-primary" onclick="GUIDED.exit()">Finish</button>`}
        <button class="btn" onclick="GUIDED.exit()">Exit Guided Demo</button>
      </div>
    </div>`;
  }
};

/* ===================== PAGES ===================== */
const Pages = {};

Pages.home = function(){
  const persona = VT_DATA.personas[STATE.persona];
  const qa = VT_DATA.quickAccess[STATE.persona];
  return `
    ${pageHead('VT Worldwide', 'HR Workflow Implementation on Lark', 'From HR Policy &rarr; Digital Workflow &rarr; Approval &rarr; Record', 'Conceptual Lark Workflow Visualisation &ndash; Prepared for VT Worldwide')}

    <div class="demo-cta">
      <div>
        <h3>Start with the Overtime workflow</h3>
        <p>The most complete end-to-end demonstration: employee submission &rarr; manager approval &rarr; HR verification &rarr; payroll &rarr; completed record.</p>
      </div>
      <button class="btn btn-primary btn-lg" onclick="OT.reset(); UI.goPage('ot-demo')">Start OT Demo</button>
    </div>

    <div class="card">
      <h3>You are viewing as: ${persona.label} &mdash; ${persona.name}</h3>
      <p style="color:var(--muted);font-size:12.5px;margin:0 0 12px">Quick access for this role. Switch persona above to see what each person sees in Lark.</p>
      <div class="grid grid-4">
        ${qa.map(c => `<div class="tile" onclick="UI.goPage('${c.page}')"><div class="tile-icon">${c.icon}</div><h4>${c.label}</h4></div>`).join('')}
      </div>
    </div>

    <h3 style="margin:22px 0 12px">Principal HR Workflow Areas</h3>
    <p style="color:var(--muted);font-size:12.5px;margin:-6px 0 14px">The major workflow groups being configured in Lark. Performance Management is shown here as a principal workflow area &mdash; click any item to open its workflow.</p>
    <div class="principal-grid">
      ${VT_DATA.principalWorkflow.map(col => `
        <div class="principal-col">
          <h4>${col.title}</h4>
          ${col.items.map(it => `<button class="principal-item" onclick="UI.goPage('${it.page}')">${it.label}</button>`).join('')}
        </div>`).join('')}
    </div>

    <h3 style="margin:22px 0 12px">Employee Workspace</h3>
    <p style="color:var(--muted);font-size:12.5px;margin:-6px 0 14px">This is what an employee could see when opening HR Services in Lark.</p>
    ${cardGrid(VT_DATA.employeeCards)}

    <h3 style="margin:26px 0 12px">Client Presentation Views</h3>
    <div class="grid grid-3">
      <div class="tile" onclick="UI.goPage('live-workflow')"><div class="tile-icon">&#128225;</div><h4>Live Workflow</h4><p>The cleanest high-level view of an active request, moving in real time.</p></div>
      <div class="tile" onclick="UI.goPage('policy-to-lark')"><div class="tile-icon">&#128279;</div><h4>Policy &rarr; Lark Workflow</h4><p>How an HR policy translates into a configured Lark workflow.</p></div>
      <div class="tile" onclick="UI.goPage('current-vs-proposed')"><div class="tile-icon">&#9878;</div><h4>Current vs Proposed</h4><p>Mark items during the onsite working session.</p></div>
      <div class="tile" onclick="UI.toggleWorkshopMode()"><div class="tile-icon">&#128221;</div><h4>Workshop Mode</h4><p>Simplified board for live discussion &mdash; not saved.</p></div>
      <div class="tile" onclick="UI.goPage('workshop-summary')"><div class="tile-icon">&#128203;</div><h4>Workshop Summary</h4><p>Auto-summarised markers from the Workshop Mode session.</p></div>
      <div class="tile" onclick="UI.togglePresentationMode()"><div class="tile-icon">&#128250;</div><h4>Presentation Mode</h4><p>Meeting-room view: only the essentials, larger proportions.</p></div>
    </div>
  `;
};

Pages['hr-services'] = function(){
  const items = VT_DATA.employeeCards.filter(c => ['leave-demo','ot-demo','attendance-demo','medical-demo','claims-info'].includes(c.page));
  return `
    ${pageHead('HR Services', 'HR Services', 'Employee self-service: submit requests that route through the configured Lark approval workflow.')}
    ${cardGrid(items)}
  `;
};

Pages['claims-info'] = function(){
  return `
    ${pageHead('HR Services', 'Claims', 'Illustrative only &mdash; claims workflow is not part of this working session\'s priority demos.')}
    <div class="card"><p style="color:var(--muted)">Expense / reimbursement claims would follow the same submission &rarr; manager verification &rarr; HR/Finance verification pattern shown in the Overtime and Medical Leave demonstrations. Not built out in this prototype.</p>
    <div class="btnrow"><button class="btn" onclick="UI.goPage('home')">Back to Home</button></div></div>
  `;
};

Pages.approvals = function(){
  const p = STATE.persona;
  let body = '';
  if (p === 'EMPLOYEE') {
    body = `<div class="card"><p style="color:var(--muted)">Approvals are visible to Manager, HR and Management roles. As an employee, track the status of what you've submitted under <b>My Requests</b>.</p>
      <div class="btnrow"><button class="btn btn-primary" onclick="UI.goPage('my-requests')">Go to My Requests</button></div></div>`;
  } else if (p === 'MANAGER') {
    body = `<div class="card"><h3>Pending Approvals</h3>${approvalRow('Overtime Claim', VT_DATA.ot.employee, STATE.ot.step==='managerReview', 'ot-demo')}
      ${approvalRow('Leave Application', VT_DATA.ot.employee, STATE.leave.step==='managerReview', 'leave-demo')}
      ${approvalRow('Attendance Correction', VT_DATA.ot.employee, STATE.attendance.step==='managerVerify', 'attendance-demo')}
      ${approvalRow('Probation Review', VT_DATA.probation.employee, !STATE.probation.outcome, 'probation-demo')}
      <div class="riskrow" style="padding:10px 0;color:var(--muted);font-size:12px">Additional filler items for illustration &mdash; not interactive: Leave Request &middot; Ben Koh, OT Claim &middot; Grace Yap.</div>
      </div>`;
  } else if (p === 'HR') {
    body = `<div class="card"><h3>HR Approval Queue</h3>${approvalRow('Overtime Verification', VT_DATA.ot.employee, STATE.ot.step==='hrReview', 'ot-demo')}
      ${approvalRow('Medical Leave Verification', VT_DATA.ot.employee, STATE.medical.step==='submitted', 'medical-demo')}
      ${approvalRow('Attendance Review', VT_DATA.ot.employee, STATE.attendance.step==='hrReview', 'attendance-demo')}
      </div>
      <div class="card"><h3>Exceptions</h3><p style="color:var(--muted);font-size:12.5px">Overtime claims submitted outside the standard 7-day window are routed here for exception review.</p>
      <div class="btnrow"><button class="btn btn-primary" onclick="OTX.reset(); UI.goPage('ot-exception')">Open OT Exception Queue</button></div></div>`;
  } else {
    body = `<div class="card"><h3>Escalated Approvals</h3><p style="color:var(--muted);font-size:12.5px">Items requiring Management sign-off &mdash; e.g. OT exceptions escalated by HR, or a Performance Improvement Plan outcome from a probation review.</p>
      ${approvalRow('OT Exception (Escalated)', VT_DATA.ot.employee, STATE.otx.step==='management', 'ot-exception')}
      </div>
      <div class="card"><h3>Exceptions</h3><p style="color:var(--muted);font-size:12.5px">Management holds final sign-off where HR's exception review determines Management approval is required.</p></div>`;
  }
  return `${pageHead('Approvals', p==='MANAGEMENT'?'Escalated Approvals':(p==='HR'?'HR Approval Queue':'Approvals'), 'What ' + VT_DATA.personas[p].label + ' sees in the approval workflow.')}${body}`;
};

function approvalRow(title, who, pending, page){
  return `<div class="attendance-row" style="cursor:pointer" onclick="UI.goPage('${page}')">
    <div><b style="font-size:13px">${title}</b><div style="font-size:11.5px;color:var(--muted)">${who}</div></div>
    ${pending ? '<span class="badge badge-amber">Pending Action</span>' : '<span class="badge badge-grey">No item pending</span>'}
  </div>`;
}

Pages.policies = function(){
  const status = STATE.policy.step === 'acknowledged' ? 'Acknowledged' : 'Requires Acknowledgement';
  return `
    ${pageHead('Policies', 'Policies', 'Company policies published in Lark. Employees are notified and must digitally acknowledge each version.')}
    <div class="card">
      <div class="attendance-row">
        <div><b>${VT_DATA.policy.name}</b><div style="font-size:11.5px;color:var(--muted)">Version ${VT_DATA.policy.version} &middot; Effective ${VT_DATA.policy.effective}</div></div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="badge ${status==='Acknowledged'?'badge-green':'badge-amber'}">${status}</span>
          <button class="btn btn-primary" onclick="UI.goPage('policy-demo')">${status==='Acknowledged'?'View':'Open'}</button>
        </div>
      </div>
      <div class="attendance-row"><div><b>Leave &amp; Attendance Policy</b><div style="font-size:11.5px;color:var(--muted)">Draft &mdash; not yet published</div></div><span class="badge badge-grey">Draft</span></div>
      <div class="attendance-row"><div><b>Anti-Harassment Policy</b><div style="font-size:11.5px;color:var(--muted)">Draft &mdash; not yet published</div></div><span class="badge badge-grey">Draft</span></div>
    </div>
    ${STATE.persona==='HR' ? `<div class="card"><h3>HR Policy Monitor</h3><p style="color:var(--muted);font-size:12.5px">Track acknowledgement completion across all assigned employees.</p><div class="btnrow"><button class="btn btn-primary" onclick="UI.setPersona('HR'); UI.goPage('policy-demo')">Open Policy Monitor</button></div></div>` : ''}
  `;
};

Pages.performance = function(){
  return `
    ${pageHead('Performance', 'Performance', 'Performance workflows for the current review cycle.', 'Proposed Future-State Workflow &mdash; Subject to VT Worldwide Confirmation')}
    <div class="grid grid-2">
      <div class="tile" onclick="UI.goPage('performance-demo')"><div class="tile-icon">&#127919;</div><h4>Performance Management</h4><p>Cycle setup &rarr; KRA/KPI &rarr; Self-assessment &rarr; Manager &rarr; Calibration &rarr; HR &rarr; Final outcome &rarr; Acknowledgement.</p></div>
      <div class="tile" onclick="UI.goPage('probation-demo')"><div class="tile-icon">&#128197;</div><h4>Probation Review</h4><p>Confirm, extend or initiate a Performance Improvement Plan.</p></div>
    </div>
    ${(STATE.persona==='HR' || STATE.persona==='MANAGEMENT') ? PM.dashboard() : ''}
  `;
};

Pages.notifications = function(){
  return `
    ${pageHead('Notifications', 'Notifications', 'Full notification log generated by workflow actions across this demo session.')}
    <div class="card">
      ${STATE.notifications.length ? STATE.notifications.map(n => `<div class="attendance-row"><div><b style="font-size:13px">${n.title}</b><div style="font-size:11.5px;color:var(--muted);margin-top:2px">${n.body}</div></div><span style="font-size:11px;color:var(--muted)">${n.time}</span></div>`).join('') : '<p style="color:var(--muted)">No notifications yet &mdash; try running one of the demos.</p>'}
    </div>
  `;
};

Pages['my-requests'] = function(){
  const rows = [
    { name:'Overtime Claim', page:'ot-demo', status: otStatusLabel() },
    { name:'Leave Application', page:'leave-demo', status: leaveStatusLabel() },
    { name:'Medical Leave', page:'medical-demo', status: medicalStatusLabel() },
    { name:'Attendance Correction', page:'attendance-demo', status: attendanceStatusLabel() },
    { name:'Policy Acknowledgement', page:'policy-demo', status: STATE.policy.step==='acknowledged' ? 'Acknowledged' : 'Outstanding' }
  ];
  return `
    ${pageHead('My Requests', 'My Requests', 'Everything ' + VT_DATA.personas.EMPLOYEE.name + ' has submitted, and its current status.')}
    <div class="card"><table class="table"><thead><tr><th>Request</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr class="clickable" onclick="UI.goPage('${r.page}')"><td>${r.name}</td><td>${statusBadge(r.status)}</td><td style="text-align:right"><span class="btn-ghost" style="font-size:12px">Open &rarr;</span></td></tr>`).join('')}
    </tbody></table></div>
  `;
};

function statusBadge(status){
  // Order matters: more specific phrases must be checked before the shorter
  // substrings they contain (e.g. "Opened – Not Acknowledged" before "Acknowledged").
  const map = [
    ['Opened – Not Acknowledged','badge-amber'],
    ['Not Opened','badge-grey'],
    ['Overdue','badge-red'],
    ['Rejected','badge-red'],
    ['Returned for Amendment','badge-red'],
    ['Completed','badge-green'],
    ['Acknowledged','badge-green'],
    ['Not Started','badge-grey'],
    ['Outstanding','badge-amber'],
    ['Pending Manager Approval','badge-amber'],
    ['Pending HR Verification','badge-amber'],
    ['Escalated to Management','badge-red']
  ];
  const hit = map.find(([k]) => status.includes(k));
  return `<span class="badge ${hit?hit[1]:'badge-grey'}">${status}</span>`;
}
function otStatusLabel(){
  return { form:'Not Started', pendingManager:'Pending Manager Approval', managerReview:'Pending Manager Approval', sentToHR:'Pending HR Verification', hrReview:'Pending HR Verification', returned:'Returned for Amendment', rejected:'Rejected', escalated:'Escalated to Management', completed:'Completed' }[STATE.ot.step] || 'Not Started';
}
function leaveStatusLabel(){
  return { form:'Not Started', pendingManager:'Pending Manager Approval', managerReview:'Pending Manager Approval', approved:'Completed' }[STATE.leave.step] || 'Not Started';
}
function medicalStatusLabel(){
  return { form:'Not Started', submitted:'Pending HR Verification', verified:'Completed' }[STATE.medical.step] || 'Not Started';
}
function attendanceStatusLabel(){
  return { log:'Not Started', reportForm:'Not Started', managerVerify:'Pending Manager Verification', hrReview:'Pending HR Review', updated:'Completed' }[STATE.attendance.step] || 'Not Started';
}

Pages['hr-admin'] = function(){
  return `
    ${pageHead('HR Administration', 'HR Administration', 'Employee records and HR control overview.')}
    <div class="grid grid-4">
      <div class="stat-tile"><div class="num">68</div><div class="lbl">Active Employees</div></div>
      <div class="stat-tile"><div class="num">${STATE.offboarding.started ? 1 : 0}</div><div class="lbl">Offboarding In Progress</div></div>
      <div class="stat-tile"><div class="num">1</div><div class="lbl">Probation Reviews Due</div></div>
      <div class="stat-tile"><div class="num">${STATE.otx.step!=='employee' && STATE.otx.step!=='reason' ? 1 : 0}</div><div class="lbl">OT Exceptions In Review</div></div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Employee Records (sample)</h3>
      <table class="table"><thead><tr><th>Employee</th><th>Department</th><th>Status</th></tr></thead><tbody>
        <tr><td>Alex Tan</td><td>Operations</td><td><span class="badge badge-green">Active</span></td></tr>
        <tr><td>Sarah Lim</td><td>Finance</td><td><span class="badge badge-green">Active</span></td></tr>
        <tr><td>Jordan Lim</td><td>Marketing</td><td><span class="badge badge-amber">Probation</span></td></tr>
        <tr><td>Farah Ismail</td><td>Customer Success</td><td><span class="badge badge-red">Offboarding</span></td></tr>
        <tr><td>David Chan</td><td>Operations</td><td><span class="badge badge-green">Active</span></td></tr>
      </tbody></table>
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <div class="tile" onclick="UI.setPersona('HR'); UI.goPage('policy-demo')"><div class="tile-icon">&#128220;</div><h4>Policy Acknowledgement Monitor</h4><p>Track outstanding and overdue policy acknowledgements.</p></div>
      <div class="tile" onclick="UI.goPage('offboarding-demo')"><div class="tile-icon">&#128682;</div><h4>Offboarding</h4><p>Manage the current offboarding case for Farah Ismail.</p></div>
    </div>
  `;
};

/* =========================================================
   DEMO 1 — OVERTIME (the most complete demonstration)
   ========================================================= */
const OT = {
  reset(){ STATE.ot = { step:'form', form:null, history:[] }; },

  stages(){
    const step = STATE.ot.step;
    const s = (key,label,doneIf,activeIf,exceptionIf,statusLabel,detail) => ({
      key,label,
      status: exceptionIf ? 'exception' : (doneIf ? 'done' : (activeIf ? 'active' : 'pending')),
      statusLabel,
      ...detail
    });
    return [
      s('employee','Employee', step!=='form', step==='form', false,
        step==='form' ? 'Drafting&hellip;' : '&#10003; Submitted', {
        responsible:'Employee (Alex Tan)', sees:'Submit OT Claim form in HR Services.',
        action:'Complete OT date, hours, reason and supporting document, then submit.',
        recorded:'OT claim draft with employee, department, date/time and reason.',
        next:'Claim moves to the employee\'s Manager / HOD for approval.'
      }),
      s('manager','Manager/HOD', ['sentToHR','hrReview','hrReturned','escalated','completed'].includes(step), ['pendingManager','managerReview'].includes(step), step==='returned'||step==='rejected',
        step==='returned' ? '! Returned' : (step==='rejected' ? '! Rejected' : (['pendingManager','managerReview'].includes(step) ? '&#9679; Pending Approval' : (step==='form' ? '&#9675; Waiting' : '&#10003; Approved'))), {
        responsible:'Manager / HOD (Priya Nair)', sees:'Pending approval card with attendance record, submitted hours, reason and evidence.',
        action:'Approve, return for amendment, or reject the claim.',
        recorded:'Manager decision, timestamp and any comments.',
        next: step==='returned' ? 'Returned to employee for amendment.' : (step==='rejected' ? 'Claim closed as rejected.' : 'Approved claim moves to Human Resources for verification.')
      }),
      s('hr','Human Resources', step==='completed', ['sentToHR','hrReview'].includes(step), step==='hrReturned'||step==='escalated',
        step==='hrReturned' ? '! Returned' : (step==='escalated' ? '! Escalated' : (['sentToHR','hrReview'].includes(step) ? '&#9679; Verification Required' : (step==='completed' ? '&#10003; Verified' : '&#9675; Waiting'))), {
        responsible:'Human Resources (Michelle Goh)', sees:'OT Verification checklist: eligibility, manager approval, attendance reconciliation, working hours, duplicate check, monthly accumulation.',
        action:'Verify & approve, return to manager, or escalate to Management.',
        recorded:'Verification checklist outcome and HR decision.',
        next: step==='escalated' ? 'Escalated to Management for review.' : 'Verified claim is sent to Payroll for processing.'
      }),
      s('payroll','Payroll', step==='completed', false, false,
        step==='completed' ? '&#10003; Processed' : '&#9675; Waiting', {
        responsible:'Payroll (system-triggered)', sees:'Verified OT claim ready for processing.',
        action:'No manual action in this concept &mdash; claim is queued automatically once HR verifies.',
        recorded:'Approved OT hours applied to the next payroll cycle.',
        next:'Workflow marked Completed with a full audit record.'
      }),
      s('completed','Completed', step==='completed', false, false,
        step==='completed' ? '&#10003; Completed' : '&#9675; Waiting', {
        responsible:'System', sees:'Completed workflow record.',
        action:'No further action required.',
        recorded:'Full audit trail: submission, approval, verification and payroll processing, each with timestamp and actor.',
        next:'Record is retained for audit and reporting.'
      })
    ];
  },

  form(f){
    if (f) STATE.ot.form = f;
    const el = id => document.getElementById(id).value;
    const start = el('otStart'), end = el('otEnd'), brk = parseFloat(el('otBreak')||'0');
    let hours = '';
    if (start && end) {
      const [sh,sm] = start.split(':').map(Number), [eh,em] = end.split(':').map(Number);
      let mins = (eh*60+em) - (sh*60+sm) - (brk*60);
      if (mins < 0) mins += 24*60;
      hours = (mins/60).toFixed(1);
    }
    document.getElementById('otHours').value = hours;
  },

  submit(){
    const val = id => document.getElementById(id).value;
    if (!val('otDate') || !val('otStart') || !val('otEnd') || !val('otReason')) {
      UI.toast('Please complete OT date, start/end time and reason before submitting.', 'warn');
      return;
    }
    STATE.ot.form = {
      date: val('otDate'), start: val('otStart'), end: val('otEnd'), brk: val('otBreak'),
      hours: val('otHours'), reason: val('otReason'), project: val('otProject'),
      doc: document.getElementById('otDocName').textContent.replace('Attached: ','') || null
    };
    STATE.ot.step = 'pendingManager';
    historyPush(STATE.ot.history, { stageKey:'employee', actor: VT_DATA.ot.employee, action:'Submitted overtime claim (' + STATE.ot.form.hours + ' hours, ' + STATE.ot.form.date + ').' });
    UI.pushNotification('Your overtime claim has been submitted.', 'Pending Manager Approval &middot; ' + VT_DATA.ot.employee);
    UI.render();
  },

  managerDecision(decision){
    const actor = VT_DATA.personas.MANAGER.name;
    if (decision==='approve') {
      STATE.ot.step = 'sentToHR';
      historyPush(STATE.ot.history, { stageKey:'manager', actor, action:'Approved the overtime claim.' });
      UI.pushNotification('Manager approved the overtime claim.', 'Sent to Human Resources for verification.');
    } else if (decision==='return') {
      STATE.ot.step = 'returned';
      historyPush(STATE.ot.history, { stageKey:'manager', actor, action:'Returned the claim for amendment.' });
      UI.pushNotification('Overtime claim returned for amendment.', 'Manager requested more information.');
    } else {
      STATE.ot.step = 'rejected';
      historyPush(STATE.ot.history, { stageKey:'manager', actor, action:'Rejected the overtime claim.' });
      UI.pushNotification('Overtime claim rejected.', 'Manager did not approve this claim.');
    }
    UI.render();
  },

  hrDecision(decision){
    const actor = VT_DATA.personas.HR.name;
    if (decision==='approve') {
      STATE.ot.step = 'completed';
      historyPush(STATE.ot.history, { stageKey:'hr', actor, action:'Verified eligibility, attendance and hours &mdash; approved.' });
      historyPush(STATE.ot.history, { stageKey:'payroll', actor:'System', action:'Approved claim queued for payroll processing.' });
      historyPush(STATE.ot.history, { stageKey:'completed', actor:'System', action:'Workflow completed and recorded for audit.' });
      UI.pushNotification('HR verified the overtime claim.', 'Sent to Payroll &middot; workflow completed.');
    } else if (decision==='return') {
      STATE.ot.step = 'hrReturned';
      historyPush(STATE.ot.history, { stageKey:'hr', actor, action:'Returned the claim to the Manager for clarification.' });
      UI.pushNotification('Overtime claim returned by HR.', 'Returned to Manager for clarification.');
    } else {
      STATE.ot.step = 'escalated';
      historyPush(STATE.ot.history, { stageKey:'hr', actor, action:'Escalated the claim to Management for review.' });
      UI.pushNotification('Overtime claim escalated to Management.', 'HR flagged this claim for Management review.');
    }
    UI.render();
  },

  render(){
    const step = STATE.ot.step;
    let body = '';

    if (step === 'form') {
      body = `
      <div class="card">
        <h3>HR Services &rarr; Overtime &rarr; Submit OT Claim</h3>
        <div class="formgrid">
          <div class="field"><label>Employee</label><input value="${VT_DATA.ot.employee}" disabled></div>
          <div class="field"><label>Department</label><input value="${VT_DATA.ot.department}" disabled></div>
          <div class="field"><label>OT Date</label><input type="date" id="otDate" value="2026-09-10"></div>
          <div class="field"><label>Start Time</label><input type="time" id="otStart" value="18:00" onchange="OT.form()"></div>
          <div class="field"><label>End Time</label><input type="time" id="otEnd" value="21:00" onchange="OT.form()"></div>
          <div class="field"><label>Break (hours)</label><input type="number" step="0.5" id="otBreak" value="0.5" onchange="OT.form()"></div>
          <div class="field"><label>Total Hours</label><input id="otHours" value="3.0" disabled></div>
          <div class="field"><label>Project / Assignment</label><input id="otProject" value="Month-End Operations Closing"></div>
          <div class="field full"><label>Reason for OT</label><textarea id="otReason">${VT_DATA.ot.normal.reason}</textarea></div>
          <div class="field full"><label>Supporting Document</label>
            <div style="display:flex;gap:10px;align-items:center">
              <button type="button" class="btn" onclick="document.getElementById('otDocName').textContent='Attached: OT-Approval-Email-Sep2026.pdf'; UI.toast('File attached (simulated).')">Attach File</button>
              <span id="otDocName" class="hint">No file attached</span>
            </div>
          </div>
        </div>
        <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="OT.submit()">Submit</button></div>
      </div>`;
    } else if (step === 'pendingManager') {
      body = transferCard(
        'Request submitted successfully.',
        VT_DATA.ot.employee + ' (Employee)', 'Manager / HOD',
        "UI.setPersona('MANAGER'); STATE.ot.step='managerReview'; UI.render()"
      );
    } else if (step === 'managerReview') {
      body = `
      <div class="card">
        <div class="badge badge-amber" style="margin-bottom:10px">Pending Approval</div>
        <div class="formgrid">
          <div><b>Employee:</b> ${VT_DATA.ot.employee}</div>
          <div><b>Request:</b> Overtime Claim</div>
          <div><b>OT Date:</b> ${STATE.ot.form.date}</div>
          <div><b>Hours:</b> ${STATE.ot.form.hours}</div>
          <div class="full"><b>Reason:</b> ${STATE.ot.form.reason}</div>
        </div>
        <div class="divider"></div>
        <div class="grid grid-3">
          <div class="doc-chip">&#128203; Attendance Record: Clocked 17:58&ndash;21:04</div>
          <div class="doc-chip">&#9203; Submitted Hours: ${STATE.ot.form.hours}</div>
          <div class="doc-chip">&#128196; ${STATE.ot.form.doc || 'No document attached'}</div>
        </div>
        <div class="btnrow">
          <button class="btn btn-success" onclick="OT.managerDecision('approve')">Approve</button>
          <button class="btn" onclick="OT.managerDecision('return')">Return for Amendment</button>
          <button class="btn btn-danger" onclick="OT.managerDecision('reject')">Reject</button>
        </div>
      </div>`;
    } else if (step === 'sentToHR') {
      body = transferCard(
        'Manager approved the claim.',
        'Manager / HOD', 'Human Resources',
        "UI.setPersona('HR'); STATE.ot.step='hrReview'; UI.render()"
      );
    } else if (step === 'hrReview') {
      body = `
      <div class="card">
        <h3>OT Verification</h3>
        <div class="checklist">${VT_DATA.ot.checklist.map(c => `<div class="checkrow">&#10003; ${c}</div>`).join('')}</div>
        <div class="btnrow">
          <button class="btn btn-success" onclick="OT.hrDecision('approve')">Verify &amp; Approve</button>
          <button class="btn" onclick="OT.hrDecision('return')">Return</button>
          <button class="btn btn-danger" onclick="OT.hrDecision('escalate')">Escalate</button>
        </div>
      </div>`;
    } else if (step === 'returned' || step === 'hrReturned' || step === 'rejected' || step === 'escalated') {
      const map = {
        returned: {title:'Returned for Amendment', desc:'The manager requested more information before approving.', cls:'badge-amber', btn:'Edit &amp; Resubmit', to:'form'},
        hrReturned: {title:'Returned by HR', desc:'HR requested clarification before verifying.', cls:'badge-amber', btn:'Back to Manager Review', to:'managerReview'},
        rejected: {title:'Rejected', desc:'The manager did not approve this claim.', cls:'badge-red', btn:'Restart Demo', to:'form'},
        escalated: {title:'Escalated to Management', desc:'HR flagged this claim for Management review before proceeding.', cls:'badge-red', btn:'Restart Demo', to:'form'}
      }[step];
      body = `
      <div class="card">
        <div class="badge ${map.cls}" style="margin-bottom:10px">${map.title}</div>
        <p style="color:var(--muted);font-size:12.5px">${map.desc}</p>
        <div class="btnrow"><button class="btn btn-primary" onclick="STATE.ot.step='${map.to}'; UI.render()">${map.btn}</button></div>
      </div>`;
    } else if (step === 'completed') {
      body = `
      <div class="card">
        <div class="badge badge-green" style="margin-bottom:10px">Completed</div>
        <h3>Overtime claim workflow complete</h3>
        <div class="grid grid-4" style="margin-top:14px">
          <div class="stat-tile"><div class="num">&#10003;</div><div class="lbl">Employee</div></div>
          <div class="stat-tile"><div class="num">&#10003;</div><div class="lbl">Manager/HOD</div></div>
          <div class="stat-tile"><div class="num">&#10003;</div><div class="lbl">Human Resources</div></div>
          <div class="stat-tile"><div class="num">&#10003;</div><div class="lbl">Payroll</div></div>
        </div>
        <div class="btnrow"><button class="btn btn-primary" onclick="OT.reset(); UI.setPersona('EMPLOYEE'); UI.render()">Restart OT Demo</button></div>
      </div>`;
    }

    return `
      <div class="page-head-row">
        ${pageHead('HR Services &middot; Overtime', 'Overtime Claim Workflow', 'Employee submission &rarr; Manager/HOD approval &rarr; HR verification &rarr; Payroll &rarr; Completed record.')}
        <div class="page-head-actions">${GUIDED.toggleBtn('ot-demo')} <button class="btn btn-ghost" onclick="UI.goPage('live-workflow')">View in Live Workflow &rarr;</button></div>
      </div>
      ${GUIDED.render('ot-demo')}
      ${WF.block('ot', OT.stages())}
      ${body}
      ${renderHistory(STATE.ot.history)}
      ${policyControlPanel([
        { k:'Governing Rule', v:'Employees must submit overtime claims within the applicable submission period.' },
        { k:'Operational Rule', v:'Current VT Lark practice indicates a seven-day submission window, subject to onsite validation.' },
        { k:'System Control', v:'Lark submission validation against the configured window.' },
        { k:'Exception Control', v:'Late submissions are routed for Manager, HR and (where required) Management review rather than an automatic block.' },
        { k:'Record', v:'Approval and verification audit trail retained for every claim.' }
      ])}
      ${advisoryNote('Final submission-window configuration should be confirmed against VT Worldwide\'s live Lark environment.')}
      <div class="card">
        <h3>Exception Handling</h3>
        <p style="color:var(--muted);font-size:12.5px;margin-bottom:10px">VT currently operates a seven-day Lark OT submission window. See how a late submission is proposed to be handled &mdash; not simply rejected.</p>
        <button class="btn" onclick="OTX.reset(); UI.goPage('ot-exception')">Show Late Submission Example</button>
      </div>
    `;
  }
};
Pages['ot-demo'] = () => OT.render();

/* =========================================================
   OT SEVEN-DAY EXCEPTION DEMO
   ========================================================= */
const OTX = {
  reset(){ STATE.otx = { step:'employee', reason:'', history:[] }; },

  standardStages(){
    return [
      { key:'std-emp', label:'Employee', status:'pending', statusLabel:'Submits within 7 days', responsible:'Employee', sees:'Standard OT submission form.', action:'Submit within the 7-day window.', recorded:'OT claim.', next:'Manager approval.' },
      { key:'std-mgr', label:'Manager', status:'pending', statusLabel:'Approves', responsible:'Manager / HOD', sees:'Standard approval queue.', action:'Approve, return or reject.', recorded:'Manager decision.', next:'HR verification.' },
      { key:'std-hr', label:'Human Resources', status:'pending', statusLabel:'Verifies', responsible:'Human Resources', sees:'Standard verification checklist.', action:'Verify & approve.', recorded:'HR decision.', next:'Payroll.' },
      { key:'std-pay', label:'Payroll', status:'pending', statusLabel:'Processes', responsible:'Payroll', sees:'Approved claim.', action:'Process automatically.', recorded:'Payroll input.', next:'Completed.' }
    ];
  },

  stages(){
    const step = STATE.otx.step;
    const idx = ['employee','reason','managerReview','hrReview','management','completed'].indexOf(step);
    const labels = {
      employee:{done:'&#10003; Flagged',active:'&#9679; Flagged'}, reason:{done:'&#10003; Reason Given',active:'&#9679; Awaiting Reason'},
      manager:{done:'&#10003; Endorsed',active:'&#9679; Under Review'}, hr:{done:'&#10003; Exception Approved',active:'&#9679; Exception Review'},
      management:{done:'&#10003; Approved',active:'&#9679; Awaiting Sign-off'}, completed:{done:'&#10003; Completed',active:'&#9679; Completing'}
    };
    const s = (key,label,at,detail) => {
      const status = idx>at ? 'done' : (idx===at ? 'exception' : 'pending');
      const lab = labels[key] || {};
      return { key, label, status, statusLabel: status==='done' ? lab.done : (status==='exception' ? lab.active : '&#9675; Waiting'), ...detail };
    };
    return [
      s('employee','Employee',0,{responsible:'Employee (Alex Tan)', sees:'Attempted OT submission flagged as outside the standard window.', action:'Acknowledge the exception and provide a reason.', recorded:'Original OT date and actual submission date.', next:'Employee provides a late submission reason.'}),
      s('reason','Late Submission Reason',1,{responsible:'Employee', sees:'A reason field specific to late submissions.', action:'Explain why the claim was not submitted within 7 days.', recorded:'Late submission justification, timestamped.', next:'Sent to Manager for review.'}),
      s('manager','Manager Review',2,{responsible:'Manager / HOD', sees:'The claim, the reason for lateness, and the number of days late.', action:'Decide whether to endorse the exception for HR review.', recorded:'Manager endorsement decision.', next:'Endorsed claims move to HR Exception Review.'}),
      s('hr','HR Exception Review',3,{responsible:'Human Resources', sees:'Exception checklist &mdash; justification, pattern of late claims, threshold for Management approval.', action:'Approve the exception directly, or route to Management if required by policy.', recorded:'HR exception decision and rationale.', next:'Either completed, or sent to Management for final approval.'}),
      s('management','Management Approval (where required)',4,{responsible:'Management', sees:'Exception case escalated by HR.', action:'Give final sign-off on the exception.', recorded:'Management decision.', next:'Workflow completed with full audit trail.'}),
      s('completed','Completed',5,{responsible:'System', sees:'Completed exception record.', action:'No further action.', recorded:'Full audit trail of the exception route.', next:'Retained for audit and policy review.'})
    ];
  },

  render(){
    const step = STATE.otx.step;
    const ex = VT_DATA.ot.exception;
    let body = '';

    if (step === 'employee') {
      body = `
        <div class="exception-banner">
          <div class="ic">&#9888;</div>
          <div><b>OUTSIDE STANDARD SUBMISSION WINDOW</b><p>This overtime entry falls outside the standard seven-day submission window.</p></div>
        </div>
        <div class="card">
          <div class="formgrid">
            <div><b>Employee:</b> ${VT_DATA.ot.employee}</div>
            <div><b>OT Date:</b> ${ex.date}</div>
            <div><b>Attempted Submission Date:</b> ${ex.submittedOn}</div>
            <div><b>Standard Window:</b> ${ex.windowDays} days</div>
          </div>
          <p style="color:var(--muted);font-size:12.5px;margin-top:10px">This is not simply rejected. VT and SVE can configure a proposed exception route so genuine cases are still reviewed.</p>
          <div class="btnrow"><button class="btn btn-primary" onclick="STATE.otx.step='reason'; UI.render()">Provide Late Submission Reason</button></div>
        </div>`;
    } else if (step === 'reason') {
      body = `
        <div class="card">
          <h3>Late Submission Reason</h3>
          <div class="field"><label>Reason</label><textarea id="otxReason">${ex.reason}</textarea></div>
          <div class="btnrow"><button class="btn btn-primary" onclick="STATE.otx.reason=document.getElementById('otxReason').value; STATE.otx.step='managerReview'; historyPush(STATE.otx.history,{stageKey:'reason',actor:VT_DATA.ot.employee,action:'Provided late submission reason.',comment:STATE.otx.reason}); UI.pushNotification('Late OT submission sent for Manager review.','Exception route started.'); UI.render()">Submit for Manager Review</button></div>
        </div>`;
    } else if (step === 'managerReview') {
      body = transferCard(
        'Late submission reason recorded.',
        'Employee', 'Manager / HOD',
        "UI.setPersona('MANAGER'); UI.render()"
      );
      if (STATE.persona === 'MANAGER') {
        body = `
        <div class="card">
          <div class="badge badge-amber" style="margin-bottom:10px">Late Submission &mdash; Manager Review</div>
          <p><b>OT Date:</b> ${ex.date} &middot; <b>Submitted:</b> ${ex.submittedOn}</p>
          <p style="color:var(--muted);font-size:12.5px"><b>Employee reason:</b> ${STATE.otx.reason}</p>
          <div class="btnrow">
            <button class="btn btn-primary" onclick="UI.setPersona('MANAGER'); STATE.otx.step='hrReview'; historyPush(STATE.otx.history,{stageKey:'manager',actor:VT_DATA.personas.MANAGER.name,action:'Endorsed the late claim for HR Exception Review.'}); UI.pushNotification('Manager endorsed the late OT claim.','Sent to HR Exception Review.'); UI.render()">Endorse for HR Exception Review</button>
            <button class="btn btn-danger" onclick="STATE.otx.step='employee'; UI.render()">Reject</button>
          </div>
        </div>`;
      }
    } else if (step === 'hrReview') {
      body = transferCard(
        'Manager endorsed the exception.',
        'Manager / HOD', 'Human Resources',
        "UI.setPersona('HR'); UI.render()"
      );
      if (STATE.persona === 'HR') {
        body = `
        <div class="card">
          <h3>HR Exception Review</h3>
          <div class="checklist">
            <div class="checkrow">&#10003; Reason justified against policy</div>
            <div class="checkrow">&#10003; Checked for pattern of repeated late claims</div>
            <div class="checkrow warn">&#9888; Days beyond window: ${ex.daysLate} &mdash; above HR's own-approval threshold</div>
          </div>
          <div class="btnrow">
            <button class="btn btn-success" onclick="UI.setPersona('HR'); STATE.otx.step='completed'; historyPush(STATE.otx.history,{stageKey:'hr',actor:VT_DATA.personas.HR.name,action:'Approved the exception directly.'}); UI.pushNotification('HR approved the OT exception.','Exception route completed.'); UI.render()">Approve Exception</button>
            <button class="btn btn-primary" onclick="UI.setPersona('MANAGEMENT'); STATE.otx.step='management'; historyPush(STATE.otx.history,{stageKey:'hr',actor:VT_DATA.personas.HR.name,action:'Escalated to Management &mdash; above HR\\'s own-approval threshold.'}); UI.pushNotification('OT exception escalated to Management.','Requires final sign-off.'); UI.render()">Require Management Approval</button>
            <button class="btn btn-danger" onclick="STATE.otx.step='employee'; UI.render()">Reject</button>
          </div>
        </div>`;
      }
    } else if (step === 'management') {
      body = transferCard(
        'HR exception review escalated this case.',
        'Human Resources', 'Management',
        "UI.setPersona('MANAGEMENT'); UI.render()"
      );
      if (STATE.persona === 'MANAGEMENT') {
        body = `
        <div class="card">
          <div class="badge badge-red" style="margin-bottom:10px">Escalated &mdash; Management Approval Required</div>
          <p style="color:var(--muted);font-size:12.5px">HR's exception review determined this case exceeds the threshold for HR to approve directly.</p>
          <div class="btnrow">
            <button class="btn btn-success" onclick="STATE.otx.step='completed'; historyPush(STATE.otx.history,{stageKey:'management',actor:VT_DATA.personas.MANAGEMENT.name,action:'Approved the exception.'}); UI.pushNotification('Management approved the OT exception.','Exception route completed.'); UI.render()">Approve</button>
            <button class="btn btn-danger" onclick="STATE.otx.step='employee'; UI.render()">Reject</button>
          </div>
        </div>`;
      }
    } else if (step === 'completed') {
      body = `
        <div class="card">
          <div class="badge badge-green" style="margin-bottom:10px">Exception Route Completed</div>
          <p style="color:var(--muted);font-size:12.5px">This demonstrates how policy (the 7-day window) and the Lark workflow can work together: a genuine late claim is reviewed through an auditable route rather than an automatic rejection.</p>
          <div class="btnrow"><button class="btn btn-primary" onclick="OTX.reset(); UI.render()">Restart Exception Demo</button></div>
        </div>`;
    }

    return `
      ${pageHead('OT Exception', 'Overtime &mdash; Seven-Day Submission Exception', 'A proposed exception route, not an automatic rejection.')}
      <div class="card branch-diagram">
        <div class="branch-head"><h3 style="margin:0">Standard Process vs Exception Process</h3></div>
        <div class="branch-divider">&#9888; SUBMISSION OUTSIDE THE 7-DAY WINDOW &mdash; WORKFLOW BRANCHES HERE</div>
        <div class="branch-cols">
          <div class="branch-col"><h4>Standard Process</h4>${WF.render('otx-std', OTX.standardStages(), { vertical:true, reference:true })}</div>
          <div class="branch-col exception"><h4>Exception Process</h4>${WF.render('otx-exc', OTX.stages(), { vertical:true })}</div>
        </div>
      </div>
      ${body}
      ${renderHistory(STATE.otx.history, 'Exception Route History')}
      <div class="btnrow"><button class="btn btn-ghost" onclick="UI.goPage('ot-demo')">&larr; Back to OT Demo</button></div>
    `;
  }
};
Pages['ot-exception'] = () => OTX.render();

/* =========================================================
   DEMO 2 — DIGITAL POLICY ACKNOWLEDGEMENT + HR POLICY MONITOR
   ========================================================= */
const POLICY = {
  reset(){ STATE.policy = { step:'notify', checked:false, record:null, history:[] }; },

  stages(){
    const order = ['notify','viewer','acknowledged'];
    const idx = order.indexOf(STATE.policy.step);
    const labels = ['Assigned','Notification Sent','Opened','Acknowledged'];
    const details = [
      { responsible:'System', sees:'Policy assignment.', action:'None &mdash; automatic.', recorded:'Assignment record.', next:'Notification sent to employee.' },
      { responsible:'System', sees:'Notification queued.', action:'None &mdash; automatic.', recorded:'Notification timestamp.', next:'Employee opens the notification.' },
      { responsible:'Employee', sees:'Policy viewer with full text.', action:'Read the policy and tick the acknowledgement statement.', recorded:'Opened timestamp &mdash; this is not yet acknowledgement.', next:'Employee submits acknowledgement.' },
      { responsible:'Employee', sees:'Confirmation of acknowledgement.', action:'None further required.', recorded:'Employee, policy, version, date and time.', next:'Retained for HR monitoring and audit.' }
    ];
    // map policy.step -> how many of the 4 chain stages are complete/active
    const chainIdx = step => ({ notify:1, viewer:2, acknowledged:3 }[step] ?? 0);
    const ci = chainIdx(STATE.policy.step);
    return labels.map((label,i) => ({
      key:'pk'+i, label,
      status: i<ci ? 'done' : (i===ci ? 'active' : 'pending'),
      statusLabel: i<ci ? '&#10003; Done' : (i===ci ? '&#9679; In Progress' : '&#9675; Waiting'),
      ...details[i]
    }));
  },

  viewPolicy(){
    STATE.policy.step = 'viewer';
    historyPush(STATE.policy.history, { stageKey:'pk2', actor: VT_DATA.ot.employee, action:'Opened the policy. Acknowledgement outstanding.' });
    UI.render();
  },

  toggleCheck(){
    STATE.policy.checked = document.getElementById('policyCheck').checked;
    document.getElementById('policyAckBtn').disabled = !STATE.policy.checked;
  },

  acknowledge(){
    if (!STATE.policy.checked) return;
    const stamp = nowStamp();
    STATE.policy.record = { employee: VT_DATA.ot.employee, policy: VT_DATA.policy.name, version: VT_DATA.policy.version, date: stamp.date, time: stamp.time };
    STATE.policy.step = 'acknowledged';
    historyPush(STATE.policy.history, { stageKey:'pk3', actor: VT_DATA.ot.employee, action:'Acknowledged ' + VT_DATA.policy.name + ' v' + VT_DATA.policy.version + '.' });
    UI.pushNotification('Policy acknowledged.', VT_DATA.policy.name + ' v' + VT_DATA.policy.version + ' recorded for ' + VT_DATA.ot.employee + '.');
    UI.render();
  },

  ackEvents(){
    const step = STATE.policy.step;
    const stages = ['Assigned','Notification Sent','Opened','Acknowledged'];
    const ci = ({ notify:1, viewer:2, acknowledged:3 }[step] ?? 0);
    return `<div class="ack-events">${stages.map((s,i) => `${i>0?'<span class="ack-arrow">&rarr;</span>':''}<span class="ack-event ${i<ci?'done':(i===ci?'now':'')}">${s}</span>`).join('')}</div>`;
  },

  employeeFlow(){
    const step = STATE.policy.step;
    if (step === 'notify') {
      return `
        <div class="card">
          <div class="badge badge-amber" style="margin-bottom:10px">New Policy Requires Your Acknowledgement</div>
          ${POLICY.ackEvents()}
          <h3>${VT_DATA.policy.name}</h3>
          <p style="color:var(--muted);font-size:12.5px">Version ${VT_DATA.policy.version} &middot; Effective Date ${VT_DATA.policy.effective}</p>
          <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="POLICY.viewPolicy()">View Policy</button></div>
        </div>`;
    }
    if (step === 'viewer') {
      return `
        <div class="card">
          ${POLICY.ackEvents()}
          <h3>${VT_DATA.policy.name} <span style="color:var(--muted);font-weight:600;font-size:12.5px">v${VT_DATA.policy.version}</span></h3>
          <div class="badge badge-amber" style="margin:6px 0 10px">Status: OPENED &mdash; Acknowledgement Outstanding</div>
          <div class="policy-viewer">
            ${VT_DATA.policy.body.map(sec => `<h4>${sec.h}</h4><p>${sec.p}</p>`).join('')}
          </div>
          <div class="divider"></div>
          <label style="display:flex;gap:10px;align-items:flex-start;font-size:12.5px">
            <input type="checkbox" id="policyCheck" onchange="POLICY.toggleCheck()" style="margin-top:3px">
            <span>I acknowledge that I have received, read and understood this policy and understand that I am required to comply with it.</span>
          </label>
          <div class="btnrow"><button class="btn btn-primary btn-lg" id="policyAckBtn" disabled onclick="POLICY.acknowledge()">Acknowledge</button></div>
        </div>`;
    }
    if (step === 'acknowledged') {
      const r = STATE.policy.record;
      return `
        <div class="card">
          <div class="badge badge-green" style="margin-bottom:10px">&#10003; Acknowledged</div>
          ${POLICY.ackEvents()}
          <h3>Acknowledgement recorded</h3>
          <div class="formgrid" style="margin-top:10px">
            <div><b>Employee:</b> ${r.employee}</div>
            <div><b>Policy:</b> ${r.policy}</div>
            <div><b>Version:</b> ${r.version}</div>
            <div><b>Date / Time:</b> ${r.date} &middot; ${r.time}</div>
          </div>
          ${transferCard('Employee acknowledgement complete.', 'Employee', 'Human Resources', "UI.setPersona('HR'); UI.render()")}
        </div>`;
    }
  },

  hrMonitor(){
    const m = VT_DATA.policyMonitor;
    return `
      <div class="card">
        <h3>Policy Acknowledgement Status</h3>
        <p style="color:var(--muted);font-size:12.5px">${VT_DATA.policy.name} &middot; v${VT_DATA.policy.version}</p>
        <div class="grid grid-4" style="margin-top:6px">
          <div class="stat-tile"><div class="num">${m.assigned}</div><div class="lbl">Assigned Employees</div></div>
          <div class="stat-tile"><div class="num" style="color:var(--success)">${m.acknowledged}</div><div class="lbl">Acknowledged</div></div>
          <div class="stat-tile"><div class="num" style="color:var(--warning)">${m.outstanding}</div><div class="lbl">Outstanding</div></div>
          <div class="stat-tile"><div class="num" style="color:var(--danger)">${m.overdue}</div><div class="lbl">Overdue</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Employee Status</h3>
        <p style="color:var(--muted);font-size:11.5px;margin-top:-4px">System events tracked separately: Assigned &middot; Notification Sent &middot; Opened &middot; Acknowledged &middot; Reminder Sent &middot; Overdue &middot; Exception.</p>
        <table class="table"><thead><tr><th>Employee</th><th>Department</th><th>Status</th></tr></thead><tbody>
          ${m.employees.map((e,i) => `<tr class="clickable" onclick="POLICY.showTimeline(${i})"><td>${e.name}</td><td>${e.dept}</td><td>${statusBadge(e.status)}</td></tr>`).join('')}
        </tbody></table>
        <p style="color:var(--muted);font-size:11.5px;margin-top:10px">Click an employee to see their acknowledgement timeline. Note: <b>Opened &ne; Acknowledged</b>.</p>
      </div>
      ${advisoryNote('Approval and escalation roles for policy follow-up should reflect VT Worldwide\'s final authority structure.')}`;
  },

  showTimeline(i){
    const e = VT_DATA.policyMonitor.employees[i];
    const openedNotAck = e.status === 'Opened – Not Acknowledged';
    UI.openModal(`
      <h3>${e.name} &mdash; Acknowledgement Timeline</h3>
      <p style="color:var(--muted);font-size:12.5px">${e.dept} &middot; ${e.date}</p>
      <div class="timeline">
        ${e.timeline.map((t,idx) => `<div class="tl-item ${idx===e.timeline.length-1 ? (e.status==='Overdue'?'warn':(t==='Acknowledged'?'done':'active')) : 'done'}"><b>${t}</b></div>`).join('')}
      </div>
      ${openedNotAck ? `<div class="exception-banner" style="margin-top:14px"><div class="ic">&#9888;</div><div><b>OPENED &ne; ACKNOWLEDGED</b><p>This employee opened the policy but has not completed the acknowledgement step. HR follow-up may be required.</p></div></div>` : ''}
      ${e.status==='Overdue' ? `<div class="exception-banner" style="margin-top:14px"><div class="ic">&#9888;</div><div><b>OVERDUE</b><p>Reminders have been sent. This record is now flagged for HR follow-up.</p></div></div>` : ''}
    `);
  },

  render(){
    if (STATE.persona === 'HR') {
      return `${pageHead('Policies &middot; Acknowledgement', 'HR Policy Monitor', 'Track digital acknowledgement of published policies across VT Worldwide.')}${POLICY.hrMonitor()}`;
    }
    return `
      <div class="page-head-row">
        ${pageHead('HR Services &middot; Policies', 'Digital Policy Acknowledgement', 'What an employee sees when a new policy is published in Lark.')}
        <div class="page-head-actions">${GUIDED.toggleBtn('policy-demo')}</div>
      </div>
      ${GUIDED.render('policy-demo')}
      ${POLICY.employeeFlow()}
      ${renderHistory(STATE.policy.history)}
    `;
  }
};
Pages['policy-demo'] = () => POLICY.render();

/* =========================================================
   DEMO 3 — LEAVE APPLICATION
   ========================================================= */
const LEAVE = {
  reset(){ STATE.leave = { step:'form', form:null, balance: STATE.leave ? STATE.leave.balance : VT_DATA.leave.balance, history:[] }; },

  stages(){
    const order = ['form','pendingManager','managerReview','approved'];
    const idx = order.indexOf(STATE.leave.step);
    const s = (key,label,at,detail) => ({ key,label, status: idx>at?'done':(idx===at?'active':'pending'), ...detail });
    return [
      s('employee','Employee',0,{responsible:'Employee', sees:'Apply Leave form with leave type and available balance.', action:'Submit leave dates and reason.', recorded:'Leave application draft.', next:'Sent to Manager for approval.'}),
      s('manager','Manager',1,{responsible:'Manager / HOD', sees:'Leave request with dates, reason and current balance.', action:'Approve or reject.', recorded:'Manager decision and timestamp.', next:'Approved leave updates the balance automatically.'}),
      s('approved','Approved',2,{responsible:'System', sees:'Approval confirmation.', action:'None &mdash; automatic.', recorded:'Approval status.', next:'Leave balance is updated.'}),
      s('balance','Leave Balance Updated',3,{responsible:'System', sees:'Updated balance reflected in employee profile.', action:'None &mdash; automatic.', recorded:'New available balance.', next:'HR record is finalised.'}),
      s('hr','HR Record',4,{responsible:'Human Resources', sees:'Completed leave record for reporting and audit.', action:'None &mdash; record only, unless queried.', recorded:'Final leave record retained for audit.', next:'Available for HR reporting.'})
    ];
  },

  submit(){
    const val = id => document.getElementById(id).value;
    if (!val('leaveStart') || !val('leaveEnd') || !val('leaveReason')) { UI.toast('Please complete all leave fields.', 'warn'); return; }
    const start = new Date(val('leaveStart')), end = new Date(val('leaveEnd'));
    const days = Math.max(1, Math.round((end-start)/86400000)+1);
    STATE.leave.form = { type: val('leaveType'), start: val('leaveStart'), end: val('leaveEnd'), reason: val('leaveReason'), days };
    STATE.leave.step = 'pendingManager';
    historyPush(STATE.leave.history, { stageKey:'employee', actor: VT_DATA.ot.employee, action:'Applied for ' + STATE.leave.form.type + ' (' + days + ' day(s)).' });
    UI.pushNotification('Leave application submitted.', 'Pending Manager Approval &middot; ' + days + ' day(s).');
    UI.render();
  },

  decide(approve){
    const actor = VT_DATA.personas.MANAGER.name;
    if (approve) {
      STATE.leave.balance = Math.max(0, STATE.leave.balance - STATE.leave.form.days);
      STATE.leave.step = 'approved';
      historyPush(STATE.leave.history, { stageKey:'manager', actor, action:'Approved the leave request.' });
      historyPush(STATE.leave.history, { stageKey:'hr', actor:'System', action:'Balance updated and HR record created.' });
      UI.pushNotification('Leave approved.', 'Balance updated and HR record created.');
    } else {
      STATE.leave.step = 'form';
      historyPush(STATE.leave.history, { stageKey:'manager', actor, action:'Rejected the leave request.' });
      UI.pushNotification('Leave rejected.', 'Employee notified to review and resubmit.');
    }
    UI.render();
  },

  render(){
    const step = STATE.leave.step;
    let body = '';
    if (step === 'form') {
      body = `<div class="card">
        <h3>HR Services &rarr; Leave &rarr; Apply Leave</h3>
        <div class="formgrid">
          <div class="field"><label>Leave Type</label><select id="leaveType">${VT_DATA.leave.types.map(t=>`<option ${t===VT_DATA.leave.example.type?'selected':''}>${t}</option>`).join('')}</select></div>
          <div class="field"><label>Available Balance</label><input value="${STATE.leave.balance} days" disabled></div>
          <div class="field"><label>Start Date</label><input type="date" id="leaveStart" value="2026-09-21"></div>
          <div class="field"><label>End Date</label><input type="date" id="leaveEnd" value="2026-09-23"></div>
          <div class="field full"><label>Reason</label><textarea id="leaveReason">${VT_DATA.leave.example.reason}</textarea></div>
        </div>
        <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="LEAVE.submit()">Submit</button></div>
      </div>`;
    } else if (step === 'pendingManager') {
      body = transferCard('Request submitted successfully.', VT_DATA.ot.employee + ' (Employee)', 'Manager / HOD', "UI.setPersona('MANAGER'); STATE.leave.step='managerReview'; UI.render()");
    } else if (step === 'managerReview') {
      body = `<div class="card">
        <h3>Leave Request</h3>
        <div class="formgrid">
          <div><b>Employee:</b> ${VT_DATA.ot.employee}</div>
          <div><b>Type:</b> ${STATE.leave.form.type}</div>
          <div><b>Dates:</b> ${STATE.leave.form.start} to ${STATE.leave.form.end}</div>
          <div><b>Days:</b> ${STATE.leave.form.days}</div>
          <div class="full"><b>Reason:</b> ${STATE.leave.form.reason}</div>
        </div>
        <div class="btnrow">
          <button class="btn btn-success" onclick="LEAVE.decide(true)">Approve</button>
          <button class="btn btn-danger" onclick="LEAVE.decide(false)">Reject</button>
        </div>
      </div>`;
    } else if (step === 'approved') {
      body = `<div class="card">
        <div class="badge badge-green" style="margin-bottom:10px">Completed</div>
        <h3>Leave approved</h3>
        <p style="color:var(--muted);font-size:12.5px">New available balance: <b>${STATE.leave.balance} days</b>. HR record created.</p>
        <div class="btnrow"><button class="btn btn-primary" onclick="LEAVE.reset(); UI.setPersona('EMPLOYEE'); UI.render()">Restart Leave Demo</button></div>
      </div>`;
    }
    return `${pageHead('HR Services &middot; Leave', 'Leave Application', 'Employee submission &rarr; Manager approval &rarr; Balance update &rarr; HR record.')}${WF.block('leave', LEAVE.stages())}${body}${renderHistory(STATE.leave.history)}`;
  }
};
Pages['leave-demo'] = () => LEAVE.render();

/* =========================================================
   DEMO 4 — MEDICAL LEAVE
   ========================================================= */
const MEDICAL = {
  reset(){ STATE.medical = { step:'form', form:null, history:[] }; },

  stages(){
    const order = ['form','submitted','verified'];
    const idx = order.indexOf(STATE.medical.step);
    const s = (key,label,at,detail) => ({ key,label, status: idx>at?'done':(idx===at?'active':'pending'), ...detail });
    return [
      s('employee','Employee Submission',0,{responsible:'Employee', sees:'Medical Leave form.', action:'Enter dates and upload the medical certificate.', recorded:'Medical leave application.', next:'Document uploaded.'}),
      s('doc','Document Uploaded',0,{responsible:'Employee', sees:'Confirmation the MC has been attached.', action:'None further.', recorded:'Medical certificate file reference.', next:'Sent to HR for verification.'}),
      s('hr','HR Verification',1,{responsible:'Human Resources', sees:'Medical certificate and submitted dates.', action:'Verify the certificate against the claimed leave dates.', recorded:'HR verification outcome.', next:'Attendance is updated.'}),
      s('att','Attendance Updated',2,{responsible:'System', sees:'Attendance record reflects approved medical leave.', action:'None &mdash; automatic.', recorded:'Updated attendance record.', next:'Workflow completed.'}),
      s('completed','Completed',2,{responsible:'System', sees:'Completed record.', action:'None.', recorded:'Full audit trail.', next:'Retained for audit.'})
    ];
  },

  submit(){
    const val = id => document.getElementById(id).value;
    if (!val('medStart') || !document.getElementById('medDocName').textContent.includes('Attached')) { UI.toast('Please set dates and upload the medical certificate.', 'warn'); return; }
    STATE.medical.form = { start: val('medStart'), days: val('medDays'), doc: VT_DATA.medical.doc, clinic: VT_DATA.medical.clinic };
    STATE.medical.step = 'submitted';
    historyPush(STATE.medical.history, { stageKey:'employee', actor: VT_DATA.ot.employee, action:'Submitted medical leave with certificate (' + STATE.medical.form.doc + ').' });
    UI.pushNotification('Medical leave submitted.', 'Document uploaded &middot; pending HR verification.');
    UI.render();
  },

  verify(){
    STATE.medical.step = 'verified';
    historyPush(STATE.medical.history, { stageKey:'hr', actor: VT_DATA.personas.HR.name, action:'Verified the medical certificate. Attendance updated.' });
    UI.pushNotification('Medical leave verified by HR.', 'Attendance updated automatically.');
    UI.render();
  },

  render(){
    const step = STATE.medical.step;
    let body = '';
    if (step === 'form') {
      body = `<div class="card">
        <h3>HR Services &rarr; Medical Leave</h3>
        <div class="formgrid">
          <div class="field"><label>Leave Type</label><input value="Medical Leave" disabled></div>
          <div class="field"><label>Start Date</label><input type="date" id="medStart" value="2026-09-15"></div>
          <div class="field"><label>Number of Days</label><input type="number" id="medDays" value="${VT_DATA.medical.days}"></div>
          <div class="field full"><label>Medical Certificate</label>
            <div style="display:flex;gap:10px;align-items:center">
              <button type="button" class="btn" onclick="document.getElementById('medDocName').textContent='Attached: ${VT_DATA.medical.doc}'; UI.toast('Medical certificate attached (simulated).')">Upload Medical Certificate</button>
              <span id="medDocName" class="hint">No file attached</span>
            </div>
          </div>
        </div>
        <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="MEDICAL.submit()">Submit</button></div>
      </div>`;
    } else if (step === 'submitted') {
      const showHR = STATE.persona === 'HR';
      body = `<div class="card">
        <div class="badge badge-amber" style="margin-bottom:10px">${showHR ? 'Pending HR Verification' : 'Submitted'}</div>
        <div class="formgrid">
          <div><b>Employee:</b> ${VT_DATA.ot.employee}</div>
          <div><b>Start Date:</b> ${STATE.medical.form.start}</div>
          <div><b>Days:</b> ${STATE.medical.form.days}</div>
          <div><b>Clinic:</b> ${STATE.medical.form.clinic}</div>
        </div>
        <div class="doc-chip" style="margin-top:10px;cursor:pointer" onclick="UI.openModal('&lt;h3&gt;Medical Certificate&lt;/h3&gt;&lt;p&gt;&lt;b&gt;File:&lt;/b&gt; ${STATE.medical.form.doc}&lt;/p&gt;&lt;p&gt;&lt;b&gt;Clinic:&lt;/b&gt; ${STATE.medical.form.clinic}&lt;/p&gt;&lt;p style=color:var(--muted);font-size:12.5px&gt;Illustrative placeholder &mdash; no real medical document is stored in this concept.&lt;/p&gt;')">&#128196; ${STATE.medical.form.doc} &middot; View Certificate</div>
        ${showHR ? `<div class="btnrow"><button class="btn btn-success" onclick="MEDICAL.verify()">Verify Certificate</button></div>` : ''}
      </div>
      ${showHR ? '' : transferCard('Medical leave submitted with certificate.', 'Employee', 'Human Resources', "UI.setPersona('HR'); UI.render()")}`;
    } else if (step === 'verified') {
      body = `<div class="card">
        <div class="badge badge-green" style="margin-bottom:10px">Completed</div>
        <h3>Medical leave verified</h3>
        <p style="color:var(--muted);font-size:12.5px">Attendance record updated automatically for ${STATE.medical.form.start} (${STATE.medical.form.days} day(s)).</p>
        <div class="btnrow"><button class="btn btn-primary" onclick="MEDICAL.reset(); UI.setPersona('EMPLOYEE'); UI.render()">Restart Medical Leave Demo</button></div>
      </div>`;
    }
    return `${pageHead('HR Services &middot; Medical Leave', 'Medical Leave', 'Employee submission &rarr; Document uploaded &rarr; HR verification &rarr; Attendance updated.')}${WF.block('medical', MEDICAL.stages())}${body}${renderHistory(STATE.medical.history)}`;
  }
};
Pages['medical-demo'] = () => MEDICAL.render();

/* =========================================================
   DEMO 5 — ATTENDANCE CORRECTION
   ========================================================= */
const ATTEND = {
  reset(){ STATE.attendance = { step:'log', form:null, history:[] }; },

  stages(){
    const order = ['log','reportForm','managerVerify','hrReview','updated'];
    const idx = order.indexOf(STATE.attendance.step);
    const s = (key,label,at,detail) => ({ key,label, status: idx>at?'done':(idx===at?'active':'pending'), ...detail });
    return [
      s('employee','Employee',1,{responsible:'Employee', sees:'Attendance log showing a missing clock-out.', action:'Report the attendance issue with the correct time and reason.', recorded:'Correction request.', next:'Sent to Manager for verification.'}),
      s('manager','Manager Verification',2,{responsible:'Manager / HOD', sees:'The reported issue and proposed correction.', action:'Verify the correction is reasonable.', recorded:'Manager verification.', next:'Sent to HR for review.'}),
      s('hr','HR Review',3,{responsible:'Human Resources', sees:'Verified correction request.', action:'Review and approve the attendance update.', recorded:'HR review outcome.', next:'Attendance record updated.'}),
      s('updated','Attendance Updated',4,{responsible:'System', sees:'Corrected attendance record.', action:'None &mdash; automatic.', recorded:'Before/after attendance record with full audit trail.', next:'Retained for audit.'})
    ];
  },

  submit(){
    const val = id => document.getElementById(id).value;
    if (!val('attCorrect') || !val('attReason')) { UI.toast('Please provide the correct time and a reason.', 'warn'); return; }
    STATE.attendance.form = { correctedOut: val('attCorrect'), reason: val('attReason') };
    STATE.attendance.step = 'managerVerify';
    historyPush(STATE.attendance.history, { stageKey:'employee', actor: VT_DATA.ot.employee, action:'Reported missing clock-out. Proposed correction: ' + STATE.attendance.form.correctedOut + '.' });
    UI.pushNotification('Attendance correction reported.', 'Pending Manager verification.');
    UI.render();
  },

  render(){
    const step = STATE.attendance.step;
    const a = VT_DATA.attendance;
    let body = '';
    if (step === 'log') {
      body = `<div class="card">
        <h3>My Attendance</h3>
        <div class="attendance-row"><div><b>${a.date}</b></div><div style="text-align:right"><div>Clock In: <b>${a.clockIn}</b></div><div style="color:var(--danger);font-weight:700">-- Missing Clock Out</div></div></div>
        <div class="btnrow"><button class="btn btn-primary" onclick="STATE.attendance.step='reportForm'; UI.render()">Report Attendance Issue</button></div>
      </div>`;
    } else if (step === 'reportForm') {
      body = `<div class="card">
        <h3>Report Attendance Issue</h3>
        <div class="formgrid">
          <div class="field"><label>Issue Type</label><input value="Missing Clock-Out" disabled></div>
          <div class="field"><label>Correct Time</label><input type="time" id="attCorrect" value="${a.correctedOut}"></div>
          <div class="field full"><label>Reason</label><textarea id="attReason">${a.reason}</textarea></div>
        </div>
        <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="ATTEND.submit()">Submit</button></div>
      </div>`;
    } else if (step === 'managerVerify') {
      body = `<div class="card">
        <div class="badge badge-amber" style="margin-bottom:10px">Pending Manager Verification</div>
        <p><b>Employee:</b> ${VT_DATA.ot.employee} &middot; <b>Date:</b> ${a.date}</p>
        <p style="color:var(--muted);font-size:12.5px"><b>Reported correction:</b> Clock-out ${STATE.attendance.form.correctedOut} &mdash; ${STATE.attendance.form.reason}</p>
        ${STATE.persona==='MANAGER' ? `<div class="btnrow"><button class="btn btn-success" onclick="STATE.attendance.step='hrReview'; historyPush(STATE.attendance.history,{stageKey:'manager',actor:VT_DATA.personas.MANAGER.name,action:'Verified the reported correction.'}); UI.pushNotification('Manager verified the attendance correction.','Sent to HR for review.'); UI.render()">Verify</button></div>` : ''}
      </div>
      ${STATE.persona==='MANAGER' ? '' : transferCard('Attendance issue reported.', 'Employee', 'Manager / HOD', "UI.setPersona('MANAGER'); UI.render()")}`;
    } else if (step === 'hrReview') {
      body = `<div class="card">
        <div class="badge badge-amber" style="margin-bottom:10px">Pending HR Review</div>
        <p style="color:var(--muted);font-size:12.5px">Manager-verified correction awaiting HR approval to update the official attendance record.</p>
        ${STATE.persona==='HR' ? `<div class="btnrow"><button class="btn btn-success" onclick="STATE.attendance.step='updated'; historyPush(STATE.attendance.history,{stageKey:'hr',actor:VT_DATA.personas.HR.name,action:'Approved the correction and updated attendance.'}); UI.pushNotification('HR approved the attendance correction.','Attendance record updated.'); UI.render()">Approve &amp; Update</button></div>` : ''}
      </div>
      ${STATE.persona==='HR' ? '' : transferCard('Manager verified the correction.', 'Manager / HOD', 'Human Resources', "UI.setPersona('HR'); UI.render()")}`;
    } else if (step === 'updated') {
      body = `<div class="grid grid-2">
        <div class="card"><h3>Before</h3><div class="attendance-row"><div>Clock In: <b>${a.clockIn}</b></div></div><div class="attendance-row"><div style="color:var(--danger);font-weight:700">-- Missing Clock-Out</div></div></div>
        <div class="card"><h3>After</h3><div class="attendance-row"><div>Clock In: <b>${a.clockIn}</b></div></div><div class="attendance-row"><div style="color:var(--success);font-weight:700">Clock Out: ${STATE.attendance.form.correctedOut}</div></div></div>
      </div>
      <div class="btnrow"><button class="btn btn-primary" onclick="ATTEND.reset(); UI.setPersona('EMPLOYEE'); UI.render()">Restart Attendance Demo</button></div>`;
    }
    return `${pageHead('HR Services &middot; Attendance Correction', 'Attendance Correction', 'Employee report &rarr; Manager verification &rarr; HR review &rarr; Attendance updated.')}${WF.block('attendance', ATTEND.stages())}${body}${renderHistory(STATE.attendance.history)}`;
  }
};
Pages['attendance-demo'] = () => ATTEND.render();

/* =========================================================
   DEMO 6 — PERFORMANCE MANAGEMENT
   Proposed future-state workflow only. Nothing here finalises
   VT Worldwide's KRA/KPI methodology, rating scale, weighting,
   calibration authority, approval authority or PIP triggers —
   see VT_DATA.pm and the Workshop validation panel.
   ========================================================= */
const PM = {
  reset(){
    STATE.pm = {
      step:'cycleSetup',
      empRating:null, empComments:'', empEvidence:false,
      mgrRating:null, mgrComments:'', mgrObservations:'', mgrDevRec:'',
      calibProposedRating:null, calibComments:'',
      outcomeBranch:null,
      ackRecord:null,
      history:[]
    };
  },

  openLandingDetail(n){
    const stages = VT_DATA.pm.landingStages;
    const i = stages.findIndex(s => s.n === n);
    const s = stages[i];
    const next = stages[i+1];
    const RESP = ['Human Resources','Human Resources / Employee / Manager','Employee & Manager','Human Resources / System','Employee','Manager / HOD','Department Head (authority to be confirmed)','Human Resources','Final approval authority (to be confirmed)','Employee','Employee / Manager / Human Resources','Human Resources'];
    UI.openStagePanel({
      label: s.label,
      responsible: RESP[i],
      sees: s.desc,
      action: 'This is a proposed stage for discussion &mdash; mark it in Workshop Mode to record VT Worldwide\'s position.',
      recorded: 'Illustrative only in this concept; subject to VT Worldwide confirmation.',
      next: next ? 'Proceeds to: ' + next.label + '.' : 'The cycle returns to Performance Cycle Setup.'
    });
  },

  flowStages(){
    const step = STATE.pm.step;
    const doneSets = {
      employee: ['pendingManager','managerReview','pendingCalibration','calibration','pendingHR','hrReview','finalOutcome','pendingAck','acknowledgement','completed'],
      manager: ['pendingCalibration','calibration','pendingHR','hrReview','finalOutcome','pendingAck','acknowledgement','completed'],
      calibration: ['pendingHR','hrReview','finalOutcome','pendingAck','acknowledgement','completed'],
      hr: ['finalOutcome','pendingAck','acknowledgement','completed'],
      outcome: ['pendingAck','acknowledgement','completed'],
      ack: ['completed']
    };
    const activeSets = {
      employee: ['cycleSetup','employee'],
      manager: ['pendingManager','managerReview'],
      calibration: ['pendingCalibration','calibration'],
      hr: ['pendingHR','hrReview'],
      outcome: ['finalOutcome'],
      ack: ['pendingAck','acknowledgement']
    };
    const mk = (key,label,detail) => {
      const status = doneSets[key].includes(step) ? 'done' : (activeSets[key].includes(step) ? 'active' : 'pending');
      return { key, label, status, statusLabel: status==='done' ? '&#10003; Done' : (status==='active' ? '&#9679; In Progress' : '&#9675; Waiting'), ...detail };
    };
    return [
      mk('employee','Employee', {responsible:'Employee', sees:'Self-assessment form with illustrative KRA/KPI.', action:'Rate own performance, add comments and supporting evidence.', recorded:'Employee self-assessment.', next:'Sent to Manager / HOD.'}),
      mk('manager','Manager/HOD', {responsible:'Manager / HOD', sees:'Employee self-assessment, KRA/KPI results, comments and evidence.', action:'Record a manager rating, comments, observations and development recommendation.', recorded:'Manager assessment.', next:'Sent to Calibration.'}),
      mk('calibration','Calibration', {responsible:'Department Head / Calibration (authority to be confirmed)', sees:'Employee and manager ratings.', action:'Endorse, return for review, or propose an adjustment.', recorded:'Calibration outcome and proposed rating.', next:'Sent to Human Resources.'}),
      mk('hr','Human Resources', {responsible:'Human Resources', sees:'Full review trail, completion checklist.', action:'Verify governance and completeness &mdash; not the rating decision.', recorded:'HR governance checklist outcome.', next:'Final performance outcome is recorded.'}),
      mk('outcome','Final Outcome', {responsible:'Final approval authority (to be confirmed)', sees:'Full review package.', action:'Record the final outcome branch.', recorded:'Final outcome and branch.', next:'Employee reviews and acknowledges.'}),
      mk('ack','Acknowledgement', {responsible:'Employee', sees:'Completed performance evaluation.', action:'Acknowledge receipt (not agreement) of the completed evaluation.', recorded:'Acknowledgement date and time.', next:'Cycle record retained; development/follow-up as applicable.'})
    ];
  },

  launchCycle(){
    STATE.pm.step = 'employee';
    historyPush(STATE.pm.history, { stageKey:'employee', actor: VT_DATA.personas.HR.name, action:'Launched the ' + VT_DATA.pm.cycle + '.' });
    UI.pushNotification('Performance cycle launched.', VT_DATA.pm.cycle + ' is now open.');
    UI.render();
  },

  submitSelfAssessment(){
    const rating = document.getElementById('pmEmpRating').value;
    if (!rating) { UI.toast('Please select a self-assessment rating.', 'warn'); return; }
    STATE.pm.empRating = rating;
    STATE.pm.empComments = document.getElementById('pmEmpComments').value;
    STATE.pm.empEvidence = document.getElementById('pmEmpDocName').textContent.includes('Attached');
    STATE.pm.step = 'pendingManager';
    historyPush(STATE.pm.history, { stageKey:'employee', actor: VT_DATA.ot.employee, action:'Submitted self-assessment (illustrative rating ' + rating + '/5).' });
    UI.pushNotification('Self-assessment submitted.', 'Pending Manager / HOD assessment.');
    UI.render();
  },

  saveDraft(){ UI.toast('Draft saved for this session (not persisted between sessions).'); },

  submitManagerAssessment(){
    const rating = document.getElementById('pmMgrRating').value;
    if (!rating) { UI.toast('Please select a manager rating.', 'warn'); return; }
    STATE.pm.mgrRating = rating;
    STATE.pm.mgrComments = document.getElementById('pmMgrComments').value;
    STATE.pm.mgrObservations = document.getElementById('pmMgrObs').value;
    STATE.pm.mgrDevRec = document.getElementById('pmMgrDev').value;
    STATE.pm.step = 'pendingCalibration';
    historyPush(STATE.pm.history, { stageKey:'manager', actor: VT_DATA.personas.MANAGER.name, action:'Submitted manager assessment (illustrative rating ' + rating + '/5).' });
    UI.pushNotification('Manager assessment submitted.', 'Sent for calibration review.');
    UI.render();
  },

  returnForClarification(){
    STATE.pm.step = 'returnedToEmployee';
    historyPush(STATE.pm.history, { stageKey:'manager', actor: VT_DATA.personas.MANAGER.name, action:'Returned the self-assessment for clarification.' });
    UI.pushNotification('Self-assessment returned for clarification.', 'Employee notified.');
    UI.render();
  },

  calibrationAction(action){
    const select = document.getElementById('pmCalibRating');
    const chosen = select ? select.value : STATE.pm.mgrRating;
    STATE.pm.calibComments = document.getElementById('pmCalibComments') ? document.getElementById('pmCalibComments').value : '';
    if (action === 'return') {
      STATE.pm.step = 'managerReview';
      historyPush(STATE.pm.history, { stageKey:'calibration', actor: VT_DATA.personas.MANAGEMENT.name, action:'Returned the assessment to Manager / HOD for review.' });
      UI.pushNotification('Returned for review.', 'Sent back to Manager / HOD.');
    } else {
      STATE.pm.calibProposedRating = action === 'adjust' ? chosen : STATE.pm.mgrRating;
      STATE.pm.step = 'pendingHR';
      historyPush(STATE.pm.history, { stageKey:'calibration', actor: VT_DATA.personas.MANAGEMENT.name, action: (action==='endorse' ? 'Endorsed the manager rating.' : 'Proposed a calibration adjustment (illustrative rating ' + chosen + '/5).') });
      UI.pushNotification('Calibration completed.', 'Sent to Human Resources for governance review.');
    }
    UI.render();
  },

  hrDecision(ready){
    if (ready) {
      STATE.pm.step = 'finalOutcome';
      historyPush(STATE.pm.history, { stageKey:'hr', actor: VT_DATA.personas.HR.name, action:'Confirmed governance checklist complete &mdash; ready for final outcome.' });
      UI.pushNotification('HR governance review complete.', 'Ready for final performance outcome.');
    } else {
      STATE.pm.step = 'calibration';
      historyPush(STATE.pm.history, { stageKey:'hr', actor: VT_DATA.personas.HR.name, action:'Returned for completion &mdash; required stage or evidence missing.' });
      UI.pushNotification('Returned for completion.', 'Sent back to Calibration.');
    }
    UI.render();
  },

  chooseOutcome(branch){
    STATE.pm.outcomeBranch = branch;
    historyPush(STATE.pm.history, { stageKey:'outcome', actor:'Final approval authority (TBC)', action:'Recorded outcome branch: ' + ({A:'Meets / Exceeds Expectations', B:'Development Required', C:'Performance Concern Identified'})[branch] + '.' });
    UI.render();
  },

  continueToAck(){
    STATE.pm.step = 'pendingAck';
    UI.pushNotification('Final performance outcome recorded.', 'Sent to Employee for review and acknowledgement.');
    UI.render();
  },

  acknowledge(){
    const stamp = nowStamp();
    STATE.pm.ackRecord = { date: stamp.date, time: stamp.time };
    STATE.pm.step = 'completed';
    historyPush(STATE.pm.history, { stageKey:'ack', actor: VT_DATA.ot.employee, action:'Acknowledged receipt of the completed evaluation (not an indication of agreement).' });
    UI.pushNotification('Performance review acknowledged.', 'Cycle record retained for audit.');
    UI.render();
  },

  sampleKpiCard(){
    const kpi = VT_DATA.performance.kpi;
    return `
      <div class="kpi-card pm-kpi-card">
        <div class="kpi-row"><span>KRA</span><b>${kpi.kra}</b></div>
        <div class="kpi-row"><span>KPI</span><b>${kpi.kpi}</b></div>
        <div class="kpi-row"><span class="sample-lbl">Weight <span class="status-tag sample">Sample Only</span></span><b>${kpi.weight}</b></div>
        <div class="kpi-row"><span class="sample-lbl">Target <span class="status-tag sample">Sample Only</span></span><b>${kpi.target}</b></div>
        <div class="kpi-row"><span class="sample-lbl">Actual <span class="status-tag sample">Sample Only</span></span><b>${kpi.actual}</b></div>
      </div>
      <p style="color:var(--muted);font-size:11px;margin-top:8px">${VT_DATA.pm.ratingScaleNote}</p>`;
  },

  landingOverview(){
    return VT_DATA.pm.landingStages.map(s => `
      <div class="pm-landing-stage">
        <div class="pm-landing-num">${s.n}</div>
        <div class="pm-landing-body" onclick="PM.openLandingDetail(${s.n})">
          <h4>${s.label} <span class="status-tag ${s.status}">${WORKSHOP.markerDefs[s.status] ? WORKSHOP.markerDefs[s.status].short : (s.status==='mgmt' ? 'Management Decision Required' : s.status)}</span></h4>
          <p>${s.desc}</p>
        </div>
      </div>`).join('');
  },

  dashboard(){
    const d = VT_DATA.pm.dashboard;
    return `
      <div class="card">
        <h3>Performance Cycle Status</h3>
        <p style="color:var(--muted);font-size:11.5px;margin-top:-6px">Illustrative / sample data &mdash; shown to demonstrate what management visibility could look like.</p>
        <div class="grid grid-4" style="margin-top:6px">
          <div class="stat-tile"><div class="num">${d.inCycle}</div><div class="lbl">Employees In Cycle</div></div>
          <div class="stat-tile"><div class="num" style="color:var(--accent-dark)">${d.selfAssessed}</div><div class="lbl">Self-Assessments Completed</div></div>
          <div class="stat-tile"><div class="num" style="color:var(--accent-dark)">${d.managerReviewed}</div><div class="lbl">Manager Reviews Completed</div></div>
          <div class="stat-tile"><div class="num" style="color:var(--warning)">${d.pendingCalibration}</div><div class="lbl">Pending Calibration</div></div>
          <div class="stat-tile"><div class="num" style="color:var(--warning)">${d.hrReview}</div><div class="lbl">Human Resources Review</div></div>
          <div class="stat-tile"><div class="num" style="color:var(--success)">${d.completed}</div><div class="lbl">Completed</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Upcoming Actions</h3>
        ${d.upcoming.map(u => `<div class="attendance-row"><div>${u.label}</div><span class="badge badge-amber">${u.count}</span></div>`).join('')}
      </div>`;
  },

  render(){
    const step = STATE.pm.step;
    let body = '';

    if (step === 'cycleSetup') {
      body = `<div class="card">
        <div class="badge badge-amber" style="margin-bottom:10px">Performance Cycle Not Yet Launched</div>
        <p style="color:var(--muted);font-size:12.5px">${VT_DATA.pm.cycle} &middot; Period: ${VT_DATA.pm.period}</p>
        ${STATE.persona==='HR' ? `<div class="btnrow"><button class="btn btn-primary btn-lg" onclick="PM.launchCycle()">Launch Performance Cycle</button></div>` : transferCard('Performance cycle is ready to be opened.', 'Employee Record', 'Human Resources', "UI.setPersona('HR'); UI.render()")}
      </div>`;
    } else if (step === 'employee') {
      body = `<div class="card">
        <h3>My Performance</h3>
        <p style="color:var(--muted);font-size:12.5px">Performance Review ${VT_DATA.performance.year} &middot; <span class="status-tag toconfirm">Period: ${VT_DATA.pm.period}</span></p>
        <div class="badge badge-amber" style="margin:8px 0">Status: Self-Assessment Required</div>
        ${PM.sampleKpiCard()}
        <div class="formgrid" style="margin-top:14px">
          <div class="field"><label>Employee Rating</label><select id="pmEmpRating"><option value="">Select&hellip;</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></div>
          <div class="field full"><label>Employee Comments</label><textarea id="pmEmpComments" placeholder="Describe performance against each KRA/KPI&hellip;"></textarea></div>
          <div class="field full"><label>Supporting Evidence</label>
            <div style="display:flex;gap:10px;align-items:center">
              <button type="button" class="btn" onclick="document.getElementById('pmEmpDocName').textContent='Attached: Q3-Delivery-Summary.pdf'; UI.toast('Evidence attached (simulated).')">Upload Evidence</button>
              <span id="pmEmpDocName" class="hint">No file attached</span>
            </div>
          </div>
        </div>
        <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="PM.submitSelfAssessment()">Submit Self-Assessment</button></div>
        <div class="tag-note" style="margin-top:14px">Illustrative Performance Structure &ndash; Final methodology subject to VT Worldwide confirmation.</div>
      </div>`;
    } else if (step === 'pendingManager') {
      body = transferCard('Self-assessment submitted successfully.', VT_DATA.ot.employee + ' (Employee)', 'Manager / HOD', "UI.setPersona('MANAGER'); STATE.pm.step='managerReview'; UI.render()");
    } else if (step === 'managerReview') {
      body = `<div class="card">
        <h3>Employee Performance Review</h3>
        <div class="formgrid">
          <div><b>Employee:</b> ${VT_DATA.ot.employee}</div>
          <div><b>Employee Rating (illustrative):</b> ${STATE.pm.empRating}/5</div>
          <div class="full"><b>Employee Comments:</b> ${STATE.pm.empComments || '&mdash;'}</div>
          <div class="full"><b>Supporting Evidence:</b> ${STATE.pm.empEvidence ? 'Attached' : 'None attached'}</div>
        </div>
        <div class="divider"></div>
        ${PM.sampleKpiCard()}
        <div class="formgrid" style="margin-top:14px">
          <div class="field"><label>Manager Rating</label><select id="pmMgrRating"><option value="">Select&hellip;</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></div>
          <div class="field full"><label>Manager Comments</label><textarea id="pmMgrComments" placeholder="Manager assessment comments&hellip;"></textarea></div>
          <div class="field full"><label>Performance Observations</label><textarea id="pmMgrObs" placeholder="Observations over the review period&hellip;"></textarea></div>
          <div class="field full"><label>Development Recommendation</label><textarea id="pmMgrDev" placeholder="Optional development or coaching recommendation&hellip;"></textarea></div>
        </div>
        <div class="btnrow">
          <button class="btn" onclick="PM.saveDraft()">Save Draft</button>
          <button class="btn btn-primary" onclick="PM.submitManagerAssessment()">Submit Manager Assessment</button>
          <button class="btn btn-danger" onclick="PM.returnForClarification()">Return for Clarification</button>
        </div>
      </div>`;
    } else if (step === 'returnedToEmployee') {
      body = `<div class="card">
        <div class="badge badge-amber" style="margin-bottom:10px">Returned for Clarification</div>
        <p style="color:var(--muted);font-size:12.5px">The manager requested more information before completing the assessment.</p>
        <div class="btnrow"><button class="btn btn-primary" onclick="STATE.pm.step='employee'; UI.setPersona('EMPLOYEE'); UI.render()">Back to Self-Assessment</button></div>
      </div>`;
    } else if (step === 'pendingCalibration') {
      body = transferCard('Manager assessment submitted for Department Head / Calibration review.', 'Manager / HOD', 'Management', "UI.setPersona('MANAGEMENT'); STATE.pm.step='calibration'; UI.render()");
    } else if (step === 'calibration') {
      body = `<div class="card">
        <h3>Calibration / Review</h3>
        <p style="color:var(--muted);font-size:12.5px">Purpose: ensure consistency and appropriate review before finalisation.</p>
        <div class="tag-note" style="margin:8px 0 14px">Calibration methodology and authority to be confirmed with VT Worldwide.</div>
        <div class="formgrid">
          <div><b>Employee Rating:</b> ${STATE.pm.empRating}/5</div>
          <div><b>Manager Rating:</b> ${STATE.pm.mgrRating}/5</div>
          <div class="field"><label>Proposed Rating</label><select id="pmCalibRating">${[1,2,3,4,5].map(n=>`<option value="${n}" ${String(n)===STATE.pm.mgrRating?'selected':''}>${n}</option>`).join('')}</select></div>
          <div class="field full"><label>Comments</label><textarea id="pmCalibComments" placeholder="Calibration notes&hellip;"></textarea></div>
        </div>
        <div class="btnrow">
          <button class="btn btn-success" onclick="PM.calibrationAction('endorse')">Endorse</button>
          <button class="btn" onclick="PM.calibrationAction('return')">Return for Review</button>
          <button class="btn btn-primary" onclick="PM.calibrationAction('adjust')">Propose Adjustment</button>
        </div>
      </div>`;
    } else if (step === 'pendingHR') {
      body = transferCard('Calibration completed.', 'Department Head / Calibration', 'Human Resources', "UI.setPersona('HR'); STATE.pm.step='hrReview'; UI.render()");
    } else if (step === 'hrReview') {
      body = `<div class="card">
        <h3>Performance Review Control</h3>
        <div class="formgrid">
          <div><b>Employee:</b> ${VT_DATA.ot.employee}</div>
          <div><b>Department:</b> ${VT_DATA.pm.dept}</div>
          <div><b>Review Cycle:</b> ${VT_DATA.pm.cycle}</div>
          <div><b>Employee Submission:</b> Complete</div>
          <div><b>Manager Submission:</b> Complete</div>
          <div><b>Calibration Status:</b> Complete</div>
          <div><b>Proposed Final Rating:</b> ${STATE.pm.calibProposedRating || STATE.pm.mgrRating}/5 (illustrative)</div>
          <div><b>Supporting Documentation:</b> ${STATE.pm.empEvidence ? 'Available' : 'None attached'}</div>
        </div>
        <div class="checklist" style="margin-top:12px">
          <div class="checkrow">&#10003; Required stages completed</div>
          <div class="checkrow">&#10003; Required comments completed</div>
          <div class="checkrow">&#10003; Supporting evidence available where applicable</div>
          <div class="checkrow">&#10003; Review routing completed</div>
        </div>
        <div class="tag-note" style="margin:12px 0">Human Resources provides governance and completeness review here &mdash; it does not itself determine the employee's rating.</div>
        <div class="btnrow">
          <button class="btn btn-success" onclick="PM.hrDecision(true)">Ready for Final Review</button>
          <button class="btn btn-danger" onclick="PM.hrDecision(false)">Return for Completion</button>
        </div>
      </div>`;
    } else if (step === 'finalOutcome') {
      const branches = {
        A: { title:'Meets / Exceeds Expectations', chain:['Performance Review Completed','Development / Career Discussion','Next Performance Cycle'] },
        B: { title:'Development Required', chain:['Development Plan','Follow-Up Review'] },
        C: { title:'Performance Concern Identified', chain:['Human Resources Review','Management / Appropriate Authority Review','Possible Performance Improvement Plan'] }
      };
      const b = STATE.pm.outcomeBranch;
      body = `<div class="card">
        <h3>Final Performance Outcome <span class="status-tag mgmt">Management Decision Required</span></h3>
        <p style="color:var(--muted);font-size:12.5px">Final approval authority to be confirmed with VT Worldwide. Select a branch to see the proposed downstream path.</p>
        <div class="grid grid-3" style="margin-top:10px">
          <div class="tile" onclick="PM.chooseOutcome('A')" style="${b==='A'?'border-color:var(--success)':''}"><h4>Branch A</h4><p>${branches.A.title}</p></div>
          <div class="tile" onclick="PM.chooseOutcome('B')" style="${b==='B'?'border-color:var(--warning)':''}"><h4>Branch B</h4><p>${branches.B.title}</p></div>
          <div class="tile" onclick="PM.chooseOutcome('C')" style="${b==='C'?'border-color:var(--danger)':''}"><h4>Branch C</h4><p>${branches.C.title}</p></div>
        </div>
        ${b ? `
        <div class="divider"></div>
        <h4 style="margin-bottom:8px">${branches[b].title}</h4>
        ${WF.render('pm-outcome', branches[b].chain.map((label,i) => ({ key:'o'+i, label, status:'done', responsible:'See Final Outcome card', sees:label, action:'Illustrative downstream step.', recorded:'Not yet configured.', next:branches[b].chain[i+1]||'Employee acknowledgement.' })), { vertical:true, reference:true })}
        ${b==='C' ? `
          <div class="tag-note" style="margin:12px 0">Performance Improvement Plan initiation is subject to review and the approved VT Worldwide Performance Management framework.</div>
          <p style="color:var(--muted);font-size:12px">This reuses the existing Probation / Performance Improvement workflow rather than duplicating it.</p>
          <div class="btnrow"><button class="btn" onclick="UI.goPage('probation-demo')">Open Performance Improvement Plan Workflow &rarr;</button></div>
        ` : ''}
        <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="PM.continueToAck()">Continue to Employee Acknowledgement</button></div>
        ` : ''}
      </div>`;
    } else if (step === 'pendingAck') {
      body = transferCard('Final performance outcome recorded.', 'Human Resources / Management', 'Employee', "UI.setPersona('EMPLOYEE'); STATE.pm.step='acknowledgement'; UI.render()");
    } else if (step === 'acknowledgement') {
      body = `<div class="card">
        <div class="badge badge-blue" style="margin-bottom:10px">Performance Review Completed</div>
        <button class="btn" onclick="UI.openModal('&lt;h3&gt;Performance Review Summary&lt;/h3&gt;&lt;p&gt;&lt;b&gt;Employee Rating (illustrative):&lt;/b&gt; ${STATE.pm.empRating}/5&lt;/p&gt;&lt;p&gt;&lt;b&gt;Manager Rating (illustrative):&lt;/b&gt; ${STATE.pm.mgrRating}/5&lt;/p&gt;&lt;p&gt;&lt;b&gt;Calibrated Rating (illustrative):&lt;/b&gt; ${STATE.pm.calibProposedRating || STATE.pm.mgrRating}/5&lt;/p&gt;&lt;p style=color:var(--muted);font-size:12.5px&gt;Rating scale and weighting are illustrative only in this concept.&lt;/p&gt;')">View Review</button>
        <div class="divider"></div>
        <h3>Employee Acknowledgement</h3>
        <p style="font-size:12.5px">I acknowledge that I have received and reviewed the completed performance evaluation.</p>
        <p style="color:var(--muted);font-size:11.5px">Acknowledgement does not indicate agreement with the rating. A separate employee comments/disagreement process can be configured, subject to VT Worldwide confirmation.</p>
        <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="PM.acknowledge()">Acknowledge</button></div>
      </div>`;
    } else if (step === 'completed') {
      body = `<div class="card">
        <div class="badge badge-green" style="margin-bottom:10px">&#10003; Acknowledged</div>
        <h3>Performance review cycle complete</h3>
        <div class="formgrid" style="margin-top:8px">
          <div><b>Acknowledged:</b> Yes</div>
          <div><b>Date / Time:</b> ${STATE.pm.ackRecord.date} &middot; ${STATE.pm.ackRecord.time}</div>
        </div>
        <div class="btnrow"><button class="btn btn-primary" onclick="PM.reset(); UI.setPersona('EMPLOYEE'); UI.render()">Restart Performance Demo</button></div>
      </div>`;
    }

    const dashboardHtml = (STATE.persona==='HR' || STATE.persona==='MANAGEMENT') ? PM.dashboard() : '';

    return `
      <div class="page-head-row">
        ${pageHead('Performance Management', 'Performance Management', 'Proposed Future-State Workflow &mdash; Subject to VT Worldwide Confirmation.')}
        <div class="page-head-actions">${GUIDED.toggleBtn('performance-demo', 'Start Performance Demo')}</div>
      </div>
      ${GUIDED.render('performance-demo')}
      <div class="card">
        <h3>Performance Management Overview</h3>
        <p style="color:var(--muted);font-size:12.5px;margin-top:-4px">Every stage is clickable. Colours match the Workshop Mode markers used to capture VT Worldwide's position.</p>
        ${PM.landingOverview()}
      </div>
      ${advisoryNote('The Performance Management workflow shown is a proposed future-state operating model intended to support discussion with VT Worldwide. Performance methodology, Key Result Areas, Key Performance Indicators, weighting, rating, calibration, approval authority and Performance Improvement Plan linkage remain subject to confirmation.')}
      ${WF.block('pm', PM.flowStages())}
      ${body}
      ${renderHistory(STATE.pm.history)}
      ${dashboardHtml}
    `;
  }
};
Pages['performance-demo'] = () => PM.render();

/* =========================================================
   DEMO 7 — PROBATION REVIEW
   ========================================================= */
const PROBATION = {
  reset(){ STATE.probation = { outcome:null, history:[] }; },

  stages(){
    const p = VT_DATA.probation;
    const outcomeStages = {
      CONFIRM: ['Manager Decision: Confirm','HR Notified','Employee Record Updated','Completed'],
      EXTEND: ['Manager Decision: Extend','New Review Date Set','HR Notified','Employee Notified'],
      PIP: ['Manager Decision: PIP Required','PIP Created','HR Review','Follow-Up Review Scheduled']
    };
    const base = ['Review Due','Manager Review'];
    const labels = STATE.probation.outcome ? base.concat(outcomeStages[STATE.probation.outcome]) : base.concat(['Awaiting Outcome']);
    return labels.map((label,i) => ({ key:'pr'+i, label, status: i<labels.length-1?'done':'active',
      responsible: i<2 ? 'Manager / HOD' : 'HR / System', sees:'Probation review status.', action:'See probation demo card for the live action.', recorded:'Probation decision and dates.', next:'See workflow.' }));
  },

  decide(outcome){
    STATE.probation.outcome = outcome;
    historyPush(STATE.probation.history, { stageKey:'pr1', actor: VT_DATA.personas.MANAGER.name, action:'Recorded probation outcome: ' + outcome + '.' });
    UI.pushNotification('Probation outcome recorded: ' + outcome + '.', VT_DATA.probation.employee);
    UI.render();
  },

  render(){
    const p = VT_DATA.probation;
    let action = '';
    if (STATE.persona !== 'MANAGER') {
      action = transferCard('Probation review is due.', 'Employee Record', 'Manager / HOD', "UI.setPersona('MANAGER'); UI.render()");
    } else if (!STATE.probation.outcome) {
      action = `<div class="btnrow">
        <button class="btn btn-success" onclick="PROBATION.decide('CONFIRM')">Confirm</button>
        <button class="btn" onclick="PROBATION.decide('EXTEND')">Extend</button>
        <button class="btn btn-danger" onclick="PROBATION.decide('PIP')">Performance Improvement Required</button>
      </div>`;
    } else {
      const msg = { CONFIRM:'Employment confirmed. HR will update the employee record.', EXTEND:'Probation extended. A new review date will be set and both HR and the employee notified.', PIP:'A Performance Improvement Plan is required. HR will review before scheduling a follow-up.' }[STATE.probation.outcome];
      action = `<p style="color:var(--muted);font-size:12.5px">${msg}</p><div class="btnrow"><button class="btn btn-primary" onclick="PROBATION.reset(); UI.render()">Try a Different Outcome</button></div>`;
    }
    return `
      ${pageHead('Performance &middot; Probation', 'Probation Review', 'Confirm, extend, or initiate a Performance Improvement Plan.')}
      <div class="card">
        <div class="formgrid">
          <div><b>Employee:</b> ${p.employee}</div>
          <div><b>Department:</b> ${p.dept}</div>
          <div><b>Probation End Date:</b> ${p.endDate}</div>
          <div><b>Status:</b> <span class="badge badge-amber">${p.status}</span></div>
        </div>
      </div>
      ${STATE.persona==='MANAGER' ? `<div class="card"><h3>Probation Review Required</h3>${action}</div>` : action}
      ${WF.block('probation', PROBATION.stages())}
      ${renderHistory(STATE.probation.history)}
    `;
  }
};
Pages['probation-demo'] = () => PROBATION.render();

/* =========================================================
   DEMO 8 — OFFBOARDING
   ========================================================= */
const OFFB = {
  start(){ STATE.offboarding.started = true; UI.pushNotification('Offboarding started.', VT_DATA.offboarding.employee + ' &middot; tasks assigned across Employee, Manager, IT, HR and Finance.'); UI.render(); },
  toggle(group, i){ STATE.offboarding.tasks[group][i].done = !STATE.offboarding.tasks[group][i].done; UI.render(); },

  completion(){
    let total=0, done=0;
    Object.values(STATE.offboarding.tasks).forEach(list => list.forEach(t => { total++; if (t.done) done++; }));
    return Math.round((done/total)*100);
  },

  render(){
    const o = VT_DATA.offboarding;
    if (!STATE.offboarding.started) {
      return `
        ${pageHead('HR Administration &middot; Offboarding', 'Offboarding', 'Triggered when an employee resigns or is separated.')}
        <div class="card">
          <div class="badge badge-amber" style="margin-bottom:10px">Resignation Received</div>
          <div class="formgrid">
            <div><b>Employee:</b> ${o.employee}</div>
            <div><b>Department:</b> ${o.dept}</div>
            <div><b>Last Day:</b> ${o.lastDay}</div>
            <div><b>Reason:</b> ${o.reason}</div>
          </div>
          ${STATE.persona==='HR' ? `<div class="btnrow"><button class="btn btn-primary btn-lg" onclick="OFFB.start()">Start Offboarding</button></div>` : `<div class="btnrow"><button class="btn btn-primary" onclick="UI.setPersona('HR'); UI.render()">Switch to HR View</button></div>`}
        </div>`;
    }
    const pct = OFFB.completion();
    const groups = [ ['EMPLOYEE','Employee'], ['MANAGER','Manager'], ['IT','IT'], ['HR','HR'], ['FINANCE','Finance'] ];
    return `
      ${pageHead('HR Administration &middot; Offboarding', 'Offboarding &mdash; ' + o.employee, o.dept + ' &middot; Last day ' + o.lastDay)}
      <div class="card">
        <h3>Offboarding Completion</h3>
        <div class="progress-bar"><i style="width:${pct}%"></i></div>
        <div style="font-weight:800;font-size:20px">${pct}%</div>
      </div>
      <div class="grid grid-3" style="align-items:start">
        ${groups.map(([key,label]) => `
          <div class="offb-col">
            <h4>${label}</h4>
            ${STATE.offboarding.tasks[key].map((t,i) => `
              <div class="offb-task ${t.done?'done':''}">
                <input type="checkbox" ${t.done?'checked':''} onchange="OFFB.toggle('${key}',${i})">
                <label>${t.t}</label>
              </div>`).join('')}
          </div>`).join('')}
      </div>
    `;
  }
};
Pages['offboarding-demo'] = () => OFFB.render();

/* =========================================================
   LIVE WORKFLOW — master high-level view of the active OT request
   ========================================================= */
Pages['live-workflow'] = function(){
  const stages = OT.stages();
  WF.registry['live'] = stages;
  const map = {};
  STATE.ot.history.forEach(h => { map[h.stageKey] = h; });
  const submitted = STATE.ot.form;
  const firstEntry = STATE.ot.history[0];

  const rows = stages.map((s,i) => {
    const h = map[s.key];
    const symbolClass = s.status;
    const symbol = s.status==='done' ? '&#10003;' : (s.status==='active' ? '&#9679;' : (s.status==='exception' ? '!' : '&#9675;'));
    return `<div class="live-row" onclick="WF.handleClick('live',${i})">
      <div class="lr-stage"><span class="live-symbol ${symbolClass}">${symbol}</span>${s.label}</div>
      <div class="lr-meta">${h ? `<b>${h.actor}</b> &middot; ${h.action}` : (s.status==='active' ? 'In progress&hellip;' : 'Waiting')}</div>
      <div class="lr-meta">${h ? `${h.date} &middot; ${h.time}` : ''}</div>
    </div>`;
  }).join('');

  return `
    ${pageHead('Client Presentation', 'Live Workflow', 'The cleanest high-level view of an active request &mdash; reflects the Overtime demo\'s current state in real time.')}
    <div class="card">
      <div class="live-header">
        <div>
          <div class="eyebrow">Overtime Claim</div>
          <div class="live-id">OT-2026-0910-004</div>
          <h3 style="margin-top:6px">${VT_DATA.ot.employee}</h3>
          <p style="color:var(--muted);font-size:12.5px;margin:2px 0 0">${VT_DATA.ot.department} Department</p>
        </div>
        <div style="text-align:right">
          <span class="badge ${submitted ? 'badge-blue' : 'badge-grey'}">${submitted ? 'Submitted' : 'Not yet submitted'}</span>
          ${firstEntry ? `<div style="font-size:11.5px;color:var(--muted);margin-top:6px">${firstEntry.date} &middot; ${firstEntry.time}</div>` : ''}
        </div>
      </div>
      <div class="divider"></div>
      ${rows}
    </div>
    ${!submitted ? `<div class="card"><p style="color:var(--muted);font-size:12.5px;margin:0">No claim has been submitted yet in this session. <a href="#" onclick="event.preventDefault(); OT.reset(); UI.goPage('ot-demo')">Start the Overtime Demo</a> to see this view update live.</p></div>` : ''}
    <div class="btnrow"><button class="btn btn-ghost" onclick="UI.goPage('ot-demo')">&larr; Back to Overtime Workflow</button></div>
  `;
};

/* =========================================================
   POLICY → LARK WORKFLOW VIEW (client presentation page)
   ========================================================= */
Pages['policy-to-lark'] = function(){
  const stages = [
    { key:'policy', label:'HR Policy', status:'done', responsible:'HR Policy Team', sees:'The written policy requirement.', action:'Define and publish the policy statement.',
      recorded:'"Employees must submit overtime claims within the applicable submission period."', next:'Translated into a configured rule in Lark.' },
    { key:'rule', label:'Lark Rule', status:'done', responsible:'System Configuration', sees:'Submission Window: 7 Days.', action:'Configure the rule so late claims are automatically flagged.',
      recorded:'The 7-day submission window as a system rule.', next:'Employee action is governed by this rule.' },
    { key:'emp', label:'Employee Action', status:'done', responsible:'Employee', sees:'Submit OT Claim form.', action:'Submit the claim within the window (or trigger the exception route).',
      recorded:'OT claim submission.', next:'Routed to Manager control.' },
    { key:'mgr', label:'Manager Control', status:'done', responsible:'Manager / HOD', sees:'Claim with attendance and hours.', action:'Verify work and hours performed.',
      recorded:'Manager verification.', next:'Routed to HR control.' },
    { key:'hr', label:'HR Control', status:'done', responsible:'Human Resources', sees:'Verification checklist.', action:'Verify eligibility and attendance reconciliation.',
      recorded:'HR verification outcome.', next:'Routed to Payroll.' },
    { key:'payroll', label:'Payroll', status:'done', responsible:'Payroll', sees:'Approved claim.', action:'Process in the next payroll cycle.',
      recorded:'Approved OT hours.', next:'Workflow closed with an audit record.' },
    { key:'audit', label:'Audit Record', status:'done', responsible:'System', sees:'Complete workflow history.', action:'None &mdash; retained automatically.',
      recorded:'Every step, actor and timestamp from policy to payroll.', next:'Available for audit and policy review.' }
  ];
  const wf = WF.render('p2l', stages, { vertical:true });
  return `
    ${pageHead('Client Presentation', 'From Policy to Lark Workflow', 'How one HR policy statement becomes a configured, auditable Lark workflow. Click any stage for detail.', 'SVE is advising VT Worldwide on both policy design and operational implementation.')}
    <div class="card">${wf}</div>
  `;
};

/* =========================================================
   CURRENT VS PROPOSED (client presentation page)
   ========================================================= */
const CVP = {
  tags: [ ['exists','CURRENTLY EXISTS','exists'], ['config','NEEDS CONFIGURATION','config'], ['confirm','NEEDS CONFIRMATION','confirm'], ['improve','PROPOSED IMPROVEMENT','improve'] ],
  mark(area, tagKey){
    STATE.cvp[area] = STATE.cvp[area] === tagKey ? null : tagKey;
    UI.render();
  }
};
Pages['current-vs-proposed'] = function(){
  return `
    ${pageHead('Client Presentation', 'Current Process vs Proposed Lark Workflow', 'For use during the onsite working session. Mark each item as the discussion progresses &mdash; not saved between sessions.')}
    <div class="card">
      ${VT_DATA.currentVsProposed.map(row => `
        <div class="cvp-row">
          <div><b style="display:block;margin-bottom:4px">${row.area}</b><div style="color:var(--muted);font-size:12px"><i>Current Process:</i> ${row.current}</div></div>
          <div style="font-size:12.5px"><i style="color:var(--muted)">Proposed Lark Workflow:</i> ${row.proposed}</div>
          <div class="cvp-tagset">
            ${CVP.tags.map(([key,label,cls]) => `<button class="cvp-tag ${STATE.cvp[row.area]===key?'selected '+cls:''}" onclick="CVP.mark('${row.area.replace(/'/g,"\\'")}','${key}')">${label}</button>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    ${advisoryNote('Variable operational rules (submission windows, escalation thresholds) should remain configurable rather than being embedded permanently into the principal policy document.')}
  `;
};

/* =========================================================
   WORKSHOP MODE — v2: five-state markers + per-area notes.
   Local session state only; nothing is persisted.
   ========================================================= */
const WORKSHOP = {
  markerDefs: {
    confirmed: { label:'&#10003; Confirmed Existing Process', short:'Confirmed Existing Process', cls:'sel-confirmed' },
    proposed:  { label:'&#9679; Proposed Configuration', short:'Proposed Configuration', cls:'sel-proposed' },
    toconfirm: { label:'? Requires VT Confirmation', short:'Requires VT Confirmation', cls:'sel-toconfirm' },
    gap:       { label:'&#9651; Gap Identified', short:'Gap Identified', cls:'sel-gap' },
    mgmt:      { label:'! Management Decision Required', short:'Management Decision Required', cls:'sel-mgmt' }
  },
  setMarker(area, key){
    STATE.workshop[area] = STATE.workshop[area] === key ? null : key;
    UI.render();
  },
  setNote(area, val){
    STATE.workshopNotes[area] = val;
  },
  card(area, current, proposed){
    const sel = STATE.workshop[area];
    const safeArea = area.replace(/'/g,"\\'");
    return `<div class="workshop-card">
      <div class="wc-head">
        <div><b>${area}</b><div class="wc-current-text"><i>Current VT Practice:</i> ${current}</div></div>
        <div class="wc-proposed">${proposed || ''}</div>
      </div>
      <div class="wc-markers">
        ${Object.entries(WORKSHOP.markerDefs).map(([key,def]) => `<button class="wc-mk ${sel===key?def.cls:''}" onclick="WORKSHOP.setMarker('${safeArea}','${key}')">${def.label}</button>`).join('')}
      </div>
      <textarea class="wc-note" placeholder="Workshop note&hellip;" onchange="WORKSHOP.setNote('${safeArea}', this.value)">${STATE.workshopNotes[area] || ''}</textarea>
    </div>`;
  }
};
Pages.workshop = function(){
  const cvpByArea = {};
  VT_DATA.currentVsProposed.forEach(r => cvpByArea[r.area] = r);
  return `
    <div class="workshop-banner">
      <span>WORKSHOP MODE &middot; VT Worldwide HR on Lark &mdash; discussion only, not persisted</span>
      <span style="display:flex;gap:8px">
        <button onclick="UI.goPage('workshop-summary')" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3)">View Summary</button>
        <button onclick="UI.toggleWorkshopMode()">Exit Workshop Mode</button>
      </span>
    </div>
    <div style="padding-top:20px">
      ${pageHead('Working Session', 'Current Process &rarr; Proposed Workflow', 'Select the marker that reflects the discussion for each workflow, and add a note where useful.')}
      <div class="workshop-grid">
        ${VT_DATA.workshopAreas.map(area => WORKSHOP.card(area, (cvpByArea[area] || {current:'To be validated with VT Worldwide', proposed:''}).current, (cvpByArea[area] || {current:'', proposed:''}).proposed)).join('')}
      </div>

      <h3 style="margin:28px 0 4px">Performance Management &mdash; Detailed Validation</h3>
      <p style="color:var(--muted);font-size:12.5px;margin:0 0 14px">Performance Management is the most complex discussion item for Thursday's session. Every item below defaults to SVE's proposed starting position &mdash; nothing is a confirmed finding until VT Worldwide changes or confirms it here.</p>
      <div class="workshop-grid">
        ${VT_DATA.pm.workshopItems.map(item => WORKSHOP.card(item.label, 'To Be Confirmed with VT Worldwide', item.proposed)).join('')}
      </div>
    </div>
  `;
};

/* =========================================================
   WORKSHOP SUMMARY
   ========================================================= */
WORKSHOP.groupMeta = [
  ['confirmed','CONFIRMED', 'var(--success)'],
  ['toconfirm','TO CONFIRM', 'var(--warning)'],
  ['gap','GAPS IDENTIFIED', 'var(--danger)'],
  ['proposed','PROPOSED CONFIGURATION', 'var(--accent)'],
  ['mgmt','MANAGEMENT DECISION REQUIRED', '#6a3fc7']
];
WORKSHOP.groupAreas = function(areaList){
  const groups = { confirmed:[], proposed:[], toconfirm:[], gap:[], mgmt:[] };
  areaList.forEach(area => {
    const key = STATE.workshop[area];
    if (key && groups[key]) groups[key].push(area);
  });
  return groups;
};
WORKSHOP.renderGroups = function(groups, anyMarked, emptyMsg){
  if (!anyMarked) return `<p style="color:var(--muted)">${emptyMsg}</p>`;
  return WORKSHOP.groupMeta.map(([key,title,color]) => groups[key].length ? `
    <div class="summary-group">
      <h4><span class="summary-dot" style="background:${color}"></span>${title}</h4>
      <ul>${groups[key].map(area => `<li>${area}${STATE.workshopNotes[area] ? `<span class="note"> &mdash; ${STATE.workshopNotes[area]}</span>` : ''}</li>`).join('')}</ul>
    </div>` : '').join('');
};

Pages['workshop-summary'] = function(){
  const genericAreas = VT_DATA.workshopAreas;
  const pmAreas = VT_DATA.pm.workshopItems.map(i => i.label);
  const groups = WORKSHOP.groupAreas(genericAreas);
  const pmGroups = WORKSHOP.groupAreas(pmAreas);
  const anyMarked = genericAreas.some(a => STATE.workshop[a]);
  const anyPmMarked = pmAreas.some(a => STATE.workshop[a]);
  return `
    ${pageHead('Working Session', 'Workshop Summary', 'Automatically summarised from the markers selected in Workshop Mode.')}
    <div class="btnrow" style="margin-bottom:16px">
      <button class="btn btn-primary" onclick="WORKSHOP.copySummary()">Copy Summary</button>
      <button class="btn" onclick="window.print()">Print / Export View</button>
      <button class="btn btn-ghost" onclick="UI.goPage('workshop')">&larr; Back to Workshop Mode</button>
      ${STATE.workshopMode ? `<button class="btn btn-ghost" onclick="UI.toggleWorkshopMode()">Exit Workshop Mode</button>` : ''}
    </div>
    <div class="card" id="workshopSummaryCard">
      ${WORKSHOP.renderGroups(groups, anyMarked, 'No workshop markers selected yet. Open Workshop Mode and mark each workflow to build this summary.')}
    </div>
    <div class="card">
      <h3 style="margin-bottom:12px">Performance Management</h3>
      ${WORKSHOP.renderGroups(pmGroups, anyPmMarked, 'No Performance Management markers selected yet.')}
    </div>
  `;
};
WORKSHOP.summaryText = function(){
  const titles = { confirmed:'CONFIRMED', toconfirm:'TO CONFIRM', gap:'GAPS IDENTIFIED', proposed:'PROPOSED CONFIGURATION', mgmt:'MANAGEMENT DECISION REQUIRED' };
  const order = ['confirmed','toconfirm','gap','proposed','mgmt'];
  const writeGroups = (groups) => {
    let out = '';
    order.forEach(key => {
      if (!groups[key].length) return;
      out += titles[key] + '\n';
      groups[key].forEach(area => {
        out += '- ' + area + (STATE.workshopNotes[area] ? ' — ' + STATE.workshopNotes[area] : '') + '\n';
      });
      out += '\n';
    });
    return out;
  };
  let out = 'VT Worldwide — Workshop Summary\n\n';
  out += writeGroups(WORKSHOP.groupAreas(VT_DATA.workshopAreas));
  out += 'PERFORMANCE MANAGEMENT\n\n';
  out += writeGroups(WORKSHOP.groupAreas(VT_DATA.pm.workshopItems.map(i => i.label)));
  return out;
};
WORKSHOP.copySummary = function(){
  const text = WORKSHOP.summaryText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => UI.toast('Summary copied to clipboard.', 'success'),
      () => UI.toast('Could not copy — clipboard access blocked in this environment.', 'warn')
    );
  } else {
    UI.toast('Clipboard not available in this environment.', 'warn');
  }
};

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', UI.init);
