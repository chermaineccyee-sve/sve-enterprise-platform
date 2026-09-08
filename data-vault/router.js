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

  function ensureOperatingStageModal(){
    if(document.getElementById('operatingStageModal'))return;
    const modal=document.createElement('div');modal.id='operatingStageModal';modal.className='modal';modal.setAttribute('aria-hidden','true');
    modal.innerHTML='<div class="modalbox" role="dialog" aria-modal="true" aria-labelledby="operatingStageTitle"><button type="button" class="modal-close" id="operatingStageClose" aria-label="Close">×</button><span class="eyebrow" id="operatingStageNumber">OPERATING MODEL</span><h2 id="operatingStageTitle">Operating Model Stage</h2><p class="muted" id="operatingStageContext"></p><label><b>Status</b><select id="operatingStageStatus" style="width:100%;margin-top:6px"><option>Not Started</option><option>In Progress</option><option>Ready for Review</option><option>Complete</option></select></label><label style="display:block;margin-top:14px"><b>Owner</b><input id="operatingStageOwner" type="text" placeholder="Stage owner" style="width:100%;margin-top:6px"></label><label style="display:block;margin-top:14px"><b>Target / Review Date</b><input id="operatingStageDate" type="date" style="width:100%;margin-top:6px"></label><label style="display:block;margin-top:14px"><b>Details / Working Notes</b><textarea id="operatingStageNotes" rows="6" placeholder="Record the working detail for this stage. Phase 1 prototype — use non-confidential information only." style="width:100%;margin-top:6px;resize:vertical"></textarea></label><p class="muted" style="margin-top:10px">Phase 1 prototype record. Do not use for confidential or production information.</p><div class="module-actions" style="margin-top:16px"><button type="button" class="btn light" id="operatingStageModule">Open Related Module</button><button type="button" class="btn gold" id="operatingStageSave">Save Stage Detail</button></div></div>';
    document.body.appendChild(modal);
    const close=()=>{modal.classList.remove('show');modal.setAttribute('aria-hidden','true');};
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.querySelector('#operatingStageClose').onclick=close;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))close();});
  }
  function stageStorageKey(index){return 'svegip_operating_model_stage_v1_'+index;}
  function openOperatingStage(step,index){
    ensureOperatingStageModal();const modal=document.getElementById('operatingStageModal');
    const raw=(step.textContent||'').replace(/\s+/g,' ').trim();const number=String(index+1).padStart(2,'0');
    let title=raw.replace(new RegExp('^'+number+'\\s*'),'').trim();
    document.getElementById('operatingStageNumber').textContent='SVE OPERATING MODEL · STAGE '+number;
    document.getElementById('operatingStageTitle').textContent=title||('Stage '+number);
    document.getElementById('operatingStageContext').textContent=state.matter?'Matter: '+state.matter:'Group operating workflow';
    let saved={};try{saved=JSON.parse(localStorage.getItem(stageStorageKey(index))||'{}');}catch(e){}
    document.getElementById('operatingStageStatus').value=saved.status||'Not Started';
    document.getElementById('operatingStageOwner').value=saved.owner||'';
    document.getElementById('operatingStageDate').value=saved.date||'';
    document.getElementById('operatingStageNotes').value=saved.notes||'';
    document.getElementById('operatingStageSave').onclick=()=>{const record={status:document.getElementById('operatingStageStatus').value,owner:document.getElementById('operatingStageOwner').value.trim(),date:document.getElementById('operatingStageDate').value,notes:document.getElementById('operatingStageNotes').value.trim()};try{localStorage.setItem(stageStorageKey(index),JSON.stringify(record));}catch(e){} if(typeof window.showToast==='function')window.showToast('Operating Model stage detail saved for this Phase 1 browser.');};
    document.getElementById('operatingStageModule').onclick=()=>{modal.classList.remove('show');const id=step.dataset.page;if(id)(state.matter?openMatterPage(id):navigate(id));};
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
  }
  function bindOperatingModel(){
    document.querySelectorAll('.engine-panel .engine-step[data-page]').forEach((step,index)=>{step.onclick=e=>{e.preventDefault();openOperatingStage(step,index);return false;};});
  }
  function bindNavigation(){
    document.querySelectorAll('.side .nav[data-page]').forEach(nav=>{nav.onclick=e=>{e.preventDefault();return navigate(nav.dataset.page);};});
    document.querySelectorAll('.engine-step[data-page]:not(.engine-panel .engine-step)').forEach(step=>{step.onclick=e=>{e.preventDefault();return state.matter?openMatterPage(step.dataset.page):navigate(step.dataset.page);};});
    document.querySelectorAll('.module-back').forEach(btn=>{btn.onclick=e=>{e.preventDefault();return back();};});
    bindOperatingModel();
  }
  function makeConsultingMethodReferenceOnly(){
    document.querySelectorAll('.consulting-method-signature,.method-link.method-static').forEach(el=>{
      el.removeAttribute('onclick');el.removeAttribute('href');el.removeAttribute('data-page');el.setAttribute('aria-disabled','true');el.style.cursor='default';
    });
  }
  function removeUnsupportedResearch(){document.querySelectorAll('[data-page="research"],#research').forEach(el=>el.remove());document.querySelectorAll('[onclick*="research"]').forEach(el=>el.remove());}
  function initialPage(){const hash=location.hash.replace(/^#/,'');return validPage(hash)?hash:'dashboard';}
  function init(){removeUnsupportedResearch();makeConsultingMethodReferenceOnly();bindNavigation();state.page=initialPage();render(state.page);}

  const api=Object.freeze({pages:PAGE_REGISTRY,state,navigate,back,setMatter,openMatterPage,clearMatterContext,openOperatingStage,init});
  window.SVEVaultRouter=api;
  window.goPage=(id,fromBack,preserveMatter)=>navigate(id,{fromBack:!!fromBack,preserveMatter:!!preserveMatter});
  window.goBackPage=back;window.openMatterPage=openMatterPage;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window,document);
