// assets/js/utils.js — ARC101 Shared Utilities

// ===== CONFIG =====
const APP_URL = '/arc101-web';  // change if deployed elsewhere

// ===== API HELPER =====
async function api(endpoint, data = null, method = 'POST') {
  try {
    const opts = { method, credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } };
    if (data instanceof FormData) {
      opts.body = data;
    } else if (data) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
    const res = await fetch(APP_URL + endpoint, opts);
    const json = await res.json();
    return json;
  } catch (err) {
    console.error('API error:', err);
    return { success: false, message: err.message || 'Network error' };
  }
}

// ===== TOAST =====
const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        document.body.appendChild(this.container);
      }
    }
  },
  show(msg, type = 'success', duration = 3500) {
    this.init();
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || '✅'}</span><span>${msg}</span>`;
    this.container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
};

// shorthand
function showToast(msg, type = 'success') { Toast.show(msg, type); }

// ===== MODAL =====
const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  }
};

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (e.target.classList.contains('modal-close')) {
    const overlay = e.target.closest('.modal-overlay');
    if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
  }
});

// ===== DATE HELPERS =====
function fmtDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(dt) { return `${fmtDate(dt)} ${fmtTime(dt)}`; }

// ===== ESCAPE HTML =====
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}

// ===== STATUS HELPERS =====
const STATUS_LABELS = {
  pending:      'Pending',
  under_review: 'Under Review',
  accepted:     'Accepted',
  in_progress:  'In Progress',
  completed:    'Completed',
  rejected:     'Rejected'
};
function statusLabel(s) { return STATUS_LABELS[s] || s; }
function statusBadge(s) { return `<span class="badge badge-${s}">${statusLabel(s)}</span>`; }

// ===== PROGRESS % =====
const PROGRESS_MAP = { pending: 25, under_review: 50, accepted: 75, in_progress: 90, completed: 100, rejected: 0 };
function progressPct(status) { return PROGRESS_MAP[status] ?? 0; }

// ===== LOADING BUTTON =====
function btnLoading(btn, text = 'Loading...') {
  if (!btn) return;
  btn.dataset.orig = btn.innerHTML;
  btn.innerHTML = `<span class="spinner spinner-sm"></span> ${text}`;
  btn.disabled = true;
}
function btnReset(btn) {
  if (!btn) return;
  btn.innerHTML = btn.dataset.orig || 'Submit';
  btn.disabled = false;
}

// ===== SIDEBAR TOGGLE =====
function initSidebar() {
  const btn     = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!btn || !sidebar) return;

  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }
  btn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// ===== NAVBAR TOGGLE =====
function initNavbar() {
  const toggle = document.querySelector('.nav-toggle');
  const menu   = document.querySelector('.nav-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => menu.classList.toggle('open'));
  }
}

// ===== NOTIFICATION BADGE POLL =====
function startNotifPoll() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  async function poll() {
    try {
      const r = await api('/api/notifications.php?action=count', null, 'GET');
      if (r.success && r.count > 0) {
        badge.textContent = r.count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    } catch {}
  }
  poll();
  setInterval(poll, 15000);
}

// ===== CAMERA =====
async function openCamera(callback) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;';
    const video = document.createElement('video');
    video.srcObject = stream; video.autoplay = true;
    video.style.cssText = 'max-width:100%;max-height:70vh;border-radius:8px;';
    const captureBtn = document.createElement('button');
    captureBtn.textContent = '📸 Capture';
    captureBtn.style.cssText = 'padding:.8rem 2rem;background:var(--primary-light);color:white;border:none;border-radius:8px;font-size:1rem;cursor:pointer;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Cancel';
    closeBtn.style.cssText = 'padding:.5rem 1.5rem;background:rgba(255,255,255,.2);color:white;border:none;border-radius:8px;cursor:pointer;';
    overlay.append(video, captureBtn, closeBtn);
    document.body.appendChild(overlay);
    captureBtn.onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(blob => {
        stream.getTracks().forEach(t => t.stop());
        overlay.remove();
        if (callback) callback(blob, 'camera_capture.jpg');
      }, 'image/jpeg', 0.85);
    };
    closeBtn.onclick = () => { stream.getTracks().forEach(t => t.stop()); overlay.remove(); };
  } catch (err) {
    Toast.show('Camera not available: ' + err.message, 'error');
  }
}

// ===== AUTO-INIT on DOM ready =====
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSidebar();
  startNotifPoll();
});
