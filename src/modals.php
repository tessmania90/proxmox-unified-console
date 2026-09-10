<!-- /home/docker/pve_dashboard/src/modals.php -->
<!-- [Bestehende Modals für NodeManager, UserManager, CronManager bleiben erhalten (aus Platzgründen gekürzt, kopiere deine bestehenden Modals hier rein, falls nötig)] -->

<!-- ANGEPASST: VM SETTINGS MODAL (Erweitert um ISO & OnBoot) -->
<div id="vmSettingsModal" class="fixed inset-0 bg-black/80 hidden z-[70] flex items-center justify-center backdrop-blur-sm">
    <div class="bg-darkcard border border-darkborder rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-5 border-b border-darkborder flex justify-between items-center bg-darkbg">
            <h2 class="text-xl font-bold text-white flex items-center gap-2"><span id="settingsModalTitle">Einstellungen</span></h2>
            <button onclick="closeVmSettings()" class="text-gray-400 hover:text-white transition-colors text-2xl">✕</button>
        </div>
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
            <input type="hidden" id="setVmid"><input type="hidden" id="setHost"><input type="hidden" id="setType"><input type="hidden" id="setNodeId"><input type="hidden" id="setRawNet0"><input type="hidden" id="setPrimaryDisk">
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Spalte 1 -->
                <div class="space-y-6">
                    <div class="bg-darkbg p-5 rounded-lg border border-darkborder">
                        <h3 class="text-white font-bold mb-4">💻 Ressourcen & Boot</h3>
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div><label class="block text-xs font-medium text-gray-500 mb-1">RAM (MB)</label><input type="number" id="setMemory" class="w-full bg-darkcard border border-darkborder rounded p-2 text-white text-sm"></div>
                            <div><label class="block text-xs font-medium text-gray-500 mb-1">CPU Cores</label><input type="number" id="setCores" class="w-full bg-darkcard border border-darkborder rounded p-2 text-white text-sm"></div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-xs font-medium text-gray-500 mb-1">CD/DVD Laufwerk (ISO Mounten)</label>
                            <select id="setIso" class="w-full bg-darkcard border border-darkborder rounded p-2 text-white text-sm">
                                <option value="">Lade ISOs...</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="flex items-center gap-2 text-white text-sm cursor-pointer">
                                <input type="checkbox" id="setOnboot" class="accent-proxmox w-4 h-4"> Start at boot (Auto-Start mit PVE)
                            </label>
                        </div>
                        <button onclick="saveHardwareSettings()" class="w-full bg-proxmox hover:bg-orange-600 text-white font-bold py-2 px-4 rounded text-sm transition-colors">Alle VM-Settings Speichern</button>
                    </div>

                    <div class="bg-darkbg p-5 rounded-lg border border-darkborder">
                        <h3 class="text-white font-bold mb-4">🌐 Netzwerkverwaltung</h3>
                        <div class="flex items-center gap-3 mb-6 border-b border-darkborder pb-4">
                            <span id="netStatusBadge" class="px-2 py-1 rounded text-xs font-bold text-gray-400 bg-gray-500/20">Lade...</span>
                            <button id="btnToggleNet" onclick="toggleNetwork()" class="bg-darkcard border border-darkborder hover:border-proxmox text-white font-bold py-1.5 px-4 rounded text-sm transition-colors">Lade...</button>
                        </div>
                        <div>
                            <h4 class="text-gray-400 font-bold mb-2 text-xs uppercase">Zusätzliche NIC</h4>
                            <div class="flex items-end gap-3"><div class="flex-1"><label class="block text-xs font-medium text-gray-500 mb-1">Bridge (z.B. vmbr0)</label><input type="text" id="addNicBridge" value="vmbr0" class="w-full bg-darkcard border border-darkborder rounded p-2 text-white text-sm"></div><button onclick="addNic()" class="bg-proxmox hover:bg-orange-600 text-white font-bold py-2 px-4 rounded text-sm">+ Add</button></div>
                        </div>
                    </div>
                </div>

                <!-- Spalte 2 -->
                <div class="space-y-6">
                    <div class="bg-darkbg p-5 rounded-lg border border-darkborder border-l-4 border-l-emerald-500">
                        <h3 class="text-white font-bold mb-4">📸 Snapshots</h3>
                        <div class="flex items-end gap-3 mb-4"><div class="flex-1"><input type="text" id="newSnapName" placeholder="Name" class="w-full bg-darkcard border border-darkborder rounded p-2 text-white text-sm"></div><button onclick="createSnapshot()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-sm transition-colors">+ Create</button></div>
                        <div class="space-y-2 mt-4 max-h-40 overflow-y-auto" id="snapshotListContainer"></div>
                    </div>
                    <div class="bg-darkbg p-5 rounded-lg border border-darkborder border-l-4 border-l-pbs">
                        <h3 class="text-white font-bold mb-4">🛡️ Backup (vzdump)</h3>
                        <div class="flex items-end gap-3 mb-4 border-b border-darkborder pb-4"><div class="flex-1"><select id="backupTargetStorage" class="w-full bg-darkcard border border-darkborder rounded p-2 text-white text-sm"></select></div><button onclick="createBackup()" class="bg-pbs hover:bg-purple-500 text-white font-bold py-2 px-4 rounded text-sm transition-colors">Backup</button></div>
                        <div class="space-y-2 max-h-40 overflow-y-auto" id="backupListContainer"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- NEU: NODE BACKUP JOBS MODAL -->
