<?php
// /home/docker/pve_dashboard/src/api_pve.php
if (!defined('PDO::ATTR_DRIVER_NAME')) exit; // Schutz

if ($action === 'get_stats') {
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pve'"); $nodes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $data = ['cpu_cores' => 0, 'cpu_used' => 0, 'ram_total' => 0, 'ram_used' => 0, 'disk_total' => 0, 'disk_used' => 0, 'cpu_percent' => 0];
    foreach ($nodes as $node) {
        $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes");
        if (isset($nData['data'])) {
            foreach ($nData['data'] as $nInfo) {
                if ($nInfo['status'] === 'online') {
                    $data['cpu_cores'] += $nInfo['maxcpu'] ?? 0; $data['cpu_used'] += ($nInfo['cpu'] ?? 0) * ($nInfo['maxcpu'] ?? 0);
                    $data['ram_total'] += $nInfo['maxmem'] ?? 0; $data['ram_used'] += $nInfo['mem'] ?? 0;
                    $data['disk_total'] += $nInfo['maxdisk'] ?? 0; $data['disk_used'] += $nInfo['disk'] ?? 0;
                }
            }
        }
    }
    if ($data['cpu_cores'] > 0) $data['cpu_percent'] = round(($data['cpu_used'] / $data['cpu_cores']) * 100, 1);
    echo json_encode(['success' => true, 'data' => $data]); exit;
}

if ($action === 'get_top_vms') {
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pve'"); $nodes = $stmt->fetchAll(PDO::FETCH_ASSOC); $allVms = [];
    foreach ($nodes as $node) {
        $vms = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/cluster/resources?type=vm");
        if (isset($vms['data'])) { foreach ($vms['data'] as $vm) { if (checkVmPermission($pdo, $vm['vmid'])) { $vm['node_id'] = $node['id']; $vm['node_ip'] = $node['ip_address']; $allVms[] = $vm; } } }
    }
    usort($allVms, function($a, $b) { return ($b['cpu'] ?? 0) <=> ($a['cpu'] ?? 0); });
    echo json_encode(['success' => true, 'data' => array_slice($allVms, 0, 5)]); exit;
}

if ($action === 'get_all_vms') {
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pve'"); $nodes = $stmt->fetchAll(PDO::FETCH_ASSOC); $allVms = [];
    foreach ($nodes as $node) {
        $vms = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/cluster/resources?type=vm");
        if (isset($vms['data'])) { foreach ($vms['data'] as $vm) { if (checkVmPermission($pdo, $vm['vmid'])) { $vm['node_id'] = $node['id']; $vm['node_ip'] = $node['ip_address']; $allVms[] = $vm; } } }
    }
    usort($allVms, function($a, $b) { if ($a['status'] === 'running' && $b['status'] !== 'running') return -1; if ($a['status'] !== 'running' && $b['status'] === 'running') return 1; return $a['vmid'] <=> $b['vmid']; });
    echo json_encode(['success' => true, 'data' => $allVms]); exit;
}

if ($action === 'vm_action') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/status/{$_POST['cmd']}", "POST");
    
    // AUDIT LOG
    logAudit("VM {$_POST['cmd']}", "VMID: {$_POST['vmid']} auf Host: {$_POST['host']}");
    echo json_encode(['success' => isset($res['data']), 'error' => $res['errors'] ?? 'Fehler']); exit;
}

if ($action === 'get_nodes') { if (!$isAdmin) exit; $stmt = $pdo->query("SELECT id, name, ip_address, type FROM nodes"); echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]); exit; }
if ($action === 'delete_node') { if (!$isAdmin) exit; $stmt = $pdo->prepare("DELETE FROM nodes WHERE id = ?"); $stmt->execute([$_POST['id']]); logAudit('Server gelöscht', "Node ID: {$_POST['id']}"); echo json_encode(['success' => true]); exit; }
if ($action === 'add_node') { 
    if (!$isAdmin) exit; 
    $stmt = $pdo->prepare("INSERT INTO nodes (name, ip_address, token_id, token_secret, type) VALUES (?, ?, ?, ?, ?)"); 
    $stmt->execute([$_POST['name'], $_POST['ip'], $_POST['user'], $_POST['pass'], $_POST['type'] ?? 'pve']); 
    logAudit('Server hinzugefügt', "Node: {$_POST['name']} ({$_POST['ip']})");
    echo json_encode(['success' => true]); exit; 
}
if ($action === 'get_users') { if (!$isAdmin) exit; $stmt = $pdo->query("SELECT id, username, role FROM users"); echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]); exit; }
if ($action === 'delete_user') { if (!$isAdmin) exit; $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?"); $stmt->execute([$_POST['id']]); logAudit('User gelöscht', "User ID: {$_POST['id']}"); echo json_encode(['success' => true]); exit; }
if ($action === 'create_user') { 
    if (!$isAdmin) exit; 
    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)"); 
    $stmt->execute([$_POST['username'], password_hash($_POST['password'], PASSWORD_DEFAULT), $_POST['role'], $_POST['permissions']]); 
    logAudit('User angelegt', "Username: {$_POST['username']} Rolle: {$_POST['role']}");
    echo json_encode(['success' => true]); exit; 
}

if ($action === 'get_pve_nodes') {
    if (!$isAdmin) exit;
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pve'"); $resList = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $node) {
        $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes");
        if(isset($nData['data'])) { foreach($nData['data'] as $n) { if($n['status'] === 'online') { $resList[] = ['node_id' => $node['id'], 'host' => $n['node'], 'display' => $node['name'] . ' -> ' . $n['node']]; } } }
    }
    echo json_encode(['success' => true, 'data' => $resList]); exit;
}

