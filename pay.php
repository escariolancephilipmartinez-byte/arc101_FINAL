<?php
require_once __DIR__ . '/includes/config.php';
startSecureSession();
if (!isLoggedIn()) { header('Location: /arc101-web/login.html'); exit; }

$message_id = intval($_GET['msg'] ?? 0);
$db  = getDB();
$msg = null;

if ($message_id) {
    $stmt = $db->prepare('SELECT m.*, cr.customer_id, cr.project_id, p.title as project_title
        FROM messages m
        JOIN chat_rooms cr ON m.room_id = cr.id
        JOIN projects p ON cr.project_id = p.id
        WHERE m.id = ? AND m.attachment_type = "receipt"');
    $stmt->execute([$message_id]);
    $msg = $stmt->fetch(PDO::FETCH_ASSOC);
}

if (!$msg) { echo '<p style="padding:2rem;font-family:sans-serif;">Invalid payment link.</p>'; exit; }

$user = currentUser();
if ($msg['customer_id'] != $user['id'] && $user['role'] !== 'admin') {
    echo '<p style="padding:2rem;font-family:sans-serif;">Unauthorized.</p>'; exit;
}

$receiptData = json_decode($msg['receipt_data'] ?? '{}', true) ?: [];
$items       = $receiptData['items'] ?? [];
$total       = array_reduce($items, fn($c, $i) => $c + floatval($i['price'] ?? 0), 0);
$projectTitle = $msg['project_title'] ?? 'Project';
$alreadyPaid  = $msg['payment_status'] === 'paid';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment — ARC101</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/main.css">
  <style>
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:1rem; }
    .pay-card { background:white; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,.12); max-width:460px; width:100%; overflow:hidden; }
    .pay-header { background:var(--primary); color:white; padding:1.75rem; text-align:center; }
    .pay-header h1 { color:white; font-size:1.3rem; margin:.5rem 0 .25rem; }
    .pay-header p  { opacity:.8; font-size:.88rem; margin:0; }
    .pay-body { padding:1.5rem; }
    .receipt-table { width:100%; border-collapse:collapse; margin-bottom:1rem; font-size:.9rem; }
    .receipt-table th { text-align:left; padding:.5rem .25rem; border-bottom:2px solid var(--border); font-size:.75rem; color:var(--text-muted); text-transform:uppercase; }
    .receipt-table td { padding:.55rem .25rem; border-bottom:1px solid var(--border); }
    .receipt-table .total-row td { font-weight:700; font-size:1rem; border-top:2px solid var(--border); border-bottom:none; padding-top:.75rem; color:var(--primary); }
    .method-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; margin-bottom:1.25rem; }
    .method-btn { border:2px solid var(--border); background:white; border-radius:10px; padding:.9rem; cursor:pointer; text-align:center; transition:all .2s; font-weight:700; font-size:.9rem; }
    .method-btn.active { border-color:var(--primary); background:var(--primary-pale); color:var(--primary); }
    .qr-box { background:var(--surface-alt); border:2px dashed var(--border); border-radius:10px; padding:1.5rem; text-align:center; margin-bottom:1.25rem; }
    .qr-placeholder { width:140px; height:140px; background:white; margin:0 auto .75rem; border-radius:8px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:3.5rem; }
    .paid-box { background:rgba(56,142,60,.08); border:1px solid rgba(56,142,60,.3); border-radius:10px; padding:1.25rem; text-align:center; color:var(--success); font-weight:700; margin-bottom:1rem; }
  </style>
