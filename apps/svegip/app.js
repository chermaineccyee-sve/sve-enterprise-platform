
const seed={
 announcements:[
  {id:1,title:"SVE Group Internal Portal – Management Review",summary:"Initial management-review environment prepared for internal evaluation.",audience:"All SVE",date:"2026-09-05",status:"Published"},
  {id:2,title:"SVE Monthly Meeting – September",summary:"Next monthly meeting scheduled for 25 September 2026.",audience:"Management",date:"2026-09-25",status:"Published"}
 ],
 projects:[
  {id:1,name:"Nusantara",unit:"SVE / SKL",owner:"Management",status:"Active",next:"Monthly review",priority:"Medium"},
  {id:2,name:"Axtraction AI",unit:"SVE / SKL",owner:"Executive Office",status:"Active",next:"HR & governance workstream",priority:"High"},
  {id:3,name:"Best88",unit:"SVE / SKL",owner:"Management",status:"Active",next:"Status update",priority:"Medium"},
  {id:4,name:"Guo Xiumin",unit:"SKL",owner:"Legal Team",status:"Review",next:"Matter review",priority:"Medium"},
  {id:5,name:"Hafiz",unit:"SKL",owner:"Legal Team",status:"Active",next:"Matter update",priority:"Medium"},
  {id:6,name:"Khairul Mustaqim",unit:"SKL",owner:"Legal Team",status:"Active",next:"Matter update",priority:"Medium"}
 ],
 policies:[
  {id:1,code:"SVE-GOV-001",title:"Group Code of Conduct",category:"Governance",version:"0.1",owner:"Management",review:"2027-09-01",status:"Draft"},
  {id:2,code:"SVE-HR-001",title:"Employee Handbook",category:"People & HR",version:"0.1",owner:"People & Culture",review:"2027-09-01",status:"Draft"},
  {id:3,code:"SVE-IT-001",title:"IT Acceptable Use Policy",category:"IT",version:"0.1",owner:"Administration",review:"2027-09-01",status:"Draft"},
  {id:4,code:"SKL-SOP-001",title:"Client Matter Opening Procedure",category:"SKL SOP",version:"0.1",owner:"SKL",review:"2027-09-01",status:"Draft"},
  {id:5,code:"SKL-SOP-002",title:"Conflict Checking Procedure",category:"SKL SOP",version:"0.1",owner:"SKL",review:"2027-09-01",status:"Draft"}
 ],
 documents:[
  {id:1,title:"SVE Monthly Meeting Minutes",type:"Meeting Minutes",area:"Executive Office",access:"Management",status:"Current"},
  {id:2,title:"SVE Monthly Meeting Agenda",type:"Agenda",area:"Executive Office",access:"Management",status:"Current"},
  {id:3,title:"Policy Registry",type:"Registry",area:"Corporate Governance",access:"Management",status:"Working"},
  {id:4,title:"Project Status Register",type:"Registry",area:"Projects & Clients",access:"Management",status:"Working"},
  {id:5,title:"Corporate Templates",type:"Templates",area:"Knowledge & Documents",access:"All SVE",status:"Current"},
  {id:6,title:"SKL Matter Opening Checklist",type:"Checklist",area:"SKL",access:"SKL",status:"Working"},
  {id:7,title:"SKL Conflict Check Record",type:"Controlled Record",area:"SKL",access:"SKL",status:"Working"}
 ],
 meetings:[
  {id:1,title:"SVE Monthly Meeting",date:"2026-09-25",time:"11:00 AM – 12:00 PM",owner:"Executive Office",status:"Upcoming"},
  {id:2,title:"Previous SVE Monthly Meeting",date:"2026-08-28",time:"11:00 AM – 12:00 PM",owner:"Executive Office",status:"Completed"}
 ],
 actions:[
  {id:1,title:"Nusantara status update",owner:"Farah",due:"2026-09-25",project:"Nusantara",status:"Open"},
  {id:2,title:"Axtraction AI workstream update",owner:"Executive Office",due:"2026-09-25",project:"Axtraction AI",status:"Open"}
 ],
 people:[
  {id:1,name:"Portal Administrator",unit:"Executive Office",role:"Administrator",status:"Active"},
  {id:2,name:"Management User",unit:"SVE",role:"Management",status:"Active"},
  {id:3,name:"SKL User",unit:"SKL",role:"SKL User",status:"Active"}
 ],
 audit:[{id:1,when:new Date().toISOString(),module:"System",action:"Management-review portal initialized"}]
};
let db=structuredClone(seed),session=null,active="home",adminTab="announcements",sklContext=false,navHistory=[];
let authReady=false;

async function loadCentralDB(){
 try{
  const r=await fetch("/api/portal-data",{credentials:"same-origin"});
  if(!r.ok)throw new Error("Unable to load shared portal data.");
  const x=await r.json();db=x.data||structuredClone(seed);return true;
 }catch(e){console.error(e);db=structuredClone(seed);return false}
}
async function bootstrapAuth(){try{const r=await fetch("/api/session",{credentials:"same-origin"});if(r.ok){const x=await r.json();session=x.user||null}}catch(e){}authReady=true;
 if(session){
   await loadCentralDB();
   if(active==="home"){
     if(session.role==="SKL User / Legal Reviewer" && session.unit==="SKL") active="skl";
     else active="home";
   }
 }
 render()}
