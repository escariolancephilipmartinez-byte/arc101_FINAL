// services.js

let uploadedFiles = [];

// Check login status on load
function openCameraForPlan() {
  openCamera((blob, filename) => {
    if (!blob) return;
    const file = new File([blob], filename || 'plan_photo.jpg', { type: 'image/jpeg' });
    uploadedFiles.push(file);
    renderPreviews();
    Toast.show('Photo captured and added!', 'success');
  });
}

async function checkAuth() {
  try {
    const r = await fetch('/arc101-web/api/notifications.php?action=count', { credentials: 'include' });
    const d = await r.json();
    if (d.success === false && d.message === 'Unauthorized') {
      document.getElementById('authWarning').style.display = '';
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('submitBtn').textContent = 'Login Required to Submit';
    } else {
      const link = document.getElementById('dashboardLink');
      if (link) { link.textContent = 'My Dashboard'; link.href = 'customer/dashboard.html'; }
    }
  } catch(e) {}
}

function toggleDimFields() {
  const type = document.querySelector('input[name="dimension_type"]:checked')?.value;
  document.getElementById('dimFields').style.display   = type === 'known'   ? '' : 'none';
  document.getElementById('measureNote').style.display = type === 'measure' ? '' : 'none';
}

function toggleSub(id, checkbox) {
  document.getElementById(id).style.display = checkbox.checked ? '' : 'none';
}

// Dropzone drag events
const dz = document.getElementById('dropzone');
if (dz) {
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
}

function handleFiles(files) {
  Array.from(files).forEach(file => {
    if (file.size > 10 * 1024 * 1024) { Toast.show(`${file.name} exceeds 10MB limit`, 'error'); return; }
    uploadedFiles.push(file);
    renderPreviews();
  });
}

function renderPreviews() {
  const preview = document.getElementById('filePreview');
  preview.innerHTML = uploadedFiles.map((f, i) => `
    <div class="preview-item">
      ${f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="${esc(f.name)}">` : `<div style="width:64px;height:64px;background:var(--surface-alt);border:1px solid var(--border);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📄</div>`}
      <button class="preview-remove" onclick="removeFile(${i})">✕</button>
    </div>`).join('');
}

function removeFile(i) {
  uploadedFiles.splice(i, 1);
  renderPreviews();
}

async function submitProject() {
  const title   = document.getElementById('title').value.trim();
  const address = document.getElementById('project_address').value.trim();

  document.getElementById('errorMsg').style.display   = 'none';
  document.getElementById('successMsg').style.display = 'none';

  if (!title)   { showErr('Project title is required.'); return; }
  if (!address) { showErr('Project address is required.'); return; }

  const dimType = document.querySelector('input[name="dimension_type"]:checked')?.value || 'known';
  const selected = [...document.querySelectorAll('input[name="materials"]:checked')].map(c => c.value);
  const aggTypes  = [...document.querySelectorAll('input[name="agg_types"]:checked')].map(c => c.value);
  const chemTypes = [...document.querySelectorAll('input[name="chem_types"]:checked')].map(c => c.value);

  const materials = { selected };
  if (aggTypes.length)  materials.aggregates = aggTypes;
  if (chemTypes.length) materials.chemicals  = chemTypes;

  const fd = new FormData();
  fd.append('action',          'submit');
  fd.append('title',           title);
  fd.append('project_address', address);
  fd.append('dimension_type',  dimType);
  fd.append('total_area',      document.getElementById('total_area').value || '');
  fd.append('structural_type', document.getElementById('structural_type').value || '');
  fd.append('other_materials', document.getElementById('other_materials').value || '');
  fd.append('additional_specs',document.getElementById('additional_specs').value || '');
  fd.append('materials',       JSON.stringify(materials));
  uploadedFiles.forEach(f => fd.append('plan_files[]', f));

  const btn = document.getElementById('submitBtn');
  btnLoading(btn, 'Submitting...');

  try {
    const r = await fetch('/arc101-web/api/projects.php', { method:'POST', credentials:'include', body: fd });
    const d = await r.json();
    if (d.success) {
      const s = document.getElementById('successMsg');
      s.innerHTML = `✅ Project submitted successfully! <a href="customer/dashboard.html">View your dashboard →</a>`;
      s.style.display = '';
      document.getElementById('projectForm').style.opacity = '.5';
      document.getElementById('projectForm').style.pointerEvents = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showErr(d.message || 'Submission failed. Please try again.');
    }
  } catch(e) {
    showErr('Connection error. Please check your connection and try again.');
  } finally {
    btnReset(btn);
  }
}

function showErr(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = '❌ ' + msg;
  el.style.display = '';
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.addEventListener('DOMContentLoaded', checkAuth);
