(() => {
  const fictionalEmployees = [
    ["Aisha Rahman","Senior Executive, People Operations","SVE International Sdn. Bhd.","Active"],
    ["Daniel Ong","Manager, Corporate Services","SVE International Pte. Ltd.","Active"],
    ["Priya Nathan","Executive, Business Operations","SVE International Sdn. Bhd.","Probation"]
  ];

  const launch = document.createElement('button');
  launch.className = 'portal-launch';
  launch.textContent = 'Enter People Portal →';
  launch.setAttribute('aria-label','Enter fictional People portal demonstration');
  document.body.appendChild(launch);

  const overlay = document.createElement('section');
  overlay.className = 'portal-overlay';
  overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML = `
    <div class="portal-shell">
      <header class="portal-top">
        <div class="portal-brand"><img src="assets/sve-logo.jpeg" alt="SVE Group"><span>SVE GROUP ENTERPRISE PLATFORM</span></div>
        <div class="portal-user"><strong>Executive Demonstration</strong>Fictional data · presentation environment</div>
      </header>
      <aside class="portal-side">
        <button class="portal-nav" data-view="home">Group Home</button>
        <h4>MY WORKSPACE</h4>
        <button class="portal-nav active" data-view="mysve">My SVE</button>
        <button class="portal-nav" data-view="tasks">My Tasks</button>
        <h4>PEOPLE</h4>
        <button class="portal-nav" data-view="dashboard">People Dashboard</button>
        <button class="portal-nav" data-view="directory">Employee Directory</button>
        <button class="portal-nav" data-view="lifecycle">HR Lifecycle</button>
        <button class="portal-nav" data-view="approvals">Approvals</button>
        <h4>INTELLIGENCE</h4>
        <button class="portal-nav" data-view="vault">Data Vault</button>
      </aside>
      <main class="portal-main">
        <div class="portal-mainbar"><div><div class="portal-kicker">PEOPLE · INTERACTIVE PRODUCT PREVIEW</div><h1 id="portalTitle">My SVE</h1></div><button class="portal-close">← Return to Briefing</button></div>
        <div id="portalBody"></div>
      </main>
    </div>`;
  document.body.appendChild(overlay);

  const toast = document.createElement('div');
  toast.className = 'portal-toast';
  document.body.appendChild(toast);
  const body = overlay.querySelector('#portalBody');
  const title = overlay.querySelector('#portalTitle');

  function profile(){return `<div class="portal-grid"><div class="portal-card"><div class="label">Employment Status</div><div class="value">Active</div></div><div class="portal-card"><div class="label">Legal Entity</div><div class="value" style="font-size:16px">SVE International<br>Sdn. Bhd.</div></div><div class="portal-card"><div class="label">Open Tasks</div><div class="value">3</div></div><div class="portal-card"><div class="label">Lifecycle</div><div class="value" style="font-size:18px">Confirmed</div></div></div><div class="portal-panel"><div class="portal-tabs"><button class="portal-tab active" data-tab="overview">Overview</button><button class="portal-tab" data-tab="employment">Employment</button><button class="portal-tab" data-tab="organisation">Organisation & Reporting</button><button class="portal-tab" data-tab="history">History</button></div><div class="portal-content" id="profileContent">${profileTab('overview')}</div></div><p class="portal-note"><strong>Demonstration only.</strong> This preview uses fictional employee information while reflecting the People / Employee Master experience already built for SVEGIP.</p>`}
  function profileTab(tab){
    if(tab==='employment') return `<div class="employee-hero"><div class="avatar">AR</div><div><div class="employee-name">Aisha Rahman</div><div class="employee-meta">Senior Executive, People Operations</div></div><span class="badge">ACTIVE</span></div><div class="detail-grid"><div class="detail"><span>Employment Type</span><strong>Permanent</strong></div><div class="detail"><span>Commencement</span><strong>10 February 2025</strong></div><div class="detail"><span>Current Assignment</span><strong>People Operations</strong></div></div>`;
    if(tab==='organisation') return `<div class="detail-grid"><div class="detail"><span>Group</span><strong>SVE Group</strong></div><div class="detail"><span>Legal Entity</span><strong>SVE International Sdn. Bhd.</strong></div><div class="detail"><span>Department</span><strong>People Operations</strong></div><div class="detail"><span>Position</span><strong>Senior Executive</strong></div><div class="detail"><span>Reports To</span><strong>Daniel Ong · Manager</strong></div><div class="detail"><span>Work Location</span><strong>Kuala Lumpur</strong></div></div>`;
    if(tab==='history') return `<table class="portal-table"><thead><tr><th>Date</th><th>Event</th><th>Outcome</th></tr></thead><tbody><tr><td>01 Jun 2025</td><td>Probation Review</td><td><span class="badge">Confirmed</span></td></tr><tr><td>10 Feb 2025</td><td>Onboarding</td><td>Completed</td></tr></tbody></table>`;
    return `<div class="employee-hero"><div class="avatar">AR</div><div><div class="employee-name">Aisha Rahman</div><div class="employee-meta">Senior Executive, People Operations · Kuala Lumpur</div></div><span class="badge">ACTIVE</span></div><div class="detail-grid"><div class="detail"><span>Employee Record</span><strong>Core identity & employment record</strong></div><div class="detail"><span>Reporting</span><strong>Daniel Ong · Manager</strong></div><div class="detail"><span>Lifecycle</span><strong>Confirmed</strong></div></div>`;
  }
  function directory(){return `<div class="portal-panel"><div class="portal-content"><table class="portal-table"><thead><tr><th>Employee</th><th>Position</th><th>Legal Entity</th><th>Status</th><th></th></tr></thead><tbody>${fictionalEmployees.map((e,i)=>`<tr><td><strong>${e[0]}</strong></td><td>${e[1]}</td><td>${e[2]}</td><td>${e[3]}</td><td><button class="portal-action" data-profile="${i}">View Profile →</button></td></tr>`).join('')}</tbody></table></div></div>`}
  function dashboard(){return `<div class="portal-grid"><div class="portal-card"><div class="label">Active Employees</div><div class="value">18</div></div><div class="portal-card"><div class="label">Onboarding</div><div class="value">2</div></div><div class="portal-card"><div class="label">Probation Reviews</div><div class="value">3</div></div><div class="portal-card"><div class="label">Pending Approvals</div><div class="value">4</div></div></div><div class="portal-panel"><div class="portal-content"><strong>People Operations</strong><p class="employee-meta">A management view of employee lifecycle activity, approvals and current workforce records.</p></div></div>`}
  function lifecycle(){return `<div class="portal-panel"><div class="portal-content"><table class="portal-table"><thead><tr><th>Employee</th><th>Lifecycle</th><th>Stage</th><th>Status</th></tr></thead><tbody><tr><td>Priya Nathan</td><td>Probation & Confirmation</td><td>Review</td><td><span class="badge">In Progress</span></td></tr><tr><td>Aisha Rahman</td><td>Employment Change</td><td>Completed</td><td>History retained</td></tr><tr><td>Daniel Ong</td><td>Onboarding</td><td>Completed</td><td>Record established</td></tr></tbody></table></div></div>`}
  function tasks(){return `<div class="portal-panel"><div class="portal-content"><table class="portal-table"><thead><tr><th>Task</th><th>Stage</th><th>Due</th><th></th></tr></thead><tbody><tr><td>Review probation outcome — Priya Nathan</td><td>Manager Review</td><td>Today</td><td><button class="portal-action" data-demo>Open</button></td></tr><tr><td>Employment change approval</td><td>HR Review</td><td>Tomorrow</td><td><button class="portal-action" data-demo>Open</button></td></tr></tbody></table></div></div>`}
  function approvals(){return `<div class="portal-panel"><div class="portal-content"><h3 style="margin-top:0">Approval Queue</h3><p class="employee-meta">Employment Change and Offboarding use the shared Workflow & Approval foundation.</p><table class="portal-table"><thead><tr><th>Case</th><th>Type</th><th>Stage</th><th>Action</th></tr></thead><tbody><tr><td>Priya Nathan</td><td>Employment Change</td><td>Pending Decision</td><td><button class="portal-action" data-demo>Review →</button></td></tr></tbody></table></div></div>`}
  function placeholder(name,copy){return `<div class="portal-panel"><div class="portal-content"><h3 style="margin-top:0">${name}</h3><p class="employee-meta">${copy}</p><button class="portal-action" data-demo>Explore Preview</button></div></div>`}
  const views={mysve:['My SVE',profile],dashboard:['People Dashboard',dashboard],directory:['Employee Directory',directory],lifecycle:['HR Lifecycle',lifecycle],tasks:['My Tasks',tasks],approvals:['Approvals',approvals],home:['Group Home',()=>placeholder('SVE Group Home','Return to the connected Group workspace and management information.')],vault:['Data Vault',()=>placeholder('Data Vault','Screen 06 will extend this product experience into SVE\'s governed information and management flow.')]};
  function render(view){const [name,fn]=views[view]||views.mysve;title.textContent=name;body.innerHTML=fn();overlay.querySelectorAll('.portal-nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));}
  function open(){overlay.classList.add('is-open');overlay.setAttribute('aria-hidden','false');render('mysve');}
  function close(){overlay.classList.remove('is-open');overlay.setAttribute('aria-hidden','true');}
  launch.addEventListener('click',open);overlay.querySelector('.portal-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{const nav=e.target.closest('[data-view]');if(nav)render(nav.dataset.view);const tab=e.target.closest('[data-tab]');if(tab){overlay.querySelectorAll('.portal-tab').forEach(t=>t.classList.toggle('active',t===tab));overlay.querySelector('#profileContent').innerHTML=profileTab(tab.dataset.tab)}if(e.target.closest('[data-profile]'))render('mysve');if(e.target.closest('[data-demo]')){toast.textContent='Interactive demonstration — workflow detail will expand in the next build phase.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('is-open'))close()});
  const updateLaunch=()=>{const txt=document.body.innerText||'';launch.classList.toggle('is-visible',txt.includes('05 / 05')&&!overlay.classList.contains('is-open'))};
  new MutationObserver(updateLaunch).observe(document.querySelector('#app'),{subtree:true,childList:true,characterData:true});updateLaunch();
})();