<?php
// /home/docker/pve_dashboard/src/api_pve.php
if (!defined('PDO::ATTR_DRIVER_NAME')) exit; // Schutz vor direktem Aufruf

if ($action === 'get_stats') {
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pve'"); 
    $nodes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $data = [
        'cpu_cores' => 0, 'cpu_used' => 0, 'ram_total' => 0, 'ram_used' => 0, 
        'disk_total' => 0, 'disk_used' => 0, 'cpu_percent' => 0, 'nodes_net' => [],
        'cluster_stats' => ['nodes_total' => count($nodes), 'nodes_online' => 0, 'vms_total' => 0, 'vms_running' => 0, 'vms_stopped' => 0]
    ];
    
    $seenNodes = [];
    $seenVms = [];
    
    foreach ($nodes as $node) {
        $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes");
        if (isset($nData['data'])) {
            foreach ($nData['data'] as $nInfo) {
                // Duplikate (z.B. in Clustern) vermeiden
                if (!isset($seenNodes[$nInfo['node']])) {
                    $seenNodes[$nInfo['node']] = true;
                    
                    if ($nInfo['status'] === 'online') {
                        $data['cluster_stats']['nodes_online']++;
                        $data['cpu_cores'] += $nInfo['maxcpu'] ?? 0; 
                        $data['cpu_used'] += ($nInfo['cpu'] ?? 0) * ($nInfo['maxcpu'] ?? 0);
                        $data['ram_total'] += $nInfo['maxmem'] ?? 0; 
                        $data['ram_used'] += $nInfo['mem'] ?? 0;
                        $data['disk_total'] += $nInfo['maxdisk'] ?? 0; 
                        $data['disk_used'] += $nInfo['disk'] ?? 0;

                        $nRrd = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$nInfo['node']}/rrddata?timeframe=hour&cf=AVERAGE");
                        $netin = 0; $netout = 0;
                        if (isset($nRrd['data']) && is_array($nRrd['data'])) {
                            for ($i = count($nRrd['data']) - 1; $i >= 0; $i--) {
                                if (isset($nRrd['data'][$i]['netin']) && $nRrd['data'][$i]['netin'] !== null) {
                                    $netin = $nRrd['data'][$i]['netin'];
                                    $netout = $nRrd['data'][$i]['netout'];
                                    break;
                                }
                            }
                        }
                        $data['nodes_net'][] = ['name' => $nInfo['node'], 'netin' => $netin, 'netout' => $netout];
                    }
                }
            }
        }
        
        // VMs von allen angebundenen Hosts ziehen und Duplikate filtern
        $vms = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/cluster/resources?type=vm");
        if (isset($vms['data'])) {
            foreach($vms['data'] as $vm) {
                $uniqueId = $vm['vmid'] . '@' . ($vm['node'] ?? 'unknown');
                if (!isset($seenVms[$uniqueId])) {
                    $seenVms[$uniqueId] = true;
                    $data['cluster_stats']['vms_total']++;
                    if (isset($vm['status']) && $vm['status'] === 'running') {
                        $data['cluster_stats']['vms_running']++;
                    } else {
                        $data['cluster_stats']['vms_stopped']++;
                    }
                }
            }
        }
    }
    if ($data['cpu_cores'] > 0) $data['cpu_percent'] = round(($data['cpu_used'] / $data['cpu_cores']) * 100, 1);
    echo json_encode(['success' => true, 'data' => $data]); exit;
}

if ($action === 'get_top_vms') {
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pve'"); $nodes = $stmt->fetchAll(PDO::FETCH_ASSOC); $allVms = []; $seenVms = [];
    foreach ($nodes as $node) {
        $vms = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/cluster/resources?type=vm");
        if (isset($vms['data'])) { 
            foreach ($vms['data'] as $vm) { 
                $uniqueId = $vm['vmid'] . '@' . ($vm['node'] ?? 'unknown');
                if (!isset($seenVms[$uniqueId]) && checkVmPermission($pdo, $vm['vmid'])) { 
                    $seenVms[$uniqueId] = true;
                    $vm['node_id'] = $node['id']; 
                    $vm['node_ip'] = $node['ip_address']; 
                    $vm['host'] = $vm['node'] ?? 'unknown'; 
                    $allVms[] = $vm; 
                } 
            } 
        }
    }
    usort($allVms, function($a, $b) { return ($b['cpu'] ?? 0) <=> ($a['cpu'] ?? 0); });
    echo json_encode(['success' => true, 'data' => array_slice($allVms, 0, 5)]); exit;
}