<div id="nodeBackupsModal" class="fixed inset-0 bg-black/80 hidden z-[75] flex items-center justify-center backdrop-blur-sm">
    <div class="bg-darkcard border border-darkborder rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[80vh]">
        <div class="p-5 border-b border-darkborder flex justify-between items-center bg-darkbg">
            <h2 class="text-xl font-bold text-white" id="nodeBackupsTitle">Backup Jobs</h2>
            <button onclick="closeNodeBackups()" class="text-gray-400 hover:text-white transition-colors text-2xl">✕</button>
        </div>
        <div class="p-6 overflow-y-auto flex-1 bg-darkbg">
            <div class="bg-darkcard border border-darkborder rounded-xl shadow-lg">
                <table class="w-full text-left text-sm text-gray-400">
                    <thead class="bg-darkbg text-xs uppercase border-b border-darkborder">
                        <tr><th class="py-3 px-4">ID</th><th class="py-3 px-4">Schedule</th><th class="py-3 px-4">Storage</th><th class="py-3 px-4">VMs</th><th class="py-3 px-4 text-right">Info</th></tr>
                    </thead>
                    <tbody id="nodeBackupsTableBody" class="divide-y divide-darkborder/50"></tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- [Die restlichen Modal-Container (liveGraphModal, taskLogModal, cronManagerModal etc.) bleiben wie sie waren.] -->
<div id="createVmModal" class="fixed inset-0 bg-black/80 hidden z-[80] flex items-center justify-center backdrop-blur-sm"><div class="bg-darkcard border border-darkborder rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"><div class="p-5 border-b border-darkborder flex justify-between items-center bg-darkbg"><h2 class="text-xl font-bold text-white">✨ Neue VM erstellen</h2><button onclick="closeCreateVm()" class="text-gray-400 hover:text-white transition-colors">✕</button></div><div class="p-6"><form id="createVmForm" class="space-y-4"><div><label class="block text-xs font-medium text-gray-500 mb-1">Ziel-Host</label><select id="createVmHost" class="w-full bg-darkbg border border-darkborder rounded p-2 text-white text-sm" required></select></div><div><label class="block text-xs font-medium text-gray-500 mb-1">Name der VM</label><input type="text" id="createVmName" class="w-full bg-darkbg border border-darkborder rounded p-2 text-white text-sm" required></div><div class="grid grid-cols-2 gap-4"><div><label class="block text-xs font-medium text-gray-500 mb-1">RAM (MB)</label><input type="number" id="createVmRam" value="2048" class="w-full bg-darkbg border border-darkborder rounded p-2 text-white text-sm" required></div><div><label class="block text-xs font-medium text-gray-500 mb-1">CPU Cores</label><input type="number" id="createVmCores" value="2" class="w-full bg-darkbg border border-darkborder rounded p-2 text-white text-sm" required></div></div><button type="submit" class="w-full bg-proxmox hover:bg-orange-600 text-white font-bold py-3 rounded mt-4 transition-colors">Erstellen</button></form></div></div></div>

<div id="liveGraphModal" class="fixed inset-0 bg-black/90 hidden z-[90] flex items-center justify-center backdrop-blur-md"><div class="bg-darkcard border border-darkborder rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]"><div class="p-5 border-b border-darkborder flex justify-between items-center bg-darkbg"><h2 class="text-xl font-bold text-white flex items-center gap-2"><span id="graphStatusDot" class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span id="graphModalTitle">Performance</span></h2><button onclick="closeLiveGraph()" class="text-gray-400 hover:text-white transition-colors text-2xl">✕</button></div><div class="flex border-b border-darkborder bg-darkbg px-5 pt-4"><button onclick="switchGraphTab('live')" id="btn-graph-live" class="px-4 py-2 border-b-2 border-proxmox text-white font-bold">Live</button><button onclick="switchGraphTab('day')" id="btn-graph-day" class="px-4 py-2 border-b-2 border-transparent text-gray-400 hover:text-white font-bold">24h</button></div><div class="p-6 bg-darkbg overflow-y-auto"><div class="grid grid-cols-1 lg:grid-cols-2 gap-6"><div class="bg-darkcard border border-darkborder rounded-xl p-4 shadow-lg"><h3 class="text-white font-bold mb-3 text-sm">CPU & RAM (%)</h3><div class="relative w-full h-[250px]"><canvas id="perfChart"></canvas></div></div><div class="bg-darkcard border border-darkborder rounded-xl p-4 shadow-lg"><h3 class="text-white font-bold mb-3 text-sm">Netzwerk Traffic</h3><div class="relative w-full h-[250px]"><canvas id="netChart"></canvas></div></div></div></div></div></div>