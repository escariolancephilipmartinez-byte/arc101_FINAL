// customer-chat.js
let currentRoomId = null;
let lastMsgId     = 0;
let pollTimer     = null;
let pendingPayId  = null;
let attachedFile  = null;

async function loadRooms() {
  const d = await api('/api/chat.php?action=rooms', null, 'GET');
  if (d.success === false && d.message === 'Unauthorized') { window.location.href = '/arc101-web/login.html'; return; }
  const rooms = d.rooms || [];
  const list  = document.getElementById('roomsList');

  if (!rooms.length) {
    list.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.85rem;">No active chats yet.<br><br>Submit a project and once accepted, a chat will open here.</div>`;
    return;
  }

  list.innerHTML = rooms.map(r => `
    <div class="chat-room-item ${r.id == currentRoomId ? 'active' : ''}" onclick="openRoom(${r.id}, '${esc(r.project_title||'Chat')}', '${r.status||''}')">
      <div class="room-avatar">A</div>
      <div class="room-info">
        <div class="room-title">${esc((r.project_title||'').substring(0,30))}</div>
        <div class="room-preview">${esc(r.last_msg||'No messages yet')}</div>
      </div>
      ${r.unread > 0 ? `<span class="badge badge-danger">${r.unread}</span>` : ''}
    </div>`).join('');

  // Auto-open room from URL param
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && !currentRoomId) {
    const match = rooms.find(r => r.id == roomParam);
    if (match) openRoom(match.id, match.project_title || 'Chat', match.status || '');
    else if (rooms.length) openRoom(rooms[0].id, rooms[0].project_title || 'Chat', rooms[0].status || '');
  } else if (!currentRoomId && rooms.length) {
    openRoom(rooms[0].id, rooms[0].project_title || 'Chat', rooms[0].status || '');
  }
}

function openRoom(roomId, title, status) {
  if (pollTimer) clearInterval(pollTimer);
  currentRoomId = roomId;
  lastMsgId = 0;

  document.getElementById('chatHeader').style.display    = 'flex';
  document.getElementById('chatMessages').style.display  = 'flex';
  document.getElementById('chatInputArea').style.display = '';
  document.getElementById('noRoom').style.display        = 'none';
  document.getElementById('chatTitle').textContent    = title;
  document.getElementById('chatSubtitle').innerHTML   = `ARC101 Admin Team • ${statusBadge(status)}`;
  document.getElementById('chatMessages').innerHTML   = '<div class="loading-state"><div class="spinner"></div></div>';

  // Update room list active state
  document.querySelectorAll('.chat-room-item').forEach(el => el.classList.remove('active'));

  loadMessages(true);
  pollTimer = setInterval(() => loadMessages(false), 3000);
}

async function loadMessages(initial) {
  if (!currentRoomId) return;
  const url = `/arc101-web/api/chat.php?action=messages&room_id=${currentRoomId}${(!initial && lastMsgId) ? '&since=' + lastMsgId : ''}`;
  const r = await fetch(url, { credentials: 'include' });
  const d = await r.json();
  if (!d.success) return;

  const msgs = d.messages || [];
  const container = document.getElementById('chatMessages');
  const atBottom  = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  if (initial) {
    container.innerHTML = msgs.length
      ? msgs.map(renderMsg).join('')
      : '<div style="text-align:center;padding:3rem;color:var(--text-muted);font-size:.88rem;">No messages yet. Start the conversation!</div>';
    if (msgs.length) lastMsgId = Math.max(...msgs.map(m => m.id));
  } else if (msgs.length) {
    msgs.forEach(msg => {
      if (msg.id > lastMsgId) {
        container.insertAdjacentHTML('beforeend', renderMsg(msg));
        lastMsgId = Math.max(lastMsgId, msg.id);
      }
    });
  }
  if (initial || atBottom) container.scrollTop = container.scrollHeight;
}

