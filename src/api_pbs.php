<?php
// /home/docker/pve_dashboard/src/api_pbs.php
if (!defined('PDO::ATTR_DRIVER_NAME')) exit; // Schutz vor direktem Aufruf

if ($action === 'get_pbs_stats') { 
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pbs'"); $datastores = []; 
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $node) { 
        $dsData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/status/datastore-usage", 'pbs'); 
        if (isset($dsData['data'])) { 
            foreach ($dsData['data'] as $ds) { 
                $ds['host'] = $node['name']; 
                $ds['node_id'] = $node['id'];
                $datastores[] = $ds; 
            } 
        } 
    } 
    echo json_encode(['success' => true, 'data' => $datastores]); exit; 
}

if ($action === 'pbs_get_datastore_content') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pbs'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $store = $_GET['store'];
    
    // 1. Hole alle Namespaces (Hetzner, Zaccaria, Zuhause etc.)
    $nsData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/admin/datastore/{$store}/namespace", 'pbs');
    $namespaces = ['']; // Root Namespace immer mitnehmen
    if (isset($nsData['data'])) {
        foreach ($nsData['data'] as $nsItem) {
            if (!empty($nsItem['ns'])) $namespaces[] = $nsItem['ns'];
        }
    }
    
    $result = [];
    // 2. Iteriere durch JEDEN Namespace und hole die Backups
    foreach ($namespaces as $ns) {
        $nsParam = empty($ns) ? "" : "?ns=" . urlencode($ns);
        $snaps = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/admin/datastore/{$store}/snapshots{$nsParam}", 'pbs', 'GET', null, 15);
        
        if (isset($snaps['data'])) {
            foreach ($snaps['data'] as $snap) {
                if (!isset($snap['size']) && isset($snap['files'])) {
                    $size = 0; foreach ($snap['files'] as $f) { $size += $f['size'] ?? 0; }
                    $snap['size'] = $size;
                }
                $snap['ns'] = $ns; // Merken, in welchem Namespace das Backup liegt (wichtig fürs Löschen!)
                $result[] = $snap;
            }
        }
    }
    
    echo json_encode(['success' => true, 'data' => $result]); exit;
}

if ($action === 'pbs_delete_snapshot') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pbs'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $store = $_POST['store']; $btype = $_POST['btype']; $bid = $_POST['bid']; $btime = $_POST['btime']; $ns = $_POST['ns'] ?? '';
    
    $nsParam = empty($ns) ? "" : "&ns=" . urlencode($ns);
    $url = "/api2/json/admin/datastore/{$store}/snapshots?backup-type={$btype}&backup-id={$bid}&backup-time={$btime}{$nsParam}";
    
    getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], $url, 'pbs', 'DELETE');
    echo json_encode(['success' => true]); exit;
}

if ($action === 'pbs_get_jobs') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pbs'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $tasks = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/localhost/tasks?limit=100", 'pbs');
    echo json_encode(['success' => true, 'data' => $tasks['data'] ?? []]); exit;
}

if ($action === 'pbs_get_sync_jobs') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pbs'"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $syncs = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/config/sync", 'pbs');
    echo json_encode(['success' => true, 'data' => $syncs['data'] ?? []]); exit;
}
?>