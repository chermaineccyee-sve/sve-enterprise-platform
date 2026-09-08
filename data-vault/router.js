/* SVEGIP Data Vault — canonical navigation router
 * Phase 1 rebuild: one router, one page registry, one history model.
 */
(function (window, document) {
  'use strict';

  const PAGE_REGISTRY = Object.freeze({
    dashboard:'Strategy Intelligence Dashboard', vault:'SVE Data Vault', master:'Evidence Master Index',
    insights:'SVE Insight Notes', policyMonitor:'Policy Monitor', monitor:'News Monitor', projects:'Projects & Matters',
    clients:'Client Workspaces', intake:'Client Intake & RFA Readiness', tasks:'Tasks & Decisions', packs:'Report Data Packs',
    deliverables:'Deliverables Register', risk:'Risk & Escalation', review:'Review Queue', decisions:'Decision Register',
    documents:'Documents & Data Rooms', archive:'Archive / Superseded Data', admin:'Administration'
  });

  const state={page:'dashboard',history:[],project:null,matter:null};
  const validPage=id=>Object.prototype.hasOwnProperty.call(PAGE_REGISTRY,id)&&!!document.getElementById(id);

  function clearMatterContext(){
    state.project=null;state.matter=null;window.SVE_CURRENT_PROJECT=null;window.SVE_CURRENT_MATTER=null;
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('matter-scoped'));
    document.querySelectorAll('.matter-context-banner').forEach(x=>x.remove());
    document.querySelectorAll('.matter-scope-hidden').forEach(x=>x.classList.remove('matter-scope-hidden'));
  }
  function syncSidebar(id){document.querySelectorAll('.side .nav[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===id));}
  function closeMobile(){
    document.querySelector('.side')?.classList.remove('mobile-open');
    document.getElementById('mobileBackdrop')?.classList.remove('show');
    document.getElementById('menuOverlay')?.classList.remove('show');
    const t=document.getElementById('navToggle');if(t)t.checked=false;
  }
  function render(id){
    document.querySelectorAll('.page').forEach(p=>{const on=p.id===id;p.classList.toggle('hidden',!on);p.classList.toggle('active',on);});
    syncSidebar(id);const title=document.getElementById('title');if(title)title.textContent=PAGE_REGISTRY[id];closeMobile();
    const main=document.querySelector('.main');if(main)main.scrollTo({top:0,behavior:'auto'});else window.scrollTo({top:0,behavior:'auto'});
  }
  function navigate(id,options={}){
    if(!validPage(id))return false;const previous=state.page;
    if(!options.fromBack&&previous&&previous!==id){state.history.push(previous);if(state.history.length>30)state.history.shift();}
    if(!options.preserveMatter&&id!=='projects')clearMatterContext();
    state.page=id;render(id);
    if(options.preserveMatter&&state.matter&&typeof window.applyMatterScope==='function')setTimeout(()=>window.applyMatterScope(id),0);
    if(!options.skipHash&&location.hash!=='#'+id)history.replaceState(null,'','#'+id);
    return true;
  }
  function back(){
    if(state.matter&&state.project&&state.page!=='projects'){if(typeof window.reopenCurrentProject==='function')window.reopenCurrentProject();return false;}
    let previous=state.history.pop();while(previous===state.page&&state.history.length)previous=state.history.pop();
    return navigate(previous||'dashboard',{fromBack:true});
  }
  function setMatter(project){state.project=project||null;state.matter=project?.name||null;window.SVE_CURRENT_PROJECT=state.project;window.SVE_CURRENT_MATTER=state.matter;}
  function openMatterPage(id){if(!state.matter&&window.SVE_CURRENT_PROJECT)setMatter(window.SVE_CURRENT_PROJECT);if(typeof window.closeModal==='function')window.closeModal('projectCommandModal');return navigate(id,{preserveMatter:true});}
  function bindNavigation(){
    document.querySelectorAll('.side .nav[data-page]').forEach(nav=>{nav.onclick=e=>{e.preventDefault();return navigate(nav.dataset.page);};});
    document.querySelectorAll('.engine-step[data-page]').forEach(step=>{step.onclick=e=>{e.preventDefault();return state.matter?openMatterPage(step.dataset.page):navigate(step.dataset.page);};});
    document.querySelectorAll('.module-back').forEach(btn=>{btn.onclick=e=>{e.preventDefault();return back();};});
  }
  function makeConsultingMethodReferenceOnly(){
    document.querySelectorAll('.consulting-method-signature,.method-link.method-static').forEach(el=>{
      el.removeAttribute('onclick');el.removeAttribute('href');el.removeAttribute('data-page');el.setAttribute('aria-disabled','true');
      el.style.cursor='default';
    });
  }
  function removeUnsupportedResearch(){
    document.querySelectorAll('[data-page="research"],#research').forEach(el=>el.remove());
    document.querySelectorAll('[onclick*="research"]').forEach(el=>el.remove());
  }
  function initialPage(){const hash=location.hash.replace(/^#/,'');return validPage(hash)?hash:'dashboard';}
  function init(){
    removeUnsupportedResearch();makeConsultingMethodReferenceOnly();bindNavigation();state.page=initialPage();render(state.page);
  }

  const api=Object.freeze({pages:PAGE_REGISTRY,state,navigate,back,setMatter,openMatterPage,clearMatterContext,init});
  window.SVEVaultRouter=api;
  /* Compatibility names used by existing Phase 1 controls. These are aliases, not additional routers. */
  window.goPage=(id,fromBack,preserveMatter)=>navigate(id,{fromBack:!!fromBack,preserveMatter:!!preserveMatter});
  window.goBackPage=back;window.openMatterPage=openMatterPage;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window,document);