function renderMsg(msg) {
  const mine = msg.sender_role === 'customer';
  const init = (msg.sender_name || 'A').charAt(0).toUpperCase();
  let content = '';

  if (msg.message) content += `<div class="bubble-text">${esc(msg.message).replace(/\n/g,'<br>')}</div>`;

  if (msg.attachment_type === 'image' && msg.attachment_path) {
    content += `<div style="margin-top:.4rem;"><img src="../uploads/messages/${msg.attachment_path}" style="max-width:220px;border-radius:6px;cursor:pointer;" onclick="window.open(this.src)"></div>`;
  }
  if (msg.attachment_type === 'file' && msg.attachment_path) {
    content += `<div style="margin-top:.4rem;"><a href="../uploads/messages/${msg.attachment_path}" target="_blank" class="btn btn-sm btn-outline">📎 View File</a></div>`;
  }
  if (msg.attachment_type === 'receipt' && msg.receipt_data) {
    const rd = typeof msg.receipt_data === 'string' ? JSON.parse(msg.receipt_data) : msg.receipt_data;
    const lines = (rd.items||[]).map(i => `<div class="receipt-line"><span>${esc(i.name)}</span><span>₱${parseFloat(i.price||0).toFixed(2)}</span></div>`).join('');
    const total = (rd.items||[]).reduce((a,i) => a + parseFloat(i.price||0), 0).toFixed(2);
    const paid  = msg.payment_status === 'paid';
    content += `<div class="receipt-card"><h4>🧾 Price Quotation</h4>${rd.project_name ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.4rem;">${esc(rd.project_name)}</div>` : ''}${lines}<div class="receipt-line receipt-total"><span>TOTAL</span><span>₱${total}</span></div>${paid ? '<div style="color:var(--success);font-size:.82rem;font-weight:700;margin-top:.4rem;">✅ Payment Confirmed</div>' : `<button class="btn-pay" onclick="showPayModal(${msg.id},'${total}')">💳 Pay Now (GCash / PayMaya)</button>`}</div>`;
  }
  if (msg.attachment_type === 'progress_photo' && msg.attachment_path) {
    content += `<div style="margin-top:.4rem;"><div style="font-size:.78rem;font-weight:700;color:var(--primary-light);margin-bottom:.3rem;">📸 Progress Update</div><img src="../uploads/messages/${msg.attachment_path}" style="max-width:220px;border-radius:6px;"></div>`;
  }
  if (msg.attachment_type === 'meeting') {
    const md = typeof msg.receipt_data === 'string' ? JSON.parse(msg.receipt_data||'{}') : (msg.receipt_data||{});
    content += `<div class="receipt-card"><h4>📅 Meeting Scheduled</h4><div style="font-size:.85rem;">${esc(md.details||'Details coming soon.')}</div></div>`;
  }

  content += `<div class="bubble-time">${fmtTime(msg.sent_at)}</div>`;
  return `<div class="msg-bubble ${mine?'mine':''}"><div class="bubble-avatar">${init}</div><div class="bubble-content">${content}</div></div>`;
}

async function sendMessage() {
  if (!currentRoomId) return;
  const text = document.getElementById('chatInput').value.trim();
  if (!text && !attachedFile) return;
  const fd = new FormData();
  fd.append('room_id', currentRoomId);
  fd.append('message', text);
  if (attachedFile) {
    fd.append('attachment', attachedFile);
    fd.append('attachment_type', attachedFile.type.startsWith('image/') ? 'image' : 'file');
  }
  const r = await fetch('/arc101-web/api/chat.php?action=send', { method:'POST', credentials:'include', body: fd });
  const d = await r.json();
  if (d.success) {
    document.getElementById('chatInput').value = '';
    document.getElementById('chatInput').style.height = 'auto';
    clearAttach();
    clearInterval(pollTimer);
    lastMsgId = 0;
    await loadMessages(true);
    pollTimer = setInterval(() => loadMessages(false), 3000);
  } else { Toast.show(d.message || 'Failed to send', 'error'); }
}

function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }

function previewAttach(input) {
  const prev = document.getElementById('attachPreview');
  if (input.files[0]) {
    attachedFile = input.files[0];
    prev.innerHTML = `📎 ${esc(attachedFile.name)} <button onclick="clearAttach()" style="background:var(--danger);color:white;border:none;border-radius:3px;padding:.1rem .4rem;cursor:pointer;font-size:.75rem;margin-left:.5rem;">✕</button>`;
    prev.style.display = 'flex';
  }
}
function clearAttach() {
  attachedFile = null;
  document.getElementById('attachFile').value = '';
  const p = document.getElementById('attachPreview');
  p.style.display = 'none'; p.innerHTML = '';
}
function handleCamera(blob, filename) {
  attachedFile = new File([blob], filename, { type:'image/jpeg' });
  const prev = document.getElementById('attachPreview');
  const url  = URL.createObjectURL(blob);
  prev.innerHTML = `<img src="${url}" style="width:46px;height:46px;object-fit:cover;border-radius:4px;"> Photo captured <button onclick="clearAttach()" style="background:var(--danger);color:white;border:none;border-radius:3px;padding:.1rem .4rem;cursor:pointer;font-size:.75rem;margin-left:.5rem;">✕</button>`;
  prev.style.display = 'flex';
}

function showPayModal(msgId, amount) {
  pendingPayId = msgId;
  document.getElementById('payAmount').textContent = '₱' + parseFloat(amount).toFixed(2);
  Modal.open('payModal');
}
async function confirmPayment() {
  if (!pendingPayId) return;
  const btn = document.getElementById('confirmPayBtn');
  btnLoading(btn, 'Processing...');
  const r = await fetch('/arc101-web/api/chat.php?action=mark_paid', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ message_id: pendingPayId })
  });
  const d = await r.json();
  btnReset(btn);
  if (d.success) {
    Modal.close('payModal');
    Toast.show('Payment confirmed! Our team will process your order.', 'success');
    clearInterval(pollTimer);
    lastMsgId = 0;
    await loadMessages(true);
    pollTimer = setInterval(() => loadMessages(false), 3000);
  } else { Toast.show(d.message || 'Error', 'error'); }
}

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', () => {
  loadRooms();
  const ta = document.getElementById('chatInput');
  if (ta) ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
});