if ($action === 'get_all_vms') {
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pve'"); $nodes = $stmt->fetchAll(PDO::FETCH_ASSOC); $allVms = []; $seenVms = [];
    foreach ($nodes as $node) {
        $vms = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/cluster/resources?type=vm");
        if (isset($vms['data'])) { 
            foreach ($vms['data'] as $vm) { 
                $uniqueId = $vm['vmid'] . '@' . ($vm['node'] ?? 'unknown');
                if (!isset($seenVms[$uniqueId]) && checkVmPermission($pdo, $vm['vmid'])) { 
                    $seenVms[$uniqueId] = true;
                    $vm['node_id'] = $node['id']; 
                    $vm['node_ip'] = $node['ip_address']; 
                    $vm['host'] = $vm['node'] ?? 'unknown'; 
                    $allVms[] = $vm; 
                } 
            } 
        }
    }
    usort($allVms, function($a, $b) { if ($a['status'] === 'running' && $b['status'] !== 'running') return -1; if ($a['status'] !== 'running' && $b['status'] === 'running') return 1; return $a['vmid'] <=> $b['vmid']; });
    echo json_encode(['success' => true, 'data' => $allVms]); exit;
}

if ($action === 'vm_action') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/status/{$_POST['cmd']}", 'pve', 'POST');
    logAudit("VM {$_POST['cmd']}", "VMID: {$_POST['vmid']} auf Host: {$_POST['host']}");
    echo json_encode(['success' => isset($res['data']), 'error' => $res['errors'] ?? 'Aktion fehlgeschlagen.']); exit;
}

if ($action === 'get_nodes') { if (!$isAdmin) exit; $stmt = $pdo->query("SELECT id, name, ip_address, type FROM nodes"); echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]); exit; }

if ($action === 'delete_node') { if (!$isAdmin) exit; $stmt = $pdo->prepare("DELETE FROM nodes WHERE id = ?"); $stmt->execute([$_POST['id']]); logAudit('Server gelöscht', "Node ID: {$_POST['id']}"); echo json_encode(['success' => true]); exit; }

if ($action === 'add_node') { 
    if (!$isAdmin) exit; 
    
    $name = trim($_POST['name']);
    $ip = trim($_POST['ip']);
    $user = trim($_POST['user']);
    $pass = trim($_POST['pass']);
    $type = $_POST['type'] ?? 'pve';
    
    $tokenIdToSave = $user;
    $tokenSecretToSave = $pass;
    
    if ($type === 'pve') {
        $chAuth = curl_init("https://{$ip}:8006/api2/json/access/ticket");
        curl_setopt_array($chAuth, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false, 
            CURLOPT_SSL_VERIFYHOST => false, CURLOPT_TIMEOUT => 5, 
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query(['username' => $user, 'password' => $pass])
        ]);
        $authRes = json_decode(curl_exec($chAuth), true); 
        curl_close($chAuth);
        
        if(!isset($authRes['data']['ticket'])) {
            echo json_encode(['success' => false, 'error' => 'Proxmox Login fehlgeschlagen. Passwort falsch?']); exit;
        }
        
        $ticket = $authRes['data']['ticket'];
        $csrf = $authRes['data']['CSRFPreventionToken'];
        
        $tokenName = 'pvedash' . rand(1000, 9999);
        $chToken = curl_init("https://{$ip}:8006/api2/json/access/users/{$user}/token/{$tokenName}");
        curl_setopt_array($chToken, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false, 
            CURLOPT_SSL_VERIFYHOST => false, CURLOPT_TIMEOUT => 5, 
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query(['privsep' => 0]),
            CURLOPT_HTTPHEADER => ["Cookie: PVEAuthCookie={$ticket}", "CSRFPreventionToken: {$csrf}"]
        ]);
        $tokenRes = json_decode(curl_exec($chToken), true);
        curl_close($chToken);
        
        if(!isset($tokenRes['data']['value'])) {
            echo json_encode(['success' => false, 'error' => 'Konnte API Token nicht erstellen. Admin-Rechte?']); exit;
        }
        
        $tokenIdToSave = $user . '!' . $tokenName;
        $tokenSecretToSave = $tokenRes['data']['value'];
    }

    $stmt = $pdo->prepare("INSERT INTO nodes (name, ip_address, token_id, token_secret, type) VALUES (?, ?, ?, ?, ?)"); 
    $stmt->execute([$name, $ip, $tokenIdToSave, $tokenSecretToSave, $type]); 
    logAudit('Server hinzugefügt', "Node: {$name} ({$ip})");
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
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type = 'pve'"); $resList = []; $seenNodes = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $node) {
        $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes");
        if(isset($nData['data'])) { 
            foreach($nData['data'] as $n) { 
                if($n['status'] === 'online' && !isset($seenNodes[$n['node']])) { 
                    $seenNodes[$n['node']] = true;
                    $resList[] = ['node_id' => $node['id'], 'host' => $n['node'], 'display' => $node['name'] . ' -> ' . $n['node']]; 
                } 
            } 
        }
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
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/qemu", 'pve', 'POST', $params);
    logAudit('VM Erstellt', "VMID: {$vmid} Name: {$_POST['name']}");
    echo json_encode(['success' => isset($res['data']), 'vmid' => $vmid, 'error' => isset($res['data']) ? '' : 'Fehler bei Erstellung.']); exit;
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
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/config", 'pve', 'POST', $params);
    logAudit('VM Config geändert', "VMID: {$_POST['vmid']}");
    echo json_encode(['success' => isset($res['data']), 'error' => 'API Fehler']); exit;
}

