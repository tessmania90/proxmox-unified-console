<?php
// /home/docker/pve_dashboard/src/api.php
ini_set('display_errors', 0); // Verhindert, dass PHP-Warnungen das JSON zerstören
error_reporting(E_ALL);

require_once 'db.php';
header('Content-Type: application/json');
$action = $_GET['action'] ?? '';

// === ZENTRALE AUDIT LOG FUNKTION ===
function logAudit($actionName, $target = '') {
    global $pdo;
    try {
        @session_start();
        $userId = $_SESSION['user_id'] ?? 0;
        $username = $_SESSION['username'] ?? 'System';
        @session_write_close();
        
        $stmt = $pdo->prepare("INSERT INTO audit_logs (user_id, username, action, target) VALUES (?, ?, ?, ?)");
        $stmt->execute([$userId, $username, $actionName, $target]);
    } catch (Throwable $e) {
        error_log("Audit Log Fehler: " . $e->getMessage());
    }
}

if ($action === 'login') {
    $username = trim($_POST['username'] ?? ''); 
    $password = $_POST['password'] ?? '';
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?"); 
    $stmt->execute([$username]); 
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user && password_verify($password, $user['password_hash'])) {
        @session_start();
        $_SESSION['user_id'] = $user['id']; 
        $_SESSION['username'] = $user['username']; 
        $_SESSION['role'] = $user['role'];
        @session_write_close();
        
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
        logAudit('User Login', 'IP: ' . $ip);
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Login fehlgeschlagen.']);
    }
    exit;
}

if ($action === 'logout') { 
    logAudit('User Logout', '');
    @session_start();
    session_destroy(); 
    echo json_encode(['success' => true]); 
    exit; 
}

@session_start();
if (!isset($_SESSION['user_id'])) { 
    echo json_encode(['success' => false, 'error' => 'Zugriff verweigert.']); 
    exit; 
}

// === PASSWORT ÄNDERN ===
if ($action === 'change_password') {
    $oldPass = $_POST['old_password'] ?? '';
    $newPass = $_POST['new_password'] ?? '';
    $userId = $_SESSION['user_id'];
    
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user && password_verify($oldPass, $user['password_hash'])) {
        if(strlen($newPass) < 4) { echo json_encode(['success' => false, 'error' => 'Passwort muss mindestens 4 Zeichen lang sein.']); exit; }
        $newHash = password_hash($newPass, PASSWORD_DEFAULT);
        $uStmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $uStmt->execute([$newHash, $userId]);
        logAudit('Passwort geändert', 'Self-Service');
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Das alte Passwort ist falsch.']);
    }
    exit;
}

$isAdmin = ($_SESSION['role'] ?? '') === 'admin';
@session_write_close(); 

// === PROXMOX API FETCHER (JETZT MIT TICKET-AUTH FÜR ALLE SYSTEME) ===
function getProxmoxData($ip, $tokenId, $tokenSecret, $endpoint, $type = 'pve', $method = "GET", $postData = null, $timeout = 6) {
    $port = ($type === 'pbs') ? 8007 : 8006;
    
    // 1. Ticket holen (Login)
    $chAuth = curl_init("https://{$ip}:{$port}/api2/json/access/ticket");
    curl_setopt_array($chAuth, [
        CURLOPT_RETURNTRANSFER => true, 
        CURLOPT_SSL_VERIFYPEER => false, 
        CURLOPT_SSL_VERIFYHOST => false, 
        CURLOPT_TIMEOUT => 4, 
        CURLOPT_POST => true, 
        CURLOPT_POSTFIELDS => http_build_query(['username' => $tokenId, 'password' => $tokenSecret])
    ]);
    $authRes = json_decode(curl_exec($chAuth), true); 
    curl_close($chAuth);
    
    if(!isset($authRes['data']['ticket'])) {
        return ['data' => null, 'error' => 'Authentifizierung fehlgeschlagen'];
    }

    // 2. Passendes Cookie für das System wählen
    $cookieName = 'PVEAuthCookie';
    if ($type === 'pbs') $cookieName = 'PBSAuthCookie';
    if ($type === 'pmg') $cookieName = 'PMGAuthCookie';
    
    $headers = [
        "Cookie: {$cookieName}=" . $authRes['data']['ticket'], 
        "CSRFPreventionToken: " . $authRes['data']['CSRFPreventionToken']
    ];

    // 3. Eigentlichen API-Call ausführen
    $ch = curl_init("https://{$ip}:{$port}{$endpoint}");
    $options = [
        CURLOPT_RETURNTRANSFER => true, 
        CURLOPT_SSL_VERIFYPEER => false, 
        CURLOPT_SSL_VERIFYHOST => false, 
        CURLOPT_TIMEOUT => $timeout, 
        CURLOPT_HTTPHEADER => $headers
    ];
    
    if ($method !== "GET") { 
        $options[CURLOPT_CUSTOMREQUEST] = $method; 
        if ($postData) {
            $options[CURLOPT_POSTFIELDS] = is_array($postData) ? http_build_query($postData) : $postData; 
        }
    }
    
    curl_setopt_array($ch, $options);
    $res = curl_exec($ch); 
    curl_close($ch); 
    
    return json_decode($res, true) ?: [];
}

function checkVmPermission($pdo, $vmid) {
    global $isAdmin; 
    if ($isAdmin) return true; 
    
    @session_start(); 
    $userId = $_SESSION['user_id'] ?? 0; 
    @session_write_close();
    
    $stmt = $pdo->prepare("SELECT permissions FROM users WHERE id = ?"); 
    $stmt->execute([$userId]); 
    $perms = json_decode($stmt->fetchColumn() ?: '{}', true);
    
    return in_array($vmid, $perms['allowed_vms'] ?? []);
}

