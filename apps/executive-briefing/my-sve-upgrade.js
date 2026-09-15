(() => {
  const eric = {
    name: 'Eric Tang Kum Yong',
    empNo: 'SG0016',
    title: 'Chief Strategy & Planning Officer',
    entities: ['SVE International Pte. Ltd.', 'SVE International Sdn. Bhd.'],
    reporting: 'Chief Executive Officer / Board of Directors'
  };

  const overview = () => `
    <section class="mysve-profile-card">
      <div class="mysve-identity">
        <div class="mysve-avatar">ET</div>
        <div class="mysve-person">
          <div class="mysve-name-row"><h2>${eric.name}</h2><span class="management-chip">MANAGEMENT</span></div>
          <div class="mysve-title">${eric.title}</div>
          <div class="mysve-entities">${eric.entities.join(' &nbsp;|&nbsp; ')}</div>
          <div class="mysve-reporting">Reporting to: <strong>${eric.reporting}</strong></div>
        </div>
        <span class="badge mysve-active">ACTIVE</span>
      </div>
      <div class="mysve-facts">
        <div><span>Employee No.</span><strong>${eric.empNo}</strong></div>
        <div><span>Position</span><strong>${eric.title}</strong></div>
        <div><span>Associated Entities</span><strong>Singapore HQ / Malaysia</strong></div>
        <div><span>Reporting</span><strong>CEO / Board of Directors</strong></div>
      </div>
    </section>
    <section class="mysve-lower-grid">
      <div class="mysve-widget quick-links">
        <h3>↗ &nbsp; Quick Links</h3>
        <button data-eric-tab="employment">View Employment Details <b>›</b></button>
        <button data-eric-tab="organisation">Organisation & Reporting <b>›</b></button>
        <button data-preview-message="Leave Balance is reserved for the employee self-service phase.">Leave Balance <b>›</b></button>
        <button data-view="tasks">My Tasks <b>›</b></button>
        <button data-preview-message="My Payslips is planned as employee self-service.">My Payslips <b>›</b></button>
        <button data-preview-message="iClaims is planned as employee self-service.">iClaims <b>›</b></button>
      </div>
      <div class="mysve-widget key-info">
        <h3>▣ &nbsp; Key Information</h3>
        <dl>
          <div><dt>Employee No.</dt><dd>${eric.empNo}</dd></div>
          <div><dt>Full Name</dt><dd>${eric.name}</dd></div>
          <div><dt>Position Title</dt><dd>${eric.title}</dd></div>
          <div><dt>Entities</dt><dd>${eric.entities.join('<br>')}</dd></div>
          <div><dt>Reporting To</dt><dd>${eric.reporting}</dd></div>
          <div><dt>Employment Status</dt><dd>Active</dd></div>
        </dl>
      </div>
      <div class="mysve-widget organisation-widget">
        <h3>♙ &nbsp; Organisation</h3>
        <div class="org-chart">
          <div>Board of Directors</div><i></i><div>Chief Executive Officer</div><i></i><div class="org-current"><strong>${eric.name}</strong><span>${eric.title}</span></div>
        </div>
        <div class="associated"><h4>Associated Entities</h4><p>${eric.entities[0]} <b>HQ</b></p><p>${eric.entities[1]} <b>Regional</b></p></div>
      </div>
    </section>`;

  const summary = () => `
    <div class="mysve-summary-grid">
      <div class="mysve-summary"><span>EMPLOYMENT STATUS</span><strong class="active-text">Active</strong></div>
      <div class="mysve-summary"><span>LEGAL ENTITY</span><strong>${eric.entities.join('<br>')}</strong></div>
      <div class="mysve-summary"><span>OPEN TASKS</span><strong>3</strong></div>
      <div class="mysve-summary"><span>CONFIRMATION STATUS</span><strong>Confirmed</strong></div>
    </div>`;

  function upgrade() {
    const title = document.querySelector('#portalTitle');
    const body = document.querySelector('#portalBody');
    if (!title || !body || title.textContent.trim() !== 'My SVE' || body.dataset.mysveUpgraded === 'true') return;
    body.dataset.mysveUpgraded = 'true';
    body.innerHTML = `${summary()}<section class="mysve-main-card"><div class="portal-tabs mysve-tabs"><button class="portal-tab active" data-mysve-tab="overview">Overview</button><button class="portal-tab" data-eric-tab="employment">Employment</button><button class="portal-tab" data-eric-tab="organisation">Organisation & Reporting</button><button class="portal-tab" data-eric-tab="lifecycle">Lifecycle</button><button class="portal-tab" data-eric-tab="history">History</button></div><div class="mysve-overview">${overview()}</div></section>`;
  }

  document.addEventListener('click', e => {
    const msg = e.target.closest('[data-preview-message]');
    if (msg) alert(msg.dataset.previewMessage);
    const overviewTab = e.target.closest('[data-mysve-tab="overview"]');
    if (overviewTab) {
      const body = document.querySelector('#portalBody');
      if (body) { body.dataset.mysveUpgraded = ''; setTimeout(upgrade, 0); }
    }
  });
  new MutationObserver(upgrade).observe(document.body, {subtree:true, childList:true, characterData:true});
  setTimeout(upgrade, 0);
})();