if ($action === 'add_vm_nic') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $cfg = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/config");
    $nextNic = 0; for ($i=0; $i<10; $i++) { if (!isset($cfg['data']["net{$i}"])) { $nextNic = $i; break; } }
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/config", 'pve', 'POST', ["net{$nextNic}" => "virtio,bridge={$_POST['bridge']}"]);
    logAudit('VM NIC hinzugefügt', "VMID: {$_POST['vmid']} Bridge: {$_POST['bridge']}");
    echo json_encode(['success' => isset($res['data']), 'slot' => "net{$nextNic}", 'error' => 'API Fehler']); exit;
}

if ($action === 'resize_vm_disk') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/resize", 'pve', 'PUT', ['disk' => $_POST['disk'], 'size' => $_POST['size']]);
    logAudit('VM Disk erweitert', "VMID: {$_POST['vmid']} Disk: {$_POST['disk']} Size: {$_POST['size']}");
    echo json_encode(['success' => isset($res['data']), 'error' => 'API Fehler']); exit;
}

if ($action === 'delete_vm') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}", 'pve', 'DELETE');
    logAudit('VM Gelöscht', "VMID: {$_POST['vmid']}");
    echo json_encode(['success' => isset($res['data']), 'error' => 'API Fehler']); exit;
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
    if ($cmd === 'create') { $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/snapshot", 'pve', 'POST', ['snapname' => $snapname]); } 
    elseif ($cmd === 'delete') { $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/snapshot/{$snapname}", 'pve', 'DELETE'); } 
    elseif ($cmd === 'rollback') { $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/snapshot/{$snapname}/rollback", 'pve', 'POST'); }
    logAudit('Snapshot ' . $cmd, "VMID: {$_POST['vmid']} Snap: {$snapname}");
    echo json_encode(['success' => isset($res['data']), 'error' => 'API Fehler']); exit;
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
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/vzdump", 'pve', 'POST', ['vmid' => $_POST['vmid'], 'storage' => $_POST['storage'], 'mode' => 'snapshot']);
    logAudit('Manuelles Backup', "VMID: {$_POST['vmid']} Storage: {$_POST['storage']}");
    echo json_encode(['success' => isset($res['data']), 'error' => 'API Fehler']); exit;
}

if ($action === 'restore_backup') {
    if (!checkVmPermission($pdo, $_POST['vmid'])) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}/{$_POST['vmid']}/status/current");
    if (isset($res['data']) && $res['data']['status'] === 'running') { echo json_encode(['success' => false, 'error' => 'VM gestoppt?']); exit; }
    $resRestore = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/{$_POST['type']}", 'pve', 'POST', ['vmid' => $_POST['vmid'], 'archive' => $_POST['archive'], 'force' => 1]);
    logAudit('Backup Restore', "VMID: {$_POST['vmid']} Archive: {$_POST['archive']}");
    echo json_encode(['success' => isset($resRestore['data']), 'error' => 'API Fehler']); exit;
}

if ($action === 'get_node_status' || $action === 'get_vm_status') {
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($action === 'get_node_status') {
        $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes");
        $internalName = $nData['data'][0]['node'] ?? 'pve';
        
        $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$internalName}/status");
        $rrd = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$internalName}/rrddata?timeframe=hour&cf=AVERAGE");
        
        $netin = 0; $netout = 0;
        if (isset($rrd['data']) && is_array($rrd['data'])) {
            for ($i = count($rrd['data']) - 1; $i >= 0; $i--) {
                if (isset($rrd['data'][$i]['netin']) && $rrd['data'][$i]['netin'] !== null) {
                    $netin = $rrd['data'][$i]['netin'];
                    $netout = $rrd['data'][$i]['netout'];
                    break;
                }
            }
        }
        
        $data = $res['data'] ?? [];
        $data['netin'] = $netin;
        $data['netout'] = $netout;
        $data['is_rrd_net'] = true;
        
        echo json_encode(['success' => true, 'data' => $data]); exit;
    } else {
        $endpoint = "/api2/json/nodes/{$_GET['host']}/{$_GET['type']}/{$_GET['vmid']}/status/current";
        $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], $endpoint);
        echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
    }
}

