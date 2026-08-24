<?php
// /home/docker/pve_dashboard/src/cron.php
require_once __DIR__ . '/db.php';

function isCronMatch($cron, $time = null) {
    if ($time === null) $time = time();
    $cronParts = explode(' ', trim($cron));
    if (count($cronParts) !== 5) return false;
    
    list($min, $hour, $day, $month, $weekday) = $cronParts;
    
    return matchCronPart($min, date('i', $time)) &&
           matchCronPart($hour, date('H', $time)) &&
           matchCronPart($day, date('d', $time)) &&
           matchCronPart($month, date('m', $time)) &&
           matchCronPart($weekday, date('w', $time));
}

function matchCronPart($part, $current) {
    if ($part === '*') return true;
    if ($part === (string)(int)$current) return true;
    if (strpos($part, '*/') === 0) { 
        $step = (int)substr($part, 2);
        return $step > 0 && ((int)$current % $step) === 0;
    }
    return false;
}

// Mini-Proxmox-Fetcher für das Cron-Skript (Mit Token-Auth für PVE!)
function cronProxmoxData($ip, $tokenId, $tokenSecret, $endpoint, $method = "POST", $postData = null) {
    $headers = ["Authorization: PVEAPIToken={$tokenId}={$tokenSecret}"];
    $ch = curl_init("https://{$ip}:8006{$endpoint}");
    $options = [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false, 
        CURLOPT_SSL_VERIFYHOST => false, CURLOPT_TIMEOUT => 15, 
        CURLOPT_HTTPHEADER => $headers, CURLOPT_CUSTOMREQUEST => $method
    ];
    if ($postData) $options[CURLOPT_POSTFIELDS] = http_build_query($postData);
    curl_setopt_array($ch, $options);
    $res = curl_exec($ch); curl_close($ch); 
    return json_decode($res, true) ?: [];
}

echo "[" . date('Y-m-d H:i:s') . "] Starte Scheduler-Check...\n";

$stmt = $pdo->query("SELECT * FROM scheduled_tasks WHERE is_active = 1");
$tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($tasks as $task) {
    if (isCronMatch($task['cron_schedule'])) {
        echo "-> Führe Task ID {$task['id']} ('{$task['name']}') aus...\n";
        
        $nStmt = $pdo->prepare("SELECT * FROM nodes WHERE id = ?");
        $nStmt->execute([$task['node_id']]);
        $node = $nStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($node) {
            $success = false;
            
            if ($task['action_type'] === 'reboot_node') {
                $nData = cronProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes", 'GET');
                if (isset($nData['data'][0]['node'])) {
                    $nName = $nData['data'][0]['node'];
                    cronProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$nName}/status", 'POST', ['command' => 'reboot']);
                    $success = true;
                }
            } 
            elseif (in_array($task['action_type'], ['start_vm', 'stop_vm', 'reboot_vm'])) {
                $vmsRes = cronProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/cluster/resources?type=vm", 'GET');
                if (isset($vmsRes['data'])) {
                    foreach ($vmsRes['data'] as $vm) {
                        if ((string)$vm['vmid'] === (string)$task['target_vmid']) {
                            $cmd = str_replace('_vm', '', $task['action_type']);
                            $type = $vm['type'] === 'lxc' ? 'lxc' : 'qemu';
                            cronProxmoxData($node['ip_address'], $node['token_id'], $node['token_secret'], "/api2/json/nodes/{$vm['node']}/{$type}/{$vm['vmid']}/status/{$cmd}", 'POST');
                            $success = true;
                            break;
                        }
                    }
                }
            }
            
            if ($success) {
                $uStmt = $pdo->prepare("UPDATE scheduled_tasks SET last_run = ? WHERE id = ?");
                $uStmt->execute([time(), $task['id']]);
                echo "   Erfolgreich an API gesendet.\n";
            } else {
                echo "   Fehler beim Ausführen!\n";
            }
        }
    }
}
echo "[" . date('Y-m-d H:i:s') . "] Scheduler-Check beendet.\n";
?>