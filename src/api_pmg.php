<?php
// /home/docker/pve_dashboard/src/api_pmg.php
if (!defined('PDO::ATTR_DRIVER_NAME')) exit; // Schutz vor direktem Aufruf

if ($action === 'get_pmg_stats') { 
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pmg'"); $pmgNodes = []; 
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $node) { 
        $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes", 'pmg'); 
        if (isset($nData['data'][0]['node'])) { 
            $nName = $nData['data'][0]['node']; 
            $status = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$nName}/status", 'pmg'); 
            if(isset($status['data'])) { 
                $status['data']['host'] = $node['name']; 
                $status['data']['node_id'] = $node['id'];
                $status['data']['internal_name'] = $nName;
                $pmgNodes[] = $status['data']; 
            } 
        } 
    } 
    echo json_encode(['success' => true, 'data' => $pmgNodes]); exit; 
}

if ($action === 'pmg_get_spam_queue') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/quarantine/spam", 'pmg', 'GET', null, 8);
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}

if ($action === 'pmg_quarantine_action') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/quarantine/content", 'pmg', "POST", ['action' => $_POST['pmg_action'], 'id' => $_POST['mailid']]);
    echo json_encode(['success' => true, 'res' => $res]); exit;
}

if ($action === 'pmg_get_queues') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $internalName = $_GET['internal_name'] ?? ''; if (!$internalName) exit;
    $allMails = []; $queues = ['deferred', 'active', 'incoming', 'hold'];
    foreach ($queues as $qName) {
        $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$internalName}/postfix/queue/{$qName}", 'pmg');
        if (isset($res['data'])) { foreach ($res['data'] as $mail) { $mail['queue_name'] = $qName; $allMails[] = $mail; } }
    }
    echo json_encode(['success' => true, 'data' => $allMails]); exit;
}

if ($action === 'pmg_get_tracking') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $internalName = $_GET['internal_name'] ?? ''; $filter = $_GET['filter'] ?? ''; if (!$internalName) exit;
    $startTime = time() - 86400; $endTime = time(); $filterStr = !empty($filter) ? "&pmail=" . urlencode($filter) : "";
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$internalName}/tracker?starttime={$startTime}&endtime={$endTime}{$filterStr}", 'pmg', 'GET', null, 10);
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}

// === CONFIG ROUTEN ===
if ($action === 'pmg_get_config') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/mail", 'pmg');
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}

if ($action === 'pmg_set_config') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $params = [];
    if (isset($_POST['relay'])) $params['relay'] = $_POST['relay'];
    if (isset($_POST['ext_port'])) $params['ext_port'] = $_POST['ext_port'];
    if (isset($_POST['int_port'])) $params['int_port'] = $_POST['int_port'];
    if (isset($_POST['tls'])) $params['tls'] = $_POST['tls'];
    if (isset($_POST['tlslog'])) $params['tlslog'] = $_POST['tlslog'];
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/mail", 'pmg', 'PUT', $params);
    echo json_encode(['success' => true, 'res' => $res]); exit;
}

// === RELAY DOMAINS ===
if ($action === 'pmg_get_domains') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/domains", 'pmg');
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}
if ($action === 'pmg_add_domain') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/domains", 'pmg', 'POST', ['domain' => $_POST['domain']]);
    echo json_encode(['success' => true, 'res' => $res]); exit;
}
if ($action === 'pmg_delete_domain') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $domain = urlencode($_POST['domain']);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/domains/{$domain}", 'pmg', 'DELETE');
    echo json_encode(['success' => true, 'res' => $res]); exit;
}

// === TRUSTED NETWORKS ===
if ($action === 'pmg_get_networks') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/mynetworks", 'pmg');
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}
if ($action === 'pmg_add_network') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/mynetworks", 'pmg', 'POST', ['cidr' => $_POST['cidr']]);
    echo json_encode(['success' => true, 'res' => $res]); exit;
}
if ($action === 'pmg_delete_network') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $cidr = urlencode($_POST['cidr']); // Verhindert Router-Crashes wegen Slashes in der IP (z.B. /24)
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/mynetworks/{$cidr}", 'pmg', 'DELETE');
    echo json_encode(['success' => true, 'res' => $res]); exit;
}

// === SSL ZERTIFIKATE ===
if ($action === 'pmg_get_ssl') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $internalName = $_GET['internal_name'] ?? ''; if (!$internalName) exit;
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$internalName}/certificates/info", 'pmg');
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}
if ($action === 'pmg_upload_ssl') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pmg'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $internalName = $_POST['internal_name'] ?? ''; if (!$internalName) exit;
    
    // Proxmox erlaubt Upload von Zertifikaten. PMG lädt diese unter /nodes/{node}/certificates/custom hoch.
    $params = [
        'certificates' => $_POST['certificate'], 
        'key' => $_POST['private_key'], 
        'force' => 1, 
        'restart' => 1
    ];
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$internalName}/certificates/custom", 'pmg', 'POST', $params);
    echo json_encode(['success' => true, 'res' => $res]); exit;
}
?>