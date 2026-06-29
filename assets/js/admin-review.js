// admin-review.js
let allProjects = [];
let selectedId  = null;

async function loadProjects() {
  const d = await api('/api/projects.php?action=list', null, 'GET');
  if (d.success === false && d.message === 'Unauthorized') { window.location.href = '/arc101-web/login.html'; return; }
  allProjects = d.projects || [];
  renderList(allProjects);

  // Auto-select from URL
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  if (idParam) { const p = allProjects.find(x => x.id == idParam); if (p) openProject(p.id); }
}

function filterProjects() {
  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  let list = allProjects;
  if (status) list = list.filter(p => p.status === status);
  if (search) list = list.filter(p => (p.title+p.customer_name+p.project_address).toLowerCase().includes(search));
  renderList(list);
}

function renderList(projects) {
  const el = document.getElementById('projectList');
  if (!projects.length) {
    el.innerHTML = '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-icon">📋</div><p>No projects found.</p></div></div></div>';
    return;
  }
  el.innerHTML = projects.map(p => `
    <div class="card" style="margin-bottom:.75rem;cursor:pointer;border-left:3px solid ${selectedId==p.id?'var(--primary)':'transparent'};" onclick="openProject(${p.id})">
      <div class="card-body" style="padding:.9rem 1rem;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.35rem;">
          <strong style="font-size:.92rem;">${esc(p.title)}</strong>
          ${statusBadge(p.status)}
        </div>
        <div style="font-size:.8rem;color:var(--text-muted);">👤 ${esc(p.customer_name||'—')} • 📍 ${esc((p.project_address||'').substring(0,30))}</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">Submitted: ${fmtDate(p.submitted_at)}</div>
      </div>
    </div>`).join('');
}

function openProject(id) {
  selectedId = id;
  renderList(allProjects.filter(p => {
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchInput').value.toLowerCase();
    if (status && p.status !== status) return false;
    if (search && !(p.title+p.customer_name+p.project_address).toLowerCase().includes(search)) return false;
    return true;
  }));

  const p = allProjects.find(x => x.id == id);
  if (!p) return;

  const mats = (() => {
    try {
      const m = typeof p.materials === 'string' ? JSON.parse(p.materials||'{}') : (p.materials||{});
      const items = [...(m.selected||[]), ...(m.aggregates||[]), ...(m.chemicals||[])];
      return items.map(k => `<span class="badge badge-info" style="margin:.15rem;">${k.replace(/_/g,' ')}</span>`).join('') || '—';
    } catch { return '—'; }
  })();

  const STATUSES = ['under_review','accepted','in_progress','completed','rejected'];
  const actionBtns = STATUSES.map(s => `
    <button onclick="updateStatus(${p.id},'${s}')"
      class="btn btn-sm ${p.status===s ? 'btn-primary' : 'btn-ghost'}"
      style="${s==='rejected'?'color:var(--danger);border-color:var(--danger);':''}"
    >${statusLabel(s)}</button>`).join('');

  document.getElementById('projectDetail').innerHTML = `
    <div class="card">
      <div class="card-header" style="gap:.5rem;flex-wrap:wrap;">
        <h3 style="font-size:1.05rem;">${esc(p.title)}</h3>
        ${statusBadge(p.status)}
      </div>
      <div class="card-body">
        <div class="detail-grid" style="margin-bottom:1.25rem;">
          <div class="detail-item"><label>Customer</label><p>${esc(p.customer_name||'—')}</p></div>
          <div class="detail-item"><label>Email</label><p><a href="mailto:${esc(p.customer_email||'')}">${esc(p.customer_email||'—')}</a></p></div>
          <div class="detail-item"><label>Phone</label><p>${esc(p.customer_phone||'N/A')}</p></div>
          <div class="detail-item"><label>Submitted</label><p>${fmtDate(p.submitted_at)}</p></div>
          <div class="detail-item"><label>Dimension Type</label><p>${p.dimension_type==='known'?'Known':'Request Measurement'}</p></div>
          ${p.total_area ? `<div class="detail-item"><label>Total Area</label><p>${esc(p.total_area)} sqm</p></div>` : ''}
          ${p.structural_type ? `<div class="detail-item"><label>Structural Type</label><p>${esc(p.structural_type)}</p></div>` : ''}
          <div class="detail-item" style="grid-column:1/-1;"><label>Address</label><p>${esc(p.project_address||'—')}</p></div>
        </div>

        <div style="margin-bottom:1.1rem;">
          <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">Materials Requested</div>
          <div>${mats}</div>
        </div>

        ${p.other_materials ? `<div style="margin-bottom:1.1rem;"><div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem;">Other:</div><p style="font-size:.9rem;">${esc(p.other_materials)}</p></div>` : ''}
        ${p.additional_specs ? `<div style="margin-bottom:1.1rem;"><div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem;">Additional Specs:</div><p style="background:var(--surface-alt);padding:.85rem;border-radius:var(--radius-sm);font-size:.88rem;">${esc(p.additional_specs)}</p></div>` : ''}
        ${p.plan_file ? `<div style="margin-bottom:1.1rem;"><div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem;">Attached Files:</div><a href="../uploads/projects/${esc(p.plan_file)}" target="_blank" class="btn btn-sm btn-outline">📎 ${esc(p.plan_file)}</a></div>` : ''}

        <hr style="border:none;border-top:1px solid var(--border);margin:1.25rem 0;">

        <div style="margin-bottom:.75rem;">
          <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem;">Update Status:</div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">${actionBtns}</div>
          <p style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem;">Setting to <strong>Accepted</strong> will open a chat room with the customer.</p>
        </div>

        ${p.chat_room_id ? `<a href="chat.html?room=${p.chat_room_id}" class="btn btn-primary btn-sm">💬 Open Chat Room</a>` : ''}
      </div>
    </div>`;
}

async function updateStatus(id, status) {
  const r = await api('/api/projects.php?action=update_status', { id, status });
  if (r.success) {
    Toast.show(`Status updated to ${statusLabel(status)}`, 'success');
    const p = allProjects.find(x => x.id == id);
    if (p) p.status = status;
    if (status === 'accepted') {
      // Reload to get chat_room_id
      const fresh = await api('/api/projects.php?action=list', null, 'GET');
      allProjects = fresh.projects || [];
    }
    openProject(id);
    filterProjects();
  } else {
    Toast.show(r.message || 'Failed to update', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  setInterval(loadProjects, 5000);
});
