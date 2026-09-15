(() => {
  const eric = {
    name: 'Eric Tang Kum Yong',
    empNo: 'SG0016',
    title: 'Chief Strategy & Planning Officer',
    entities: ['SVE International Pte. Ltd.', 'SVE International Sdn. Bhd.'],
    reporting: 'Chief Executive Officer / Board of Directors'
  };

  const hero = () => `<section class="mysve-profile-card"><div class="mysve-identity"><div class="mysve-avatar">ET</div><div class="mysve-person"><div class="mysve-name-row"><h2>${eric.name}</h2><span class="management-chip">MANAGEMENT</span></div><div class="mysve-title">${eric.title}</div><div class="mysve-entities">${eric.entities.join(' &nbsp;|&nbsp; ')}</div><div class="mysve-reporting">Reporting to: <strong>${eric.reporting}</strong></div></div><span class="badge mysve-active">ACTIVE</span></div></section>`;

  const summary = () => `<div class="mysve-summary-grid"><div class="mysve-summary"><span>EMPLOYMENT STATUS</span><strong class="active-text">Active</strong></div><div class="mysve-summary"><span>LEGAL ENTITY</span><strong>${eric.entities.join('<br>')}</strong></div><div class="mysve-summary"><span>OPEN TASKS</span><strong>3</strong></div><div class="mysve-summary"><span>CONFIRMATION STATUS</span><strong>Confirmed</strong></div></div>`;

  const overview = () => `${hero()}<section class="mysve-lower-grid"><div class="mysve-widget quick-links"><h3>↗ &nbsp; Quick Links</h3><button data-mysve-route="employment">View Employment Details <b>›</b></button><button data-mysve-route="organisation">Organisation & Reporting <b>›</b></button><button data-preview-message="Leave Balance is reserved for the employee self-service phase.">Leave Balance <b>›</b></button><button data-view="tasks">My Tasks <b>›</b></button><button data-preview-message="My Payslips is planned as employee self-service.">My Payslips <b>›</b></button><button data-preview-message="iClaims is planned as employee self-service.">iClaims <b>›</b></button></div><div class="mysve-widget key-info"><h3>▣ &nbsp; Key Information</h3><dl><div><dt>Employee No.</dt><dd>${eric.empNo}</dd></div><div><dt>Full Name</dt><dd>${eric.name}</dd></div><div><dt>Position Title</dt><dd>${eric.title}</dd></div><div><dt>Entities</dt><dd>${eric.entities.join('<br>')}</dd></div><div><dt>Reporting To</dt><dd>${eric.reporting}</dd></div><div><dt>Employment Status</dt><dd>Active</dd></div></dl></div><div class="mysve-widget organisation-widget"><h3>♙ &nbsp; Organisation</h3><div class="org-chart"><div>Board of Directors</div><i></i><div>Chief Executive Officer</div><i></i><div class="org-current"><strong>${eric.name}</strong><span>${eric.title}</span></div></div><div class="associated"><h4>Associated Entities</h4><p>${eric.entities[0]} <b>HQ</b></p><p>${eric.entities[1]} <b>Regional</b></p></div></div></section>`;

  const employment = () => `${hero()}<section class="mysve-section-grid"><div class="mysve-widget mysve-detail-card"><h3>Employment Details</h3><dl><div><dt>Employee No.</dt><dd>${eric.empNo}</dd></div><div><dt>Position</dt><dd>${eric.title}</dd></div><div><dt>Employment Status</dt><dd>Active</dd></div><div><dt>Primary Entity</dt><dd>${eric.entities[0]}</dd></div><div><dt>Associated Entity</dt><dd>${eric.entities[1]}</dd></div></dl></div><div class="mysve-widget mysve-detail-card"><h3>Role & Access Context</h3><p>Executive employee record with authorised management access to SVE Group applications.</p><div class="mysve-callout">Personal employment information remains separate from restricted HR and Finance management applications.</div></div></section>`;

  const organisation = () => `${hero()}<section class="mysve-section-grid"><div class="mysve-widget organisation-widget mysve-org-large"><h3>Organisation & Reporting</h3><div class="org-chart"><div>Board of Directors</div><i></i><div>Chief Executive Officer</div><i></i><div class="org-current"><strong>${eric.name}</strong><span>${eric.title}</span></div></div></div><div class="mysve-widget mysve-detail-card"><h3>Associated Entities</h3><dl><div><dt>${eric.entities[0]}</dt><dd><span class="entity-chip">HQ</span></dd></div><div><dt>${eric.entities[1]}</dt><dd><span class="entity-chip">Regional</span></dd></div><div><dt>Reporting To</dt><dd>${eric.reporting}</dd></div></dl></div></section>`;

  const lifecycle = () => `${hero()}<section class="mysve-widget mysve-wide-card"><h3>Employment Lifecycle</h3><div class="journey"><div class="journey-step done"><b>JOIN</b><span>Employment record established</span></div><div class="journey-step done"><b>PROBATION</b><span>Confirmed</span></div><div class="journey-step"><b>MOVEMENT</b><span>Employment changes</span></div><div class="journey-step"><b>EXIT</b><span>Controlled offboarding</span></div></div></section>`;

  const history = () => `${hero()}<section class="mysve-widget mysve-wide-card"><h3>Employment History</h3><table class="portal-table"><tr><th>Record</th><th>Status</th><th>Control</th></tr><tr><td>Employee Master · ${eric.empNo}</td><td>Active</td><td>Controlled record</td></tr><tr><td>Current position · ${eric.title}</td><td>Current</td><td>Effective employment record</td></tr><tr><td>Confirmation</td><td>Confirmed</td><td>Lifecycle history retained</td></tr></table></section>`;

  const renderTab = tab => ({overview,employment,organisation,lifecycle,history}[tab] || overview)();
  const tabs = active => `<div class="portal-tabs mysve-tabs">${[['overview','Overview'],['employment','Employment'],['organisation','Organisation & Reporting'],['lifecycle','Lifecycle'],['history','History']].map(([key,label])=>`<button class="portal-tab ${active===key?'active':''}" data-mysve-route="${key}">${label}</button>`).join('')}</div>`;

  function renderMySve(tab='overview') {
    const title = document.querySelector('#portalTitle');
    const kicker = document.querySelector('#portalKicker');
    const body = document.querySelector('#portalBody');
    if (!title || !body) return;
    title.textContent = 'My SVE';
    if (kicker) kicker.textContent = 'MY WORKSPACE / EMPLOYEE';
    body.dataset.mysveUpgraded = 'true';
    body.innerHTML = `${summary()}<section class="mysve-main-card">${tabs(tab)}<div class="mysve-overview">${renderTab(tab)}</div></section>`;
  }

  function upgrade() {
    const title = document.querySelector('#portalTitle');
    const body = document.querySelector('#portalBody');
    if (!title || !body || title.textContent.trim() !== 'My SVE' || body.dataset.mysveUpgraded === 'true') return;
    renderMySve('overview');
  }

  document.addEventListener('click', e => {
    const route = e.target.closest('[data-mysve-route]');
    if (route) { e.preventDefault(); e.stopImmediatePropagation(); renderMySve(route.dataset.mysveRoute); return; }
    const msg = e.target.closest('[data-preview-message]');
    if (msg) { e.preventDefault(); e.stopImmediatePropagation(); alert(msg.dataset.previewMessage); }
  }, true);

  new MutationObserver(upgrade).observe(document.body, {subtree:true, childList:true, characterData:true});
  setTimeout(upgrade, 0);
})();