// === NEU: RRD Historie (24h / 7 Tage) für alle Node Typen ===
if ($action === 'get_historical_rrd') {
    if (!checkVmPermission($pdo, $_GET['vmid'] ?? 0)) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_GET['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $timeframe = $_GET['timeframe'] === 'week' ? 'week' : 'day';
    $type = $node['type'] ?? 'pve';
    
    if ($type === 'pbs') {
        $endpoint = "/api2/json/nodes/localhost/rrddata?timeframe={$timeframe}&cf=AVERAGE";
    } elseif ($type === 'pmg') {
        $internalName = $_GET['host'] ?? 'localhost';
        $endpoint = "/api2/json/nodes/{$internalName}/rrddata?timeframe={$timeframe}&cf=AVERAGE";
    } else {
        if ($_GET['target_mode'] === 'node') {
            $endpoint = "/api2/json/nodes/{$_GET['host']}/rrddata?timeframe={$timeframe}&cf=AVERAGE";
        } else {
            $endpoint = "/api2/json/nodes/{$_GET['host']}/{$_GET['target_mode']}/{$_GET['vmid']}/rrddata?timeframe={$timeframe}&cf=AVERAGE";
        }
    }
    
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], $endpoint, $type);
    echo json_encode(['success' => true, 'data' => $res['data'] ?? []]); exit;
}

// === NEU: APT Update Manager ===
if ($action === 'get_update_details') {
    if (!$isAdmin) exit;
    $stmt = $pdo->query("SELECT * FROM nodes WHERE type != 'pmg'"); $updateList = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $node) {
        $nData = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes", $node['type']);
        if (isset($nData['data'])) {
            foreach ($nData['data'] as $nInfo) {
                $internalName = $nInfo['node'] ?? 'localhost';
                $apt = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$internalName}/apt/update", $node['type']);
                if (isset($apt['data']) && count($apt['data']) > 0) {
                    $updateList[] = [ 'node_id' => $node['id'], 'host' => $internalName, 'display_name' => $node['name'] . ' (' . $internalName . ')', 'type' => $node['type'], 'packages' => $apt['data'] ];
                }
            }
        }
    }
    echo json_encode(['success' => true, 'data' => $updateList]); exit;
}

if ($action === 'trigger_apt_upgrade') {
    if (!$isAdmin) exit;
    $stmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?"); $stmt->execute([$_POST['node_id']]); $node = $stmt->fetch(PDO::FETCH_ASSOC);
    $res = getProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$_POST['host']}/apt/upgrade", $node['type'], 'POST');
    logAudit('APT Upgrade gestartet', "Node: {$_POST['host']}");
    echo json_encode(['success' => isset($res['data']), 'upid' => $res['data'] ?? '', 'error' => $res['errors'] ?? 'API Fehler']); exit;
}
?>