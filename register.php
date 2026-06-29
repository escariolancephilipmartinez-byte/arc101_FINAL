<?php
require_once __DIR__ . '/includes/config.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$name     = trim($_POST['name']     ?? '');
$email    = trim($_POST['email']    ?? '');
$phone    = trim($_POST['phone']    ?? '');
$password = $_POST['password']      ?? '';

if (!$name || !$email || !$password) {
    jsonResponse(['success' => false, 'error' => 'Name, email, and password are required.']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'error' => 'Invalid email address.']);
}
if (strlen($password) < 8) {
    jsonResponse(['success' => false, 'error' => 'Password must be at least 8 characters.']);
}

$db  = getDB();
$chk = $db->prepare('SELECT id FROM users WHERE email = ?');
$chk->execute([$email]);
if ($chk->fetch()) {
    jsonResponse(['success' => false, 'error' => 'Email already registered. Please log in.']);
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
$ins  = $db->prepare('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)');
$ins->execute([$name, $email, $phone, $hash, 'customer']);

jsonResponse(['success' => true, 'message' => 'Account created successfully.']);
