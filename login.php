<?php
require_once __DIR__ . '/includes/config.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

if (!$email || !$password) {
    jsonResponse(['success' => false, 'error' => 'Email and password are required.']);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user && password_verify($password, $user['password'])) {
    session_regenerate_id(true);
    $_SESSION['user_id']           = $user['id'];
    $_SESSION['user_name']         = $user['name'];
    $_SESSION['user_role']         = $user['role'];
    $_SESSION['last_regenerated']  = time();
    jsonResponse([
        'success' => true,
        'role'    => $user['role'],
        'user'    => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']]
    ]);
} else {
    jsonResponse(['success' => false, 'error' => 'Invalid email or password.']);
}