async function signOut(){try{await fetch("/api/logout",{method:"POST",credentials:"include",cache:"no-store"})}catch(e){}session=null;location.replace("/?signedout=1")}
function statusBadge(s){let c=/active|published|current|completed/i.test(s)?"good":/review|working|upcoming|open|progress/i.test(s)?"warn":/pending|cancel/i.test(s)?"bad":"draft";return `<span class="badge ${c}">${esc(s)}</span>`}
function fmtDate(d){if(!d)return "—";return new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
function esc(v){return String(v??"").replace(/[&<>"]/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[x]))}
function canEdit(){return ["Administrator","Management"].includes(session?.role)}
function canSeeAdmin(){return session?.role==="Administrator"}
function app(){return document.getElementById("app")}

function render(){
 if(!authReady){app().innerHTML='<div class="auth-loading">Checking secure session...</div>';return}
 if(!session){renderLogin();return}
 app().innerHTML=`<div class="shell ${sklContext?"skl-theme":(sidebarMode()==="sve"?"sve-theme":"group-theme")}">
 <aside class="sidebar">${sidebarBrand()}
 <nav class="nav contextual-nav">${sidebarNav()}</nav><div class="side-foot"><div class="side-user">${esc(session.name)}</div><div class="side-role">${esc(session.role)} · ${esc(session.unit)}</div><button class="logout" onclick="signOut()">Sign out</button></div></aside>
 <main class="main"><header class="topbar"><div class="topbar-title"><button class="mobile-nav-toggle" onclick="togglePortalNav()" aria-label="Open navigation">☰</button><div><div class="eyebrow">${sklContext?"SK LAI & PARTNERS":"SVE GROUP"}</div><h1>${title(active)}</h1></div></div><div class="top-right"><input class="search" placeholder="Search portal..." oninput="searchPortal(this.value)"><div class="avatar">${initials(session.name)}</div></div></header><section class="content" id="content"></section></main>
 </div><div class="portal-nav-overlay" id="portalNavOverlay" onclick="togglePortalNav(false)"></div><div class="modal-bg" id="modalBg"><div class="modal" id="modal"></div></div>`;
 renderSection();
}
function togglePortalNav(force){const sb=document.querySelector(".sidebar"),ov=document.getElementById("portalNavOverlay");if(!sb)return;const open=typeof force==="boolean"?force:!sb.classList.contains("open");sb.classList.toggle("open",open);if(ov)ov.classList.toggle("show",open);document.body.classList.toggle("nav-open",open)}
function renderLogin(){
 app().innerHTML=`<div class="login-shell"><section class="login-brand"><div><img class="login-logo" src="assets/sve-logo.jpeg"><h1>SVE Group<br>Internal Portal</h1><p>A centralised workspace where information connects, governance aligns and the Group moves forward.</p><div class="login-values"><span>Sustainable</span><span>Venture</span><span>Equity</span></div></div><div style="font-size:11px;opacity:.65">SVEGIP · Secure Employee Access</div></section><section class="login-panel"><div class="login-card"><div class="eyebrow">SVE GROUP · AUTHENTICATED ACCESS</div><h2>Employee Sign In</h2><p>Use your employee account to access SVEGIP and authorised SVE Data Vault resources.</p><form onsubmit="secureLogin(event)"><div class="field"><label>Employee Email</label><input id="loginEmail" type="email" autocomplete="username" required placeholder="name@company.com"></div><div class="field"><label>Password</label><input id="loginPassword" type="password" autocomplete="current-password" required></div><button class="login-btn" type="submit">Sign In</button><div id="loginError" class="demo-note" style="display:none"></div></form><button class="btn secondary" type="button" onclick="openFirstAdminSetup()" style="width:100%;margin-top:12px">First-time Administrator Setup</button><div class="demo-note"><strong>Protected access:</strong> authentication is validated on the server and the secure session carries your employee name, role and business unit throughout the portal.</div></div></section></div>`;
}

function openFirstAdminSetup(){
  document.body.insertAdjacentHTML("beforeend",`<div id="firstAdminOverlay" style="position:fixed;inset:0;background:rgba(20,12,38,.62);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px">
  <div style="background:white;border-radius:18px;max-width:520px;width:100%;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.28)">
    <div style="display:flex;justify-content:space-between;gap:18px;align-items:flex-start">
      <div><div class="eyebrow">SVEGIP INITIALISATION</div><h2 style="margin:5px 0 8px">First Administrator Setup</h2><p style="margin:0 0 18px">Use this once to create the first SVEGIP Administrator. The server disables bootstrap after the first account exists.</p></div>
      <button type="button" onclick="document.getElementById('firstAdminOverlay').remove()" style="border:0;background:transparent;font-size:25px;cursor:pointer">×</button>
    </div>
    <form onsubmit="submitFirstAdminSetup(event)">
      <div class="field"><label>Display Name</label><input id="setupName" value="Ching Yee" autocomplete="name" required></div>
      <div class="field"><label>Employee / Work Email</label><input id="setupEmail" type="email" autocomplete="email" required></div>
      <div class="field"><label>New Password</label><input id="setupPassword" type="password" minlength="12" autocomplete="new-password" required></div>
      <div class="field"><label>Confirm Password</label><input id="setupPassword2" type="password" minlength="12" autocomplete="new-password" required></div>
      <div class="field"><label>Bootstrap Secret</label><input id="setupSecret" type="password" autocomplete="off" required></div>
      <button id="setupSubmit" class="login-btn" type="submit">Create First Administrator</button>
      <div id="setupStatus" class="demo-note" style="display:none;margin-top:12px"></div>
    </form>
  </div></div>`);
}
async function submitFirstAdminSetup(e){
  e.preventDefault();
  const status=document.getElementById("setupStatus"),btn=document.getElementById("setupSubmit");
  const password=document.getElementById("setupPassword").value;
  if(password!==document.getElementById("setupPassword2").value){status.textContent="Passwords do not match.";status.style.display="block";return}
  status.textContent="Creating Administrator account…";status.style.display="block";btn.disabled=true;
  try{
    const r=await fetch("/api/bootstrap-admin",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json","x-bootstrap-secret":document.getElementById("setupSecret").value},body:JSON.stringify({email:document.getElementById("setupEmail").value.trim(),name:document.getElementById("setupName").value.trim(),password})});
    const x=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(x.error||"Unable to create Administrator.");
    status.textContent="Administrator created successfully. Close this window and sign in with your employee email and password.";
    document.getElementById("setupSecret").value="";document.getElementById("setupPassword").value="";document.getElementById("setupPassword2").value="";btn.style.display="none";
  }catch(err){status.textContent=err.message;btn.disabled=false}
}

async function secureLogin(e){e.preventDefault();const box=document.getElementById("loginError"),btn=e.submitter;box.style.display="none";btn.disabled=true;btn.textContent="Signing in...";try{const r=await fetch("/api/login",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({email:document.getElementById("loginEmail").value.trim(),password:document.getElementById("loginPassword").value})});const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.error||"Unable to sign in.");session=x.user;const next=new URLSearchParams(location.search).get("next");if(next&&next.startsWith("/")){location.href=next;return}render()}catch(err){box.textContent=err.message;box.style.display="block"}finally{btn.disabled=false;btn.textContent="Sign In"}}
function initials(n){return n.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
function nav(k,l,ctx=null){return `<button class="${active===k?"active":""}" onclick="go('${k}'${ctx?`,'${ctx}'`:""})">${l}</button>`}
function navLabel(t){return `<div class="nav-label">${t}</div>`}
// PR #11: the People/HRMS functional area — a peer top-level workspace
// (its own sidebar mode, like "sve"/"skl"), not nested inside SVE
// International. See docs/architecture/hrms-application-shell.md
// "Information architecture".
const HRMS_ACTIVES=["hrms","hrmsDirectory","hrmsEmployee","hrmsLifecycle","hrmsCase","hrmsApprovals"];

function sidebarMode(){
 if(sklContext) return "skl";
 if(HRMS_ACTIVES.includes(active)) return "hrms";
 if(active==="sve"||["executive","projects","governance","documents"].includes(active)) return "sve";
 if(active==="admin") return "group";
 return "group";
}
function sidebarBrand(){
 const mode=sidebarMode();
 if(mode==="skl") return `<div class="brand unit-brand"><button class="back-group" onclick="goHome()">← SVE Group</button><div class="brand-logo-panel"><img src="assets/skl-logo.png" alt="SK Lai & Partners"></div><div><div class="brand-title">SK Lai & Partners</div><div class="brand-sub">Legal & Professional Services</div></div></div>`;
 if(mode==="hrms") return `<div class="brand unit-brand"><button class="back-group" onclick="goHome()">← SVE Group</button><div class="brand-logo-panel sve-small"><img src="assets/sve-logo.jpeg" alt="SVE Group"></div><div><div class="brand-title">People</div><div class="brand-sub">SVE Group People Operations</div></div></div>`;
 if(mode==="sve") return `<div class="brand unit-brand"><button class="back-group" onclick="goHome()">← SVE Group</button><div class="brand-logo-panel sve-small"><img src="assets/sve-logo.jpeg" alt="SVE International"></div><div><div class="brand-title">SVE International</div><div class="brand-sub">Corporate & Business Operations</div></div></div>`;
 return `<div class="brand"><img src="assets/sve-logo.jpeg"><div><div class="brand-title">SVE Group Internal Portal</div><div class="brand-sub">Management Review v0.1</div></div></div>`;
}
function sidebarNav(){
 const mode=sidebarMode();
 if(mode==="skl") return `${navLabel("SKL WORKSPACE")}${permittedNav("skl","SKL Home")}${portalAllowed("projects")?nav("projects","Matters & Projects","skl"):""}${portalAllowed("governance")?nav("governance","SOP & Governance","skl"):""}${portalAllowed("documents")?nav("documents","Documents & Resources","skl"):""}<button onclick="openOurInsights()">Our Insights ↗</button>${navLabel("GROUP")}${permittedNav("home","Return to Group Home")}`;
 if(mode==="hrms") return `${navLabel("PEOPLE")}${permittedNav("hrms","HR Dashboard")}${permittedNav("hrmsDirectory","Employee Directory")}${navLabel("HR LIFECYCLE")}${hrmsLifecycleNavLink("onboarding","Onboarding")}${hrmsLifecycleNavLink("probation","Probation & Confirmation")}${hrmsLifecycleNavLink("employment_change","Employment Changes")}${hrmsLifecycleNavLink("offboarding","Offboarding")}${permittedNav("hrmsApprovals","Approvals")}${navLabel("GROUP")}${permittedNav("home","Return to Group Home")}`;
 if(mode==="sve") return `${navLabel("SVE INTERNATIONAL")}${permittedNav("sve","SVE Home")}${permittedNav("executive","Executive Office")}${permittedNav("projects","Projects & Clients")}${permittedNav("governance","Corporate Governance")}${permittedNav("documents","Knowledge & Documents")}${navLabel("GROUP")}${permittedNav("home","Return to Group Home")}`;
 return `${navLabel("MY WORKSPACE")}${permittedNav("mysve","My SVE")}${permittedNav("mytasks","My Tasks")}${navLabel("GROUP")}${permittedNav("home","Group Home")}${(session?.role==="Administrator"||session?.role==="Management"||session?.role==="Executive Office")?`${navLabel("GROUP MANAGEMENT & INTELLIGENCE")}<button onclick="openManagementCommandCentre()">Management Command Centre</button><button onclick="openUnifiedWorkflow()">Insight to Implementation</button><button onclick="openDecisionTracker()">Decision Tracker</button>`:""}${hasDataVaultAccess()?`${navLabel("INTELLIGENCE")}<button onclick="openDataVault()">SVE Data Vault ↗</button>`:""}${navLabel("PEOPLE")}${permittedNav("hrms","People")}${navLabel("GROUP RESOURCES")}<button class="${active==='announcements'?'active':''}" onclick="showAnnouncements()">Group Announcements</button><button onclick="secureGo('documents')">Policies & Guidelines</button>${navLabel("BUSINESS UNITS")}${permittedNav("sve","SVE International")}${permittedNav("skl","SK Lai & Partners")}${canSeeAdmin()?`${navLabel("SYSTEM")}${permittedNav("admin","Administration")}`:""}`;
}
/** HR-lifecycle sub-nav link inside the "hrms" sidebar mode — all four lifecycle types share the SAME "hrms" page permission (they are not independently reachable from outside this workspace), but each sets hrmsLifecycleType before navigating, mirroring the existing sklContext side-channel pattern used throughout this router. */
function hrmsLifecycleNavLink(lifecycleType,label){
 if(!portalAllowed("hrms"))return "";
 const isActive=active==="hrmsLifecycle"&&hrmsLifecycleType===lifecycleType;
 return `<button class="${isActive?"active":""}" onclick="goHrmsLifecycle('${lifecycleType}')">${label}</button>`;
}
function showAnnouncements(){togglePortalNav(false);navHistory.push({active,sklContext});active="announcements";sklContext=false;render()}
function announcements(c){
 const notices=db.announcements.filter(x=>x.status==="Published");
 c.innerHTML=`${roleBanner()}<div class="section"><div class="panel-head"><div><span class="group-home-greeting-kicker">SVE GROUP</span><h2>Group Announcements</h2><p>Published Group communications and management notices.</p></div><span>${notices.length} published</span></div><div class="card"><div class="list">${notices.map(a=>li(a.title,`${fmtDate(a.date)} · ${a.audience}`,a.status)).join("")||`<div class="empty">No published announcements.</div>`}</div></div></div>`;
}
function openOurInsights(){window.open("https://sklaipartners.com/insights/","_blank","noopener,noreferrer")}
function title(k){if(sklContext&&k==="projects")return "Matters & Projects";if(sklContext&&k==="governance")return "SOP & Governance";if(sklContext&&k==="documents")return "Documents & Resources";return ({home:"Group Home",announcements:"Group Announcements",sve:"SVE International",executive:"Executive Office",skl:"SK Lai & Partners",projects:"Projects & Clients",governance:"Corporate Governance",documents:"Knowledge & Documents",admin:"Administration",search:"Search",mysve:"My SVE",mytasks:"My Tasks",hrms:"HR Dashboard",hrmsDirectory:"Employee Directory",hrmsEmployee:"Employee Profile",hrmsLifecycle:HRMS_LIFECYCLE_LABELS[hrmsLifecycleType]||"HR Lifecycle",hrmsCase:"Case Detail",hrmsApprovals:"Approvals"})[k]||"Portal"}
function go(k,ctx=null,track=true){
 togglePortalNav(false);
 const __target=arguments[0];
 if(typeof portalAllowed==="function" && !portalAllowed(__target)){denyPortalAccess(__target);return}

      if(track && active!==k) navHistory.push({active,sklContext});
      active=k;
      if(k==="skl") sklContext=true;
      else if(ctx==="skl") sklContext=true;
      else if(["home","sve","executive","people","admin"].includes(k)) sklContext=false;
      render()
    }
function goBack(){
      const prev=navHistory.pop();
      if(prev){active=prev.active;sklContext=prev.sklContext;render()}
      else {active=sklContext?"skl":"home";render()}
    }
function goHome(){togglePortalNav(false);navHistory=[];active="home";sklContext=false;render()}
function renderSection(){
 const c=document.getElementById("content");
 ({home:home,announcements:announcements,sve:sve,executive:executive,skl:skl,projects:projects,governance:governance,documents:documents,admin:admin,search:()=>{},mysve:mySve,mytasks:myTasks,hrms:hrDashboard,hrmsDirectory:hrmsDirectory,hrmsEmployee:hrmsEmployeeProfile,hrmsLifecycle:hrmsLifecycleList,hrmsCase:hrmsCaseDetail,hrmsApprovals:hrmsApprovals}[active]||home)(c);
 if(active!=="home"){
   const nav=document.createElement("div");
   nav.className="workspace-nav";
   const sveWorkspaceActives=["executive","projects","governance","documents"];
   const midCrumb=sklContext&&active!=="skl"?`<button onclick="go('skl',null,false)">SK Lai & Partners</button><span>›</span>`
     :(!sklContext&&HRMS_ACTIVES.includes(active)&&active!=="hrms"?`<button onclick="go('hrms',null,false)">People</button><span>›</span>`
     :(!sklContext&&sveWorkspaceActives.includes(active)?`<button onclick="go('sve',null,false)">SVE International</button><span>›</span>`:""));
   // The root "SVE Group" segment is hidden on mobile (.crumb-root, see
   // styles.css) — the page's own <h1> already names the current screen
   // and "⌂ Group Home" already offers the same jump, so on a narrow
   // viewport the crumb keeps only the immediate parent (if any) plus
   // the current page, rather than the full chain.
   nav.innerHTML=`<button class="btn ghost" onclick="goBack()">← Back</button><div class="crumb"><span class="crumb-root"><button onclick="goHome()">SVE Group</button><span>›</span></span>${midCrumb}<strong>${title(active)}</strong></div><button class="btn secondary" onclick="goHome()">⌂ Group Home</button>`;
   c.prepend(nav);
 }
}
function roleBanner(){return `<div class="role-banner">Signed in as <strong>${esc(session.role)}</strong>. ${canSeeAdmin()?"You have full CMS administration access.":canEdit()?"You have management-level access.":"This view is read-only in the review build."}</div>`}
function card(title,desc,to){return `<div class="card link-card" onclick="go('${to}')"><h4>${title}</h4><p>${desc}</p><div class="arrow">Open workspace →</div></div>`}
function ctxCard(title,desc,to,ctx){return `<div class="card link-card" onclick="go('${to}','${ctx}')"><h4>${title}</h4><p>${desc}</p><div class="arrow">Open workspace →</div></div>`}

function sklWorkspaceBar(label){return `<div class="skl-workspace-bar"><div><strong>SK Lai & Partners</strong><span>${label}</span></div><button class="btn ghost" onclick="secureGo('skl')">← SKL Home</button></div>`}


function home(c){
 const activeProjects=db.projects.filter(x=>x.status==="Active").length;
 const openActions=db.actions.filter(x=>x.status!=="Completed").length;
 const upcoming=db.meetings.filter(x=>x.status==="Upcoming");
 const notices=db.announcements.filter(x=>x.status==="Published");
 c.innerHTML=`${roleBanner()}
 <div class="group-home-greeting"><div><span class="group-home-greeting-kicker">SVE GROUP</span><h2>Hello, ${esc(session.name)}!</h2></div><div class="group-home-datetime" id="groupHomeDateTime"></div></div>
 <div class="section key-updates home-management-overview">
   <div class="panel-head"><div><span class="group-home-greeting-kicker">GROUP MANAGEMENT OVERVIEW</span><h3>What needs attention</h3></div><span>Current portal records</span></div>
   <div class="key-grid">
     <div class="key-item"><span class="key-num">${openActions}</span><div><strong>Open Action Items</strong><small>Management follow-up</small></div></div>
     <div class="key-item"><span class="key-num">${activeProjects}</span><div><strong>Ongoing Projects</strong><small>Across SVE Group</small></div></div>
     <div class="key-item"><span class="key-num">${db.policies.filter(x=>x.status==="Draft"||x.status==="Review").length}</span><div><strong>Policies Under Review</strong><small>Governance workflow</small></div></div>
   </div>
 </div>
 <div class="home-panels">
   <div class="card home-panel" id="latestAnnouncements">
     <div class="panel-head"><h3>Latest Announcements</h3><span>${notices.length} published</span></div>
     <div class="list">${notices.slice(0,3).map(a=>li(a.title,`${fmtDate(a.date)} · ${a.audience}`,a.status)).join("")||`<div class="empty">No published announcements.</div>`}</div>
   </div>
   <div class="card home-panel">
     <div class="panel-head"><h3>Upcoming Meetings</h3><span>Group calendar</span></div>
     <div class="list">${upcoming.slice(0,3).map(m=>li(m.title,`${fmtDate(m.date)} · ${m.time}`,m.status)).join("")||`<div class="empty">No upcoming meetings.</div>`}</div>
   </div>
 </div>
`
 updateGroupHomeClock();
}
function updateGroupHomeClock(){
 const el=document.getElementById("groupHomeDateTime"); if(!el)return;
 const now=new Date();
 const date=now.toLocaleDateString("en-MY",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 const time=now.toLocaleTimeString("en-MY",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});
 el.textContent=`${date} · ${time} · MYT/SGT`;
 clearTimeout(window._groupHomeClockTimer); window._groupHomeClockTimer=setTimeout(updateGroupHomeClock,1000);
}
function metric(l,v,n){return `<div class="card"><div class="metric-label">${l}</div><div class="metric">${v}</div><div class="metric-note">${n}</div></div>`}
function li(t,m,s){return `<div class="list-item"><div><div class="list-title">${t}</div><div class="list-meta">${m}</div></div>${statusBadge(s)}</div>`}
function sve(c){
 sklContext=false;
 c.innerHTML=`${roleBanner()}
 <div class="identity sve-workspace-identity">
   <img src="assets/sve-logo.jpeg" alt="SVE International">
   <div><div class="eyebrow">SVE GROUP · CORPORATE & BUSINESS OPERATIONS</div><h2>SVE International</h2><p>Corporate management workspace for executive coordination, business operations, governance and internal resources.</p></div>
 </div>
 <div class="workspace-section-label">SVE INTERNATIONAL WORKSPACES</div>
 <div class="grid g3">
   ${card("Executive Office","Management coordination, meetings, actions and executive oversight.","executive")}
   ${card("Projects & Clients","Portfolio tracking, client workstreams and next actions.","projects")}
   ${card("Corporate Governance","Policies, registers, controlled procedures and governance records.","governance")}
   ${card("Knowledge & Documents","Controlled documents, templates, minutes and shared references.","documents")}
 </div>
 <div class="section unit-summary">
   <div><span>Workspace</span><strong>SVE International</strong></div>
   <div><span>Active Projects</span><strong>${db.projects.filter(x=>x.unit.includes("SVE")).length}</strong></div>
   <div><span>Policies</span><strong>${db.policies.filter(x=>x.code.startsWith("SVE-")).length}</strong></div>
   <div><span>Open Actions</span><strong>${db.actions.filter(x=>x.status!=="Completed").length}</strong></div>
 </div>`
}

function executive(c){c.innerHTML=`${roleBanner()}<div class="hero executive-hero"><h2>Executive Office</h2><p>Management coordination, meeting governance, action follow-up and cross-functional oversight for SVE Group.</p><div class="chips"><span class="chip">Management Meetings</span><span class="chip">Action Tracking</span><span class="chip">Corporate Calendar</span><span class="chip">Directives & Records</span></div></div><div class="section grid g4">${metric("Upcoming Meetings",db.meetings.filter(x=>x.status==="Upcoming").length,"Management calendar")}${metric("Open Actions",db.actions.filter(x=>x.status!=="Completed").length,"Follow-up required")}${metric("Active Projects",db.projects.filter(x=>x.status==="Active").length,"Portfolio oversight")}${metric("Published Notices",db.announcements.filter(x=>x.status==="Published").length,"Internal communications")}</div><div class="section grid g2"><div class="card"><h3>Management Meetings</h3><div class="list">${db.meetings.map(m=>li(m.title,`${fmtDate(m.date)} · ${m.time} · ${m.owner}`,m.status)).join("")}</div></div><div class="card"><h3>Management Action Tracker</h3><div class="list">${db.actions.map(a=>li(a.title,`${a.owner} · ${a.project} · Due ${fmtDate(a.due)}`,a.status)).join("")}</div></div></div>`}
function skl(c){c.innerHTML=`${roleBanner()}<div class="identity skl-identity"><div class="skl-logo-wrap"><img src="assets/skl-logo.png" alt="SK Lai & Partners" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="skl-logo-fallback">SK LAI & PARTNERS</div></div><div><div class="eyebrow" style="color:#a98527">SVE GROUP · PROFESSIONAL UNIT</div><h2>SK Lai & Partners</h2><p>Dedicated legal and professional services workspace within the SVE umbrella.</p></div></div><div class="hero"><h2>SKL Workspace</h2><p>Matters, professional procedures, controlled legal resources and SVE-linked project workstreams under the SKL corporate identity.</p><div class="chips"><span class="chip">Legal Operations</span><span class="chip">Matters</span><span class="chip">SOP & Compliance</span><span class="chip">SVE Group</span></div></div><div class="section grid g3">${ctxCard("SKL Matters & Projects","Active matters and joint SVE/SKL projects.","projects","skl")}${ctxCard("SKL SOP Library","Matter opening, conflict checking and controlled procedures.","governance","skl")}${ctxCard("Documents & Resources","Templates, documents and professional resources.","documents","skl")}</div><div class="section">${projectTable(db.projects.filter(x=>x.unit.includes("SKL")))}</div>`}
function projectTable(rows){return `<div class="table-wrap desktop-register"><table><thead><tr><th>Project / Matter</th><th>Unit</th><th>Owner</th><th>Priority</th><th>Next Step</th><th>Status</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.unit)}</td><td>${esc(p.owner)}</td><td>${esc(p.priority)}</td><td>${esc(p.next)}</td><td>${statusBadge(p.status)}</td></tr>`).join("")}</tbody></table></div><div class="mobile-record-list">${rows.map(p=>`<article class="mobile-record-card"><h4>${esc(p.name)}</h4><p>${esc(p.unit)} · ${esc(p.owner)}</p><dl><div><dt>Priority</dt><dd>${esc(p.priority)}</dd></div><div><dt>Next Step</dt><dd>${esc(p.next)}</dd></div><div><dt>Status</dt><dd>${statusBadge(p.status)}</dd></div></dl></article>`).join("")}</div>`}
function projects(c){
      const rows=sklContext?db.projects.filter(x=>x.unit.includes("SKL")):db.projects;
      c.innerHTML=`${roleBanner()}${sklContext?sklWorkspaceBar("Matters & Projects"):""}<div class="section-head"><div><h3>${sklContext?"SKL Matters & Joint Projects":"SVE / SKL Project Portfolio"}</h3><p>${sklContext?"Legal matters and SVE-linked workstreams within the SKL workspace.":"Central view of active projects, matters and next actions."}</p></div></div>${projectTable(rows)}`
    }
function governance(c){
      const rows=sklContext?db.policies.filter(x=>x.code.startsWith("SKL-")||x.category==="SKL SOP"):db.policies;
      c.innerHTML=`${roleBanner()}${sklContext?sklWorkspaceBar("SOP & Governance"):""}<div class="grid g4">${metric("Policy Records",rows.length,"Registry total")}${metric("Published",rows.filter(x=>x.status==="Published").length,"Approved for use")}${metric("Draft",rows.filter(x=>x.status==="Draft").length,"In development")}${metric("Under Review",rows.filter(x=>x.status==="Review").length,"Review workflow")}</div><div class="section table-wrap"><table><thead><tr><th>Code</th><th>Title</th><th>Category</th><th>Version</th><th>Owner</th><th>Review</th><th>Status</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.code)}</strong></td><td>${esc(p.title)}</td><td>${esc(p.category)}</td><td>${esc(p.version)}</td><td>${esc(p.owner)}</td><td>${fmtDate(p.review)}</td><td>${statusBadge(p.status)}</td></tr>`).join("")}</tbody></table></div><div class="mobile-record-list">${rows.map(p=>`<article class="mobile-record-card"><h4>${esc(p.code)} · ${esc(p.title)}</h4><p>${esc(p.category)}</p><dl><div><dt>Version</dt><dd>${esc(p.version)}</dd></div><div><dt>Owner</dt><dd>${esc(p.owner)}</dd></div><div><dt>Review</dt><dd>${fmtDate(p.review)}</dd></div><div><dt>Status</dt><dd>${statusBadge(p.status)}</dd></div></dl></article>`).join("")}</div>`
    }
