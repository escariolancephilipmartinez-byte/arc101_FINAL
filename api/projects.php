<?php
// api/projects.php
require_once __DIR__ . '/../includes/config.php';
startSecureSession();

header('Content-Type: application/json; charset=utf-8');

if (!isLoggedIn()) {
    jsonResponse(['success' => false, 'message' => 'Unauthorized'], 401);
}

$jsonBody = json_decode(file_get_contents('php://input'), true) ?? [];
$action   = $_GET['action'] ?? $_POST['action'] ?? $jsonBody['action'] ?? '';
$db       = getDB();
$user     = currentUser();

switch ($action) {

    case 'submit':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['success'=>false,'message'=>'Method not allowed'],405);
        requireLogin('customer');

        $title         = trim($_POST['title'] ?? '');
        $dimType       = $_POST['dimension_type'] ?? 'known';
        $totalArea     = $_POST['total_area'] ?? null;
        $structType    = trim($_POST['structural_type'] ?? '');
        $address       = trim($_POST['project_address'] ?? '');
        $otherMats     = trim($_POST['other_materials'] ?? '');
        $addSpecs      = trim($_POST['additional_specs'] ?? '');

        if (!$title || !$address) {
            jsonResponse(['success'=>false,'message'=>'Project title and address are required.']);
        }

        // Collect materials — frontend sends a JSON string via fd.append('materials', JSON.stringify(...))
        $materialsRaw = $_POST['materials'] ?? '';
        $materials = json_decode($materialsRaw, true);
        if (!is_array($materials)) {
            // Fallback: try old multi-value field approach
            $materials = [];
            if (!empty($_POST['materials'])) {
                $materials['selected'] = is_array($_POST['materials']) ? $_POST['materials'] : [$_POST['materials']];
            }
            if (!empty($_POST['agg_types'])) {
                $materials['aggregates'] = is_array($_POST['agg_types']) ? $_POST['agg_types'] : [$_POST['agg_types']];
            }
            if (!empty($_POST['chem_types'])) {
                $materials['chemicals'] = is_array($_POST['chem_types']) ? $_POST['chem_types'] : [$_POST['chem_types']];
            }
        }

        // Handle file upload
        $planFile = null;
        if (!empty($_FILES['plan_files']['name'][0])) {
            $uploadDir = UPLOAD_PATH . 'projects/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            $allowed = ['jpg','jpeg','png','pdf','dwg'];
            $files   = $_FILES['plan_files'];
            $uploaded = [];
            for ($i = 0; $i < count($files['name']); $i++) {
                $ext = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
                if (!in_array($ext, $allowed)) continue;
                if ($files['size'][$i] > 10 * 1024 * 1024) continue;
                $fname = uniqid('plan_') . '.' . $ext;
                if (move_uploaded_file($files['tmp_name'][$i], $uploadDir . $fname)) {
                    $uploaded[] = $fname;
                }
            }
            $planFile = $uploaded ? implode(',', $uploaded) : null;
        }

        $stmt = $db->prepare('INSERT INTO projects 
            (customer_id,title,dimension_type,total_area,structural_type,project_address,materials,other_materials,plan_file,additional_specs,status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([
            $user['id'], $title, $dimType,
            $dimType === 'known' ? ($totalArea ?: null) : null,
            $dimType === 'known' ? ($structType ?: null) : null,
            $address,
            json_encode($materials),
            $otherMats ?: null,
            $planFile,
            $addSpecs ?: null,
            'pending'
        ]);
        $projectId = $db->lastInsertId();

        // Notify admin
        $adminStmt = $db->query('SELECT id FROM users WHERE role="admin" LIMIT 1');
        $admin = $adminStmt->fetch();
        if ($admin) {
            $notif = $db->prepare('INSERT INTO notifications (user_id,title,body,type,reference_id) VALUES (?,?,?,?,?)');
            $notif->execute([$admin['id'], 'New Project Request', "New project submitted: $title", 'project_request', $projectId]);
        }

        jsonResponse(['success'=>true,'message'=>'Project submitted successfully!','project_id'=>$projectId]);
        break;

    case 'list':
        if ($user['role'] === 'admin') {
            $stmt = $db->prepare('SELECT p.*, p.submitted_at as created_at, u.name as customer_name, u.email as customer_email 
                FROM projects p JOIN users u ON u.id=p.customer_id ORDER BY p.submitted_at DESC');
            $stmt->execute();
        } else {
            $stmt = $db->prepare('SELECT p.*, p.submitted_at as created_at FROM projects p WHERE p.customer_id=? ORDER BY p.submitted_at DESC');
            $stmt->execute([$user['id']]);
        }
        $projects = $stmt->fetchAll();
        foreach ($projects as &$p) {
            $p['materials'] = json_decode($p['materials'] ?? '{}', true);
        }
        jsonResponse(['success'=>true,'projects'=>$projects]);
        break;

    case 'get':
        $id = intval($_GET['id'] ?? 0);
        if ($user['role'] === 'admin') {
            $stmt = $db->prepare('SELECT p.*, p.submitted_at as created_at, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
                FROM projects p JOIN users u ON u.id=p.customer_id WHERE p.id=?');
        } else {
            $stmt = $db->prepare('SELECT p.*, p.submitted_at as created_at FROM projects p WHERE p.id=? AND p.customer_id=?');
        }
        $params = $user['role'] === 'admin' ? [$id] : [$id, $user['id']];
        $stmt->execute($params);
        $project = $stmt->fetch();
        if (!$project) jsonResponse(['success'=>false,'message'=>'Project not found'],404);
        $project['materials'] = json_decode($project['materials'] ?? '{}', true);
        jsonResponse(['success'=>true,'project'=>$project]);
        break;

    case 'update_status':
        requireLogin('admin');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(['success'=>false,'message'=>'Method not allowed'],405);
        $data   = json_decode(file_get_contents('php://input'), true);
        $id     = intval($data['id'] ?? 0);
        $status = $data['status'] ?? '';
        $allowed = ['pending','under_review','accepted','in_progress','completed','rejected'];
        if (!in_array($status, $allowed)) jsonResponse(['success'=>false,'message'=>'Invalid status']);

        $stmt = $db->prepare('UPDATE projects SET status=? WHERE id=?');
        $stmt->execute([$status, $id]);

        // If accepted, create a chat room
        if ($status === 'accepted') {
            $proj = $db->prepare('SELECT customer_id FROM projects WHERE id=?');
            $proj->execute([$id]);
            $p = $proj->fetch();
            if ($p) {
                $chk = $db->prepare('SELECT id FROM chat_rooms WHERE project_id=?');
                $chk->execute([$id]);
                if (!$chk->fetch()) {
                    $cr = $db->prepare('INSERT INTO chat_rooms (project_id,customer_id) VALUES (?,?)');
                    $cr->execute([$id, $p['customer_id']]);
                    // Notify customer
                    $notif = $db->prepare('INSERT INTO notifications (user_id,title,body,type,reference_id) VALUES (?,?,?,?,?)');
                    $notif->execute([$p['customer_id'], 'Project Accepted!', 'Your project request has been accepted. Chat has been opened.', 'project_accepted', $id]);
                }
            }
        }

        jsonResponse(['success'=>true,'message'=>'Status updated']);
        break;

    case 'stats':
        requireLogin('admin');
        $total   = $db->query('SELECT COUNT(*) FROM projects')->fetchColumn();
        $pending = $db->query('SELECT COUNT(*) FROM projects WHERE status="pending"')->fetchColumn();
        $active  = $db->query('SELECT COUNT(*) FROM projects WHERE status IN ("accepted","in_progress","under_review")')->fetchColumn();
        $done    = $db->query('SELECT COUNT(*) FROM projects WHERE status="completed"')->fetchColumn();
        $customers = $db->query('SELECT COUNT(*) FROM users WHERE role="customer"')->fetchColumn();
        jsonResponse(['success'=>true,'stats'=>compact('total','pending','active','done','customers')]);
        break;

    default:
        jsonResponse(['success'=>false,'message'=>'Unknown action'],400);
}
