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