(() => {
  const contextMap = {
    'Group Home': {view:'home', footer:'Executive preview · SVE Group Enterprise Platform'},
    'My SVE': {view:'mysve', footer:'Executive preview · personal employee workspace'},
    'My Tasks': {view:'tasks', footer:'Executive preview · workflow tasks'},
    'My Payslips': {planned:'payslip', footer:'Executive preview · employee self-service · next development'},
    'iClaims': {planned:'claims', footer:'Executive preview · employee self-service · next development'},
    'People Portal': {view:'dashboard', footer:'Executive preview · sample HR records'},
    'Employee Profile': {view:'dashboard', footer:'Executive preview · sample HR records'},
    'Employee Directory': {view:'dashboard', footer:'Executive preview · sample HR records'},
    'HR Lifecycle': {view:'dashboard', footer:'Executive preview · sample HR records'},
    'Approvals': {view:'dashboard', footer:'Executive preview · sample HR records'},
    'Data Vault & Intelligence': {view:'vault', footer:'Executive preview · management information & intelligence'},
    'SVE Accounting Pro': {view:'finance', footer:'Executive preview · restricted finance system'}
  };

  function syncContext(){
    const title=document.querySelector('#portalTitle');
    if(!title) return;
    const text=title.textContent.trim();
    const ctx=contextMap[text];
    if(!ctx) return;
    document.querySelectorAll('.portal-side .portal-nav').forEach(n=>n.classList.remove('active'));
    let target=null;
    if(ctx.view) target=document.querySelector(`.portal-side .portal-nav[data-view="${ctx.view}"]`);
    if(ctx.planned) target=document.querySelector(`.portal-side .portal-nav[data-suite-planned="${ctx.planned}"]`);
    if(target) target.classList.add('active');
    const footer=document.querySelector('.portal-footer span:first-child');
    if(footer) footer.textContent=ctx.footer;
  }

  new MutationObserver(syncContext).observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('click',()=>setTimeout(syncContext,0),true);
  setTimeout(syncContext,0);
})();