// The old static "People & HR" stub (Onboarding/Policy Acknowledgement
// cards marked "Planned production module") has been replaced by the
// real People/HRMS workspace (PR #11) — see hrDashboard/hrmsDirectory/
// hrmsEmployeeProfile/hrmsLifecycleList/hrmsApprovals below, reached via
// the sidebar's own "PEOPLE" section rather than nested inside SVE
// International. "Employee Accounts" (SVEGIP portal login administration
// — a different concept from Employee Master) remains reachable from
// Administration, unchanged.
function documents(c){
      const rows=sklContext?db.documents.filter(d=>d.area==="SKL"||d.access==="SKL"):db.documents;
      c.innerHTML=`${roleBanner()}${sklContext?sklWorkspaceBar("Documents & Resources"):""}<div class="section-head"><div><h3>${sklContext?"SKL Controlled Resources":"Knowledge & Resources"}</h3><p>${sklContext?"Professional resources and controlled SKL records.":"General references for minutes, registers, templates and working resources. Governed controlled documents are maintained in the Controlled Document Repository."}</p></div></div><div class="table-wrap"><table><thead><tr><th>Document</th><th>Type</th><th>Area</th><th>Access</th><th>Status</th></tr></thead><tbody>${rows.map(d=>`<tr><td><strong>${esc(d.title)}</strong></td><td>${esc(d.type)}</td><td>${esc(d.area)}</td><td>${esc(d.access)}</td><td>${statusBadge(d.status)}</td></tr>`).join("")}</tbody></table></div><div class="mobile-record-list">${rows.map(d=>`<article class="mobile-record-card"><h4>${esc(d.title)}</h4><p>${esc(d.type)}</p><dl><div><dt>Area</dt><dd>${esc(d.area)}</dd></div><div><dt>Access</dt><dd>${esc(d.access)}</dd></div><div><dt>Status</dt><dd>${statusBadge(d.status)}</dd></div></dl></article>`).join("")}</div>${!sklContext?`<div class="section doc-repository-cta"><div><strong>Controlled Document Repository</strong><span>Authoritative governed documents, versions, access controls and audit records.</span></div><button class="btn primary" onclick="openControlledDocuments()">Open Repository →</button></div>`:""}`
    }

function admin(c){
 if(!canSeeAdmin()){c.innerHTML=`<div class="card"><h3>Restricted</h3><p>Administration is available to portal administrators only.</p></div>`;return}
 const mods=["announcements","projects","policies","documents","meetings","actions","audit"];
 c.innerHTML=`${roleBanner()}<div class="section-head"><div><h3>Admin Content Management</h3><p>Manage portal records without editing HTML.</p></div><div class="toolbar"><button class="btn primary" onclick="openEmployeeAccounts()">Employee Accounts & Access</button></div></div><div class="tabs">${mods.map(m=>`<button class="tab ${adminTab===m?"active":""}" onclick="adminTab='${m}';renderSection()">${labels[m]}</button>`).join("")}</div><div id="adminPanel"></div><div class="section callout"><strong>Phase 1 controlled storage:</strong> shared portal records are managed through the secured SVEGIP application API and database layer. Confidential information remains outside the Phase 1 validation scope.</div>`;
 adminPanel();
}
const labels={announcements:"Announcements",projects:"Projects",policies:"Policies",documents:"Documents",meetings:"Meetings",actions:"Action Items",people:"Users & Roles",audit:"Audit Log"};
const specs={
 announcements:[["title","Title","text"],["summary","Summary","textarea"],["audience","Audience","select",["All SVE","Management","Executive Office","SKL"]],["date","Date","date"],["status","Status","select",["Draft","Published","Archived"]]],
 projects:[["name","Project / Matter","text"],["unit","Unit","select",["SVE","SKL","SVE / SKL"]],["owner","Owner","text"],["priority","Priority","select",["Low","Medium","High","Critical"]],["next","Next Step","text"],["status","Status","select",["Active","Review","Pending","Completed","Archived"]]],
 policies:[["code","Policy Code","text"],["title","Policy Title","text"],["category","Category","text"],["version","Version","text"],["owner","Owner","text"],["review","Review Date","date"],["status","Status","select",["Draft","Review","Published","Archived"]]],
 documents:[["title","Document Title","text"],["type","Type","text"],["area","Area","select",["Executive Office","Corporate Governance","Projects & Clients","People & HR","SKL","Knowledge & Documents"]],["access","Access","select",["All SVE","Management","Executive Office","SKL"]],["status","Status","select",["Working","Current","Archived"]]],
 meetings:[["title","Meeting Title","text"],["date","Date","date"],["time","Time","text"],["owner","Owner","text"],["status","Status","select",["Upcoming","Completed","Cancelled"]]],
 actions:[["title","Action Item","text"],["owner","Owner","text"],["due","Due Date","date"],["project","Project / Matter","text"],["status","Status","select",["Open","In Progress","Completed","Deferred"]]],
 people:[["name","Name","text"],["unit","Unit","select",["SVE","Executive Office","SKL"]],["role","Role","select",["Administrator","Management","Executive Office","SKL User","Employee"]],["status","Status","select",["Active","Inactive"]]]
};
function adminPanel(){const p=document.getElementById("adminPanel");if(adminTab==="audit"){p.innerHTML=`<div class="table-wrap"><table><thead><tr><th>When</th><th>Module</th><th>Action</th></tr></thead><tbody>${db.audit.map(a=>`<tr><td>${new Date(a.when).toLocaleString()}</td><td>${esc(a.module)}</td><td>${esc(a.action)}</td></tr>`).join("")}</tbody></table></div>`;return}
 const arr=db[adminTab];const cols=specs[adminTab].slice(0,4).map(x=>x[0]);
 p.innerHTML=`<div class="section-head"><div><h3>${labels[adminTab]}</h3><p>${arr.length} record(s)</p></div><button class="btn primary" onclick="openEditor('${adminTab}')">+ Add New</button></div><div class="table-wrap admin-desktop-table"><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join("")}<th>Status</th><th>Actions</th></tr></thead><tbody>${arr.map(r=>`<tr>${cols.map(c=>`<td>${esc(c==="date"||c==="due"||c==="review"?fmtDate(r[c]):r[c])}</td>`).join("")}<td>${statusBadge(r.status||r.role)}</td><td><div class="toolbar"><button class="btn secondary" onclick="openEditor('${adminTab}',${r.id})">Edit</button><button class="btn danger" onclick="del('${adminTab}',${r.id})">Delete</button></div></td></tr>`).join("")}</tbody></table></div><div class="mobile-record-list admin-mobile-records">${arr.map(r=>`<article class="mobile-record-card"><h4>${esc(r.title||r.name||r.code||r.action||labels[adminTab])}</h4><dl>${cols.filter(c=>!["title","name","code"].includes(c)).map(c=>`<div><dt>${esc(c)}</dt><dd>${esc(c==="date"||c==="due"||c==="review"?fmtDate(r[c]):r[c])}</dd></div>`).join("")}<div><dt>Status</dt><dd>${statusBadge(r.status||r.role||"Record")}</dd></div></dl><div class="toolbar"><button class="btn secondary" onclick="openEditor('${adminTab}',${r.id})">Edit</button><button class="btn danger" onclick="del('${adminTab}',${r.id})">Delete</button></div></article>`).join("")}</div>`;
}
function openEditor(mod,id=null){const arr=db[mod],rec=id?arr.find(x=>x.id===id):{id:nextId(arr)};const fields=specs[mod];
 document.getElementById("modal").innerHTML=`<div class="modal-head"><div><div class="eyebrow">${id?"EDIT":"NEW"} ${labels[mod].toUpperCase()}</div><h3>${id?"Edit Record":"Add Record"}</h3></div><button class="close" onclick="closeModal()">×</button></div><div class="form-grid">${fields.map(f=>field(f,rec[f[0]]??"")).join("")}</div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveRec('${mod}',${rec.id},${!!id})">Save Changes</button></div>`;document.getElementById("modalBg").classList.add("open")}
function field([k,l,t,opts],v){if(t==="textarea")return `<div class="field full"><label>${l}</label><textarea id="f_${k}">${esc(v)}</textarea></div>`;if(t==="select")return `<div class="field"><label>${l}</label><select id="f_${k}">${opts.map(o=>`<option ${o===v?"selected":""}>${o}</option>`).join("")}</select></div>`;return `<div class="field"><label>${l}</label><input id="f_${k}" type="${t}" value="${esc(v)}"></div>`}
function nextId(a){return a.length?Math.max(...a.map(x=>Number(x.id)||0))+1:1}
async function saveRec(mod,id,edit){
 const obj={id};specs[mod].forEach(([k])=>obj[k]=document.getElementById("f_"+k).value.trim());
 const btn=document.querySelector("#modal .btn.primary");if(btn){btn.disabled=true;btn.textContent="Saving..."}
 try{
  const r=await fetch("/api/portal-data?module="+encodeURIComponent(mod),{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(obj)});
  const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.error||"Unable to save record.");
  await loadCentralDB();closeModal();renderSection();
 }catch(e){alert(e.message)}finally{if(btn){btn.disabled=false;btn.textContent="Save Changes"}}
}
async function del(mod,id){
 const rec=db[mod].find(x=>x.id===id);if(!confirm(`Delete "${rec?.title||rec?.name||rec?.code||"this record"}"?`))return;
 try{
  const r=await fetch("/api/portal-data?module="+encodeURIComponent(mod)+"&id="+encodeURIComponent(id),{method:"DELETE",credentials:"same-origin"});
  const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.error||"Unable to delete record.");
  await loadCentralDB();renderSection();
 }catch(e){alert(e.message)}
}
function closeModal(){document.getElementById("modalBg").classList.remove("open")}
function resetData(){alert("Shared portal data is centrally managed. Browser reset has been disabled.");}
function searchPortal(q){q=q.trim().toLowerCase();if(!q){go("home");return}active="search";sklContext=false;const pool=[...db.announcements.map(x=>({t:x.title,m:`Announcement · ${x.audience} · ${x.status}`})),...db.projects.map(x=>({t:x.name,m:`Project · ${x.unit} · ${x.status}`})),...db.policies.map(x=>({t:`${x.code} — ${x.title}`,m:`Policy · ${x.category} · ${x.status}`})),...db.documents.map(x=>({t:x.title,m:`${x.type} · ${x.area} · ${x.status}`})),...db.meetings.map(x=>({t:x.title,m:`Meeting · ${fmtDate(x.date)} · ${x.status}`})),...db.actions.map(x=>({t:x.title,m:`Action · ${x.owner} · ${x.status}`}))];const res=pool.filter(x=>(x.t+" "+x.m).toLowerCase().includes(q));render();const c=document.getElementById("content");c.innerHTML=`<div class="section-head"><div><h3>Search Results</h3><p>${res.length} matching record(s)</p></div></div><div class="grid g2">${res.map(r=>`<div class="card"><h4>${esc(r.t)}</h4><p style="color:var(--muted);font-size:12px">${esc(r.m)}</p></div>`).join("")||`<div class="card">No matching records.</div>`}</div>`}
render();

function hasDataVaultAccess(){return session?.dataVaultAccess!==false}
// ---- SVEGIP PORTAL-WIDE RBAC ----
// PR #11: "mysve"/"mytasks" (My Workspace) are granted to every
// authenticated role — every employee has their own profile and may be
// assigned Workflow tasks. "hrms" (People / HRMS) replaces the old
// "people" stub key with the SAME visibility Management/Executive Office
// already had — this is a rename of an existing grant, not a new one.
// Hiding "hrms" from Employee/SKL here is UX narrowing only (see
// portalAllowed's own header note below and docs/architecture/
// hrms-application-shell.md "Security model" — Navigation authorization):
// every People/HRMS screen still calls into platform-services'
// organisation/hrms/workflow, each independently enforcing its own RBAC
// regardless of what this portal's nav shows.
const SVEGIP_ACCESS_POLICY={
 "Administrator":["*"],
 "Management":["home","mysve","mytasks","sve","skl","executive","projects","governance","hrms","documents","admin"],
 "Executive Office":["home","mysve","mytasks","sve","executive","projects","governance","hrms","documents"],
 "SKL User / Legal Reviewer":["home","mysve","mytasks","skl","projects","governance","documents"],
 "Employee":["home","mysve","mytasks","documents"]
};
function portalRole(){return session?.role||"Employee"}
function portalAllowed(page){
 const allowed=SVEGIP_ACCESS_POLICY[portalRole()]||SVEGIP_ACCESS_POLICY.Employee;
 if(allowed.includes("*"))return true;
 if(page==="admin"&&(session?.permissions||[]).includes("accounts.manage"))return true;
 // A narrowly-granted "hr.access" flag (same convention as
 // accounts.manage/vault.audit/vault.admin/decisions.manage) lets an
 // Employee-role SVEGIP account see the People/HRMS nav without needing
 // the broader Management/Executive Office portal role.
 if(HRMS_ACTIVES.includes(page)&&(session?.permissions||[]).includes("hr.access"))return true;
 if(HRMS_ACTIVES.includes(page))return allowed.includes("hrms");
 if(page==="sve"&&session?.unit==="SVE")return true;
 if(page==="skl"&&session?.unit==="SKL")return true;
 return allowed.includes(page);
}
function portalAccessLabel(){
 const r=portalRole(),u=session?.unit||"Group";
 return `${r} · ${u}`;
}
function denyPortalAccess(page){
 alert(`Access restricted. Your ${portalRole()} account is not authorised for this SVEGIP area.`);
 if(active!== "home"){active="home";navHistory=[];render()} 
}
function secureGo(page){
 if(!portalAllowed(page)){denyPortalAccess(page);return}
 go(page);
}
function permittedNav(page,label){
 return portalAllowed(page)?nav(page,label):"";
}

function openDataVault(){if(!hasDataVaultAccess()){alert("Your account is not authorised for SVE Data Vault.");return}window.location.href="/data-vault/"}
bootstrapAuth();