</head>
<body>
<div class="pay-card">
  <div class="pay-header">
    <div style="font-size:2rem;">🏗️</div>
    <h1>ARC101 Payment</h1>
    <p><?= htmlspecialchars($projectTitle) ?></p>
  </div>
  <div class="pay-body">
    <?php if ($alreadyPaid): ?>
      <div class="paid-box">✅ Payment Already Confirmed</div>
      <p style="text-align:center;color:var(--text-muted);font-size:.9rem;">Thank you! Your payment has been recorded.</p>
      <a href="customer/chat.html" class="btn btn-primary btn-block" style="margin-top:1rem;">Back to Chat</a>
    <?php else: ?>
      <h3 style="font-size:1rem;margin-bottom:.75rem;">Order Summary</h3>
      <table class="receipt-table">
        <thead><tr><th>Item</th><th>Qty</th><th style="text-align:right;">Price</th></tr></thead>
        <tbody>
          <?php foreach($items as $item): ?>
          <tr>
            <td><?= htmlspecialchars($item['name']??'') ?></td>
            <td><?= htmlspecialchars($item['qty']??'1') ?></td>
            <td style="text-align:right;">₱<?= number_format(floatval($item['price']??0),2) ?></td>
          </tr>
          <?php endforeach; ?>
          <tr class="total-row">
            <td colspan="2">Total</td>
            <td style="text-align:right;">₱<?= number_format($total,2) ?></td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-size:1rem;margin-bottom:.75rem;">Payment Method</h3>
      <div class="method-grid">
        <button class="method-btn active" id="btnGcash" onclick="selectMethod('gcash')">
          <div style="font-size:1.5rem;margin-bottom:.25rem;">💚</div>GCash
        </button>
        <button class="method-btn" id="btnPaymaya" onclick="selectMethod('paymaya')">
          <div style="font-size:1.5rem;margin-bottom:.25rem;">💜</div>PayMaya
        </button>
      </div>

      <div class="qr-box">
        <div class="qr-placeholder" id="qrIcon">📱</div>
        <p id="qrLabel" style="font-weight:700;color:var(--primary);margin-bottom:.25rem;">GCash</p>
        <p id="qrNumber" style="font-size:1.1rem;font-weight:800;letter-spacing:.05em;">09XX-XXX-XXXX</p>
        <p style="color:var(--text-muted);font-size:.82rem;margin:.25rem 0;">Scan QR or send to the number above</p>
        <p style="font-size:1.2rem;font-weight:700;color:var(--primary);">₱<?= number_format($total,2) ?></p>
      </div>

      <p style="font-size:.83rem;color:var(--text-muted);text-align:center;margin-bottom:1rem;">After sending payment, click the button below.</p>
      <button class="btn btn-success btn-block btn-lg" id="paidBtn" onclick="confirmPayment()">✅ I've Sent Payment</button>
      <p style="text-align:center;font-size:.78rem;color:var(--text-muted);margin-top:.75rem;">Our team will verify within 24 hours.</p>
    <?php endif; ?>
  </div>
</div>

<div id="toast-container"></div>
<script src="assets/js/utils.js"></script>
<script>
function selectMethod(method) {
  document.getElementById('btnGcash').classList.toggle('active', method==='gcash');
  document.getElementById('btnPaymaya').classList.toggle('active', method==='paymaya');
  if (method === 'gcash') {
    document.getElementById('qrLabel').textContent  = 'GCash';
    document.getElementById('qrNumber').textContent = '09XX-XXX-XXXX';
    document.getElementById('qrIcon').textContent   = '📱';
  } else {
    document.getElementById('qrLabel').textContent  = 'PayMaya';
    document.getElementById('qrNumber').textContent = '09YY-YYY-YYYY';
    document.getElementById('qrIcon').textContent   = '💳';
  }
}

async function confirmPayment() {
  const btn = document.getElementById('paidBtn');
  btnLoading(btn, 'Processing...');
  try {
    const r = await fetch('/arc101-web/api/chat.php?action=mark_paid', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message_id: <?= $message_id ?> })
    });
    const d = await r.json();
    if (d.success) {
      btn.textContent = '✅ Payment Notified!';
      btn.style.background = 'var(--success)';
      setTimeout(() => location.reload(), 1200);
    } else { Toast.show(d.message || 'Failed', 'error'); btnReset(btn); }
  } catch(e) { Toast.show('Connection error', 'error'); btnReset(btn); }
}
</script>
</body>
</html>
