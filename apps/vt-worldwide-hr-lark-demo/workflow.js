/* ===========================================================
   Reusable interactive workflow visualiser.
   Every demo builds a stage array and calls WF.block(id, stages, opts)
   for the standard "track + What Happens Next?" card, or WF.render(...)
   for the track alone. Clicking a stage opens the right-side panel.
   =========================================================== */

const WF = {
  registry: {},

  symbolFor(status){
    return { done:'&#10003;', active:'&#9679;', exception:'!', pending:'&#9675;' }[status] || '&#9675;';
  },

  /**
   * stages: [{ key, label, status: 'done'|'active'|'pending'|'exception',
   *            statusLabel, responsible, sees, action, recorded, next }]
   * opts: { vertical:false, reference:false }
   */
  render(id, stages, opts = {}) {
    WF.registry[id] = stages;
    const vertical = !!opts.vertical;
    const reference = !!opts.reference;
    let html = `<div class="workflow-track${vertical ? ' vertical' : ''}${reference ? ' reference' : ''}">`;
    stages.forEach((s, i) => {
      const symbol = WF.symbolFor(s.status);
      html += `
        <div class="wf-stage ${s.status}" onclick="WF.handleClick('${id}',${i})">
          <div class="wf-dot">${symbol}</div>
          <div class="wf-text"><div class="wf-label">${s.label}</div>${s.statusLabel ? `<div class="wf-statusline">${s.statusLabel}</div>` : ''}</div>
        </div>`;
      if (i < stages.length - 1) {
        const done = s.status === 'done';
        html += `<div class="wf-connector ${done ? 'done' : ''}"></div>`;
      }
    });
    html += `</div>`;
    return html;
  },

  /** Track + automatic "What Happens Next?" contextual card, wrapped in a titled card. */
  block(id, stages, opts = {}) {
    const track = WF.render(id, stages, opts);
    const activeIdx = stages.findIndex(s => s.status === 'active' || s.status === 'exception');
    let nextHtml;
    if (activeIdx >= 0) {
      const cur = stages[activeIdx];
      const next = stages[activeIdx + 1];
      nextHtml = `<div class="next-panel${cur.status==='exception' ? ' exception':''}">
        <div class="np-eyebrow">What Happens Next?</div>
        <div class="np-grid">
          <div><span>Current Stage</span><b>${cur.label}</b></div>
          ${next ? `
          <div><span>Next Step</span><b>${next.label}</b></div>
          <div class="full"><span>Expected Action</span><p>${next.action || ''}</p></div>
          <div><span>Responsible Party</span><b>${next.responsible || ''}</b></div>` : `
          <div class="full"><span>Status</span><p>Final stage of this route &mdash; no further step configured.</p></div>`}
        </div>
      </div>`;
    } else if (stages.length && stages.every(s => s.status === 'done')) {
      nextHtml = `<div class="next-panel done"><div class="np-eyebrow">Workflow Complete</div><p>No further action required. The full record is retained for audit.</p></div>`;
    } else {
      nextHtml = '';
    }
    return `<div class="card wf-card"><h3>Workflow</h3>${track}${nextHtml}</div>`;
  },

  handleClick(id, idx) {
    const s = WF.registry[id] && WF.registry[id][idx];
    if (!s) return;
    UI.openStagePanel(s);
  }
};

/* ===================== WORKFLOW HISTORY ===================== */
function historyPush(arr, entry){
  const s = nowStamp();
  arr.push(Object.assign({ date: s.date, time: s.time }, entry));
}

function renderHistory(historyArr, title){
  if (!historyArr || !historyArr.length) return '';
  const rows = historyArr.slice().reverse().map(h => `
    <div class="wfh-row">
      <div class="wfh-dot"></div>
      <div class="wfh-body">
        <div class="wfh-top"><b>${h.actor}</b><span class="wfh-time">${h.date} &middot; ${h.time}</span></div>
        <div class="wfh-action">${h.action}</div>
        ${h.comment ? `<div class="wfh-comment">&ldquo;${h.comment}&rdquo;</div>` : ''}
      </div>
    </div>`).join('');
  return `<div class="card"><h3>${title || 'Workflow History'}</h3><div class="wf-history">${rows}</div></div>`;
}

/* ===================== RESPONSIBILITY TRANSFER ===================== */
function transferCard(message, fromLabel, toLabel, actionAttr){
  return `<div class="transfer-card">
    <div class="transfer-msg">&#10003; ${message}</div>
    <div class="transfer-flow">
      <span class="transfer-from">${fromLabel}</span>
      <span class="transfer-arrow">&rarr;</span>
      <span class="transfer-to">${toLabel}</span>
    </div>
    <p class="transfer-note">Responsibility transferred to <b>${toLabel}</b>.</p>
    <div class="btnrow"><button class="btn btn-primary btn-lg" onclick="${actionAttr}">VIEW AS ${toLabel.toUpperCase()}</button></div>
  </div>`;
}

/* ===================== ADVISORY / POLICY CONTROL ===================== */
function advisoryNote(text){
  return `<details class="advisory-note"><summary>SVE Implementation Note</summary><p>${text}</p></details>`;
}

function policyControlPanel(rows){
  return `<div class="card policy-control">
    <h3>Policy Control</h3>
    <div class="pc-chain">POLICY <span>&rarr;</span> WORKFLOW <span>&rarr;</span> SYSTEM CONTROL <span>&rarr;</span> AUDIT RECORD</div>
    <div class="pc-rows">
      ${rows.map(r => `<div class="pc-row"><span class="pc-k">${r.k}</span><p>${r.v}</p></div>`).join('')}
    </div>
  </div>`;
}
