// admin-chat.js
let currentRoomId = null;
let lastMsgId     = 0;
let pollTimer     = null;
let attachedFile  = null;

async function loadRooms() {
  const d = await api('/api/chat.php?action=rooms', null, 'GET');
  if (d.success === false && d.message === 'Unauthorized') { window.location.href = '/arc101-web/login.html'; return; }
  const rooms = d.rooms || [];
  const list  = document.getElementById('roomsList');

  if (!rooms.length) {
    list.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.85rem;">No chat rooms yet.<br>Accept a project to open a chat.</div>`;
    return;
  }

  list.innerHTML = rooms.map(r => `
    <div class="chat-room-item ${r.id == currentRoomId ? 'active' : ''}" onclick="openRoom(${r.id})">
      <div class="room-avatar">${(r.customer_name||'?').charAt(0).toUpperCase()}</div>
      <div class="room-info">
        <div class="room-title">${esc((r.project_title||'').substring(0,28))}</div>
        <div class="room-preview">${esc(r.customer_name||'—')}</div>
      </div>
      ${r.unread > 0 ? `<span class="badge badge-danger">${r.unread}</span>` : statusBadge(r.status||'')}
    </div>`).join('');

  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && !currentRoomId) {
    const match = rooms.find(r => r.id == roomParam);
    if (match) { openRoom(match.id); return; }
  }
  if (!currentRoomId && rooms.length) openRoom(rooms[0].id);
}

function openRoom(roomId) {
  if (pollTimer) clearInterval(pollTimer);
  currentRoomId = roomId;
  lastMsgId = 0;

  document.getElementById('chatHeader').style.display    = 'flex';
  document.getElementById('chatMessages').style.display  = 'flex';
  document.getElementById('chatInputArea').style.display = '';
  document.getElementById('noRoom').style.display        = 'none';
  document.getElementById('chatMessages').innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  // Find room info from list
  const roomEl = document.querySelectorAll('.chat-room-item');
  roomEl.forEach(el => el.classList.remove('active'));

  loadRoomInfo(roomId);
  loadMessages(true);
  pollTimer = setInterval(() => loadMessages(false), 3000);
}

async function loadRoomInfo(roomId) {
  const d = await api('/api/chat.php?action=rooms', null, 'GET');
  const rooms = d.rooms || [];
  const r = rooms.find(x => x.id == roomId);
  if (!r) return;
  document.getElementById('chatAvatar').textContent  = (r.customer_name||'?').charAt(0).toUpperCase();
  document.getElementById('chatTitle').textContent   = r.project_title || 'Chat';
  document.getElementById('chatSubtitle').innerHTML  = `Customer: ${esc(r.customer_name||'—')} • ${statusBadge(r.status||'')}`;
  // Update room list
  loadRooms();
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
      : '<div style="text-align:center;padding:3rem;color:var(--text-muted);font-size:.88rem;">No messages yet. Say hello!</div>';
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
  const mine = msg.sender_role === 'admin';
  const init = (msg.sender_name || '?').charAt(0).toUpperCase();
  let content = '';

  if (msg.message) content += `<div class="bubble-text">${esc(msg.message).replace(/\n/g,'<br>')}</div>`;
  if (msg.attachment_type === 'image' && msg.attachment_path)
    content += `<div style="margin-top:.4rem;"><img src="../uploads/messages/${msg.attachment_path}" style="max-width:220px;border-radius:6px;cursor:pointer;" onclick="window.open(this.src)"></div>`;
  if (msg.attachment_type === 'file' && msg.attachment_path)
    content += `<div style="margin-top:.4rem;"><a href="../uploads/messages/${msg.attachment_path}" target="_blank" class="btn btn-sm btn-outline">📎 View File</a></div>`;
  if (msg.attachment_type === 'receipt' && msg.receipt_data) {
    const rd = typeof msg.receipt_data === 'string' ? JSON.parse(msg.receipt_data) : msg.receipt_data;
    const lines = (rd.items||[]).map(i=>`<div class="receipt-line"><span>${esc(i.name)}</span><span>₱${parseFloat(i.price||0).toFixed(2)}</span></div>`).join('');
    const total = (rd.items||[]).reduce((a,i)=>a+parseFloat(i.price||0),0).toFixed(2);
    const paid  = msg.payment_status === 'paid';
    content += `<div class="receipt-card"><h4>🧾 Price Quotation</h4>${rd.project_name?`<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.4rem;">${esc(rd.project_name)}</div>`:''} ${lines}<div class="receipt-line receipt-total"><span>TOTAL</span><span>₱${total}</span></div>${paid?'<div style="color:var(--success);font-size:.82rem;font-weight:700;margin-top:.4rem;">✅ Customer Paid</div>':'<div style="color:var(--text-muted);font-size:.78rem;margin-top:.4rem;">⏳ Awaiting payment</div>'}</div>`;
  }
  if (msg.attachment_type === 'progress_photo' && msg.attachment_path)
    content += `<div style="margin-top:.4rem;"><div style="font-size:.78rem;font-weight:700;color:var(--primary-light);margin-bottom:.3rem;">📸 Progress Update</div><img src="../uploads/messages/${msg.attachment_path}" style="max-width:220px;border-radius:6px;"></div>`;
  if (msg.attachment_type === 'meeting') {
    const md = typeof msg.receipt_data === 'string' ? JSON.parse(msg.receipt_data||'{}') : (msg.receipt_data||{});
    content += `<div class="receipt-card"><h4>📅 Meeting Scheduled</h4><div style="font-size:.85rem;">${esc(md.details||'')}</div></div>`;
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
  } else Toast.show(d.message || 'Failed', 'error');
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
  prev.innerHTML = `<img src="${URL.createObjectURL(blob)}" style="width:46px;height:46px;object-fit:cover;border-radius:4px;"> Photo <button onclick="clearAttach()" style="background:var(--danger);color:white;border:none;border-radius:3px;padding:.1rem .4rem;cursor:pointer;font-size:.75rem;margin-left:.5rem;">✕</button>`;
  prev.style.display = 'flex';
}

