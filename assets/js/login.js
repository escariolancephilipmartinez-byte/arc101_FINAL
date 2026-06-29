// login.js
document.getElementById('password').addEventListener('keypress', e => {
  if (e.key === 'Enter') doLogin();
});

async function doLogin() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl  = document.getElementById('errorMsg');
  const btn      = document.getElementById('loginBtn');

  errorEl.style.display = 'none';
  if (!email || !password) { showError('Please fill in all fields.'); return; }

  btnLoading(btn, 'Signing in...');
  try {
    const r = await fetch('/arc101-web/login.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&ajax=1`
    });
    const d = await r.json();
    if (d.success) {
      window.location.href = d.role === 'admin'
        ? '/arc101-web/admin/dashboard.html'
        : '/arc101-web/customer/dashboard.html';
    } else {
      showError(d.error || 'Invalid email or password.');
    }
  } catch (e) {
    showError('Connection error. Please try again.');
  } finally {
    btnReset(btn);
  }
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = '❌ ' + msg;
  el.style.display = '';
}
