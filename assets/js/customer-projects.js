// customer-projects.js
let allProjects = [];
let activeFilter = 'all';
let searchTerm = '';

const STEPS = [
  { key: 'pending',      label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'accepted',     label: 'Accepted' },
  { key: 'in_progress',  label: 'In Progress' },
  { key: 'completed',    label: 'Completed' },
];
const STATUS_ORDER = { pending:0, under_review:1, accepted:2, in_progress:3, completed:4, rejected:-1 };

async function loadProjects() {
  const d = await api('/api/projects.php?action=list', null, 'GET');
  if (d.success === false && d.message === 'Unauthorized') { window.location.href = '/arc101-web/login.html'; return; }
  allProjects = d.projects || [];
  renderGrid();
}

function renderGrid() {
  let list = allProjects;
  if (activeFilter !== 'all') list = list.filter(p => p.status === activeFilter);
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    list = list.filter(p => (p.title||'').toLowerCase().includes(t) || (p.project_address||'').toLowerCase().includes(t));
  }

  const container = document.getElementById('projectsGrid');
  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No projects found</h3>
        <p>${activeFilter === 'all' ? "You haven't submitted any projects yet." : `No ${statusLabel(activeFilter)} projects.`}</p>
        <a href="../services.html" class="btn btn-primary">Submit Your First Project</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.25rem;">
      ${list.map(p => projectCard(p)).join('')}
    </div>`;
}

function projectCard(p) {
  const pct = progressPct(p.status);
  const stepIdx = STATUS_ORDER[p.status] ?? 0;
  const mats = getMaterials(p.materials);

  return `
  <div class="card" style="cursor:pointer;" onclick="openProject(${p.id})">
    <div class="card-body">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.75rem;">
        <h4 style="margin:0;font-size:1rem;">${esc(p.title)}</h4>
        ${statusBadge(p.status)}
      </div>
      <p style="color:var(--text-muted);font-size:.83rem;margin-bottom:.35rem;">📍 ${esc(p.project_address||'—')}</p>
      <p style="color:var(--text-muted);font-size:.83rem;margin-bottom:.9rem;">🧱 ${mats || 'N/A'}</p>
      ${p.status !== 'rejected' ? `
        <div style="margin-bottom:.4rem;">
          <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem;">
            <span>${statusLabel(p.status)}</span><span>${pct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>` : `<p style="color:var(--danger);font-size:.83rem;">This request was not accepted.</p>`}
      <div style="display:flex;gap:.5rem;margin-top:.9rem;flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();openProject(${p.id})">View Details</button>
        ${p.chat_room_id ? `<a href="chat.html?room=${p.chat_room_id}" class="btn btn-sm btn-primary" onclick="event.stopPropagation()">💬 Chat</a>` : ''}
      </div>
    </div>
    <div class="card-footer">Submitted: ${fmtDate(p.submitted_at)}</div>
  </div>`;
}

function getMaterials(raw) {
  try {
    const m = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    const items = [...(m.selected||[]), ...(m.aggregates||[]), ...(m.chemicals||[])];
    return items.slice(0,3).map(s => s.replace(/_/g,' ')).join(', ');
  } catch { return ''; }
}

function openProject(id) {
  const p = allProjects.find(x => x.id == id);
  if (!p) return;

  const stepIdx = STATUS_ORDER[p.status] ?? 0;
  const mats = getMaterials(p.materials);
  const matBadges = (() => {
    try {
      const m = typeof p.materials === 'string' ? JSON.parse(p.materials || '{}') : (p.materials || {});
      const items = [...(m.selected||[]), ...(m.aggregates||[]), ...(m.chemicals||[])];
      return items.map(k => `<span class="badge badge-info" style="margin:.15rem;">${k.replace(/_/g,' ')}</span>`).join('') || '<span style="color:var(--text-muted)">None specified</span>';
    } catch { return '<span style="color:var(--text-muted)">None specified</span>'; }
  })();

  document.getElementById('modalTitle').textContent = p.title;
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;">
      ${statusBadge(p.status)}
      <span style="color:var(--text-muted);font-size:.83rem;">Submitted ${fmtDate(p.submitted_at)}</span>
    </div>

    ${p.status !== 'rejected' ? `
    <div style="margin-bottom:1.25rem;">
      <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem;">Progress</div>
      <div class="progress-steps">
        ${STEPS.map((step,i) => `
          <div class="progress-step ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}">
            <div class="step-dot">${i < stepIdx ? '✓' : i+1}</div>
            <div class="step-label">${step.label}</div>
          </div>`).join('')}
      </div>
    </div>` : `<div class="alert alert-danger">This project was not accepted. You may submit a new request.</div>`}

    <div class="detail-grid" style="margin-bottom:1.25rem;">
      <div class="detail-item"><label>Project Address</label><p>${esc(p.project_address||'—')}</p></div>
      <div class="detail-item"><label>Dimension Type</label><p>${p.dimension_type === 'known' ? 'I Know the Dimensions' : 'Request Measurement'}</p></div>
      ${p.total_area    ? `<div class="detail-item"><label>Total Area</label><p>${esc(p.total_area)} sqm</p></div>` : ''}
      ${p.structural_type ? `<div class="detail-item"><label>Structural Type</label><p>${esc(p.structural_type)}</p></div>` : ''}
    </div>

    <div style="margin-bottom:1.25rem;">
      <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">Required Materials</div>
      <div>${matBadges}</div>
    </div>

    ${p.other_materials ? `<div style="margin-bottom:1rem;"><div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem;">Other Materials</div><p style="font-size:.9rem;">${esc(p.other_materials)}</p></div>` : ''}
    ${p.additional_specs ? `<div style="margin-bottom:1rem;"><div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem;">Additional Specifications</div><p style="background:var(--surface-alt);padding:.85rem;border-radius:var(--radius-sm);font-size:.88rem;">${esc(p.additional_specs)}</p></div>` : ''}
    ${p.plan_file ? `<div><div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem;">Project Plan</div><a href="../uploads/projects/${esc(p.plan_file)}" target="_blank" class="btn btn-sm btn-outline">📎 View Uploaded Plan</a></div>` : ''}
  `;

  document.getElementById('modalFooter').innerHTML = p.chat_room_id
    ? `<a href="chat.html?room=${p.chat_room_id}" class="btn btn-primary">💬 Open Project Chat</a>`
    : `<p style="color:var(--text-muted);font-size:.85rem;margin:0;">Chat opens once admin accepts your project.</p>`;

  Modal.open('projectModal');
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => { b.className = 'btn btn-sm btn-ghost filter-btn'; });
    btn.className = 'btn btn-sm btn-primary filter-btn';
    activeFilter = btn.dataset.status;
    renderGrid();
  });
});

document.getElementById('searchInput').addEventListener('input', e => {
  searchTerm = e.target.value.trim();
  renderGrid();
});

document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  setInterval(loadProjects, 5000);
});
