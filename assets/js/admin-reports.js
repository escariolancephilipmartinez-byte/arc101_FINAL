// admin-reports.js
let allProjects = [];
let monthlyChart, statusChart, materialsChart;

async function init() {
  const [statsRes, projRes] = await Promise.all([
    api('/api/projects.php?action=stats', null, 'GET'),
    api('/api/projects.php?action=list',  null, 'GET')
  ]);
  if (statsRes.success === false && statsRes.message === 'Unauthorized') { window.location.href = '/arc101-web/login.html'; return; }

  const s = statsRes.stats || {};
  document.getElementById('sTot').textContent = s.total    || 0;
  document.getElementById('sAct').textContent = s.active   || 0;
  document.getElementById('sDon').textContent = s.done     || 0;
  document.getElementById('sPen').textContent = (s.pending||0) + (s.under_review||0);

  allProjects = projRes.projects || [];
  renderStatusChart(s);
  renderMonthlyChart(allProjects);
  renderMaterialsChart(allProjects);
  renderTable(allProjects);
}

function renderStatusChart(s) {
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
      labels: ['Pending','Under Review','Accepted','In Progress','Completed','Rejected'],
      datasets: [{ data:[s.pending||0,s.under_review||0,s.accepted||0,s.in_progress||0,s.completed||0,s.rejected||0],
        backgroundColor:['#f59e0b','#3b82f6','#10b981','#6366f1','#059669','#ef4444'], borderWidth:2 }]
    },
    options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, padding:8 } } } }
  });
}

function renderMonthlyChart(projects) {
  const counts = {};
  projects.forEach(p => { const m=(p.submitted_at||'').substring(0,7); if(m) counts[m]=(counts[m]||0)+1; });
  const sorted = Object.keys(counts).sort().slice(-6);
  const labels = sorted.map(m=>new Date(m+'-01').toLocaleDateString('en',{month:'short',year:'numeric'}));
  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(document.getElementById('monthlyChart'), {
    type:'bar',
    data:{ labels, datasets:[{ label:'Projects', data:sorted.map(m=>counts[m]), backgroundColor:'rgba(31,77,31,.7)', borderColor:'rgba(31,77,31,1)', borderWidth:2, borderRadius:4 }] },
    options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
  });
}

function renderMaterialsChart(projects) {
  const counts = {};
  projects.forEach(p => {
    try {
      const m = typeof p.materials === 'string' ? JSON.parse(p.materials||'{}') : (p.materials||{});
      [...(m.selected||[]),...(m.aggregates||[]),...(m.chemicals||[])].forEach(k => { counts[k]=(counts[k]||0)+1; });
    } catch{}
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if (materialsChart) materialsChart.destroy();
  materialsChart = new Chart(document.getElementById('materialsChart'), {
    type:'bar',
    data:{ labels:sorted.map(([k])=>k.replace(/_/g,' ')), datasets:[{ label:'Requests', data:sorted.map(([,v])=>v), backgroundColor:'rgba(201,162,39,.7)', borderColor:'rgba(201,162,39,1)', borderWidth:2, borderRadius:4 }] },
    options:{ indexAxis:'y', responsive:true, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true,ticks:{stepSize:1}}} }
  });
}

function filterTable() {
  const search = document.getElementById('tableSearch').value.toLowerCase();
  const status = document.getElementById('tableFilter').value;
  let list = allProjects;
  if (status) list = list.filter(p => p.status === status);
  if (search) list = list.filter(p => (p.title+p.customer_name+p.project_address).toLowerCase().includes(search));
  renderTable(list);
}

function renderTable(projects) {
  const el = document.getElementById('projectsTable');
  if (!projects.length) { el.innerHTML = '<div class="empty-state" style="padding:3rem;"><p>No projects found.</p></div>'; return; }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Project</th><th>Customer</th><th>Address</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
      <tbody>
        ${projects.map(p=>`
          <tr>
            <td><strong>${esc(p.title)}</strong></td>
            <td>${esc(p.customer_name||'—')}</td>
            <td>${esc((p.project_address||'').substring(0,30))}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${fmtDate(p.submitted_at)}</td>
            <td><a href="review_orders.html?id=${p.id}" class="btn btn-sm btn-outline">View</a></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

document.addEventListener('DOMContentLoaded', init);