if ($action === 'create_vm') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ? AND type = 'pve'"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $nextIdRes = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/cluster/nextid");
    if(!isset($nextIdRes['data'])) { echo json_encode(['success' => false, 'error' => 'Konnte keine freie VMID finden.']); exit; }
    $vmid = $nextIdRes['data'];
    $params = ['vmid' => $vmid, 'name' => $_POST['name'], 'memory' => $_POST['memory'], 'cores' => $_POST['cores'], 'net0' => 'virtio,bridge=vmbr0'];
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/qemu", "POST", $params);
    logAudit('VM Erstellt', "VMID: {$vmid} Name: {$_POST['name']}");
    echo json_encode(['success' => isset($res['data']), 'vmid' => $vmid]); exit;
}

if ($action === 'get_vm_config') {
    if (!checkVmPermission($pdo, $_GET['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_GET['host']}/{$_GET['type']}/{$_GET['vmid']}/config");
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}

if ($action === 'update_vm_config') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $params = [];
    if(isset($_POST['memory'])) $params['memory'] = $_POST['memory'];
    if(isset($_POST['cores'])) $params['cores'] = $_POST['cores'];
    if(isset($_POST['net0'])) $params['net0'] = $_POST['net0'];
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/config", "POST", $params);
    logAudit('VM Config geändert', "VMID: {$_POST['vmid']}");
    echo json_encode(['success' => isset($res['data'])]); exit;
}

if ($action === 'add_vm_nic') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $cfg = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/config");
    $nextNic = 0; for ($i=0; $i<10; $i++) { if (!isset($cfg['data']["net{$i}"])) { $nextNic = $i; break; } }
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/config", "POST", ["net{$nextNic}" => "virtio,bridge={$_POST['bridge']}"]);
    logAudit('VM NIC hinzugefügt', "VMID: {$_POST['vmid']} Bridge: {$_POST['bridge']}");
    echo json_encode(['success' => isset($res['data']), 'slot' => "net{$nextNic}"]); exit;
}

if ($action === 'resize_vm_disk') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/resize", "PUT", ['disk' => $_POST['disk'], 'size' => $_POST['size']]);
    logAudit('VM Disk erweitert', "VMID: {$_POST['vmid']} Disk: {$_POST['disk']} Size: {$_POST['size']}");
    echo json_encode(['success' => isset($res['data'])]); exit;
}

if ($action === 'delete_vm') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}", "DELETE");
    logAudit('VM Gelöscht', "VMID: {$_POST['vmid']}");
    echo json_encode(['success' => isset($res['data'])]); exit;
}

if ($action === 'get_vm_snapshots') {
    if (!checkVmPermission($pdo, $_GET['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_GET['host']}/{$_GET['type']}/{$_GET['vmid']}/snapshot");
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}

if ($action === 'vm_snapshot_action') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $cmd = $_POST['cmd']; $snapname = $_POST['snapname'];
    if ($cmd === 'create') { $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/snapshot", "POST", ['snapname' => $snapname]); } 
    elseif ($cmd === 'delete') { $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/snapshot/{$snapname}", "DELETE"); } 
    elseif ($cmd === 'rollback') { $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/snapshot/{$snapname}/rollback", "POST"); }
    logAudit('Snapshot ' . $cmd, "VMID: {$_POST['vmid']} Snap: {$snapname}");
    echo json_encode(['success' => isset($res['data'])]); exit;
}

if ($action === 'get_backup_storages') {
    if (!checkVmPermission($pdo, $_GET['vmid'] ?? 0)) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $stRes = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_GET['host']}/storage");
    $storages = []; if (isset($stRes['data'])) { foreach ($stRes['data'] as $st) { if (strpos($st['content'], 'backup') !== false) { $storages[] = $st['storage']; } } }
    echo json_encode(['success' => true, 'data' => $storages]); exit;
}

if ($action === 'get_vm_backups') {
    if (!checkVmPermission($pdo, $_GET['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $stRes = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_GET['host']}/storage");
    $backups = [];
    if (isset($stRes['data'])) {
        foreach ($stRes['data'] as $st) {
            if (strpos($st['content'], 'backup') !== false) {
                $bRes = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_GET['host']}/storage/{$st['storage']}/content?vmid={$_GET['vmid']}");
                if (isset($bRes['data'])) { foreach ($bRes['data'] as $b) { $b['storage'] = $st['storage']; $backups[] = $b; } }
            }
        }
    }
    usort($backups, function($a, $b) { return $b['ctime'] <=> $a['ctime']; });
    echo json_encode(['success' => true, 'data' => $backups]); exit;
}

if ($action === 'create_backup') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/vzdump", "POST", ['vmid' => $_POST['vmid'], 'storage' => $_POST['storage'], 'mode' => 'snapshot']);
    logAudit('Manuelles Backup', "VMID: {$_POST['vmid']} Storage: {$_POST['storage']}");
    echo json_encode(['success' => isset($res['data'])]); exit;
}

if ($action === 'restore_backup') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/status/current");
    if (isset($res['data']) && $res['data']['status'] === 'running') { echo json_encode(['success' => false, 'error' => 'VM muss gestoppt sein!']); exit; }
    $resRestore = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}", "POST", ['vmid' => $_POST['vmid'], 'archive' => $_POST['archive'], 'force' => 1]);
    logAudit('Backup Restore', "VMID: {$_POST['vmid']} Archive: {$_POST['archive']}");
    echo json_encode(['success' => isset($resRestore['data'])]); exit;
}

if ($action === 'get_node_status' || $action === 'get_vm_status') {
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $endpoint = $action === 'get_node_status' ? "/api2/json/nodes/{$_GET['host']}/status" : "/api2/json/nodes/{$_GET['host']}/{$_GET['type']}/{$_GET['vmid']}/status/current";
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], $endpoint);
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}
?>