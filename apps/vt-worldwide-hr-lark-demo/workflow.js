/* ===========================================================
   Reusable interactive workflow visualiser.
   Every demo builds a stage array and calls WF.render(id, stages, opts).
   Clicking a stage opens the right-side panel with stage detail.
   =========================================================== */

const WF = {
  registry: {},

  /**
   * stages: [{ key, label, status: 'done'|'active'|'pending'|'exception',
   *            responsible, sees, action, recorded, next }]
   * opts: { vertical:false }
   */
  render(id, stages, opts = {}) {
    WF.registry[id] = stages;
    const vertical = !!opts.vertical;
    let html = `<div class="workflow-track${vertical ? ' vertical' : ''}">`;
    stages.forEach((s, i) => {
      const icon = s.status === 'done' ? '&#10003;' : (s.status === 'exception' ? '!' : (i + 1));
      html += `
        <div class="wf-stage ${s.status}" onclick="WF.handleClick('${id}',${i})">
          <div class="wf-dot">${icon}</div>
          <div class="wf-label">${s.label}</div>
        </div>`;
      if (i < stages.length - 1) {
        const done = s.status === 'done';
        html += `<div class="wf-connector ${done ? 'done' : ''}"></div>`;
      }
    });
    html += `</div>`;
    return html;
  },

  handleClick(id, idx) {
    const s = WF.registry[id] && WF.registry[id][idx];
    if (!s) return;
    UI.openStagePanel(s);
  }
};
