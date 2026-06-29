// index.js — homepage logic

// Update nav link based on session
async function checkSession() {
  try {
    const r = await fetch('/arc101-web/api/notifications.php?action=count', { credentials: 'include' });
    const d = await r.json();
    if (d.success !== false) {
      // User is logged in — update dashboard link
      const link = document.getElementById('dashboardLink');
      if (link) {
        link.textContent = 'My Dashboard';
        link.href = 'customer/dashboard.html';
      }
    }
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', checkSession);
