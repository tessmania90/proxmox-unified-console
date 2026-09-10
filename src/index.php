<?php
// /home/docker/pve_dashboard/src/index.php
require_once 'db.php';
$isLoggedIn = isset($_SESSION['user_id']);
$stmt = $pdo->query("SELECT COUNT(*) FROM nodes");
$nodeCount = $stmt->fetchColumn();
?>
<!DOCTYPE html>
<html lang="de" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proxmox Unified Console</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        tailwind.config = { darkMode: 'class', theme: { extend: { colors: { proxmox: '#E57000', darkbg: '#1a1a24', darkcard: '#232333', darkborder: '#33334d', pbs: '#8b5cf6', pmg: '#3b82f6' } } } }
    </script>
    <style>
        body { background-color: #1a1a24; color: #e2e8f0; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #1a1a24; }
        ::-webkit-scrollbar-thumb { background: #33334d; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #E57000; }
        .tab-active { background-color: rgba(255,255,255,0.05); color: white; border-left: 3px solid #E57000; padding-left: 0.5rem; }
        .tab-active-pbs { background-color: rgba(139,92,246,0.1); color: white; border-left: 3px solid #8b5cf6; padding-left: 0.5rem; }
        .tab-active-pmg { background-color: rgba(59,130,246,0.1); color: white; border-left: 3px solid #3b82f6; padding-left: 0.5rem; }
    </style>
</head>
<body class="antialiased min-h-screen flex flex-col">

    <header class="bg-darkcard border-b border-darkborder p-4 shadow-md">
        <div class="max-w-[1600px] w-full mx-auto flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-gradient-to-br from-proxmox to-orange-500 flex items-center justify-center font-bold text-white shadow-lg">PX</div>
                <h1 class="text-xl font-bold text-white tracking-wide">Proxmox Unified Console</h1>
            </div>
            <?php if ($isLoggedIn): ?>
                <div class="flex items-center gap-4 text-sm">
                    <span class="text-gray-400">Hallo, <span class="text-white font-bold"><?= htmlspecialchars($_SESSION['username']) ?></span></span>
                    <button onclick="openPasswordModal()" class="text-gray-400 hover:text-white transition-colors" title="Passwort ändern">🔑</button>
                    <button onclick="logout()" class="text-red-400 hover:text-red-300 font-medium transition-colors">Abmelden</button>
                </div>
            <?php endif; ?>
        </div>
    </header>

    <main class="flex-grow p-6 flex items-center justify-center max-w-[1600px] w-full mx-auto">
        <?php if (!$isLoggedIn): ?>
            <!-- Login -->
            <div class="bg-darkcard border border-darkborder rounded-xl shadow-2xl p-8 max-w-sm w-full"><h2 class="text-2xl font-bold mb-2 text-center text-white">Login</h2><form id="loginForm" class="space-y-4"><div><label class="block text-sm font-medium text-gray-400 mb-1">Benutzer</label><input type="text" id="loginUser" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white" required></div><div><label class="block text-sm font-medium text-gray-400 mb-1">Passwort</label><input type="password" id="loginPass" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white" required></div><button type="submit" class="w-full bg-proxmox hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg mt-4">Einloggen</button></form></div>
        <?php elseif ($nodeCount == 0): ?>
            <!-- Setup -->
            <div class="bg-darkcard border border-darkborder rounded-xl shadow-2xl p-8 max-w-md w-full"><h2 class="text-2xl font-bold mb-2 text-white">Willkommen! 👋</h2><form id="setupForm" class="space-y-4"><div><label class="block text-sm font-medium text-gray-400 mb-1">Name</label><input type="text" id="nodeName" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white" required></div><div><label class="block text-sm font-medium text-gray-400 mb-1">IP</label><input type="text" id="nodeIp" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white" required></div><div><label class="block text-sm font-medium text-gray-400 mb-1">Benutzer</label><input type="text" id="nodeUser" value="root@pam" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white" required></div><div><label class="block text-sm font-medium text-gray-400 mb-1">Passwort</label><input type="password" id="nodePass" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white" required></div><button type="submit" class="w-full bg-proxmox text-white font-bold py-3 rounded-lg mt-6">Node verbinden</button></form></div>
        <?php else: ?>
            <div class="w-full h-[85vh] flex bg-darkbg overflow-hidden rounded-xl border border-darkborder shadow-2xl">
                <!-- SIDEBAR -->
                <aside class="w-64 bg-darkcard border-r border-darkborder flex flex-col shrink-0">
                    <nav class="flex-1 overflow-y-auto space-y-2 py-4">
                        <div class="px-4 mb-2"><span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Cluster Übersicht</span></div>
                        <a href="#" id="nav-tab-pve" onclick="switchTab('pve')" class="tab-active flex items-center gap-3 text-gray-400 hover:text-white px-3 py-2 rounded-r-lg transition-colors">📊 PVE Cluster</a>
                        
                        <div class="mt-4 border-t border-darkborder pt-4">
                            <div class="px-4 mb-2"><span class="text-xs font-bold text-gray-500 uppercase tracking-wider">PVE Nodes</span></div>
                            <div id="sidebar-pve-nodes" class="space-y-1">
                                <!-- Nodes per JS -->
                            </div>
                        </div>

                        <div class="mt-4 border-t border-darkborder pt-4 space-y-2">
                            <div class="px-4 mb-2"><span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Erweiterungen</span></div>
                            <a href="#" id="nav-tab-pbs" onclick="switchTab('pbs')" class="flex items-center gap-3 text-gray-400 hover:text-white px-3 py-2 rounded-r-lg">🛡️ Backup Server (PBS)</a>
                            <a href="#" id="nav-tab-pmg" onclick="switchTab('pmg')" class="flex items-center gap-3 text-gray-400 hover:text-white px-3 py-2 rounded-r-lg">✉️ Mail Gateway (PMG)</a>
                        </div>
                    </nav>
                    <div class="p-4 border-t border-darkborder space-y-2 text-sm">
                        <a href="#" onclick="openNodeTopology()" class="block text-gray-400 hover:text-white">Cluster Topologie</a>
                        <a href="#" onclick="openVmManager()" class="block text-gray-400 hover:text-white">VMs verwalten</a>
                        <a href="#" onclick="openNodeManager()" class="block text-gray-400 hover:text-white">Server & API</a>
                        <?php if(($_SESSION['role'] ?? '') === 'admin'): ?>
                        <a href="#" onclick="openCronManager()" class="block text-gray-400 hover:text-white">Task Scheduler</a>
                        <a href="#" onclick="openUserManager()" class="block text-gray-400 hover:text-white">Benutzerverwaltung</a>
                        <?php endif; ?>
                    </div>
                </aside>

                <div class="flex-1 flex flex-col overflow-hidden relative">
                    <main class="absolute inset-0 overflow-x-hidden overflow-y-auto bg-darkbg p-6 flex gap-6 w-full">
                        
                        <!-- TAB 1: PVE CLUSTER (Global) -->
                        <div id="tab-pve" class="flex-1 flex flex-col min-w-0 transition-opacity duration-300">
                            <!-- Top Kachel Cluster Status -->
                            <div class="mb-6 bg-darkcard border border-darkborder rounded-xl p-6 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                                <div class="flex items-center gap-4">
                                    <div class="p-3 bg-blue-500/10 rounded-xl"><svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg></div>
                                    <div><h2 class="text-xl font-bold text-white">Gesamtübersicht</h2><p class="text-gray-400 text-sm">Cluster & Standalone Nodes</p></div>
                                </div>
                                <div class="flex flex-wrap justify-center gap-6 md:gap-12">
                                    <div class="text-center"><p class="text-gray-400 text-xs font-bold uppercase mb-1">Server (Nodes)</p><p class="text-2xl font-bold text-white"><span id="stat-nodes-online" class="text-green-500">0</span><span class="text-gray-600 mx-1">/</span><span id="stat-nodes-total" class="text-gray-300">0</span></p></div>
                                    <div class="hidden md:block w-px bg-darkborder"></div>
                                    <div class="text-center"><p class="text-gray-400 text-xs font-bold uppercase mb-1">Total VMs/LXC</p><p class="text-2xl font-bold text-white" id="stat-vms-total">0</p></div>
                                    <div class="text-center"><p class="text-gray-400 text-xs font-bold uppercase mb-1">Online</p><p class="text-2xl font-bold text-green-500" id="stat-vms-run">0</p></div>
                                    <div class="text-center"><p class="text-gray-400 text-xs font-bold uppercase mb-1">Offline</p><p class="text-2xl font-bold text-red-500" id="stat-vms-stop">0</p></div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><p class="text-gray-400 text-sm font-medium">Cluster CPU Cores</p><h3 id="stat-cpu-text" class="text-2xl font-bold text-white mt-1">Lade...</h3><div class="w-full bg-darkbg rounded-full h-2 mt-4"><div id="stat-cpu-bar" class="bg-blue-500 h-2 rounded-full" style="width: 0%"></div></div></div>
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><p class="text-gray-400 text-sm font-medium">Globaler RAM</p><h3 id="stat-ram-text" class="text-2xl font-bold text-white mt-1">Lade...</h3><div class="w-full bg-darkbg rounded-full h-2 mt-4"><div id="stat-ram-bar" class="bg-proxmox h-2 rounded-full" style="width: 0%"></div></div></div>
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><p class="text-gray-400 text-sm font-medium">Datacenter Storage</p><h3 id="stat-disk-text" class="text-2xl font-bold text-white mt-1">Lade...</h3><div class="w-full bg-darkbg rounded-full h-2 mt-4"><div id="stat-disk-bar" class="bg-emerald-500 h-2 rounded-full" style="width: 0%"></div></div></div>
                                <div onclick="openCreateVm()" class="bg-proxmox/10 border border-proxmox/30 hover:border-proxmox rounded-xl p-5 shadow-lg cursor-pointer flex flex-col items-center justify-center text-proxmox transition-colors"><span class="text-3xl font-bold mb-1">+</span><span class="font-bold">Neue VM anlegen</span></div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg min-h-[300px] flex flex-col justify-center"><div class="flex justify-between items-center mb-4"><h3 class="text-white font-bold">Live Cluster Auslastung</h3><span class="text-xs text-gray-500 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> CPU / RAM</span></div><div class="relative h-full w-full min-h-[220px]"><canvas id="liveChart"></canvas></div></div>
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg min-h-[300px] flex flex-col justify-center"><div class="flex justify-between items-center mb-4"><h3 class="text-white font-bold">Live Netzwerk Traffic</h3><span class="text-xs text-gray-500 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> MB/s Total pro Node</span></div><div class="relative h-full w-full min-h-[220px]"><canvas id="liveNetChart"></canvas></div></div>
                            </div>
                            
                            <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><h3 class="text-white font-bold mb-4">🔥 Top 5 Ressourcen-Fresser</h3><div id="top-vms-container" class="space-y-3"><p class="text-gray-400 text-sm">Lädt Live-Daten von Proxmox API...</p></div></div>
                        </div>

                        <!-- TAB NODE VIEW -->
                        <div id="tab-node-view" class="hidden opacity-0 flex-1 flex flex-col min-w-0 transition-opacity duration-300">
                            <div class="flex justify-between items-center border-b border-darkborder pb-4 mb-6">
                                <h2 id="nodeViewTitle" class="text-2xl font-bold text-white">Host: ...</h2>
                                <div class="space-x-3">
                                    <button id="nodeViewBackupBtn" class="bg-darkcard border border-darkborder hover:border-proxmox text-white px-4 py-2 rounded text-sm transition-colors">📦 Backup Jobs</button>
                                    <button id="nodeViewHeaderBtn" class="bg-darkcard border border-darkborder hover:border-proxmox text-white px-4 py-2 rounded text-sm transition-colors">📈 Live Performance</button>
                                    <button onclick="openCreateVm()" class="bg-proxmox hover:bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors">+ Neue VM hier anlegen</button>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
                                <div class="xl:col-span-3 bg-darkcard border border-darkborder rounded-xl shadow-lg flex flex-col h-[600px]">
                                    <div class="p-4 border-b border-darkborder"><h3 class="text-white font-bold">Laufende & Gestoppte Maschinen</h3></div>
                                    <div class="overflow-y-auto flex-1">
                                        <table class="w-full text-left text-sm text-gray-400">
                                            <thead class="bg-darkbg text-xs uppercase sticky top-0 border-b border-darkborder z-10">
                                                <tr><th class="py-2 px-3">ID</th><th class="py-2 px-3">Name</th><th class="py-2 px-3">Typ</th><th class="py-2 px-3">Status</th><th class="py-2 px-3 text-right">Aktionen</th></tr>
                                            </thead>
                                            <tbody id="nodeVmsTableBody" class="divide-y divide-darkborder/50"></tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="bg-darkcard border border-darkborder rounded-xl shadow-lg p-4 flex flex-col h-[600px]">
                                    <h3 class="text-white font-bold mb-4 border-b border-darkborder pb-2">💾 Storages</h3>
                                    <div id="nodeStoragesContainer" class="space-y-3 overflow-y-auto pr-2"></div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB PBS -->
                        <div id="tab-pbs" class="hidden opacity-0 flex-1 flex flex-col min-w-0 transition-opacity duration-300">
                            <div class="mb-6 border-b border-darkborder pb-4"><h2 class="text-2xl font-bold text-white">Backup Datastores</h2></div>
                            <div id="pbs-datastores-container" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"></div>
                        </div>

                        <!-- TAB PMG -->
                        <div id="tab-pmg" class="hidden opacity-0 flex-1 flex flex-col min-w-0 transition-opacity duration-300">
                            <div class="mb-6 border-b border-darkborder pb-4"><h2 class="text-2xl font-bold text-white">Mail Gateway Status</h2></div>
                            <div id="pmg-nodes-container" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"></div>
                        </div>

                        <!-- RECHTS: JOBS (Immer sichtbar, es sei denn das Fenster ist zu schmal) -->
                        <div class="w-80 shrink-0 flex flex-col hidden lg:flex">
                            <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg flex-1 overflow-y-auto">
                                <h3 class="text-white font-bold mb-4 sticky top-0 bg-darkcard pb-2 border-b border-darkborder z-10">Letzte Jobs</h3>
                                <div id="recent-jobs-container" class="space-y-3"><p class="text-gray-400 text-sm">Lädt Job-Historie...</p></div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
            <?php include 'modals.php'; ?>
        <?php endif; ?>
    </main>
    <script> window.APP = { isLoggedIn: <?= $isLoggedIn ? 'true' : 'false' ?>, nodeCount: <?= $nodeCount ?>, username: '<?= htmlspecialchars($_SESSION['username'] ?? '') ?>' }; </script>
    <script src="app.js?v=<?= time() ?>"></script>
</body>
</html>