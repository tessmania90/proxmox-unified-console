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
                    
                    <!-- HIER IST DER SCHLÜSSEL BUTTON -->
                    <button onclick="openPasswordModal()" class="text-gray-400 hover:text-white transition-colors" title="Passwort ändern">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.286l5.742-5.742C9.4 11.135 9 10.126 9 9a6 6 0 0112 0z"></path></svg>
                    </button>
                    <!-- ============================ -->

                    <button onclick="logout()" class="text-red-400 hover:text-red-300 font-medium transition-colors">Abmelden</button>
                </div>
            <?php else: ?>
                <div class="text-sm text-gray-400">System Status: <span class="text-green-500 font-bold">Sicher</span></div>
            <?php endif; ?>
        </div>
    </header>

    <main class="flex-grow p-6 flex items-center justify-center max-w-[1600px] w-full mx-auto">
        <?php if (!$isLoggedIn): ?>
            <div class="bg-darkcard border border-darkborder rounded-xl shadow-2xl p-8 max-w-sm w-full"><div class="flex justify-center mb-6"><div class="w-12 h-12 rounded bg-proxmox/10 flex items-center justify-center text-proxmox shadow-lg"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg></div></div><h2 class="text-2xl font-bold mb-2 text-center text-white">Login</h2><form id="loginForm" class="space-y-4"><div><label class="block text-sm font-medium text-gray-400 mb-1">Benutzername</label><input type="text" id="loginUser" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white focus:outline-none focus:border-proxmox" required></div><div><label class="block text-sm font-medium text-gray-400 mb-1">Passwort</label><input type="password" id="loginPass" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white focus:outline-none focus:border-proxmox" required></div><button type="submit" class="w-full bg-proxmox hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-4 shadow-lg shadow-orange-900/50">Einloggen</button></form></div>
        <?php elseif ($nodeCount == 0): ?>
            <div class="bg-darkcard border border-darkborder rounded-xl shadow-2xl p-8 max-w-md w-full"><h2 class="text-2xl font-bold mb-2 text-white">Willkommen! 👋</h2><p class="text-gray-400 text-sm mb-6">Verbinde deinen ersten Host, um zu starten.</p><form id="setupForm" class="space-y-4"><div><label class="block text-sm font-medium text-gray-400 mb-1">Anzeigename</label><input type="text" id="nodeName" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white focus:outline-none focus:border-proxmox" required></div><div><label class="block text-sm font-medium text-gray-400 mb-1">IP-Adresse</label><input type="text" id="nodeIp" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white focus:outline-none focus:border-proxmox" required></div><div><label class="block text-sm font-medium text-gray-400 mb-1">Benutzername</label><input type="text" id="nodeUser" value="root@pam" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white focus:outline-none focus:border-proxmox" required></div><div><label class="block text-sm font-medium text-gray-400 mb-1">Passwort</label><input type="password" id="nodePass" class="w-full bg-darkbg border border-darkborder rounded p-2.5 text-white focus:outline-none focus:border-proxmox" required></div><button type="submit" class="w-full bg-proxmox hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-6 shadow-lg shadow-orange-900/50">Node verbinden</button></form></div>
        <?php else: ?>
            <div class="w-full h-[85vh] flex bg-darkbg overflow-hidden rounded-xl border border-darkborder shadow-2xl">
                <!-- SIDEBAR -->
                <aside class="w-64 bg-darkcard border-r border-darkborder flex flex-col">
                    <div class="p-4 border-b border-darkborder"><span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Dashboards</span></div>
                    <nav class="flex-1 overflow-y-auto p-4 space-y-2">
                        <a href="#" id="nav-tab-pve" onclick="switchTab('pve')" class="tab-active flex items-center gap-3 text-gray-400 hover:text-white px-3 py-2 rounded-r-lg transition-colors"><svg class="w-5 h-5 text-proxmox" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg> PVE Cluster</a>
                        <a href="#" id="nav-tab-pbs" onclick="switchTab('pbs')" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-r-lg transition-colors"><svg class="w-5 h-5 text-pbs" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg> Backup Server (PBS)</a>
                        <a href="#" id="nav-tab-pmg" onclick="switchTab('pmg')" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-r-lg transition-colors"><svg class="w-5 h-5 text-pmg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> Mail Gateway (PMG)</a>

                        <div class="pt-4 mt-4 border-t border-darkborder space-y-2">
                            <a href="#" onclick="openNodeTopology()" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg> Cluster Topologie</a>
                            <a href="#" onclick="openVmManager()" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg> VMs verwalten</a>
                            <a href="#" onclick="openNodeManager()" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Server & API</a>
                            
                            <?php if(($_SESSION['role'] ?? '') === 'admin'): ?>
                            <a href="#" onclick="openCronManager()" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3"></path></svg> Task Scheduler</a>
                            <a href="#" onclick="openUserManager()" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> Benutzerverwaltung</a>
                            <?php endif; ?>
                        </div>
                    </nav>
                </aside>

                <div class="flex-1 flex flex-col overflow-hidden relative">
                    <main class="absolute inset-0 overflow-x-hidden overflow-y-auto bg-darkbg p-6 flex gap-6 w-full">
                        
                        <!-- TAB 1: PVE -->
                        <div id="tab-pve" class="flex-1 flex flex-col min-w-0 transition-opacity duration-300">
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><div class="flex justify-between items-start mb-4"><div><p class="text-gray-400 text-sm font-medium">Cluster CPU Cores</p><h3 id="stat-cpu-text" class="text-2xl font-bold text-white mt-1">Lade...</h3></div><div class="p-2 bg-blue-500/10 rounded-lg"><svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg></div></div><div class="w-full bg-darkbg rounded-full h-2"><div id="stat-cpu-bar" class="bg-blue-500 h-2 rounded-full" style="width: 0%"></div></div></div>
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><div class="flex justify-between items-start mb-4"><div><p class="text-gray-400 text-sm font-medium">Globaler RAM</p><h3 id="stat-ram-text" class="text-2xl font-bold text-white mt-1">Lade...</h3></div><div class="p-2 bg-proxmox/10 rounded-lg"><svg class="w-6 h-6 text-proxmox" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div></div><div class="w-full bg-darkbg rounded-full h-2"><div id="stat-ram-bar" class="bg-proxmox h-2 rounded-full" style="width: 0%"></div></div></div>
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><div class="flex justify-between items-start mb-4"><div><p class="text-gray-400 text-sm font-medium">Datacenter Storage</p><h3 id="stat-disk-text" class="text-2xl font-bold text-white mt-1">Lade...</h3></div><div class="p-2 bg-emerald-500/10 rounded-lg"><svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg></div></div><div class="w-full bg-darkbg rounded-full h-2"><div id="stat-disk-bar" class="bg-emerald-500 h-2 rounded-full" style="width: 0%"></div></div></div>
                                <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg flex flex-col justify-center"><div class="flex justify-between items-start mb-1"><div><p class="text-gray-400 text-sm font-medium">System Updates (APT)</p><h3 id="stat-updates-text" class="text-2xl font-bold text-white mt-1">Lade...</h3></div><div class="p-2 bg-purple-500/10 rounded-lg"><svg class="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></div></div><div id="stat-updates-sub" class="text-xs text-gray-500 mt-1 truncate">Prüfe Updates...</div></div>
                            </div>
                            <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg min-h-[300px] flex flex-col justify-center mb-6"><div class="flex justify-between items-center mb-4"><h3 class="text-white font-bold">Live Cluster Auslastung</h3><span class="text-xs text-gray-500 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live Sync</span></div><div class="relative h-full w-full min-h-[220px]"><canvas id="liveChart"></canvas></div></div>
                            <div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><h3 class="text-white font-bold mb-4">🔥 Top 5 Ressourcen-Fresser</h3><div id="top-vms-container" class="space-y-3"><p class="text-gray-400 text-sm">Lädt Live-Daten von Proxmox API...</p></div></div>
                        </div>

                        <!-- TAB 2: PBS -->
                        <div id="tab-pbs" class="flex-1 flex flex-col min-w-0 hidden opacity-0 transition-opacity duration-300">
                            <div class="mb-6 border-b border-darkborder pb-4"><h2 class="text-2xl font-bold text-white">Backup Datastores</h2><p class="text-sm text-gray-400">Live-Kapazitätsüberwachung deiner PBS Server.</p></div>
                            <div id="pbs-datastores-container" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"><div class="text-gray-500 animate-pulse">Lade PBS Daten...</div></div>
                        </div>

                        <!-- TAB 3: PMG -->
                        <div id="tab-pmg" class="flex-1 flex flex-col min-w-0 hidden opacity-0 transition-opacity duration-300">
                            <div class="mb-6 border-b border-darkborder pb-4"><h2 class="text-2xl font-bold text-white">Mail Gateway Status</h2><p class="text-sm text-gray-400">Live-Metriken deiner PMG Instanzen.</p></div>
                            <div id="pmg-nodes-container" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"><div class="text-gray-500 animate-pulse">Lade PMG Daten...</div></div>
                        </div>

                        <!-- RECHTS: JOBS -->
                        <div class="w-80 shrink-0 flex flex-col"><div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg flex-1 overflow-y-auto"><h3 class="text-white font-bold mb-4 sticky top-0 bg-darkcard pb-2 border-b border-darkborder">Letzte Jobs</h3><div id="recent-jobs-container" class="space-y-3"><p class="text-gray-400 text-sm">Lädt Job-Historie...</p></div></div></div>
                    </main>
                </div>
            </div>
            <?php include 'modals.php'; ?>
        <?php endif; ?>
    </main>

    <footer class="bg-darkcard border-t border-darkborder py-4 mt-auto z-10 w-full">
        <div class="max-w-[1600px] w-full mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-gray-500">
            <div>
                Proxmox Unified Console (PUC) &copy; <?= date('Y') ?> — Ein Open-Source Projekt.
            </div>
            <div>
                Weitere private Projekte und Infos zur PUC findest du auf 
                <a href="https://tessmann.dev" target="_blank" rel="noopener noreferrer" class="text-proxmox hover:text-orange-400 font-bold transition-colors">
                    tessmann.dev
                </a>
            </div>
        </div>
    </footer>

    <script> window.APP = { isLoggedIn: <?= $isLoggedIn ? 'true' : 'false' ?>, nodeCount: <?= $nodeCount ?>, username: '<?= htmlspecialchars($_SESSION['username'] ?? '') ?>' }; </script>
    <script src="app.js"></script>
</body>
</html>