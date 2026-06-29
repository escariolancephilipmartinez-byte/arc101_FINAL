<?php
// api/notifications.php
require_once __DIR__ . '/../includes/config.php';
startSecureSession();
header('Content-Type: application/json; charset=utf-8');
if (!isLoggedIn()) jsonResponse(['success'=>false,'message'=>'Unauthorized'],401);

$action = $_GET['action'] ?? 'count';
$db     = getDB();
$user   = currentUser();

switch ($action) {
    case 'count':
        $stmt = $db->prepare('SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0');
        $stmt->execute([$user['id']]);
        jsonResponse(['success'=>true,'count'=>intval($stmt->fetchColumn())]);
        break;
    case 'list':
        $stmt = $db->prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20');
        $stmt->execute([$user['id']]);
        jsonResponse(['success'=>true,'notifications'=>$stmt->fetchAll()]);
        break;
    case 'read_all':
        $db->prepare('UPDATE notifications SET is_read=1 WHERE user_id=?')->execute([$user['id']]);
        jsonResponse(['success'=>true]);
        break;
    case 'save_token':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['success'=>false,'message'=>'POST required']);
        $data  = json_decode(file_get_contents('php://input'), true);
        $token = trim($data['token'] ?? '');
        if (!$token) jsonResponse(['success'=>false,'message'=>'Token required']);
        $stmt = $db->prepare('INSERT INTO push_tokens (user_id,token,platform) VALUES (?,?,?) ON DUPLICATE KEY UPDATE token=?');
        $stmt->execute([$user['id'], $token, $data['platform'] ?? 'android', $token]);
        jsonResponse(['success'=>true]);
        break;
    default:
        jsonResponse(['success'=>false,'message'=>'Unknown action']);
}
