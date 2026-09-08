/* SVEGIP Data Vault — canonical navigation router
 * Phase 1 rebuild. One router, one page registry, one history model.
 * This file intentionally contains no legacy V15/V26 routing wrappers.
 */
(function (window, document) {
  'use strict';

  const PAGE_REGISTRY = Object.freeze({
    dashboard: 'Strategy Intelligence Dashboard',
    vault: 'SVE Data Vault',
    master: 'Evidence Master Index',
    insights: 'SVE Insight Notes',
    policyMonitor: 'Policy Monitor',
    monitor: 'News Monitor',
    projects: 'Projects & Matters',
    clients: 'Client Workspaces',
    intake: 'Client Intake & RFA Readiness',
    tasks: 'Tasks & Decisions',
    packs: 'Report Data Packs',
    deliverables: 'Deliverables Register',
    risk: 'Risk & Escalation',
    review: 'Review Queue',
    decisions: 'Decision Register',
    documents: 'Documents & Data Rooms',
    archive: 'Archive / Superseded Data',
    admin: 'Administration'
  });

  const state = {
    page: 'dashboard',
    history: [],
    project: null,
    matter: null
  };

  function validPage(id) {
    return Object.prototype.hasOwnProperty.call(PAGE_REGISTRY, id) && !!document.getElementById(id);
  }

  function clearMatterContext() {
    state.project = null;
    state.matter = null;
    window.SVE_CURRENT_PROJECT = null;
    window.SVE_CURRENT_MATTER = null;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('matter-scoped'));
    document.querySelectorAll('.matter-context-banner').forEach(x => x.remove());
    document.querySelectorAll('.matter-scope-hidden').forEach(x => x.classList.remove('matter-scope-hidden'));
  }

  function syncSidebar(id) {
    document.querySelectorAll('.side .nav[data-page]').forEach(nav => {
      nav.classList.toggle('active', nav.dataset.page === id);
    });
  }

  function render(id) {
    document.querySelectorAll('.page').forEach(page => {
      const active = page.id === id;
      page.classList.toggle('hidden', !active);
      page.classList.toggle('active', active);
    });
    syncSidebar(id);
    const title = document.getElementById('title');
    if (title) title.textContent = PAGE_REGISTRY[id];
    const toggle = document.getElementById('navToggle');
    if (toggle) toggle.checked = false;
    if (typeof window.closeMobileMenu === 'function') window.closeMobileMenu();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function navigate(id, options) {
    options = options || {};
    if (!validPage(id)) return false;

    const previous = state.page;
    if (!options.fromBack && previous && previous !== id) {
      state.history.push(previous);
      if (state.history.length > 30) state.history.shift();
    }

    if (!options.preserveMatter && id !== 'projects') clearMatterContext();

    state.page = id;
    render(id);

    if (options.preserveMatter && state.matter && typeof window.applyMatterScope === 'function') {
      window.setTimeout(() => window.applyMatterScope(id), 0);
    }

    if (!options.skipHash && window.location.hash !== '#' + id) {
      history.replaceState(null, '', '#' + id);
    }
    return true;
  }

  function back() {
    if (state.matter && state.project && state.page !== 'projects') {
      if (typeof window.reopenCurrentProject === 'function') window.reopenCurrentProject();
      return false;
    }
    let previous = state.history.pop();
    while (previous === state.page && state.history.length) previous = state.history.pop();
    return navigate(previous || 'dashboard', { fromBack: true });
  }

  function setMatter(project) {
    state.project = project || null;
    state.matter = project ? project.name : null;
    window.SVE_CURRENT_PROJECT = state.project;
    window.SVE_CURRENT_MATTER = state.matter;
  }

  function openMatterPage(id) {
    if (!state.matter && window.SVE_CURRENT_PROJECT) setMatter(window.SVE_CURRENT_PROJECT);
    if (typeof window.closeModal === 'function') window.closeModal('projectCommandModal');
    return navigate(id, { preserveMatter: true });
  }

  function bindNavigation() {
    document.querySelectorAll('.side .nav[data-page]').forEach(nav => {
      nav.onclick = function (event) {
        event.preventDefault();
        navigate(nav.dataset.page);
        return false;
      };
    });

    document.querySelectorAll('.engine-step[data-page]').forEach(step => {
      step.onclick = function (event) {
        event.preventDefault();
        if (state.matter) return openMatterPage(step.dataset.page);
        return navigate(step.dataset.page);
      };
    });
  }

  function initialPage() {
    const hash = window.location.hash.replace(/^#/, '');
    return validPage(hash) ? hash : 'dashboard';
  }

  function init() {
    bindNavigation();
    state.page = initialPage();
    render(state.page);
  }

  window.SVEVaultRouter = Object.freeze({
    pages: PAGE_REGISTRY,
    state: state,
    navigate: navigate,
    back: back,
    setMatter: setMatter,
    openMatterPage: openMatterPage,
    clearMatterContext: clearMatterContext,
    init: init
  });
})(window, document);