async function sendProgressPhoto() {
  openCamera(async (blob) => {
    if (!blob) return;
    const fd = new FormData();
    fd.append('room_id', currentRoomId);
    fd.append('message', 'Progress Update 📸');
    fd.append('attachment_type', 'progress_photo');
    fd.append('attachment', new File([blob], 'progress.jpg', { type:'image/jpeg' }));
    const r = await fetch('/arc101-web/api/chat.php?action=send', { method:'POST', credentials:'include', body: fd });
    const d = await r.json();
    if (d.success) {
      clearInterval(pollTimer);
      lastMsgId = 0;
      await loadMessages(true);
      pollTimer = setInterval(() => loadMessages(false), 3000);
    }
    else Toast.show(d.message || 'Failed', 'error');
  });
}

// Receipt
function addReceiptItem() {
  const row = document.createElement('div');
  row.className = 'receipt-item-row';
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr auto;gap:.5rem;margin-bottom:.5rem;';
  row.innerHTML = `<input type="text" class="form-control ri-name" placeholder="Item name"><input type="number" class="form-control ri-price" placeholder="Price" oninput="updateTotal()"><button onclick="this.parentElement.remove();updateTotal();" class="btn btn-danger btn-sm">✕</button>`;
  document.getElementById('receiptItems').appendChild(row);
}
function updateTotal() {
  let total = 0;
  document.querySelectorAll('.ri-price').forEach(i => total += parseFloat(i.value||0));
  document.getElementById('receiptTotal').textContent = '₱' + total.toFixed(2);
}

async function sendReceipt() {
  const items = [];
  document.querySelectorAll('.receipt-item-row').forEach(row => {
    const name  = row.querySelector('.ri-name').value.trim();
    const price = parseFloat(row.querySelector('.ri-price').value || 0);
    if (name) items.push({ name, price });
  });
  if (!items.length) { Toast.show('Add at least one item', 'error'); return; }
  const receiptData = { project_name: document.getElementById('rcProjectName').value.trim(), items };
  const fd = new FormData();
  fd.append('room_id', currentRoomId);
  fd.append('message', '💰 Price quotation attached. Please review and pay.');
  fd.append('attachment_type', 'receipt');
  fd.append('receipt_data', JSON.stringify(receiptData));
  const r = await fetch('/arc101-web/api/chat.php?action=send', { method:'POST', credentials:'include', body: fd });
  const d = await r.json();
  if (d.success) {
    Modal.close('receiptModal');
    clearInterval(pollTimer);
    lastMsgId = 0;
    await loadMessages(true);
    pollTimer = setInterval(() => loadMessages(false), 3000);
    Toast.show('Receipt sent!', 'success');
  }
  else Toast.show(d.message || 'Failed', 'error');
}

async function sendMeeting() {
  const details = document.getElementById('meetingDetails').value.trim();
  if (!details) { Toast.show('Please enter meeting details', 'error'); return; }
  const fd = new FormData();
  fd.append('room_id', currentRoomId);
  fd.append('message', '📅 Meeting scheduled');
  fd.append('attachment_type', 'meeting');
  fd.append('receipt_data', JSON.stringify({ details }));
  const r = await fetch('/arc101-web/api/chat.php?action=send', { method:'POST', credentials:'include', body: fd });
  const d = await r.json();
  if (d.success) {
    Modal.close('meetingModal');
    clearInterval(pollTimer);
    lastMsgId = 0;
    await loadMessages(true);
    pollTimer = setInterval(() => loadMessages(false), 3000);
    document.getElementById('meetingDetails').value = '';
  }
  else Toast.show(d.message || 'Failed', 'error');
}

document.addEventListener('DOMContentLoaded', () => {
  loadRooms();
  const ta = document.getElementById('chatInput');
  if (ta) ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
  document.querySelectorAll('.ri-price').forEach(i => i.addEventListener('input', updateTotal));
  updateTotal();
});
