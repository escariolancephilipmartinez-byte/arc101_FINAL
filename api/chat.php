<?php
// api/chat.php
require_once __DIR__ . '/../includes/config.php';
startSecureSession();
header('Content-Type: application/json; charset=utf-8');

if (!isLoggedIn()) jsonResponse(['success'=>false,'message'=>'Unauthorized'],401);

$action = $_GET['action'] ?? '';
$db     = getDB();
$user   = currentUser();

switch ($action) {

    case 'rooms':
        if ($user['role'] === 'admin') {
            $stmt = $db->prepare('SELECT cr.*,p.title as project_title,u.name as customer_name,
                (SELECT message FROM messages WHERE room_id=cr.id ORDER BY sent_at DESC LIMIT 1) as last_msg,
                (SELECT sent_at FROM messages WHERE room_id=cr.id ORDER BY sent_at DESC LIMIT 1) as last_time,
                (SELECT COUNT(*) FROM messages WHERE room_id=cr.id AND is_read=0 AND sender_id!=:uid) as unread
                FROM chat_rooms cr JOIN projects p ON p.id=cr.project_id JOIN users u ON u.id=cr.customer_id
                ORDER BY last_time DESC');
            $stmt->execute([':uid' => $user['id']]);
        } else {
            $stmt = $db->prepare('SELECT cr.*,p.title as project_title,p.status as project_status,
                (SELECT message FROM messages WHERE room_id=cr.id ORDER BY sent_at DESC LIMIT 1) as last_msg,
                (SELECT sent_at FROM messages WHERE room_id=cr.id ORDER BY sent_at DESC LIMIT 1) as last_time,
                (SELECT COUNT(*) FROM messages WHERE room_id=cr.id AND is_read=0 AND sender_id!=:uid) as unread
                FROM chat_rooms cr JOIN projects p ON p.id=cr.project_id
                WHERE cr.customer_id=:cid
                ORDER BY last_time DESC');
            $stmt->execute([':uid' => $user['id'], ':cid' => $user['id']]);
        }
        $rooms = $stmt->fetchAll();
        jsonResponse(['success'=>true,'rooms'=>$rooms]);
        break;

    case 'messages':
        $roomId = intval($_GET['room_id'] ?? 0);
        if (!$roomId) jsonResponse(['success'=>false,'message'=>'Room ID required']);

        // Verify access
        $accessStmt = $db->prepare('SELECT * FROM chat_rooms WHERE id=?');
        $accessStmt->execute([$roomId]);
        $room = $accessStmt->fetch();
        if (!$room) jsonResponse(['success'=>false,'message'=>'Room not found'],404);
        if ($user['role'] !== 'admin' && $room['customer_id'] != $user['id']) {
            jsonResponse(['success'=>false,'message'=>'Access denied'],403);
        }

        $since = intval($_GET['since'] ?? 0);

        if ($since > 0) {
            // Polling: only fetch messages with id GREATER than since
            $stmt = $db->prepare('SELECT m.*,u.name as sender_name,u.role as sender_role
                FROM messages m JOIN users u ON u.id=m.sender_id
                WHERE m.room_id=? AND m.id > ?
                ORDER BY m.id ASC');
            $stmt->execute([$roomId, $since]);
        } else {
            // Initial load: get last 100 messages
            $stmt = $db->prepare('SELECT m.*,u.name as sender_name,u.role as sender_role
                FROM messages m JOIN users u ON u.id=m.sender_id
                WHERE m.room_id=?
                ORDER BY m.id ASC LIMIT 100');
            $stmt->execute([$roomId]);
        }
        $messages = $stmt->fetchAll();

        // Parse receipt_data
        foreach ($messages as &$msg) {
            if ($msg['receipt_data']) {
                $msg['receipt_data'] = json_decode($msg['receipt_data'], true);
            }
        }

        // Mark as read
        $markRead = $db->prepare('UPDATE messages SET is_read=1 WHERE room_id=? AND sender_id!=?');
        $markRead->execute([$roomId, $user['id']]);

        jsonResponse(['success'=>true,'messages'=>$messages]);
        break;

    case 'send':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['success'=>false,'message'=>'POST required'],405);

        $roomId  = intval($_POST['room_id'] ?? 0);
        $message = trim($_POST['message'] ?? '');
        $attType = $_POST['attachment_type'] ?? null;
        if (!$roomId) jsonResponse(['success'=>false,'message'=>'Room ID required']);

        // Verify access
        $accessStmt = $db->prepare('SELECT * FROM chat_rooms WHERE id=?');
        $accessStmt->execute([$roomId]);
        $room = $accessStmt->fetch();
        if (!$room) jsonResponse(['success'=>false,'message'=>'Room not found']);
        if ($user['role'] !== 'admin' && $room['customer_id'] != $user['id']) {
            jsonResponse(['success'=>false,'message'=>'Access denied'],403);
        }

        // Handle file attachment
        $attachPath = null;
        if (!empty($_FILES['attachment']['name'])) {
            $uploadDir = UPLOAD_PATH . 'messages/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            $ext   = strtolower(pathinfo($_FILES['attachment']['name'], PATHINFO_EXTENSION));
            $fname = uniqid('msg_') . '.' . $ext;
            if (move_uploaded_file($_FILES['attachment']['tmp_name'], $uploadDir . $fname)) {
                $attachPath = $fname;
            }
        }

        // Handle receipt JSON
        $receiptData = null;
        if ($attType === 'receipt' && !empty($_POST['receipt_data'])) {
            $rd = json_decode($_POST['receipt_data'], true);
            if ($rd) $receiptData = json_encode($rd);
        }

        // Generate payment link for receipts
        $payLink = null;
        if ($attType === 'receipt') {
            $payLink = APP_URL . '/pay.php?room=' . $roomId . '&msg=PLACEHOLDER';
        }

        $ins = $db->prepare('INSERT INTO messages (room_id,sender_id,message,attachment_path,attachment_type,receipt_data,payment_link)
            VALUES (?,?,?,?,?,?,?)');
        $ins->execute([
            $roomId, $user['id'],
            $message ?: null,
            $attachPath,
            $attType ?: null,
            $receiptData,
            $payLink
        ]);
        $msgId = $db->lastInsertId();

        // Update payment link with real message ID
        if ($attType === 'receipt') {
            $payLink = APP_URL . '/pay.php?room=' . $roomId . '&msg=' . $msgId;
            $db->prepare('UPDATE messages SET payment_link=? WHERE id=?')->execute([$payLink, $msgId]);
        }

        // Notify recipient
        $recipientId = ($user['id'] == $room['customer_id']) ? null : $room['customer_id'];
        if ($user['role'] === 'admin') $recipientId = $room['customer_id'];
        else {
            // Get admin
            $adm = $db->query('SELECT id FROM users WHERE role="admin" LIMIT 1')->fetch();
            $recipientId = $adm ? $adm['id'] : null;
        }
        if ($recipientId) {
            $proj = $db->prepare('SELECT title FROM projects WHERE id=?');
            $proj->execute([$room['project_id']]);
            $projTitle = $proj->fetchColumn() ?: 'Project';
            $notif = $db->prepare('INSERT INTO notifications (user_id,title,body,type,reference_id) VALUES (?,?,?,?,?)');
            $notif->execute([$recipientId, 'New Message', "Message from {$user['name']} on: $projTitle", 'chat', $roomId]);
        }

        jsonResponse(['success'=>true,'message_id'=>$msgId]);
        break;

    case 'mark_paid':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['success'=>false,'message'=>'POST required'],405);
        $data  = json_decode(file_get_contents('php://input'), true);
        $msgId = intval($data['message_id'] ?? 0);

        $stmt = $db->prepare('SELECT m.*,cr.customer_id FROM messages m JOIN chat_rooms cr ON cr.id=m.room_id WHERE m.id=?');
        $stmt->execute([$msgId]);
        $msg = $stmt->fetch();
        if (!$msg) jsonResponse(['success'=>false,'message'=>'Message not found']);
        if ($user['role'] !== 'customer' || $msg['customer_id'] != $user['id']) {
            jsonResponse(['success'=>false,'message'=>'Access denied'],403);
        }

        $db->prepare('UPDATE messages SET payment_status="paid" WHERE id=?')->execute([$msgId]);
        jsonResponse(['success'=>true,'message'=>'Payment confirmed!']);
        break;

    default:
        jsonResponse(['success'=>false,'message'=>'Unknown action'],400);
}
