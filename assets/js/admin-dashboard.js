// admin-dashboard.js
let monthlyChart, statusChart;

async function init() {
  const [statsRes, projRes] = await Promise.all([
    api('/api/projects.php?action=stats', null, 'GET'),
    api('/api/projects.php?action=list',  null, 'GET')
  ]);

  if (statsRes.success === false && statsRes.message === 'Unauthorized') {
    window.location.href = '/arc101-web/login.html'; return;
  }

  const s = statsRes.stats || {};
  document.getElementById('sTot').textContent = s.total    || 0;
  document.getElementById('sPen').textContent = s.pending  || 0;
  document.getElementById('sAct').textContent = s.active   || 0;
  document.getElementById('sDon').textContent = s.done     || 0;
  document.getElementById('sCus').textContent = s.customers|| 0;

  const projects = projRes.projects || [];
  renderStatusChart(s);
  renderMonthlyChart(projects);
  renderRecentTable(projects.slice(0, 10));
}

function renderStatusChart(s) {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pending','Under Review','Accepted','In Progress','Completed','Rejected'],
      datasets: [{ data: [s.pending||0, s.under_review||0, s.accepted||0, s.in_progress||0, s.completed||0, s.rejected||0],
        backgroundColor: ['#f59e0b','#3b82f6','#10b981','#6366f1','#059669','#ef4444'], borderWidth: 2 }]
    },
    options: { responsive: true, plugins: { legend: { position:'bottom', labels: { font:{size:11}, padding:8 } } } }
  });
}

function renderMonthlyChart(projects) {
  const counts = {};
  projects.forEach(p => {
    const m = (p.submitted_at||'').substring(0,7);
    if (m) counts[m] = (counts[m]||0) + 1;
  });
  const sorted = Object.keys(counts).sort().slice(-6);
  const labels = sorted.map(m => new Date(m+'-01').toLocaleDateString('en',{month:'short',year:'numeric'}));
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;
  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets:[{ label:'Projects', data:sorted.map(m=>counts[m]), backgroundColor:'rgba(31,77,31,.7)', borderColor:'rgba(31,77,31,1)', borderWidth:2, borderRadius:4 }] },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
  });
}

function renderRecentTable(projects) {
  const el = document.getElementById('recentTable');
  if (!projects.length) { el.innerHTML = '<div class="empty-state"><p>No projects yet.</p></div>'; return; }
  el.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Project</th><th>Customer</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
        <tbody>
          ${projects.map(p => `
            <tr>
              <td><strong>${esc(p.title)}</strong></td>
              <td>${esc(p.customer_name||'—')}</td>
              <td>${statusBadge(p.status)}</td>
              <td>${fmtDate(p.submitted_at)}</td>
              <td><a href="review_orders.html?id=${p.id}" class="btn btn-sm btn-outline">Review</a></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  setInterval(init, 5000);
});
