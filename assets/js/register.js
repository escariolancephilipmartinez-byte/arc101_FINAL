// register.js
async function doRegister() {
  const name     = document.getElementById('name').value.trim();
  const email    = document.getElementById('email').value.trim();
  const phone    = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const confirm  = document.getElementById('confirm').value;
  const btn      = document.getElementById('regBtn');

  document.getElementById('errorMsg').style.display   = 'none';
  document.getElementById('successMsg').style.display = 'none';

  if (!name || !email || !password) { showError('Please fill in all required fields.'); return; }
  if (password.length < 8)          { showError('Password must be at least 8 characters.'); return; }
  if (password !== confirm)          { showError('Passwords do not match.'); return; }

  btnLoading(btn, 'Creating account...');
  try {
    const r = await fetch('/arc101-web/register.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&password=${encodeURIComponent(password)}&ajax=1`
    });
    const d = await r.json();
    if (d.success) {
      const s = document.getElementById('successMsg');
      s.textContent = '✅ Account created! Redirecting to login...';
      s.style.display = '';
      setTimeout(() => window.location.href = '/arc101-web/login.html', 1500);
    } else {
      showError(d.error || 'Registration failed.');
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
