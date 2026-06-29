// customer-dashboard.js
let projects = [];

async function init() {
  // Check auth
  const me = await api('/api/projects.php?action=list', null, 'GET');
  if (me.success === false && me.message === 'Unauthorized') {
    window.location.href = '/arc101-web/login.html'; return;
  }
  projects = me.projects || [];
  renderWelcome();
  renderStats();
  renderProjects();
  updateProgressGuide();
}

async function renderWelcome() {
  try {
    const r = await fetch('/arc101-web/api/notifications.php?action=count', { credentials: 'include' });
    const d = await r.json();
    // Try to get name from a session endpoint or just use stored
  } catch(e) {}
  // greeting handled by sidebar-user fallback
}

function renderStats() {
  const total   = projects.length;
  const pending = projects.filter(p => p.status === 'pending').length;
  const active  = projects.filter(p => ['accepted','in_progress','under_review'].includes(p.status)).length;
  const done    = projects.filter(p => p.status === 'completed').length;
  document.getElementById('sTot').textContent = total;
  document.getElementById('sPen').textContent = pending;
  document.getElementById('sAct').textContent = active;
  document.getElementById('sDon').textContent = done;
}

function renderProjects() {
  const container = document.getElementById('projectsTable');
  if (!projects.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No projects yet</h3>
        <p>Submit your first project review request to get started.</p>
        <a href="../services.html" class="btn btn-primary">Submit Project Request</a>
      </div>`;
    return;
  }

  const rows = projects.map((p, i) => {
    const pct = progressPct(p.status);
    const hasChat = p.chat_room_id;
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(p.title)}</strong></td>
        <td style="font-size:.82rem;color:var(--text-muted);">${esc((p.project_address||'').substring(0,35))}...</td>
        <td>${fmtDate(p.submitted_at)}</td>
        <td>${statusBadge(p.status)}</td>
        <td style="min-width:130px;">
          ${p.status !== 'rejected' ? `
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div style="font-size:.7rem;color:var(--text-muted);margin-top:.2rem;">${pct}%</div>
          ` : `<span style="font-size:.8rem;color:var(--danger);">Rejected</span>`}
        </td>
        <td>
          ${hasChat
            ? `<a href="chat.html?room=${p.chat_room_id}" class="btn btn-primary btn-sm">💬 Chat</a>`
            : `<span style="font-size:.78rem;color:var(--text-muted);">Awaiting review</span>`}
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th><th>Project Title</th><th>Address</th>
            <th>Submitted</th><th>Status</th><th>Progress</th><th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function updateProgressGuide() {
  if (!projects.length) return;
  const latest = projects[0];
  const steps = ['under_review','accepted','in_progress','completed'];
  const order = ['pending','under_review','accepted','in_progress','completed'];
  const idx   = order.indexOf(latest.status);

  steps.forEach((key, i) => {
    const el = document.getElementById('step-' + key);
    if (!el) return;
    const stepOrder = i + 1; // pending=0, so under_review=1 etc.
    el.classList.remove('done','active');
    el.querySelector('.step-dot').textContent = i + 2;
    if (idx > stepOrder) {
      el.classList.add('done');
      el.querySelector('.step-dot').textContent = '✓';
    } else if (idx === stepOrder) {
      el.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  setInterval(init, 5000);
});