async function openEmployeeAccounts(){
 if(session?.role!=="Administrator" && !(session?.permissions||[]).includes("accounts.manage")){alert("Employee Account Administration is restricted to authorised administrators.");return}
 const r=await fetch("/api/admin/users",{credentials:"same-origin"});if(!r.ok){alert("Unable to load employee accounts.");return}
 const x=await r.json(),rows=x.users||[];
 app().innerHTML=`${sidebar()}<main class="main"><div class="topbar"><div><div class="eyebrow">ADMINISTRATION · ACCESS CONTROL</div><h2>Employee Accounts</h2><p>Manage authenticated employee access, roles, business units and SVE Data Vault permissions.</p></div><button class="btn ghost" onclick="secureGo('admin')">← Administration</button></div>
 <div class="panel"><div class="panel-head"><div><h3>Account Directory</h3><p>${rows.length} employee account(s)</p></div><button class="btn primary" onclick="showNewEmployeeForm()">+ Add Employee</button></div>
 <div class="table-wrap"><table><thead><tr><th>Employee</th><th>Role</th><th>Unit</th><th>Status</th><th>Data Vault</th><th>Permissions</th><th></th></tr></thead><tbody>${rows.map(u=>`<tr><td><strong>${esc(u.name)}</strong><br><small>${esc(u.email)}</small></td><td>${esc(u.role)}</td><td>${esc(u.unit)}</td><td><span class="badge ${u.status==="Active"?"green":"grey"}">${esc(u.status)}</span></td><td>${u.data_vault_access?"✓ Access":"— No access"}</td><td><small>${esc((u.permissions||[]).join(", ")||"Standard")}</small></td><td><button class="btn ghost" onclick='editEmployee(${JSON.stringify(u)})'>Manage</button></td></tr>`).join("")}</tbody></table></div></div>
 <div id="accountEditor"></div></main>`;
}
function showNewEmployeeForm(){renderEmployeeForm({status:"Active",role:"Employee",unit:"SVE",data_vault_access:false,permissions:[]},true)}
function editEmployee(u){renderEmployeeForm(u,false)}
function renderEmployeeForm(u,isNew){
 const host=document.getElementById("accountEditor");host.innerHTML=`<div class="panel account-editor"><div class="panel-head"><div><h3>${isNew?"Add Employee":"Manage Employee"}</h3><p>${isNew?"Create a secure SVEGIP account.":"Update access controls for "+esc(u.email)}</p></div><button class="btn ghost" onclick="this.closest('.account-editor').remove()">Close</button></div>
 <form onsubmit="saveEmployee(event,${isNew},${u.id||0})" class="form-grid">
 <div class="field"><label>Name</label><input id="auName" required value="${esc(u.name||"")}"></div><div class="field"><label>Email</label><input id="auEmail" type="email" ${isNew?"":"disabled"} required value="${esc(u.email||"")}"></div>
 <div class="field"><label>Role</label><select id="auRole">${["Administrator","Management","Executive Office","SKL User / Legal Reviewer","Employee"].map(x=>`<option ${u.role===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="field"><label>Business Unit</label><select id="auUnit">${["SVE","SKL","Group"].map(x=>`<option ${u.unit===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="field"><label>Status</label><select id="auStatus"><option ${u.status==="Active"?"selected":""}>Active</option><option ${u.status==="Inactive"?"selected":""}>Inactive</option></select></div>
 <div class="field"><label>${isNew?"Temporary Password":"Reset Password (optional)"}</label><input id="auPassword" type="password" ${isNew?"required":""} minlength="8" placeholder="${isNew?"Minimum 8 characters":"Leave blank to keep current"}"></div>
 <label class="check-row"><input id="auVault" type="checkbox" ${u.data_vault_access?"checked":""}> Allow SVE Data Vault access</label>
 <label class="check-row"><input id="auAudit" type="checkbox" ${(u.permissions||[]).includes("vault.audit")?"checked":""}> Allow Data ID Audit Trail</label>
 <label class="check-row"><input id="auAdmin" type="checkbox" ${(u.permissions||[]).includes("vault.admin")?"checked":""}> Data Vault Administration</label>
 <label class="check-row"><input id="auAccounts" type="checkbox" ${(u.permissions||[]).includes("accounts.manage")?"checked":""}> Manage Employee Accounts</label>
 <div><button class="btn primary" type="submit">${isNew?"Create Account":"Save Changes"}</button></div></form></div>`;host.scrollIntoView({behavior:"smooth"});
}
async function saveEmployee(e,isNew,id){e.preventDefault();const permissions=[];if(auAudit.checked)permissions.push("vault.audit");if(auAdmin.checked)permissions.push("vault.admin");if(auAccounts.checked)permissions.push("accounts.manage");const body={id,name:auName.value.trim(),email:auEmail.value.trim(),role:auRole.value,unit:auUnit.value,status:auStatus.value,dataVaultAccess:auVault.checked,permissions,password:auPassword.value};const r=await fetch("/api/admin/users",{method:isNew?"POST":"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),x=await r.json().catch(()=>({}));if(!r.ok){alert(x.error||"Unable to save account.");return}await openEmployeeAccounts()}


function adminStandaloneShell(titleText,eyebrowText){
 const groupBrand=`<div class="brand"><img src="assets/sve-logo.jpeg"><div><div class="brand-title">SVE Group Internal Portal</div><div class="brand-sub">Management Review v0.1</div></div></div>`;const groupNav=`${navLabel("MY WORKSPACE")}${permittedNav("mysve","My SVE")}${permittedNav("mytasks","My Tasks")}${navLabel("GROUP")}${permittedNav("home","Group Home")}${navLabel("GROUP MANAGEMENT & INTELLIGENCE")}<button onclick="openManagementCommandCentre()">Management Command Centre</button><button onclick="openUnifiedWorkflow()">Insight to Implementation</button><button onclick="openDecisionTracker()">Decision Tracker</button>${hasDataVaultAccess()?`${navLabel("INTELLIGENCE")}<button onclick="openDataVault()">SVE Data Vault ↗</button>`:""}${navLabel("PEOPLE")}${permittedNav("hrms","People")}${navLabel("GROUP RESOURCES")}<button class="${active==='announcements'?'active':''}" onclick="showAnnouncements()">Group Announcements</button><button onclick="secureGo('documents')">Policies & Guidelines</button>${navLabel("BUSINESS UNITS")}${permittedNav("sve","SVE International")}${permittedNav("skl","SK Lai & Partners")}${canSeeAdmin()?`${navLabel("SYSTEM")}${permittedNav("admin","Administration")}`:""}`;return `<div class="shell group-theme"><aside class="sidebar">${groupBrand}<nav class="nav contextual-nav">${groupNav}</nav><div class="side-foot"><div class="side-user">${esc(session.name)}</div><div class="side-role">${esc(session.role)} · ${esc(session.unit)}</div><button class="logout" onclick="signOut()">Sign out</button></div></aside><main class="main employee-admin-page"><header class="topbar"><div class="topbar-title"><button class="mobile-nav-toggle" onclick="togglePortalNav()">☰</button><div><div class="eyebrow">${eyebrowText}</div><h1>${titleText}</h1></div></div><div class="top-right"><div class="avatar">${initials(session.name)}</div></div></header><section class="content" id="adminStandaloneContent"></section></main><div class="portal-nav-overlay" id="portalNavOverlay" onclick="togglePortalNav(false)"></div></div>`;
}
function accountAccessSummary(u){
 const p=u.permissions||[];
 return [
  u.data_vault_access?"Data Vault":"No Data Vault",
  p.includes("vault.audit")?"Audit Trail":null,
  p.includes("vault.admin")?"Vault Admin":null,
  p.includes("accounts.manage")?"Account Admin":null
 ].filter(Boolean).join(" · ");
}
async function openEmployeeAccounts(){
 if(session?.role!=="Administrator" && !(session?.permissions||[]).includes("accounts.manage")){alert("Employee Account Administration is restricted to authorised administrators.");return}
 const r=await fetch("/api/admin/users",{credentials:"same-origin"});if(!r.ok){alert("Unable to load employee accounts.");return}
 const {users=[]}=await r.json();
 window.SVE_ACCOUNT_CACHE=users;
 renderEmployeeDirectory(users);
}
function renderEmployeeDirectory(users){
 app().innerHTML=adminStandaloneShell("Employee Accounts & Access","ADMINISTRATION · IDENTITY & ACCESS");
 const host=document.getElementById("adminStandaloneContent");
 host.innerHTML=`<div class="section-head"><div><h3>Employee Directory</h3><p>Manage authenticated employees, business-unit access and SVE Data Vault permissions.</p></div><button class="btn ghost" onclick="secureGo('admin')">← Administration</button></div>
 <div class="account-kpis">
  <div class="account-kpi"><span>Total Accounts</span><strong>${users.length}</strong></div>
  <div class="account-kpi"><span>Active</span><strong>${users.filter(x=>x.status==="Active").length}</strong></div>
  <div class="account-kpi"><span>Data Vault Access</span><strong>${users.filter(x=>x.data_vault_access).length}</strong></div>
  <div class="account-kpi"><span>Administrators</span><strong>${users.filter(x=>x.role==="Administrator").length}</strong></div>
 </div>
 <div class="panel"><div class="panel-head"><div><h3>Account Directory</h3><p>Authenticated SVEGIP accounts and assigned access.</p></div><button class="btn primary" onclick="showNewEmployeeForm()">+ Add Employee</button></div>
 <div class="account-tools"><input id="accountSearch" placeholder="Search employee, email, role or unit" oninput="filterEmployeeDirectory()"><select id="accountStatusFilter" onchange="filterEmployeeDirectory()"><option value="">All status</option><option>Active</option><option>Inactive</option></select><select id="accountUnitFilter" onchange="filterEmployeeDirectory()"><option value="">All units</option><option>SVE</option><option>SKL</option><option>Group</option></select></div>
 <div class="table-wrap"><table class="account-table"><thead><tr><th>Employee</th><th>Role / Unit</th><th>Status</th><th>Access</th><th>Last Updated</th><th></th></tr></thead><tbody id="accountRows">${employeeRows(users)}</tbody></table></div><div class="mobile-record-list account-mobile" id="accountMobileRows">${employeeMobileRows(users)}</div></div>
 <div id="accountEditor"></div>`;
}
function employeeRows(users){return users.map(u=>`<tr><td><div class="employee-cell"><div class="employee-avatar">${initials(u.name)}</div><div><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div></div></td><td><strong>${esc(u.role)}</strong><small>${esc(u.unit)}</small></td><td><span class="badge ${u.status==="Active"?"green":"grey"}">${esc(u.status)}</span></td><td><small>${esc(accountAccessSummary(u))}</small></td><td><small>${u.updated_at?new Date(u.updated_at).toLocaleDateString():"—"}</small></td><td><button class="btn ghost" onclick="openEmployeeProfile(${u.id})">View Profile</button></td></tr>`).join("")||`<tr><td colspan="6"><div class="empty-state">No employee accounts found.</div></td></tr>`}

function employeeMobileRows(users){return users.map(u=>`<article class="mobile-record-card"><div class="employee-cell"><div class="employee-avatar">${initials(u.name)}</div><div><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div></div><dl><div><dt>Role</dt><dd>${esc(u.role)}</dd></div><div><dt>Business Unit</dt><dd>${esc(u.unit)}</dd></div><div><dt>Status</dt><dd><span class="badge ${u.status==="Active"?"green":"grey"}">${esc(u.status)}</span></dd></div><div><dt>Access</dt><dd>${esc(accountAccessSummary(u))}</dd></div><div><dt>Last Updated</dt><dd>${u.updated_at?new Date(u.updated_at).toLocaleDateString():"—"}</dd></div></dl><button class="btn ghost" onclick="openEmployeeProfile(${u.id})">View Profile →</button></article>`).join("")||`<div class="empty-state">No employee accounts found.</div>`}
function filterEmployeeDirectory(){
 const q=(document.getElementById("accountSearch")?.value||"").toLowerCase(),status=document.getElementById("accountStatusFilter")?.value||"",unit=document.getElementById("accountUnitFilter")?.value||"";
 const rows=(window.SVE_ACCOUNT_CACHE||[]).filter(u=>(!q||[u.name,u.email,u.role,u.unit].join(" ").toLowerCase().includes(q))&&(!status||u.status===status)&&(!unit||u.unit===unit));
 document.getElementById("accountRows").innerHTML=employeeRows(rows);const mobile=document.getElementById("accountMobileRows");if(mobile)mobile.innerHTML=employeeMobileRows(rows);
}
async function openEmployeeProfile(id){
 const r=await fetch("/api/admin/users?id="+encodeURIComponent(id),{credentials:"same-origin"}),x=await r.json().catch(()=>({}));
 if(!r.ok){alert(x.error||"Unable to load employee profile.");return}
 const u=x.user,a=x.audit||[],p=u.permissions||[];
 app().innerHTML=adminStandaloneShell(u.name,"ADMINISTRATION · EMPLOYEE PROFILE");
 const host=document.getElementById("adminStandaloneContent");
 host.innerHTML=`<div class="section-head"><div><h3>${esc(u.name)}</h3><p>${esc(u.email)} · ${esc(u.role)} · ${esc(u.unit)}</p></div><button class="btn ghost" onclick="openEmployeeAccounts()">← Employee Directory</button></div>
 <div class="profile-grid">
  <section class="panel profile-summary"><div class="profile-avatar">${initials(u.name)}</div><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p><div class="profile-meta"><span class="badge ${u.status==="Active"?"green":"grey"}">${esc(u.status)}</span><span>${esc(u.role)}</span><span>${esc(u.unit)}</span></div><button class="btn primary" onclick='editEmployee(${JSON.stringify(u)})'>Edit Account & Permissions</button></section>
  <section class="panel"><div class="panel-head"><div><h3>Access & Permissions</h3><p>Current effective account entitlements.</p></div></div><div class="permission-matrix">
   ${permissionRow("SVEGIP Account",u.status==="Active","Authenticated portal access")}
   ${permissionRow("SVE Data Vault",u.data_vault_access,"Research, evidence and intelligence workspace")}
   ${permissionRow("Data ID Audit Trail",p.includes("vault.audit")||u.role==="Administrator","View Data ID issuance history")}
   ${permissionRow("Data Vault Administration",p.includes("vault.admin")||u.role==="Administrator","Administrative Data Vault controls")}
   ${permissionRow("Employee Account Administration",p.includes("accounts.manage")||u.role==="Administrator","Manage SVEGIP employee accounts")}
  </div></section>
 </div>
 <section class="panel"><div class="panel-head"><div><h3>Account Activity & Audit History</h3><p>Administrative changes recorded for this employee account.</p></div><span class="badge">${a.length} event(s)</span></div>
 <div class="audit-timeline">${a.length?a.map(ev=>`<div class="audit-event"><div class="audit-dot"></div><div><strong>${esc(ev.action)}</strong><p>By ${esc(ev.performed_by)} · ${new Date(ev.created_at).toLocaleString()}</p><small>${esc(JSON.stringify(ev.details||{}))}</small></div></div>`).join(""):`<div class="empty-state">No account changes have been recorded yet.</div>`}</div></section><div id="accountEditor"></div>`;
}
function permissionRow(label,on,desc){return `<div class="permission-row"><div><strong>${label}</strong><small>${desc}</small></div><span class="access-state ${on?"on":"off"}">${on?"Allowed":"Not allowed"}</span></div>`}

async function openControlledDocuments(){
 if(!portalAllowed("documents")){denyPortalAccess("documents");return}
 const r=await fetch("/api/documents-control",{credentials:"same-origin"}),x=await r.json().catch(()=>({}));
 if(!r.ok){alert(x.error||"Unable to load controlled documents.");return}
 const docs=x.documents||[];
 app().innerHTML=adminStandaloneShell("Controlled Document Repository","KNOWLEDGE & DOCUMENTS · DOCUMENT CONTROL");
 const host=document.getElementById("adminStandaloneContent");
 host.innerHTML=`<div class="section-head"><div><h3>Controlled Documents</h3><p>Central register for governed SVE Group documents and file references.</p></div><div>${canEdit()?`<button class="btn primary" onclick="newControlledDocument()">+ Register Document</button>`:""} <button class="btn ghost" onclick="secureGo('documents')">← Knowledge & Documents</button></div></div>
 <div class="doc-control-note"><strong>Interim backend architecture</strong><span>Document control is database-backed. File storage is provider-neutral so SVE can migrate to its own Database Hub later.</span></div>
 <div class="table-wrap"><table class="account-table"><thead><tr><th>Document</th><th>Unit</th><th>Classification</th><th>Version</th><th>Status</th><th></th></tr></thead><tbody>${docs.map(d=>`<tr><td><strong>${esc(d.document_code)}</strong><small>${esc(d.title)}</small></td><td>${esc(d.business_unit)}</td><td><span class="badge">${esc(d.classification)}</span></td><td>${esc(d.current_version)}</td><td>${esc(d.status)}</td><td><button class="btn ghost" onclick="viewControlledDocument(${d.id})">Open</button></td></tr>`).join("")||`<tr><td colspan="6"><div class="empty-state">No controlled documents registered yet.</div></td></tr>`}</tbody></table></div>`;
}
function newControlledDocument(){
 document.getElementById("modal").classList.remove("hidden");
 document.getElementById("modalBody").innerHTML=`<h2>Register Controlled Document</h2><p class="muted">Register the document identity, governance classification and current file reference.</p>
 <div class="form-grid"><label>Document Code<input id="cd_code" placeholder="SVE-GOV-001"></label><label>Title<input id="cd_title"></label><label>Business Unit<select id="cd_unit"><option>SVE</option><option>SKL</option><option>Group</option></select></label><label>Category<input id="cd_category" placeholder="Governance / HR / Legal / Project"></label><label>Classification<select id="cd_class"><option>Internal</option><option>Confidential</option><option>Restricted</option></select></label><label>Status<select id="cd_status"><option>Draft</option><option>Under Review</option><option>Approved</option><option>Superseded</option><option>Archived</option></select></label><label>Version<input id="cd_version" value="0.1"></label><label>Storage Provider<input id="cd_provider" value="INTERIM" readonly></label><label class="full">File / Storage Reference<input id="cd_ref" placeholder="Provider-neutral reference; actual secure storage connector can be added later"></label><label class="full">Change Note<input id="cd_note" value="Initial registration"></label></div>
 <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveControlledDocument()">Register Document</button></div>`;
}
async function saveControlledDocument(){
 const b={documentCode:document.getElementById("cd_code").value.trim(),title:document.getElementById("cd_title").value.trim(),businessUnit:document.getElementById("cd_unit").value,category:document.getElementById("cd_category").value.trim(),classification:document.getElementById("cd_class").value,status:document.getElementById("cd_status").value,version:document.getElementById("cd_version").value.trim(),storageProvider:document.getElementById("cd_provider").value,storageReference:document.getElementById("cd_ref").value.trim()||null,changeNote:document.getElementById("cd_note").value.trim()};
 const r=await fetch("/api/documents-control",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(b)}),x=await r.json().catch(()=>({}));
 if(!r.ok){alert(x.error||"Unable to register document.");return}closeModal();openControlledDocuments();
}
async function viewControlledDocument(id){
 const r=await fetch("/api/documents-control?id="+id,{credentials:"same-origin"}),x=await r.json().catch(()=>({}));if(!r.ok){alert(x.error||"Unable to open document.");return}
 const d=x.document,v=x.versions||[],a=x.audit||[];
 app().innerHTML=adminStandaloneShell(d.document_code,"CONTROLLED DOCUMENT · "+d.classification.toUpperCase());
 const host=document.getElementById("adminStandaloneContent");
 host.innerHTML=`<div class="section-head"><div><h3>${esc(d.title)}</h3><p>${esc(d.business_unit)} · ${esc(d.category)} · Owner: ${esc(d.owner_email||"—")}</p></div><button class="btn ghost" onclick="openControlledDocuments()">← Repository</button></div>
 <div class="profile-grid"><section class="panel"><h3>Document Control</h3><div class="doc-fields">${docField("Document Code",d.document_code)}${docField("Classification",d.classification)}${docField("Current Version",d.current_version)}${docField("Status",d.status)}${docField("Storage Provider",d.storage_provider)}${docField("File Reference",d.storage_reference||"Not attached")}</div></section>
 <section class="panel"><h3>Version History</h3>${v.map(z=>`<div class="version-row"><strong>v${esc(z.version)}</strong><span>${esc(z.change_note||"")}</span><small>${new Date(z.created_at).toLocaleString()} · ${esc(z.uploaded_by)}</small></div>`).join("")||"<p>No versions recorded.</p>"}</section></div>
 ${a.length?`<section class="panel"><h3>Document Audit Trail</h3><div class="audit-timeline">${a.map(ev=>`<div class="audit-event"><div class="audit-dot"></div><div><strong>${esc(ev.action)}</strong><p>${new Date(ev.created_at).toLocaleString()} · ${esc(ev.performed_by)}</p></div></div>`).join("")}</div></section>`:""}`;
}
function docField(k,v){return `<div><small>${k}</small><strong>${esc(String(v??"—"))}</strong></div>`}

async function openManagementCommandCentre(){
 if(!(session?.role==="Administrator"||session?.role==="Management"||session?.role==="Executive Office")){alert("Management / Executive Office access required.");return}
 await loadCentralDB();
 const docsRes=await fetch("/api/documents-control",{credentials:"same-origin"}).then(r=>r.ok?r.json():{documents:[]}).catch(()=>({documents:[]}));
 const cdocs=docsRes.documents||[],projects=db.projects||[],actions=db.actions||[],meetings=db.meetings||[],ann=db.announcements||[];
 const openActions=actions.filter(x=>!["Completed","Closed"].includes(x.status));
 const highProjects=projects.filter(x=>x.priority==="High"||x.status==="Review");
 const upcoming=meetings.filter(x=>x.status==="Upcoming").sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 app().innerHTML=adminStandaloneShell("Management Command Centre","SVE GROUP · MANAGEMENT OVERSIGHT");
 const host=document.getElementById("adminStandaloneContent");
 host.innerHTML=`<div class="command-hero"><div><span class="command-kicker">SVE GROUP MANAGEMENT VIEW</span><h2>Good ${commandDaypart()}, ${esc(session.name)}.</h2><p>Group-level operational view across projects, actions, governance, meetings, documents and strategy intelligence.</p></div><div class="command-clock"><strong id="commandClock"></strong><span>${new Date().toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</span></div></div>
 <div class="decision-command-cta"><div><span>DECISION GOVERNANCE</span><strong>Management Decision Tracker</strong><small>Decision Required → Direction → Owner → Implementation → Closed</small></div><div><button class="btn ghost" onclick="openUnifiedWorkflow()">End-to-End Workflow</button> <button class="btn primary" onclick="openDecisionTracker()">Open Decision Tracker →</button></div></div><div id="commandDecisionStats" class="decision-mini-stats"></div>
 <div class="command-kpis">
  ${commandKpi("Active Projects",projects.filter(x=>x.status==="Active").length,"Projects & Clients","secureGo('projects')")}
  ${commandKpi("Open Actions",openActions.length,"Items requiring follow-through","secureGo('executive')")}
  ${commandKpi("Upcoming Meetings",upcoming.length,"Executive calendar","secureGo('executive')")}
  ${commandKpi("Controlled Documents",cdocs.length,"Governed repository","openControlledDocuments()")}
 </div>
 <div class="command-grid">
  <section class="panel command-span2"><div class="panel-head"><div><h3>Portfolio Oversight</h3><p>Current projects and matters requiring management visibility.</p></div><button class="btn ghost" onclick="secureGo('projects')">Open Projects →</button></div>
   <div class="portfolio-list">${projects.slice(0,8).map(p=>`<div class="portfolio-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.unit)} · ${esc(p.owner)}</small></div><span class="badge">${esc(p.status)}</span><div class="portfolio-next">${esc(p.next||"—")}</div><span class="priority ${String(p.priority).toLowerCase()}">${esc(p.priority)}</span></div>`).join("")||commandEmpty("No projects registered.")}</div>
  </section>
  <section class="panel"><div class="panel-head"><div><h3>Action Watch</h3><p>Outstanding follow-through.</p></div></div>
   <div class="command-list">${openActions.slice(0,6).map(a=>`<div class="command-item"><strong>${esc(a.title)}</strong><span>${esc(a.project||"General")} · ${esc(a.owner||"Unassigned")}</span><small>Due ${esc(a.due||"—")} · ${esc(a.status)}</small></div>`).join("")||commandEmpty("No open actions.")}</div>
  </section>
  <section class="panel"><div class="panel-head"><div><h3>Upcoming Meetings</h3><p>Scheduled management touchpoints.</p></div></div>
   <div class="command-list">${upcoming.slice(0,5).map(m=>`<div class="command-item date-item"><div class="date-block"><strong>${commandDateDay(m.date)}</strong><span>${commandDateMon(m.date)}</span></div><div><strong>${esc(m.title)}</strong><span>${esc(m.time||"")}</span><small>${esc(m.owner||"")}</small></div></div>`).join("")||commandEmpty("No upcoming meetings.")}</div>
  </section>
  <section class="panel"><div class="panel-head"><div><h3>Governance & Documents</h3><p>Controlled knowledge and policy oversight.</p></div><button class="btn ghost" onclick="openControlledDocuments()">Repository →</button></div>
   <div class="command-statline"><span>Controlled documents</span><strong>${cdocs.length}</strong></div>
   <div class="command-statline"><span>Confidential / Restricted</span><strong>${cdocs.filter(d=>["Confidential","Restricted"].includes(d.classification)).length}</strong></div>
   <div class="command-statline"><span>Under review</span><strong>${cdocs.filter(d=>d.status==="Under Review").length}</strong></div>
   <div class="command-statline"><span>Policies in portal</span><strong>${(db.policies||[]).length}</strong></div>
  </section>
  <section class="panel strategy-panel"><div class="panel-head"><div><h3>SVE Data Vault</h3><p>Strategy intelligence and reusable consulting IP.</p></div></div>
   <div class="strategy-flow"><span>FACT</span><b>→</b><span>PATTERN</span><b>→</b><span>IMPLICATION</span><b>→</b><span>RECOMMENDATION</span></div>
   <p class="muted">Move from operational information into evidence-backed management intelligence.</p>
   ${hasDataVaultAccess()?`<button class="btn primary" onclick="openDataVault()">Open SVE Data Vault ↗</button>`:`<span class="badge grey">Data Vault access not assigned</span>`}
  </section>
  <section class="panel command-span2"><div class="panel-head"><div><h3>Latest Group Announcements</h3><p>Recent management communications.</p></div></div>
   <div class="announcement-strip">${ann.slice(0,4).map(a=>`<div><span>${esc(a.date||"")}</span><strong>${esc(a.title)}</strong><small>${esc(a.audience||"Group")}</small></div>`).join("")||commandEmpty("No announcements.")}</div>
  </section>
 </div>`;
 commandTick();loadCommandDecisionStats();window.commandClockTimer&&clearInterval(window.commandClockTimer);window.commandClockTimer=setInterval(commandTick,1000);
}
function commandKpi(label,value,sub,action){return `<button class="command-kpi" onclick="${action}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></button>`}
function commandEmpty(t){return `<div class="empty-state">${t}</div>`}
function commandDaypart(){const h=new Date().getHours();return h<12?"morning":h<18?"afternoon":"evening"}
function commandDateDay(d){const x=new Date(d+"T00:00:00");return isNaN(x)? "—":String(x.getDate()).padStart(2,"0")}
function commandDateMon(d){const x=new Date(d+"T00:00:00");return isNaN(x)? "":x.toLocaleString(undefined,{month:"short"}).toUpperCase()}
function commandTick(){const el=document.getElementById("commandClock");if(el)el.textContent=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}

async function openDecisionTracker(){
 if(!(session?.role==="Administrator"||session?.role==="Management"||session?.role==="Executive Office")){alert("Management / Executive Office access required.");return}
 const r=await fetch("/api/decisions",{credentials:"same-origin"}),x=await r.json().catch(()=>({}));
 if(!r.ok){alert(x.error||"Unable to load management decisions.");return}
 const decisions=x.decisions||[];
 window.SVE_DECISIONS=decisions;
 app().innerHTML=adminStandaloneShell("Management Decision Tracker","SVE GROUP · DECISION GOVERNANCE");
 const host=document.getElementById("adminStandaloneContent");
 const canManage=session?.role==="Administrator"||session?.role==="Management"||(session?.permissions||[]).includes("decisions.manage");
 host.innerHTML=`<div class="section-head"><div><h3>Decision Register</h3><p>Track management decisions from issue raised through implementation and closure.</p></div><div><button class="btn ghost" onclick="exportDecisionRegisterCSV()">Export CSV</button> ${canManage?`<button class="btn primary" onclick="newDecision()">+ New Decision</button>`:""} <button class="btn ghost" onclick="openManagementCommandCentre()">← Command Centre</button></div></div>
 <div class="decision-flow"><div><span>1</span><strong>Decision Required</strong></div><b>→</b><div><span>2</span><strong>Management Direction</strong></div><b>→</b><div><span>3</span><strong>Owner & Due Date</strong></div><b>→</b><div><span>4</span><strong>Implementation</strong></div><b>→</b><div><span>5</span><strong>Closed</strong></div></div>
 <div class="account-kpis">
   <div class="account-kpi"><span>Decision Required</span><strong>${decisions.filter(d=>d.status==="Decision Required").length}</strong></div>
   <div class="account-kpi"><span>Direction Given</span><strong>${decisions.filter(d=>d.status==="Direction Given").length}</strong></div>
   <div class="account-kpi"><span>Implementation</span><strong>${decisions.filter(d=>d.status==="Implementation").length}</strong></div>
   <div class="account-kpi"><span>Closed</span><strong>${decisions.filter(d=>d.status==="Closed").length}</strong></div>
 </div>
 <div class="panel"><div class="account-tools"><input id="decisionSearch" placeholder="Search code, title, project, owner" oninput="filterDecisions()"><select id="decisionStatus" onchange="filterDecisions()"><option value="">All status</option><option>Decision Required</option><option>Direction Given</option><option>Implementation</option><option>Closed</option></select><select id="decisionPriority" onchange="filterDecisions()"><option value="">All priority</option><option>High</option><option>Medium</option><option>Low</option></select></div>
 <div class="table-wrap"><table class="account-table"><thead><tr><th>Decision</th><th>Source / Link</th><th>Priority</th><th>Status</th><th>Owner / Due</th><th></th></tr></thead><tbody id="decisionRows">${decisionRows(decisions)}</tbody></table></div></div>`;
}
function decisionRows(ds){return ds.map(d=>`<tr><td><strong>${esc(d.decision_code)}</strong><small>${esc(d.title)}</small></td><td><strong>${esc(d.source_type)}</strong><small>${esc(d.linked_project||d.linked_meeting||d.linked_data_vault_id||d.source_reference||"—")}</small></td><td><span class="priority ${String(d.priority).toLowerCase()}">${esc(d.priority)}</span></td><td><span class="badge">${esc(d.status)}</span></td><td><strong>${esc(d.owner_email||"Unassigned")}</strong><small>${d.due_date?`Due ${esc(String(d.due_date).slice(0,10))}`:"No due date"}</small></td><td><button class="btn ghost" onclick="openDecision(${d.id})">Open</button></td></tr>`).join("")||`<tr><td colspan="6"><div class="empty-state">No management decisions registered yet.</div></td></tr>`}
function filterDecisions(){
 const q=(document.getElementById("decisionSearch")?.value||"").toLowerCase(),st=document.getElementById("decisionStatus")?.value||"",pr=document.getElementById("decisionPriority")?.value||"";
 const ds=(window.SVE_DECISIONS||[]).filter(d=>(!q||[d.decision_code,d.title,d.linked_project,d.linked_meeting,d.owner_email,d.source_reference].join(" ").toLowerCase().includes(q))&&(!st||d.status===st)&&(!pr||d.priority===pr));
 document.getElementById("decisionRows").innerHTML=decisionRows(ds);
}
function newDecision(){
 document.getElementById("modal").classList.remove("hidden");
 document.getElementById("modalBody").innerHTML=`<h2>Register Management Decision</h2><div class="form-grid">
 <label class="full">Decision / Issue Title<input id="dec_title"></label>
 <label class="full">Background / Decision Required<textarea id="dec_desc" rows="4"></textarea></label>
 <label>Source Type<select id="dec_source"><option>General</option><option>Meeting</option><option>Project</option><option>Data Vault</option><option>Governance</option><option>Client Matter</option></select></label>
 <label>Source Reference<input id="dec_ref" placeholder="e.g. SVE Monthly Meeting"></label>
 <label>Linked Project<input id="dec_project"></label>
 <label>Linked Meeting<input id="dec_meeting"></label>
 <label>Linked Data Vault ID<input id="dec_vault" placeholder="e.g. SVE-DATA-000123"></label>
 <label>Priority<select id="dec_priority"><option>Medium</option><option>High</option><option>Low</option></select></label>
 <label>Owner Email<input id="dec_owner"></label>
 <label>Due Date<input id="dec_due" type="date"></label>
 </div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveNewDecision()">Create Decision</button></div>`;
}
async function saveNewDecision(){
 const b={title:document.getElementById("dec_title").value.trim(),description:document.getElementById("dec_desc").value.trim(),sourceType:document.getElementById("dec_source").value,sourceReference:document.getElementById("dec_ref").value.trim(),linkedProject:document.getElementById("dec_project").value.trim(),linkedMeeting:document.getElementById("dec_meeting").value.trim(),linkedDataVaultId:document.getElementById("dec_vault").value.trim(),priority:document.getElementById("dec_priority").value,ownerEmail:document.getElementById("dec_owner").value.trim(),dueDate:document.getElementById("dec_due").value||null};
 const r=await fetch("/api/decisions",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(b)}),x=await r.json().catch(()=>({}));
 if(!r.ok){alert(x.error||"Unable to create decision.");return}closeModal();openDecisionTracker();
}
async function openDecision(id){
 const r=await fetch("/api/decisions?id="+id,{credentials:"same-origin"}),x=await r.json().catch(()=>({}));if(!r.ok){alert(x.error||"Unable to open decision.");return}
 const d=x.decision,a=x.audit||[];
 app().innerHTML=adminStandaloneShell(d.decision_code,"MANAGEMENT DECISION · "+d.status.toUpperCase());
 const host=document.getElementById("adminStandaloneContent");
 const canManage=session?.role==="Administrator"||session?.role==="Management"||(session?.permissions||[]).includes("decisions.manage");
 host.innerHTML=`<div class="section-head"><div><h3>${esc(d.title)}</h3><p>${esc(d.source_type)} · ${esc(d.source_reference||"No source reference")}</p></div><button class="btn ghost" onclick="openDecisionTracker()">← Decision Register</button></div>
 <div class="decision-detail-grid">
  <section class="panel"><h3>Decision Requirement</h3><p>${esc(d.description||"No background recorded.")}</p><div class="doc-fields">${docField("Priority",d.priority)}${docField("Status",d.status)}${docField("Linked Project",d.linked_project||"—")}${docField("Linked Meeting",d.linked_meeting||"—")}${docField("Data Vault ID",d.linked_data_vault_id||"—")}${docField("Owner",d.owner_email||"Unassigned")}${docField("Due Date",d.due_date?String(d.due_date).slice(0,10):"—")}</div></section>
  <section class="panel"><h3>Management Direction & Implementation</h3>
   ${canManage?`<label>Management Direction<textarea id="decisionDirection" rows="5">${esc(d.direction||"")}</textarea></label>
   <label>Status<select id="decisionStatusEdit"><option ${d.status==="Decision Required"?"selected":""}>Decision Required</option><option ${d.status==="Direction Given"?"selected":""}>Direction Given</option><option ${d.status==="Implementation"?"selected":""}>Implementation</option><option ${d.status==="Closed"?"selected":""}>Closed</option></select></label>
   <label>Owner Email<input id="decisionOwnerEdit" value="${esc(d.owner_email||"")}"></label>
   <label>Due Date<input id="decisionDueEdit" type="date" value="${d.due_date?String(d.due_date).slice(0,10):""}"></label>
   <label>Implementation Note<textarea id="decisionImpl" rows="5">${esc(d.implementation_note||"")}</textarea></label>
   <button class="btn primary" onclick="updateDecision(${d.id})">Save Decision Update</button>`:
   `<p><strong>Management Direction</strong></p><p>${esc(d.direction||"Pending management direction.")}</p><p><strong>Implementation Note</strong></p><p>${esc(d.implementation_note||"No implementation note yet.")}</p>`}
  </section>
 </div>
 <section class="panel"><h3>Decision Audit Trail</h3><div class="audit-timeline">${a.map(ev=>`<div class="audit-event"><div class="audit-dot"></div><div><strong>${esc(ev.action)}</strong><p>${new Date(ev.created_at).toLocaleString()} · ${esc(ev.performed_by)}</p><small>${esc(JSON.stringify(ev.details||{}))}</small></div></div>`).join("")||`<div class="empty-state">No audit events.</div>`}</div></section>`;
}
async function updateDecision(id){
 const b={direction:document.getElementById("decisionDirection").value.trim(),status:document.getElementById("decisionStatusEdit").value,ownerEmail:document.getElementById("decisionOwnerEdit").value.trim(),dueDate:document.getElementById("decisionDueEdit").value||null,implementationNote:document.getElementById("decisionImpl").value.trim()};
 const r=await fetch("/api/decisions?id="+id,{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(b)}),x=await r.json().catch(()=>({}));
 if(!r.ok){alert(x.error||"Unable to update decision.");return}openDecision(id);
}

async function createDecisionFromAction(actionId){
 const a=(db.actions||[]).find(x=>Number(x.id)===Number(actionId));if(!a){alert("Action not found.");return}
 if(!(session?.role==="Administrator"||session?.role==="Management"||(session?.permissions||[]).includes("decisions.manage"))){alert("Management decision write access required.");return}
 const body={title:a.title,description:`Escalated from SVEGIP action item. Current status: ${a.status||"Open"}.`,sourceType:"Project",sourceReference:`Action #${a.id}`,linkedProject:a.project||"",priority:"Medium",ownerEmail:a.owner||"",dueDate:a.due||null,status:"Decision Required"};
 const r=await fetch("/api/decisions",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),x=await r.json().catch(()=>({}));
 if(!r.ok){alert(x.error||"Unable to create management decision.");return}
 alert(`Created ${x.decision.decision_code} from action item.`);openDecision(x.decision.id);
}
async function createDecisionFromDataVault(){
 if(!(session?.role==="Administrator"||session?.role==="Management"||(session?.permissions||[]).includes("decisions.manage"))){alert("Management decision write access required.");return}
 document.getElementById("modal").classList.remove("hidden");
 document.getElementById("modalBody").innerHTML=`<h2>Create Decision from Data Vault Recommendation</h2><p class="muted">Reference the authoritative Data ID so the decision remains traceable to its evidence and analysis.</p><div class="form-grid">
 <label>Data Vault ID<input id="dv_dec_id" placeholder="SVE-DATA-000001"></label><label>Priority<select id="dv_dec_priority"><option>Medium</option><option>High</option><option>Low</option></select></label>
 <label class="full">Decision / Recommendation Title<input id="dv_dec_title"></label><label class="full">Decision Required<textarea id="dv_dec_desc" rows="4"></textarea></label>
 <label>Owner Email<input id="dv_dec_owner"></label><label>Due Date<input id="dv_dec_due" type="date"></label></div>
 <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveDataVaultDecision()">Create Decision</button></div>`;
}
async function saveDataVaultDecision(){
 const body={title:document.getElementById("dv_dec_title").value.trim(),description:document.getElementById("dv_dec_desc").value.trim(),sourceType:"Data Vault",sourceReference:"SVE Data Vault Recommendation",linkedDataVaultId:document.getElementById("dv_dec_id").value.trim(),priority:document.getElementById("dv_dec_priority").value,ownerEmail:document.getElementById("dv_dec_owner").value.trim(),dueDate:document.getElementById("dv_dec_due").value||null,status:"Decision Required"};
 const r=await fetch("/api/decisions",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),x=await r.json().catch(()=>({}));
 if(!r.ok){alert(x.error||"Unable to create decision.");return}closeModal();openDecision(x.decision.id);
}
async function openUnifiedWorkflow(){
 if(!(session?.role==="Administrator"||session?.role==="Management"||session?.role==="Executive Office")){alert("Management / Executive Office access required.");return}
 await loadCentralDB();
 const dr=await fetch("/api/decisions",{credentials:"same-origin"}),dx=await dr.json().catch(()=>({decisions:[]}));
 const decisions=dx.decisions||[], actions=db.actions||[], meetings=db.meetings||[], projects=db.projects||[];
 app().innerHTML=adminStandaloneShell("Insight to Implementation","SVE GROUP · END-TO-END MANAGEMENT WORKFLOW");
 const host=document.getElementById("adminStandaloneContent");
 host.innerHTML=`<div class="section-head"><div><h3>SVE Management Workflow</h3><p>One traceable path from evidence and operational issues to management decision and implementation.</p></div><button class="btn ghost" onclick="openManagementCommandCentre()">← Command Centre</button></div>
 <div class="endtoend-flow">
  <div><span>01</span><strong>Research & Evidence</strong><small>SVE Data Vault</small></div><b>→</b>
  <div><span>02</span><strong>Insight</strong><small>Fact → Pattern → Implication → Recommendation</small></div><b>→</b>
  <div><span>03</span><strong>Management Review</strong><small>Meeting / Project / Governance</small></div><b>→</b>
  <div><span>04</span><strong>Decision</strong><small>Direction + Owner + Due Date</small></div><b>→</b>
  <div><span>05</span><strong>Implementation</strong><small>Action & progress</small></div><b>→</b>
  <div><span>06</span><strong>Closure</strong><small>Audit & organisational knowledge</small></div>
 </div>
 <div class="command-kpis">
  ${commandKpi("Projects",projects.length,"Operating portfolio","secureGo('projects')")}
  ${commandKpi("Actions",actions.filter(a=>!["Closed","Completed"].includes(a.status)).length,"Open follow-through","openUnifiedWorkflow()")}
  ${commandKpi("Decisions",decisions.filter(d=>d.status!=="Closed").length,"Open management decisions","openDecisionTracker()")}
  ${commandKpi("Closed Decisions",decisions.filter(d=>d.status==="Closed").length,"Completed governance cycle","openDecisionTracker()")}
 </div>
 <div class="command-grid">
 <section class="panel"><div class="panel-head"><div><h3>Actions Ready for Escalation</h3><p>Promote an operational action into formal management decision governance.</p></div></div>
 <div class="command-list">${actions.filter(a=>!["Closed","Completed"].includes(a.status)).map(a=>`<div class="workflow-action"><div><strong>${esc(a.title)}</strong><span>${esc(a.project||"General")} · ${esc(a.owner||"Unassigned")}</span><small>Due ${esc(a.due||"—")}</small></div>${session?.role==="Administrator"||session?.role==="Management"||(session?.permissions||[]).includes("decisions.manage")?`<button class="btn ghost" onclick="createDecisionFromAction(${a.id})">Escalate → Decision</button>`:""}</div>`).join("")||commandEmpty("No open actions.")}</div></section>
 <section class="panel"><div class="panel-head"><div><h3>Data Vault → Decision</h3><p>Carry a recommendation into management governance while preserving its Data ID.</p></div></div>
 <div class="vault-decision-card"><div class="strategy-flow"><span>FACT</span><b>→</b><span>PATTERN</span><b>→</b><span>IMPLICATION</span><b>→</b><span>RECOMMENDATION</span></div>
 <p>When a recommendation requires management direction, create a Decision and link the authoritative SVE Data ID.</p>
 ${session?.role==="Administrator"||session?.role==="Management"||(session?.permissions||[]).includes("decisions.manage")?`<button class="btn primary" onclick="createDecisionFromDataVault()">Create from Data Vault Recommendation</button>`:""} ${hasDataVaultAccess()?`<button class="btn ghost" onclick="openDataVault()">Open Data Vault ↗</button>`:""}</div></section>
 </div>
 <section class="panel"><div class="panel-head"><div><h3>Decision Pipeline</h3><p>Current management governance cycle.</p></div><button class="btn ghost" onclick="openDecisionTracker()">Full Register →</button></div>
 <div class="decision-board">${["Decision Required","Direction Given","Implementation","Closed"].map(st=>`<div class="decision-column"><h4>${st}<span>${decisions.filter(d=>d.status===st).length}</span></h4>${decisions.filter(d=>d.status===st).slice(0,6).map(d=>`<button onclick="openDecision(${d.id})"><strong>${esc(d.decision_code)}</strong><span>${esc(d.title)}</span><small>${esc(d.linked_project||d.linked_data_vault_id||d.source_type)} · ${esc(d.owner_email||"Unassigned")}</small></button>`).join("")||`<div class="empty-mini">No items</div>`}</div>`).join("")}</div></section>`;
}
async function loadCommandDecisionStats(){
 try{const r=await fetch("/api/decisions",{credentials:"same-origin"});if(!r.ok)return;const x=await r.json(),ds=x.decisions||[];
  const el=document.getElementById("commandDecisionStats");if(el)el.innerHTML=`<div><span>Decision Required</span><strong>${ds.filter(d=>d.status==="Decision Required").length}</strong></div><div><span>Direction Given</span><strong>${ds.filter(d=>d.status==="Direction Given").length}</strong></div><div><span>Implementation</span><strong>${ds.filter(d=>d.status==="Implementation").length}</strong></div><div><span>Closed</span><strong>${ds.filter(d=>d.status==="Closed").length}</strong></div>`;
 }catch(e){console.error(e)}
}
function exportDecisionRegisterCSV(){
 const ds=window.SVE_DECISIONS||[];if(!ds.length){alert("No decisions to export.");return}
 const cols=["decision_code","title","source_type","source_reference","linked_project","linked_meeting","linked_data_vault_id","priority","status","direction","owner_email","due_date","implementation_note","updated_at"];
 const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
 const csv=[cols.join(","),...ds.map(d=>cols.map(c=>q(d[c])).join(","))].join("\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`SVE_Management_Decision_Register_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
}

// ============================================================
// PR #11 — People / HRMS (SVEGIP application shell)
// ============================================================
// Presentation layer only. Every screen below reads/writes through the
// same-origin Netlify proxy functions (apps/svegip/netlify/functions/
// {organisation,hrms,workflow}-api.mts), which forward the caller's own
// SVEGIP session to the real platform-services HTTP APIs — this file
// never invents HR data, never stores sensitive HR data in localStorage,
// and never completes a lifecycle case or Workflow decision client-side.
// See docs/architecture/hrms-application-shell.md for the full design,
// the API gap assessment, and what is intentionally not built yet.

const HRMS_LIFECYCLE_LABELS={onboarding:"Onboarding",probation:"Probation & Confirmation",employment_change:"Employment Changes",offboarding:"Offboarding"};
let hrmsLifecycleType="onboarding";
let hrmsSelectedEmployeeId=null;
let hrmsSelectedCaseId=null;
let hrmsOrgRefCache=null;

/** Shared API client for the People/HRMS area — mirrors the existing Data Vault frontend's own dataVaultFetch envelope convention (unwrap {data}/{error}, redirect to sign-in on 401) rather than the older app-wide alert()-on-failure pattern, since these screens need real loading/error/empty states, not native alert() dialogs (brief item 16). */
async function svegipApiFetch(path,options={}){
 let res;
 try{
   res=await fetch(path,{credentials:"same-origin",...options,headers:{"content-type":"application/json",...(options.headers||{})}});
 }catch(e){
   throw new Error("Unable to reach the server. Check your connection and try again.");
 }
 if(res.status===401){
   location.href="/?next="+encodeURIComponent(location.pathname)+"&sessionExpired=1";
   throw new Error("Your session has expired.");
 }
 const body=await res.json().catch(()=>({}));
 if(!res.ok){
   const err=body.error;
   const message=typeof err==="string"?err:(err&&err.message)||`Request failed (${res.status}).`;
   const wrapped=new Error(message);
   wrapped.status=res.status;
   wrapped.code=err&&err.code;
   throw wrapped;
 }
 return body.data;
}

// ---- Enterprise loading/empty/error/denied states (brief item 16) ----
function hrmsLoadingPanel(label){return `<div class="card hrms-state"><div class="hrms-spinner" aria-hidden="true"></div><p>${esc(label||"Loading…")}</p></div>`}
function hrmsErrorPanel(message){return `<div class="card hrms-state hrms-state-error" role="alert"><strong>Something went wrong</strong><p>${esc(message||"Unable to load this data. Please try again.")}</p></div>`}
function hrmsEmptyPanel(message){return `<div class="empty-state">${esc(message)}</div>`}
function hrmsDeniedPanel(message){return `<div class="card hrms-state hrms-state-denied" role="alert"><strong>Access restricted</strong><p>${esc(message||"You are not authorised to view this information.")}</p></div>`}
function hrmsRenderError(err){
 if(err&&err.status===403)return hrmsDeniedPanel(err.message);
 if(err&&err.status===404)return hrmsEmptyPanel(err.message||"Not found.");
 return hrmsErrorPanel(err&&err.message);
}
/** Renders an immediate loading state into `host`, then swaps in the real content or an error/empty/denied state once `loadFn` settles — never leaves stale content on screen while a request is in flight (brief item 16), and never throws into the caller (all failures render as a state panel). */
function hrmsAsyncRender(host,loadFn,renderFn,loadingLabel){
 host.innerHTML=hrmsLoadingPanel(loadingLabel);
 loadFn().then(data=>{
   if(!document.body.contains(host))return;
   try{host.innerHTML=renderFn(data)}catch(e){console.error(e);host.innerHTML=hrmsErrorPanel("Unable to display this data.")}
 }).catch(err=>{
   console.error(err);
   if(document.body.contains(host))host.innerHTML=hrmsRenderError(err);
 });
}

function loadHrmsOrgReference(){
 if(!hrmsOrgRefCache){
   hrmsOrgRefCache=Promise.all([
     svegipApiFetch("/api/v1/organisation/legal-entities").then(d=>d.legalEntities||[]),
     svegipApiFetch("/api/v1/organisation/business-units").then(d=>d.businessUnits||[]),
     svegipApiFetch("/api/v1/organisation/departments").then(d=>d.departments||[]),
     svegipApiFetch("/api/v1/organisation/positions").then(d=>d.positions||[]),
   ]).then(([legalEntities,businessUnits,departments,positions])=>({legalEntities,businessUnits,departments,positions}))
     .catch(err=>{hrmsOrgRefCache=null;throw err});
 }
 return hrmsOrgRefCache;
}
function hrmsNameLookup(list){const m=new Map((list||[]).map(x=>[x.id,x.name||x.title||x.key]));return id=>id&&m.has(id)?m.get(id):"—"}
/** Converts a raw backend enum ("full_time", "IN_PROGRESS", "ON_LEAVE") into a professional display label. Only changes what is SHOWN — never the value passed into statusBadge's own colour logic, so existing colour rules keep working unchanged. */
function hrmsLabel(value){
 if(value===null||value===undefined||value==="")return "—";
 return String(value).toLowerCase().replace(/[_\s]+/g," ").trim().replace(/\b\w/g,c=>c.toUpperCase());
}
function hrmsStatusBadge(raw){return statusBadge(hrmsLabel(raw))}

// ---- My SVE (employee workspace) ----
async function loadMySveData(){
 const [employeeData,tasksData,ref]=await Promise.all([
   svegipApiFetch("/api/v1/employees/me"),
   svegipApiFetch("/api/v1/workflow/tasks?status=PENDING").catch(()=>({tasks:[]})),
   loadHrmsOrgReference().catch(()=>null),
 ]);
 return {employee:employeeData&&employeeData.employee,tasks:(tasksData&&tasksData.tasks)||[],ref};
}
function renderMySve(data){
 const e=data.employee;
 if(!e){
   return `<div class="section"><div class="card hrms-state"><strong>Profile not linked yet</strong><p>Your SVEGIP account isn't linked to an employee profile yet, so your details can't be shown here. Contact People if this doesn't look right.</p></div></div>${renderMySveTasksPreview(data.tasks)}`;
 }
 const a=e.restricted?e.restricted.currentAssignment:null;
 const names=hrmsOrgFieldNames(data);
 const workLocation=(e.currentAssignment&&e.currentAssignment.workLocation)||null;
 const subtitle=[names.position,names.legalEntity,workLocation].filter(n=>n&&n!=="—").join(" · ")||"SVE Group";
 return `<div class="section">
   <div class="card hrms-profile-summary-card">
     <div class="hrms-profile-summary-head">
       <div class="employee-avatar hrms-avatar-lg">${initials(e.preferredName||e.legalName)}</div>
       <div class="hrms-profile-summary-titles">
         <h3>${esc(e.preferredName||e.legalName)}</h3>
         <p>${esc(subtitle)}</p>
       </div>
       ${e.restricted?hrmsStatusBadge(e.restricted.status):""}
     </div>
     <div class="hrms-profile-summary-meta">
       ${a?`<span>${esc(hrmsLabel(a.employmentType))}</span>`:""}
       ${a&&a.startDate?`<span>With SVE since ${fmtDate(a.startDate)}</span>`:""}
     </div>
   </div>
 </div>
 <div class="section grid g2">
   <div class="card"><h3>My Profile</h3><dl class="hrms-field-list">
     <div><dt>Employee Number</dt><dd>${esc(e.employeeNumber||"—")}</dd></div>
     <div><dt>Legal Name</dt><dd>${esc(e.legalName||"—")}</dd></div>
     <div><dt>Preferred Name</dt><dd>${esc(e.preferredName||"—")}</dd></div>
     <div><dt>Work Email</dt><dd>${esc(e.workEmail||"—")}</dd></div>
   </dl></div>
   <div class="card"><h3>My Employment</h3><dl class="hrms-field-list">
     <div><dt>Employment Type</dt><dd>${a?esc(hrmsLabel(a.employmentType)):"—"}</dd></div>
     <div><dt>Status</dt><dd>${a?hrmsStatusBadge(a.status):"—"}</dd></div>
     <div><dt>Start Date</dt><dd>${a&&a.startDate?fmtDate(a.startDate):"—"}</dd></div>
     <div><dt>Confirmation Date</dt><dd>${a&&a.confirmationDate?fmtDate(a.confirmationDate):"—"}</dd></div>
     <div><dt>Department</dt><dd>${names.department}</dd></div>
     <div><dt>Manager</dt><dd>${hrmsReportsToDisplay(e)}</dd></div>
     <div><dt>Work Location</dt><dd>${esc(workLocation||"—")}</dd></div>
     <div><dt>Work Arrangement</dt><dd>${esc(hrmsLabel(e.currentAssignment&&e.currentAssignment.workArrangement))}</dd></div>
   </dl></div>
 </div>
 ${renderMySveTasksPreview(data.tasks)}
 <div class="section hrms-future-modules">
   <div class="panel-head"><div><h3>Coming later</h3><p>Reserved for future modules.</p></div></div>
   <div class="grid g4">${["Leave","Attendance","Claims","Payslips","Performance","Training","Documents","Policies & Acknowledgements"].map(m=>`<div class="card hrms-future-card"><strong>${esc(m)}</strong><span>Planned</span></div>`).join("")}</div>
 </div>`;
}
function renderMySveTasksPreview(tasks){
 return `<div class="section"><div class="panel-head"><div><h3>My Tasks</h3><p>Tasks currently assigned to you.</p></div><button class="btn ghost" onclick="secureGo('mytasks')">Open My Tasks →</button></div>
 <div class="card"><div class="list">${tasks.slice(0,5).map(t=>li(hrmsTaskTypeLabel(t),t.dueAt?"Due "+fmtDate(t.dueAt.slice(0,10)):"",hrmsLabel(t.status))).join("")||hrmsEmptyPanel("No tasks currently assigned to you.")}</div></div></div>`;
}
function hrmsTaskTypeLabel(t){return t.taskType==="APPROVAL"?"Approval decision required":"Task"}
function mySve(c){
 c.innerHTML=`${roleBanner()}<div class="identity hrms-workspace-identity"><div><div class="eyebrow">MY WORKSPACE</div><h2>My SVE</h2><p>Your own profile, employment summary and assigned tasks.</p></div></div><div id="mySveBody"></div>`;
 hrmsAsyncRender(document.getElementById("mySveBody"),loadMySveData,renderMySve,"Loading your profile…");
}

// ---- My Tasks / Approvals (real Workflow tasks + real decisions) ----
async function loadTaskListData(){
 const tasksData=await svegipApiFetch("/api/v1/workflow/tasks");
 const tasks=tasksData.tasks||[];
 // Enrich each task with its parent instance (subject/requester/started
 // date/current stage) and, when the subject is an HRMS lifecycle case,
 // the case itself — Workflow deliberately stores no copy of the
 // business record, so this join happens here, not server-side (see
 // docs/architecture/hrms-application-shell.md "API additions/gaps").
 // Bounded by the size of one user's own task list, never a bulk scan.
 const enriched=await Promise.all(tasks.map(async t=>{
   let instance=null,hrmsCase=null;
   try{instance=(await svegipApiFetch(`/api/v1/workflow/instances/${encodeURIComponent(t.instanceId)}`)).instance}catch(e){}
   if(instance&&instance.subjectType==="hrms.lifecycle"){
     try{hrmsCase=(await svegipApiFetch(`/api/v1/hrms/lifecycle/cases/${encodeURIComponent(instance.subjectId)}`)).case}catch(e){}
   }
   return {task:t,instance,hrmsCase};
 }));
 return enriched;
}
/** Requester identity is deliberately masked, not resolved: no endpoint exists to turn a userId into a display name, and showing a raw internal id fragment reads as unfinished/technical — see docs/architecture/hrms-application-shell.md "API additions/gaps". */
function hrmsRequesterLabel(userId){return userId?"An SVE employee":"—"}
function renderTaskList(rows,opts={}){
 if(!rows.length)return hrmsEmptyPanel(opts.emptyMessage||"No tasks currently assigned to you.");
 const desktop=`<div class="table-wrap desktop-register"><table><thead><tr><th>Task</th><th>Process / Subject</th><th>Submitted by</th><th>Submitted</th><th>Stage</th><th>Due / Status</th><th></th></tr></thead><tbody>${rows.map(hrmsTaskRow).join("")}</tbody></table></div>`;
 const mobile=`<div class="mobile-record-list">${rows.map(hrmsTaskCard).join("")}</div>`;
 return desktop+mobile;
}
function hrmsTaskSubjectLabel(r){
 if(r.hrmsCase)return `${HRMS_LIFECYCLE_LABELS[r.hrmsCase.lifecycleType]||esc(r.hrmsCase.lifecycleType)} · ${esc(r.hrmsCase.caseNumber)}`;
 if(r.instance)return "Other workflow process";
 return "—";
}
/** Prefers the underlying HR case's own human-readable stage (e.g. "Awaiting manager review") over Workflow's internal step id, which is never shown directly to users. */
function hrmsStageLabel(r){
 const stage=r.hrmsCase&&r.hrmsCase.restricted&&r.hrmsCase.restricted.currentStage;
 return stage?esc(stage):"—";
}
function hrmsTaskRow(r){
 const t=r.task;
 return `<tr>
   <td><strong>${hrmsTaskTypeLabel(t)}</strong></td>
   <td>${hrmsTaskSubjectLabel(r)}</td>
   <td>${hrmsRequesterLabel(r.instance&&r.instance.requesterUserId)}</td>
   <td>${r.instance&&r.instance.startedAt?fmtDate(r.instance.startedAt.slice(0,10)):"—"}</td>
   <td>${hrmsStageLabel(r)}</td>
   <td>${hrmsStatusBadge(t.status)}${t.dueAt?` <small>Due ${fmtDate(t.dueAt.slice(0,10))}</small>`:""}</td>
   <td>${hrmsTaskActions(t)}</td>
 </tr>`;
}
function hrmsTaskCard(r){
 const t=r.task;
 return `<article class="mobile-record-card"><h4>${hrmsTaskTypeLabel(t)}</h4><p>${hrmsTaskSubjectLabel(r)}</p><dl>
   <div><dt>Submitted by</dt><dd>${hrmsRequesterLabel(r.instance&&r.instance.requesterUserId)}</dd></div>
   <div><dt>Submitted</dt><dd>${r.instance&&r.instance.startedAt?fmtDate(r.instance.startedAt.slice(0,10)):"—"}</dd></div>
   <div><dt>Stage</dt><dd>${hrmsStageLabel(r)}</dd></div>
   <div><dt>Status</dt><dd>${hrmsStatusBadge(t.status)}${t.dueAt?` Due ${fmtDate(t.dueAt.slice(0,10))}`:""}</dd></div>
 </dl>${hrmsTaskActions(t)}</article>`;
}
function hrmsTaskActions(t){
 if(t.taskType!=="APPROVAL"||t.status!=="PENDING")return "";
 return `<div class="toolbar hrms-task-actions">
   <button class="btn primary" onclick="decideHrmsTask('${t.id}','APPROVE')">Approve</button>
   <button class="btn danger" onclick="decideHrmsTask('${t.id}','REJECT')">Reject</button>
   <button class="btn ghost" onclick="decideHrmsTask('${t.id}','RETURN')">Return</button>
 </div>`;
}
/** Submits a REAL Workflow decision (POST /workflow/tasks/:id/decide) — never a client-side-only status change. A decision the current step does not permit is rejected by the backend and shown here as an honest error, rather than being pre-validated/guessed client-side. */
async function decideHrmsTask(taskId,decision){
 const comment=decision==="REJECT"||decision==="RETURN"?prompt(`Optional comment for this ${decision.toLowerCase()} decision:`)||undefined:undefined;
 try{
   await svegipApiFetch(`/api/v1/workflow/tasks/${encodeURIComponent(taskId)}/decide`,{method:"POST",body:JSON.stringify({decision,comment})});
   renderSection();
 }catch(e){
   alert(e.message||"Unable to record this decision.");
 }
}
function myTasks(c){
 c.innerHTML=`${roleBanner()}<div class="section-head"><div><h3>My Tasks</h3><p>Tasks currently assigned to you.</p></div></div><div id="myTasksBody"></div>`;
 hrmsAsyncRender(document.getElementById("myTasksBody"),loadTaskListData,rows=>renderTaskList(rows,{emptyMessage:"No tasks currently assigned to you."}),"Loading your tasks…");
}
function hrmsApprovals(c){
 c.innerHTML=`${roleBanner()}<div class="section-head"><div><h3>Approvals</h3><p>Approval decisions currently assigned to you.</p></div></div><div id="hrmsApprovalsBody"></div>`;
 hrmsAsyncRender(document.getElementById("hrmsApprovalsBody"),loadTaskListData,rows=>renderTaskList(rows.filter(r=>r.task.taskType==="APPROVAL"),{emptyMessage:"No approval tasks currently assigned to you."}),"Loading approvals…");
}

// ---- HR Dashboard ----
async function loadHrDashboardData(){
 const [employees,onboarding,probation,employmentChange,offboarding]=await Promise.all([
   svegipApiFetch("/api/v1/employees?status=ACTIVE").then(d=>d.employees||[]),
   svegipApiFetch("/api/v1/hrms/lifecycle/cases?lifecycleType=onboarding&status=IN_PROGRESS").then(d=>d.cases||[]),
   svegipApiFetch("/api/v1/hrms/lifecycle/cases?lifecycleType=probation&status=IN_PROGRESS").then(d=>d.cases||[]),
   svegipApiFetch("/api/v1/hrms/lifecycle/cases?lifecycleType=employment_change&status=IN_PROGRESS").then(d=>d.cases||[]),
   svegipApiFetch("/api/v1/hrms/lifecycle/cases?lifecycleType=offboarding&status=IN_PROGRESS").then(d=>d.cases||[]),
 ]);
 return {employees,onboarding,probation,employmentChange,offboarding};
}
function renderHrDashboard(d){
 return `<div class="grid g5">
   ${metric("Active Employees",d.employees.length,"Across SVE Group")}
   ${metric("Onboarding",d.onboarding.length,"Currently onboarding")}
   ${metric("Probation & Confirmation",d.probation.length,"Currently in probation")}
   ${metric("Employment Changes",d.employmentChange.length,"Awaiting completion")}
   ${metric("Offboarding",d.offboarding.length,"Currently offboarding")}
 </div>
 <div class="section grid g2">
   <div class="card"><h3>Onboarding</h3><div class="list">${d.onboarding.slice(0,5).map(hrmsCaseListItem).join("")||hrmsEmptyPanel("No onboarding cases in progress.")}</div></div>
   <div class="card"><h3>Offboarding</h3><div class="list">${d.offboarding.slice(0,5).map(hrmsCaseListItem).join("")||hrmsEmptyPanel("No offboarding cases in progress.")}</div></div>
 </div>`;
}
function hrmsCaseListItem(caseRow){
 return `<div class="list-item hrms-case-list-item" onclick="goHrmsCase('${caseRow.id}')"><div><div class="list-title">${esc(caseRow.caseNumber)}</div><div class="list-meta">${HRMS_LIFECYCLE_LABELS[caseRow.lifecycleType]||esc(caseRow.lifecycleType)}</div></div>${hrmsStatusBadge(caseRow.status)}</div>`;
}
function hrDashboard(c){
 c.innerHTML=`${roleBanner()}<div class="section-head"><div><h3>HR Dashboard</h3><p>An operational overview of active People lifecycle work.</p></div></div><div id="hrDashboardBody"></div>`;
 hrmsAsyncRender(document.getElementById("hrDashboardBody"),loadHrDashboardData,renderHrDashboard,"Loading HR dashboard…");
}

// ---- Employee Directory ----
let hrmsDirectoryFilters={legalEntityId:"",businessUnitId:"",departmentId:"",status:"",search:""};
async function loadHrmsDirectoryData(){
 const params=new URLSearchParams();
 if(hrmsDirectoryFilters.search)params.set("search",hrmsDirectoryFilters.search);
 if(hrmsDirectoryFilters.status)params.set("status",hrmsDirectoryFilters.status);
 const [employeesData,ref]=await Promise.all([
   svegipApiFetch("/api/v1/employees?"+params.toString()),
   loadHrmsOrgReference(),
 ]);
 let rows=employeesData.employees||[];
 if(hrmsDirectoryFilters.legalEntityId)rows=rows.filter(e=>e.currentAssignment&&e.currentAssignment.legalEntityId===hrmsDirectoryFilters.legalEntityId);
 if(hrmsDirectoryFilters.businessUnitId)rows=rows.filter(e=>e.currentAssignment&&e.currentAssignment.businessUnitId===hrmsDirectoryFilters.businessUnitId);
 if(hrmsDirectoryFilters.departmentId)rows=rows.filter(e=>e.currentAssignment&&e.currentAssignment.departmentId===hrmsDirectoryFilters.departmentId);
 return {rows,ref};
}
function renderHrmsDirectory(data){
 const {rows,ref}=data;
 const legalEntityName=hrmsNameLookup(ref.legalEntities),businessUnitName=hrmsNameLookup(ref.businessUnits),departmentName=hrmsNameLookup(ref.departments),positionName=hrmsNameLookup(ref.positions);
 const desktop=`<div class="table-wrap desktop-register"><table><thead><tr><th>Employee</th><th>Employee #</th><th>Legal Entity</th><th>Business Unit</th><th>Department</th><th>Position</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr class="hrms-directory-row" onclick="goHrmsEmployee('${e.id}')"><td><strong>${esc(e.legalName)}</strong>${e.preferredName?`<br><small>${esc(e.preferredName)}</small>`:""}</td><td>${esc(e.employeeNumber)}</td><td>${legalEntityName(e.currentAssignment&&e.currentAssignment.legalEntityId)}</td><td>${businessUnitName(e.currentAssignment&&e.currentAssignment.businessUnitId)}</td><td>${departmentName(e.currentAssignment&&e.currentAssignment.departmentId)}</td><td>${positionName(e.currentAssignment&&e.currentAssignment.positionId)}</td><td>${e.restricted?hrmsStatusBadge(e.restricted.status):"—"}</td><td><button class="btn ghost hrms-view-profile-btn" onclick="event.stopPropagation();goHrmsEmployee('${e.id}')">View Profile →</button></td></tr>`).join("")}</tbody></table></div>`;
 const mobile=`<div class="mobile-record-list">${rows.map(e=>`<article class="mobile-record-card"><h4>${esc(e.legalName)}</h4><p>${esc(e.employeeNumber)}</p><dl><div><dt>Legal Entity</dt><dd>${legalEntityName(e.currentAssignment&&e.currentAssignment.legalEntityId)}</dd></div><div><dt>Business Unit</dt><dd>${businessUnitName(e.currentAssignment&&e.currentAssignment.businessUnitId)}</dd></div><div><dt>Department</dt><dd>${departmentName(e.currentAssignment&&e.currentAssignment.departmentId)}</dd></div><div><dt>Position</dt><dd>${positionName(e.currentAssignment&&e.currentAssignment.positionId)}</dd></div></dl><button class="btn ghost" onclick="goHrmsEmployee('${e.id}')">View Profile →</button></article>`).join("")}</div>`;
 return (rows.length?desktop+mobile:hrmsEmptyPanel("No employees match the current filters."));
}
function hrmsDirectoryRerender(){
 const body=document.getElementById("hrmsDirectoryBody");
 if(body)hrmsAsyncRender(body,loadHrmsDirectoryData,renderHrmsDirectory,"Loading employee directory…");
}
function hrmsDirectoryFilterChanged(field,value){hrmsDirectoryFilters[field]=value;hrmsDirectoryRerender()}
function hrmsDirectory(c){
 c.innerHTML=`${roleBanner()}<div class="section-head"><div><h3>Employee Directory</h3><p>General contact and role information. Sensitive employment details are not shown here.</p></div></div>
 <div class="account-tools hrms-directory-tools" id="hrmsDirectoryTools">${hrmsLoadingPanel("Loading filters…")}</div>
 <div id="hrmsDirectoryBody"></div>`;
 loadHrmsOrgReference().then(ref=>{
   const tools=document.getElementById("hrmsDirectoryTools");
   if(!tools)return;
   tools.innerHTML=`<input placeholder="Search name or employee number" oninput="hrmsDirectoryFilterChanged('search',this.value)">
     <select onchange="hrmsDirectoryFilterChanged('legalEntityId',this.value)"><option value="">All legal entities</option>${ref.legalEntities.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select>
     <select onchange="hrmsDirectoryFilterChanged('businessUnitId',this.value)"><option value="">All business units</option>${ref.businessUnits.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select>
     <select onchange="hrmsDirectoryFilterChanged('departmentId',this.value)"><option value="">All departments</option>${ref.departments.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select>
     <select onchange="hrmsDirectoryFilterChanged('status',this.value)"><option value="">All status</option><option value="ACTIVE">Active</option><option value="ON_LEAVE">On Leave</option><option value="TERMINATED">Terminated</option></select>`;
 }).catch(err=>{const tools=document.getElementById("hrmsDirectoryTools");if(tools)tools.innerHTML=hrmsRenderError(err)});
 hrmsDirectoryRerender();
}

// ---- Employee Master / Employee Profile ----
// PR #12: a real Employee Master view — header + Overview/Employment/
// Organisation & Reporting/Lifecycle/History tabs. A tab whose fields are
// entirely restricted-tier (Employment, History) is omitted outright for a
// viewer without canReadRestricted, rather than shown empty/decorative —
// see docs/architecture/organisation-employee-master.md "Employee Profile
// tab availability". Tab switches re-render from the already-fetched data
// (hrmsProfileDataCache) — never a re-fetch.
const HRMS_PROFILE_TABS=[{key:"overview",label:"Overview"},{key:"employment",label:"Employment"},{key:"organisation",label:"Organisation & Reporting"},{key:"lifecycle",label:"Lifecycle"},{key:"history",label:"History"}];
let hrmsProfileTab="overview";
let hrmsProfileDataCache=null;
function goHrmsEmployee(employeeId){hrmsSelectedEmployeeId=employeeId;hrmsProfileTab="overview";hrmsProfileDataCache=null;secureGo("hrmsEmployee")}
async function loadHrmsEmployeeProfileData(){
 const id=hrmsSelectedEmployeeId;
 const [employeeData,assignmentsData,casesData,ref]=await Promise.all([
   svegipApiFetch(`/api/v1/employees/${encodeURIComponent(id)}`),
   svegipApiFetch(`/api/v1/employees/${encodeURIComponent(id)}/assignments`).catch(()=>({assignments:[]})),
   svegipApiFetch(`/api/v1/hrms/lifecycle/cases?employeeId=${encodeURIComponent(id)}`).catch(()=>({cases:[]})),
   loadHrmsOrgReference().catch(()=>null),
 ]);
 return {employee:employeeData.employee,assignments:assignmentsData.assignments||[],cases:casesData.cases||[],ref};
}
function hrmsSwitchProfileTab(tab){
 hrmsProfileTab=tab;
 const body=document.getElementById("hrmsEmployeeBody");
 if(body&&hrmsProfileDataCache)body.innerHTML=renderHrmsEmployeeProfile(hrmsProfileDataCache);
}
function hrmsOrgFieldNames(data){
 const e=data.employee;
 return {
   legalEntity:data.ref?hrmsNameLookup(data.ref.legalEntities)(e.currentAssignment&&e.currentAssignment.legalEntityId):"—",
   businessUnit:data.ref?hrmsNameLookup(data.ref.businessUnits)(e.currentAssignment&&e.currentAssignment.businessUnitId):"—",
   department:data.ref?hrmsNameLookup(data.ref.departments)(e.currentAssignment&&e.currentAssignment.departmentId):"—",
   position:data.ref?hrmsNameLookup(data.ref.positions)(e.currentAssignment&&e.currentAssignment.positionId):"—",
 };
}
function renderHrmsEmployeeProfile(data){
 hrmsProfileDataCache=data;
 const e=data.employee,r=e.restricted,names=hrmsOrgFieldNames(data);
 const tabs=HRMS_PROFILE_TABS.filter(t=>r||(t.key!=="employment"&&t.key!=="history"));
 const header=`<div class="identity hrms-workspace-identity"><div><div class="eyebrow">EMPLOYEE PROFILE</div><h2>${esc(e.legalName)}</h2><p>${e.preferredName?esc(e.preferredName)+" · ":""}${esc(e.employeeNumber)}</p><p>${[names.position,names.department,names.legalEntity].filter(n=>n&&n!=="—").join(" · ")||"SVE Group"}</p></div>${r?hrmsStatusBadge(r.status):""}</div>`;
 const tabNav=`<div class="tabs hrms-profile-tabs" role="tablist">${tabs.map(t=>`<button class="tab ${hrmsProfileTab===t.key?"active":""}" role="tab" aria-selected="${hrmsProfileTab===t.key}" onclick="hrmsSwitchProfileTab('${t.key}')">${esc(t.label)}</button>`).join("")}</div>`;
 const activeTab=tabs.some(t=>t.key===hrmsProfileTab)?hrmsProfileTab:"overview";
 const body={overview:hrmsProfileOverviewTab,employment:hrmsProfileEmploymentTab,organisation:hrmsProfileOrganisationTab,lifecycle:hrmsProfileLifecycleTab,history:hrmsProfileHistoryTab}[activeTab](data,names);
 return header+tabNav+body;
}
function hrmsProfileOverviewTab(data){
 const e=data.employee,r=e.restricted;
 return `<div class="section"><div class="card"><dl class="hrms-field-list">
   <div><dt>Employee Number</dt><dd>${esc(e.employeeNumber||"—")}</dd></div>
   <div><dt>Legal Name</dt><dd>${esc(e.legalName||"—")}</dd></div>
   <div><dt>Preferred Name</dt><dd>${esc(e.preferredName||"—")}</dd></div>
   <div><dt>Work Email</dt><dd>${esc(e.workEmail||"—")}</dd></div>
   <div><dt>Employment Country</dt><dd>${esc(e.employmentCountry||"—")}</dd></div>
   ${r?`<div><dt>Status</dt><dd>${hrmsStatusBadge(r.status)}</dd></div>`:""}
 </dl></div></div>`;
}
function hrmsProfileEmploymentTab(data){
 const a=data.employee.restricted?data.employee.restricted.currentAssignment:null;
 return `<div class="section"><div class="card"><dl class="hrms-field-list">
   <div><dt>Employment Type</dt><dd>${a?esc(hrmsLabel(a.employmentType)):"—"}</dd></div>
   <div><dt>Start Date</dt><dd>${a&&a.startDate?fmtDate(a.startDate):"—"}</dd></div>
   <div><dt>Confirmation Date</dt><dd>${a&&a.confirmationDate?fmtDate(a.confirmationDate):"—"}</dd></div>
   <div><dt>Probation End Date</dt><dd>${a&&a.probationEndDate?fmtDate(a.probationEndDate):"—"}</dd></div>
   <div><dt>Employment Status</dt><dd>${a?hrmsStatusBadge(a.status):"—"}</dd></div>
   <div><dt>Work Location</dt><dd>${esc((data.employee.currentAssignment&&data.employee.currentAssignment.workLocation)||"—")}</dd></div>
   <div><dt>Work Arrangement</dt><dd>${esc(hrmsLabel(data.employee.currentAssignment&&data.employee.currentAssignment.workArrangement))}</dd></div>
 </dl></div></div>`;
}
function hrmsReportsToDisplay(e){
 const m=e.restricted&&e.restricted.managerDisplay;
 if(!m)return "Not assigned";
 return m.title?`${esc(m.name)} — ${esc(m.title)}`:esc(m.name);
}
function hrmsProfileOrganisationTab(data,names){
 return `<div class="section"><div class="card"><dl class="hrms-field-list">
   <div><dt>Legal Entity</dt><dd>${names.legalEntity}</dd></div>
   <div><dt>Business Unit</dt><dd>${names.businessUnit}</dd></div>
   <div><dt>Department</dt><dd>${names.department}</dd></div>
   <div><dt>Position</dt><dd>${names.position}</dd></div>
   <div><dt>Reports To</dt><dd>${hrmsReportsToDisplay(data.employee)}</dd></div>
 </dl></div></div>`;
}
function hrmsProfileLifecycleTab(data){
 return `<div class="section"><div class="card"><div class="list">${data.cases.map(hrmsCaseListItem).join("")||hrmsEmptyPanel("No HR lifecycle cases on record for this employee.")}</div></div></div>`;
}
/** Smallest-safe History view: the effective-dated assignment record plus completed/cancelled lifecycle cases, merged into one chronological, human-readable timeline from data ALREADY fetched for this profile — no new event-sourcing framework, no extra API calls. See docs/architecture/organisation-employee-master.md "History/audit projection". */
function hrmsProfileHistoryEvents(data){
 const assignmentEvents=[...data.assignments].sort((x,y)=>x.effectiveFrom<y.effectiveFrom?-1:1).map((x,i)=>({
   date:x.effectiveFrom,
   label:i===0?"Joined":(x.changeReason?esc(x.changeReason):"Assignment updated"),
   detail:x.effectiveTo?`Until ${fmtDate(x.effectiveTo)}`:"Current",
 }));
 const lifecycleEvents=data.cases.filter(c=>c.restricted&&(c.restricted.completedAt||c.restricted.cancelledAt)).map(c=>({
   date:(c.restricted.completedAt||c.restricted.cancelledAt).slice(0,10),
   label:`${HRMS_LIFECYCLE_LABELS[c.lifecycleType]||esc(c.lifecycleType)} ${c.restricted.completedAt?"completed":"cancelled"}`,
   detail:esc(c.caseNumber),
 }));
 return [...assignmentEvents,...lifecycleEvents].sort((x,y)=>x.date<y.date?1:-1);
}
function hrmsProfileHistoryTab(data){
 const events=hrmsProfileHistoryEvents(data);
 return `<div class="section"><div class="card"><div class="audit-timeline">${events.map(ev=>`<div class="audit-event"><div class="audit-dot"></div><div><strong>${ev.label}</strong><p>${fmtDate(ev.date)} · ${ev.detail}</p></div></div>`).join("")||hrmsEmptyPanel("No history recorded yet.")}</div></div></div>`;
}
function hrmsEmployeeProfile(c){
 if(!hrmsSelectedEmployeeId){c.innerHTML=hrmsEmptyPanel("No employee selected. Return to the Employee Directory and select an employee.");return}
 c.innerHTML=`${roleBanner()}<div id="hrmsEmployeeBody"></div>`;
 hrmsAsyncRender(document.getElementById("hrmsEmployeeBody"),loadHrmsEmployeeProfileData,renderHrmsEmployeeProfile,"Loading employee profile…");
}

// ---- HR Lifecycle (onboarding/probation/employment change/offboarding) ----
function goHrmsLifecycle(lifecycleType){hrmsLifecycleType=lifecycleType;secureGo("hrmsLifecycle")}
async function loadHrmsLifecycleListData(){
 const data=await svegipApiFetch(`/api/v1/hrms/lifecycle/cases?lifecycleType=${encodeURIComponent(hrmsLifecycleType)}`);
 return data.cases||[];
}
function renderHrmsLifecycleList(cases){
 if(!cases.length)return hrmsEmptyPanel(`No ${(HRMS_LIFECYCLE_LABELS[hrmsLifecycleType]||"").toLowerCase()} cases on record.`);
 const desktop=`<div class="table-wrap desktop-register"><table><thead><tr><th>Case</th><th>Status</th><th>Initiated</th><th></th></tr></thead><tbody>${cases.map(x=>`<tr><td><strong>${esc(x.caseNumber)}</strong></td><td>${hrmsStatusBadge(x.status)}</td><td>${fmtDate(x.initiatedAt.slice(0,10))}</td><td><button class="btn ghost" onclick="goHrmsCase('${x.id}')">Open →</button></td></tr>`).join("")}</tbody></table></div>`;
 const mobile=`<div class="mobile-record-list">${cases.map(x=>`<article class="mobile-record-card"><h4>${esc(x.caseNumber)}</h4><dl><div><dt>Status</dt><dd>${hrmsStatusBadge(x.status)}</dd></div><div><dt>Initiated</dt><dd>${fmtDate(x.initiatedAt.slice(0,10))}</dd></div></dl><button class="btn ghost" onclick="goHrmsCase('${x.id}')">Open →</button></article>`).join("")}</div>`;
 return desktop+mobile;
}
function hrmsLifecycleList(c){
 c.innerHTML=`${roleBanner()}<div class="section-head"><div><h3>${HRMS_LIFECYCLE_LABELS[hrmsLifecycleType]}</h3><p>Cases currently in this stage.</p></div></div><div id="hrmsLifecycleBody"></div>`;
 hrmsAsyncRender(document.getElementById("hrmsLifecycleBody"),loadHrmsLifecycleListData,renderHrmsLifecycleList,"Loading cases…");
}

// ---- HR Lifecycle case detail ----
function goHrmsCase(caseId){hrmsSelectedCaseId=caseId;secureGo("hrmsCase")}
async function loadHrmsCaseDetailData(){
 const id=hrmsSelectedCaseId;
 const [caseData,eventsData]=await Promise.all([
   svegipApiFetch(`/api/v1/hrms/lifecycle/cases/${encodeURIComponent(id)}`),
   svegipApiFetch(`/api/v1/hrms/lifecycle/cases/${encodeURIComponent(id)}/events`).catch(()=>({events:[]})),
 ]);
 return {caseRow:caseData.case,events:eventsData.events||[]};
}
function renderHrmsCaseDetail(data){
 const x=data.caseRow,r=x.restricted;
 const stageLabel=r&&r.currentStage?r.currentStage:hrmsLabel(x.status);
 return `<div class="identity hrms-workspace-identity"><div><div class="eyebrow">${HRMS_LIFECYCLE_LABELS[x.lifecycleType]||esc(x.lifecycleType)}</div><h2>${esc(x.caseNumber)}</h2><p>${hrmsStatusBadge(x.status)}${r&&r.currentStage?` · ${esc(r.currentStage)}`:""}</p></div></div>
 <div class="section hrms-lifecycle-flow"><div><span>1</span><strong>Case Opened</strong></div><b>→</b><div><span>2</span><strong>${esc(stageLabel)}</strong></div><b>→</b><div><span>3</span><strong>Approval</strong></div><b>→</b><div><span>4</span><strong>Complete</strong></div></div>
 <div class="section grid g2">
   <div class="card"><h3>Case</h3><dl class="hrms-field-list">
     <div><dt>Status</dt><dd>${hrmsStatusBadge(x.status)}</dd></div>
     <div><dt>Current Stage</dt><dd>${r?esc(r.currentStage||"—"):"Restricted — no access"}</dd></div>
     <div><dt>Effective Date</dt><dd>${r&&r.effectiveDate?fmtDate(r.effectiveDate):"—"}</dd></div>
     <div><dt>Initiated</dt><dd>${fmtDate(x.initiatedAt.slice(0,10))}</dd></div>
   </dl></div>
   <div class="card"><h3>History</h3><div class="audit-timeline">${data.events.map(ev=>`<div class="audit-event"><div class="audit-dot"></div><div><strong>${esc(hrmsLabel(ev.eventType))}</strong><p>${fmtDate(ev.occurredAt.slice(0,10))}</p></div></div>`).join("")||hrmsEmptyPanel("No history recorded yet.")}</div></div>
 </div>
 <div class="section callout">Any decision required from you on this case will appear under My Tasks.</div>`;
}
function hrmsCaseDetail(c){
 if(!hrmsSelectedCaseId){c.innerHTML=hrmsEmptyPanel("No case selected.");return}
 c.innerHTML=`${roleBanner()}<div id="hrmsCaseBody"></div>`;
 hrmsAsyncRender(document.getElementById("hrmsCaseBody"),loadHrmsCaseDetailData,renderHrmsCaseDetail,"Loading case…");
}
