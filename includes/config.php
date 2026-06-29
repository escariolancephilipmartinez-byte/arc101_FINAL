<?php
// includes/config.php - ARC101 Database Configuration

define('DB_HOST', 'localhost');
define('DB_NAME', 'arc101db');
define('DB_USER', 'root');      // Change to your XAMPP MySQL username
define('DB_PASS', '');          // Change to your XAMPP MySQL password (usually blank)
define('DB_CHARSET', 'utf8mb4');

define('APP_NAME', 'ARC101 Readymix & Development Corp.');
define('APP_URL', 'http://localhost/arc101-web');  // Change to your XAMPP path
define('UPLOAD_PATH', __DIR__ . '/../uploads/');
define('UPLOAD_URL', APP_URL . '/uploads/');
define('SESSION_LIFETIME', 3600); // 1 hour

// Payment config (GCash/PayMaya - use real credentials in production)
define('GCASH_NAME', 'ARC101 Readymix');
define('GCASH_NUMBER', '09XX-XXX-XXXX');  // Replace with actual number

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['success' => false, 'message' => 'Database connection failed']));
        }
    }
    return $pdo;
}

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.cookie_httponly', 1);
        ini_set('session.use_strict_mode', 1);
        session_set_cookie_params([
            'lifetime' => SESSION_LIFETIME,
            'path'     => '/',
            'secure'   => false, // Set to true when using HTTPS
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
        session_start();
        // Regenerate session ID periodically for security
        if (!isset($_SESSION['last_regenerated'])) {
            session_regenerate_id(true);
            $_SESSION['last_regenerated'] = time();
        } elseif (time() - $_SESSION['last_regenerated'] > 300) {
            session_regenerate_id(true);
            $_SESSION['last_regenerated'] = time();
        }
        // Session expiry check
        if (isset($_SESSION['last_active']) && (time() - $_SESSION['last_active'] > SESSION_LIFETIME)) {
            session_unset();
            session_destroy();
            session_start();
        }
        $_SESSION['last_active'] = time();
    }
}

function isLoggedIn(): bool {
    startSecureSession();
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

function requireLogin(string $role = ''): void {
    if (!isLoggedIn()) {
        header('Location: ' . APP_URL . '/login.php');
        exit;
    }
    if ($role && $_SESSION['user_role'] !== $role) {
        header('Location: ' . APP_URL . '/unauthorized.php');
        exit;
    }
}

function currentUser(): array {
    return [
        'id'   => $_SESSION['user_id']   ?? null,
        'name' => $_SESSION['user_name'] ?? '',
        'role' => $_SESSION['user_role'] ?? '',
    ];
}

function escape(string $str): string {
    return htmlspecialchars($str, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function csrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(string $token): bool {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}