if ($action === 'get_audit_logs') {
    if (!$isAdmin) exit;
    $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200");
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]); exit;
}

if ($action === 'get_users' || $action === 'create_user' || $action === 'delete_user' || $action === 'get_nodes' || $action === 'delete_node' || $action === 'add_node') {
    require_once 'api_pve.php'; exit;
}

if ($action === 'get_recent_jobs') { 
    $stmt = $pdo->query("SELECT * FROM nodes"); $allTasks = []; 
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $node) { 
        if ($node['type'] === 'pbs') {
            $tasks = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/localhost/tasks?limit=10", 'pbs');
            if (isset($tasks['data'])) { foreach ($tasks['data'] as $t) { $t['node_name'] = $node['name']; $allTasks[] = $t; } }
        } elseif ($node['type'] === 'pmg') {
            $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes", 'pmg');
            if (isset($nData['data'][0]['node'])) { 
                $tasks = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$nData['data'][0]['node']}/tasks?limit=10", 'pmg'); 
                if (isset($tasks['data'])) { foreach ($tasks['data'] as $t) { $t['node_name'] = $node['name']; $allTasks[] = $t; } } 
            }
        } else {
            $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes", 'pve'); 
            if (isset($nData['data'])) { 
                foreach ($nData['data'] as $nInfo) { 
                    $tasks = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$nInfo['node']}/tasks?limit=10", 'pve'); 
                    if (isset($tasks['data'])) { foreach ($tasks['data'] as $t) { $t['node_name'] = $node['name']; $allTasks[] = $t; } } 
                } 
            } 
        }
    } 
    usort($allTasks, function($a, $b) { return ($b['starttime'] ?? 0) <=> ($a['starttime'] ?? 0); }); 
    echo json_encode(['success' => true, 'data' => array_slice($allTasks, 0, 15)]); exit; 
}

if ($action === 'get_updates') { 
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type != 'pmg'"); $total = 0; $nodesNeed = []; 
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $node) { 
        if ($node['type'] === 'pbs') {
            $apt = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/localhost/apt/update", 'pbs');
            if (isset($apt['data'])) { $c = count($apt['data']); $total += $c; if ($c > 0) $nodesNeed[] = $node['name'] . " (" . $c . ")"; }
        } else {
            $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes", 'pve'); 
            if (isset($nData['data'])) { 
                foreach ($nData['data'] as $nInfo) { 
                    $apt = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$nInfo['node']}/apt/update", 'pve'); 
                    if (isset($apt['data'])) { $c = count($apt['data']); $total += $c; if ($c > 0) $nodesNeed[] = $nInfo['node'] . " (" . $c . ")"; } 
                } 
            }
        } 
    } 
    echo json_encode(['success' => true, 'total' => $total, 'details' => implode(', ', $nodesNeed)]); exit; 
}

if ($action === 'get_task_log') { 
    if (!$isAdmin) exit; 
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC); 
    $upid = $_GET['upid']; $host = $_GET['host'] ?? 'localhost'; 
    $log = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$host}/tasks/{$upid}/log", $node['type']); 
    echo json_encode(['success' => true, 'data' => $log['data'] ?? []]); exit; 
}

if ($action === 'get_cron_jobs') {
    if (!$isAdmin) exit;
    $stmt = $pdo->query("SELECT s.*, n.name as node_name FROM scheduled_tasks s LEFT JOIN nodes n ON s.node_id = n.id ORDER BY s.id DESC");
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]); exit;
}
if ($action === 'add_cron_job') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("INSERT INTO scheduled_tasks (name, node_id, action_type, target_vmid, cron_schedule) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$_POST['name'], $_POST['node_id'], $_POST['action_type'], $_POST['target_vmid'] ?? '', $_POST['cron_schedule']]);
    logAudit('Cronjob erstellt', $_POST['name']);
    echo json_encode(['success' => true]); exit;
}
if ($action === 'delete_cron_job') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("DELETE FROM scheduled_tasks WHERE id = ?");
    $stmt->execute([$_POST['id']]);
    logAudit('Cronjob gelöscht', 'ID: ' . $_POST['id']);
    echo json_encode(['success' => true]); exit;
}
if ($action === 'toggle_cron_job') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("UPDATE scheduled_tasks SET is_active = ? WHERE id = ?");
    $stmt->execute([$_POST['is_active'], $_POST['id']]);
    logAudit('Cronjob Status geändert', 'ID: ' . $_POST['id'] . ' -> ' . ($_POST['is_active'] ? 'Aktiv' : 'Pausiert'));
    echo json_encode(['success' => true]); exit;
}

$pbsActions = ['get_pbs_stats', 'pbs_get_datastore_content', 'pbs_delete_snapshot', 'pbs_get_jobs', 'pbs_get_sync_jobs'];
$pmgActions = [
    'get_pmg_stats', 'pmg_get_spam_queue', 'pmg_quarantine_action', 'pmg_get_queues', 'pmg_get_tracking', 
    'pmg_get_config', 'pmg_set_config', 'pmg_get_ssl', 'pmg_upload_ssl',
    'pmg_get_domains', 'pmg_add_domain', 'pmg_delete_domain',
    'pmg_get_networks', 'pmg_add_network', 'pmg_delete_network'
]; 

if (in_array($action, $pbsActions)) { require_once 'api_pbs.php'; } 
elseif (in_array($action, $pmgActions)) { require_once 'api_pmg.php'; } 
else { require_once 'api_pve.php'; }
?>