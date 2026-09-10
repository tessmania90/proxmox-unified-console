// /home/docker/pve_dashboard/src/app.js

// ---------------------------------------------------------
// 1. HILFSFUNKTIONEN (Immer zuerst laden)
// ---------------------------------------------------------
function formatBytes(bytes) { if (!bytes || bytes === 0) return '0 GB'; const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }
function formatDate(timestamp) { if (!timestamp || timestamp === 0) return 'Nie'; const d = new Date(timestamp * 1000); return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE'); }
async function logout() { await fetch('api.php?action=logout'); window.location.href = window.location.pathname + '?t=' + Date.now(); }

// ---------------------------------------------------------
// 2. GLOBALE CHART OBJEKTE
// ---------------------------------------------------------
let liveChart = null;
let liveNetChart = null;
let perfChartObj = null; 
let netChartObj = null; 
let liveInterval = null; 
let currentGraphParams = {};
let prevGlobalTime = null;

// Initialisierung der kleinen Dashboard-Charts (sofern Container vorhanden)
document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('liveChart')?.getContext('2d');
    if(ctx) { liveChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [{ label: 'CPU (%)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, tension: 0.4, fill: true, data: [] }, { label: 'RAM (%)', borderColor: '#E57000', backgroundColor: 'rgba(229, 112, 0, 0.1)', borderWidth: 2, tension: 0.4, fill: true, data: [] }] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } }, y: { min: 0, max: 100, ticks: { color: '#9ca3af', callback: v => v + '%' }, grid: { color: '#33334d' } } }, plugins: { legend: { labels: { color: '#e2e8f0', usePointStyle: true } } } } }); }

    const ctxNet = document.getElementById('liveNetChart')?.getContext('2d');
    if(ctxNet) { liveNetChart = new Chart(ctxNet, { type: 'line', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } }, y: { min: 0, ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } } }, plugins: { legend: { labels: { color: '#e2e8f0', usePointStyle: true } } } } }); }
});

// ---------------------------------------------------------
// 3. ALLE WINDOW.* FUNKTIONEN (Modals & Actions)
// ---------------------------------------------------------
// Wir binden ALLES zwingend an "window.", damit HTML-onclick immer darauf zugreifen kann!

window.switchTab = function(tab) {
    ['pve', 'pbs', 'pmg', 'node-view'].forEach(t => { 
        const el = document.getElementById('tab-' + t); 
        const nav = document.getElementById('nav-tab-' + t); 
        if (t === tab) { 
            if(el) { el.classList.remove('hidden'); setTimeout(() => el.classList.remove('opacity-0'), 50); }
            if(nav) nav.classList.add('tab-active' + (t==='pve'?'':(t==='pbs'?'-pbs':(t==='pmg'?'-pmg':'')))); 
        } else { 
            if(el) el.classList.add('hidden', 'opacity-0'); 
            if(nav) nav.classList.remove('tab-active', 'tab-active-pbs', 'tab-active-pmg'); 
        } 
    });
    document.querySelectorAll('[id^="nav-node-"]').forEach(el => el.classList.remove('text-white', 'font-bold'));
    if(tab === 'pbs') window.fetchPbsStats(); 
    if(tab === 'pmg') window.fetchPmgStats();
}

window.openNodeView = async function(nodeId, host) {
    window.switchTab('node-view');
    document.querySelectorAll('[id^="nav-node-"]').forEach(el => el.classList.remove('text-white', 'font-bold'));
    const activeNav = document.getElementById(`nav-node-${host}`);
    if(activeNav) activeNav.classList.add('text-white', 'font-bold');
    
    const titleEl = document.getElementById('nodeViewTitle');
    if(titleEl) titleEl.innerText = 'Host: ' + host;
    
    const headerBtn = document.getElementById('nodeViewHeaderBtn');
    const backupBtn = document.getElementById('nodeViewBackupBtn');
    
    if(headerBtn) {
        const newHeaderBtn = headerBtn.cloneNode(true); headerBtn.parentNode.replaceChild(newHeaderBtn, headerBtn);
        newHeaderBtn.addEventListener('click', () => window.openLiveGraph('node', 0, host, nodeId, host));
    }
    if(backupBtn) {
        const newBackupBtn = backupBtn.cloneNode(true); backupBtn.parentNode.replaceChild(newBackupBtn, backupBtn);
        newBackupBtn.addEventListener('click', () => window.openNodeBackups(nodeId, host));
    }
    
    window.currentSelectedNodeId = nodeId; window.currentSelectedHost = host;

    const storContainer = document.getElementById('nodeStoragesContainer'); 
    if(storContainer) storContainer.innerHTML = '<div class="text-gray-500 animate-pulse">Lade Storages...</div>';
    
    const vmsBody = document.getElementById('nodeVmsTableBody'); 
    if(vmsBody) vmsBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4 animate-pulse">Lade VMs...</td></tr>';
    
    try {
        const res = await (await fetch(`api.php?action=get_node_dashboard&node_id=${nodeId}&host=${host}`)).json();
        if(res.success) {
            if(storContainer) {
                storContainer.innerHTML = '';
                res.storages.forEach(st => {
                    const pct = st.total > 0 ? ((st.used / st.total) * 100).toFixed(1) : 0;
                    storContainer.innerHTML += `<div class="bg-darkbg p-3 border border-darkborder rounded">
                        <div class="flex justify-between text-sm mb-1"><span class="font-bold text-white">${st.storage}</span><span class="text-gray-400">${pct}%</span></div>
                        <div class="w-full bg-darkcard rounded-full h-1.5 mb-1"><div class="bg-proxmox h-1.5 rounded-full" style="width: ${pct}%"></div></div>
                        <div class="text-xs text-gray-500">${st.content}</div></div>`;
                });
            }

            if(vmsBody) {
                vmsBody.innerHTML = '';
                if(res.vms.length === 0) vmsBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Keine VMs auf diesem Host.</td></tr>';
                res.vms.forEach(vm => {
                    const isRunning = vm.status === 'running'; const typeStr = vm.type === 'lxc' ? '📦 LXC' : '🖥️ QEMU';
                    const statusBadge = isRunning ? '<span class="text-green-500 font-bold">Online</span>' : '<span class="text-red-500 font-bold">Offline</span>';
                    let actionButtons = isRunning ? `<button onclick="sendVmCommand('${vm.vmid}', '${vm.host}', '${vm.type}', 'stop', ${vm.node_id})" class="text-red-500 hover:text-red-400 px-2 text-lg transition-colors">⏹️</button>` : `<button onclick="sendVmCommand('${vm.vmid}', '${vm.host}', '${vm.type}', 'start', ${vm.node_id})" class="text-green-500 hover:text-green-400 px-2 text-lg transition-colors">▶️</button>`;
                    actionButtons += `<button onclick="window.openVmSettings('${vm.vmid}', '${vm.host}', '${vm.type}', ${vm.node_id}, '${vm.name}')" class="text-gray-400 hover:text-white px-2 ml-2 border-l border-darkborder text-lg transition-colors">⚙️</button>`;
                    vmsBody.innerHTML += `<tr class="border-b border-darkborder/50 hover:bg-darkbg transition-colors"><td class="py-2 px-3 text-white font-mono">${vm.vmid}</td><td class="py-2 px-3 text-white font-bold truncate max-w-[200px]">${vm.name}</td><td class="py-2 px-3 text-gray-400 whitespace-nowrap">${typeStr}</td><td class="py-2 px-3 whitespace-nowrap">${statusBadge}</td><td class="py-2 px-3 text-right whitespace-nowrap">${actionButtons}</td></tr>`;
                });
            }
        }
    } catch(e) {}
}

window.openLiveGraph = function(targetMode, vmid, host, nodeId, name) {
    const m = document.getElementById('liveGraphModal');
    if(!m) return;
    m.classList.remove('hidden');
    currentGraphParams = { mode: targetMode, vmid: vmid, host: host, nodeId: nodeId, name: name };
    window.switchGraphTab('live');
}
window.closeLiveGraph = function() { const m = document.getElementById('liveGraphModal'); if(m) m.classList.add('hidden'); if(liveInterval) clearInterval(liveInterval); }

window.switchGraphTab = async function(tab) {
    if(liveInterval) clearInterval(liveInterval);
    ['live', 'day', 'week'].forEach(t => { 
        const b = document.getElementById('btn-graph-' + t); 
        if(b) {
            if(t === tab) { b.classList.add('border-proxmox', 'text-white'); b.classList.remove('border-transparent', 'text-gray-400'); } 
            else { b.classList.remove('border-proxmox', 'text-white'); b.classList.add('border-transparent', 'text-gray-400'); }
        }
    });
    
    const titleEl = document.getElementById('graphModalTitle');
    if(titleEl) titleEl.innerText = `${tab === 'live' ? 'Live' : (tab === 'day' ? '24h' : '7 Tage')} Performance: ${currentGraphParams.name}`;
    
    const dot = document.getElementById('graphStatusDot'); 
    const subText = document.getElementById('graphSubText');
    if(dot && subText) {
        if(tab === 'live') { dot.classList.add('animate-pulse', 'bg-green-500'); dot.classList.remove('bg-blue-500'); subText.innerText = 'Metriken werden live abgefragt.'; } 
        else { dot.classList.remove('animate-pulse', 'bg-green-500'); dot.classList.add('bg-blue-500'); subText.innerText = 'Historische RRD-Daten via Proxmox API.'; }
    }

    if(perfChartObj) perfChartObj.destroy(); if(netChartObj) netChartObj.destroy();
    
    const ctxPerfEl = document.getElementById('perfChart');
    if(ctxPerfEl) {
        const ctxPerf = ctxPerfEl.getContext('2d'); 
        perfChartObj = new Chart(ctxPerf, { type: 'line', data: { labels: [], datasets: [ { label: 'CPU (%)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: tab==='live'?3:0, data: [] }, { label: 'RAM (%)', borderColor: '#E57000', backgroundColor: 'rgba(229, 112, 0, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: tab==='live'?3:0, data: [] }]}, options: { responsive: true, maintainAspectRatio: false, animation: { duration: tab==='live'?0:500 }, scales: { x: { grid: { color: '#33334d' }, ticks: { color: '#9ca3af' } }, y: { min: 0, max: 100, grid: { color: '#33334d' }, ticks: { color: '#9ca3af' } } }, plugins: { legend: { labels: { color: '#e2e8f0' } } } } });
    }

    const ctxNetEl = document.getElementById('netChart');
    if(ctxNetEl) {
        const ctxNet = ctxNetEl.getContext('2d'); 
        netChartObj = new Chart(ctxNet, { type: 'line', data: { labels: [], datasets: [ { label: 'RX (MB/s)', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: tab==='live'?3:0, data: [] }, { label: 'TX (MB/s)', borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: tab==='live'?3:0, data: [] }]}, options: { responsive: true, maintainAspectRatio: false, animation: { duration: tab==='live'?0:500 }, scales: { x: { grid: { color: '#33334d' }, ticks: { color: '#9ca3af' } }, y: { min: 0, grid: { color: '#33334d' }, ticks: { color: '#9ca3af' } } }, plugins: { legend: { labels: { color: '#e2e8f0' } } } } });
    }

    if(tab === 'live') {
        let prevNetIn = 0; let prevNetOut = 0; let prevTime = null;
        const fetchLiveData = async () => {
            try {
                const endpoint = currentGraphParams.mode === 'node' ? `api.php?action=get_node_status&host=${currentGraphParams.host}&node_id=${currentGraphParams.nodeId}` : `api.php?action=get_vm_status&vmid=${currentGraphParams.vmid}&host=${currentGraphParams.host}&type=${currentGraphParams.mode}&node_id=${currentGraphParams.nodeId}`;
                const res = await (await fetch(endpoint)).json();
                if(res.success && res.data) {
                    const d = res.data; const now = Date.now();
                    let cpuRaw = 0; if (d.cpu !== undefined) cpuRaw = d.cpu; else if (d.cpuinfo && d.cpuinfo.cpus) cpuRaw = 0; const cpu = (cpuRaw * 100).toFixed(1);
                    let ram = 0; if (d.maxmem && d.maxmem > 0) { ram = ((d.mem / d.maxmem) * 100).toFixed(1); } else if (d.memory && d.memory.total > 0) { ram = ((d.memory.used / d.memory.total) * 100).toFixed(1); }
                    
                    let currentNetIn = d.netin || 0; let currentNetOut = d.netout || 0; 
                    let rxSpeed = 0; let txSpeed = 0;
                    if (d.is_rrd_net) { rxSpeed = (currentNetIn / (1024 * 1024)).toFixed(2); txSpeed = (currentNetOut / (1024 * 1024)).toFixed(2); } else { if(prevTime !== null) { const timeSec = (now - prevTime) / 1000; if (timeSec > 0) { rxSpeed = Math.max(0, ((currentNetIn - prevNetIn) / timeSec / (1024 * 1024))).toFixed(2); txSpeed = Math.max(0, ((currentNetOut - prevNetOut) / timeSec / (1024 * 1024))).toFixed(2); } } }
                    prevNetIn = currentNetIn; prevNetOut = currentNetOut; prevTime = now;
                    const timeStr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    
                    if(perfChartObj) { perfChartObj.data.labels.push(timeStr); perfChartObj.data.datasets[0].data.push(cpu); perfChartObj.data.datasets[1].data.push(ram); if(perfChartObj.data.labels.length > 30) { perfChartObj.data.labels.shift(); perfChartObj.data.datasets[0].data.shift(); perfChartObj.data.datasets[1].data.shift(); } perfChartObj.update(); }
                    if(netChartObj && (prevTime !== null || d.is_rrd_net)) { netChartObj.data.labels.push(timeStr); netChartObj.data.datasets[0].data.push(rxSpeed); netChartObj.data.datasets[1].data.push(txSpeed); if(netChartObj.data.labels.length > 30) { netChartObj.data.labels.shift(); netChartObj.data.datasets[0].data.shift(); netChartObj.data.datasets[1].data.shift(); } netChartObj.update(); }
                }
            } catch(e) {}
        };
        fetchLiveData(); liveInterval = setInterval(fetchLiveData, 2000);
    } else {
        try {
            const res = await (await fetch(`api.php?action=get_historical_rrd&timeframe=${tab}&target_mode=${currentGraphParams.mode}&vmid=${currentGraphParams.vmid}&host=${currentGraphParams.host}&node_id=${currentGraphParams.nodeId}`)).json();
            if(res.success && res.data) {
                res.data.forEach(d => {
                    const date = new Date(d.time * 1000); const l = tab === 'day' ? date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}) : date.toLocaleDateString('de-DE',{weekday:'short', hour:'2-digit'});
                    if(perfChartObj) { perfChartObj.data.labels.push(l); perfChartObj.data.datasets[0].data.push((d.cpu || 0) * 100); let ram = 0; if (d.maxmem > 0) { ram = ((d.mem / d.maxmem) * 100).toFixed(1); } perfChartObj.data.datasets[1].data.push(ram); }
                    if(netChartObj) { netChartObj.data.labels.push(l); netChartObj.data.datasets[0].data.push((d.netin || 0) / (1024*1024)); netChartObj.data.datasets[1].data.push((d.netout || 0) / (1024*1024)); }
                });
                if(perfChartObj) perfChartObj.update(); if(netChartObj) netChartObj.update();
            }
        } catch(e) {}
    }
}

window.openNodeBackups = async function(nodeId, host) {
    const m = document.getElementById('nodeBackupsModal');
    if(!m) return;
    m.classList.remove('hidden');
    document.getElementById('nodeBackupsTitle').innerText = 'Backup Jobs: ' + host;
    const tbody = document.getElementById('nodeBackupsTableBody'); 
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500 animate-pulse">Lade Jobs...</td></tr>';
    try {
        const res = await (await fetch(`api.php?action=get_node_backup_jobs&node_id=${nodeId}&host=${host}`)).json();
        if(res.success) {
            tbody.innerHTML = '';
            if(res.data.length === 0) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Keine Backup Jobs definiert.</td></tr>';
            res.data.forEach(j => {
                tbody.innerHTML += `<tr class="border-b border-darkborder/50 hover:bg-darkbg transition-colors">
                    <td class="py-2 px-3 text-white font-bold">${j.id}</td>
                    <td class="py-2 px-3 text-proxmox">${j.schedule || 'Manuell'}</td>
                    <td class="py-2 px-3">${j.storage}</td>
                    <td class="py-2 px-3 text-gray-400">${j.vmid || 'Alle VMs'}</td>
                    <td class="py-2 px-3 text-right"><span class="text-xs bg-darkcard border border-darkborder px-2 py-1 rounded text-gray-500">Read-Only via API</span></td>
                </tr>`;
            });
        }
    } catch(e) {}
}
window.closeNodeBackups = function() { const m = document.getElementById('nodeBackupsModal'); if(m) m.classList.add('hidden'); }

window.openCreateVm = async function() { 
    const m = document.getElementById('createVmModal'); if(!m) return;
    m.classList.remove('hidden'); 
    const select = document.getElementById('createVmHost'); 
    if(select) {
        select.innerHTML = '<option value="">Suche Hosts...</option>'; 
        try { 
            const res = await (await fetch('api.php?action=get_pve_nodes')).json(); 
            if (res.success && res.data.length > 0) { 
                select.innerHTML = ''; 
                res.data.forEach(node => { 
                    const isSelected = (window.currentSelectedHost && node.host === window.currentSelectedHost) ? 'selected' : '';
                    select.innerHTML += `<option value='{"id":${node.node_id},"host":"${node.host}"}' ${isSelected}>${node.display}</option>`; 
                }); 
            } else { select.innerHTML = '<option value="">Keine PVE-Hosts</option>'; } 
        } catch(e) {} 
    }
}
window.closeCreateVm = function() { const m = document.getElementById('createVmModal'); if(m) m.classList.add('hidden'); }

window.openVmSettings = async function(vmid, host, type, nodeId, name) { 
    const m = document.getElementById('vmSettingsModal'); if(!m) return;
    m.classList.remove('hidden'); 
    const titleEl = document.getElementById('settingsModalTitle'); if(titleEl) titleEl.innerText = 'Einstellungen: ' + name; 
    
    if(document.getElementById('setVmid')) document.getElementById('setVmid').value = vmid; 
    if(document.getElementById('setHost')) document.getElementById('setHost').value = host; 
    if(document.getElementById('setType')) document.getElementById('setType').value = type; 
    if(document.getElementById('setNodeId')) document.getElementById('setNodeId').value = nodeId; 
    
    if(document.getElementById('snapshotListContainer')) document.getElementById('snapshotListContainer').innerHTML = '<div class="text-gray-500 text-sm italic">Lade Snapshots...</div>'; 
    if(document.getElementById('backupListContainer')) document.getElementById('backupListContainer').innerHTML = '<div class="text-gray-500 text-sm italic">Lade Backups...</div>';
    
    if(type === 'qemu' && document.getElementById('setIso')) {
        document.getElementById('setIso').innerHTML = '<option value="">Lade ISOs...</option>';
        fetch(`api.php?action=get_isos&node_id=${nodeId}&host=${host}`).then(r=>r.json()).then(isoRes => {
            const s = document.getElementById('setIso'); 
            if(s) {
                s.innerHTML = '<option value="none">Kein ISO gemountet (CD auswerfen)</option>';
                if(isoRes.success) { isoRes.data.forEach(iso => s.innerHTML += `<option value="${iso}">${iso}</option>`); }
            }
        });
    }

    try { 
        const res = await (await fetch(`api.php?action=get_vm_config&vmid=${vmid}&host=${host}&type=${type}&node_id=${nodeId}`)).json(); 
        if (res.success && res.data) { 
            const cfg = res.data; 
            if(document.getElementById('setMemory')) document.getElementById('setMemory').value = cfg.memory || ''; 
            if(document.getElementById('setCores')) document.getElementById('setCores').value = cfg.cores || 1; 
            if(document.getElementById('setOnboot')) document.getElementById('setOnboot').checked = (cfg.onboot == 1);
            if(cfg.ide2 && cfg.ide2 !== 'none,media=cdrom' && document.getElementById('setIso')) { const parts = cfg.ide2.split(','); document.getElementById('setIso').value = parts[0]; }
            
            if (cfg.net0) { 
                if(document.getElementById('setRawNet0')) document.getElementById('setRawNet0').value = cfg.net0; 
                const badge = document.getElementById('netStatusBadge');
                const btn = document.getElementById('btnToggleNet');
                if(badge && btn) {
                    if (cfg.net0.includes('link_down=1')) { 
                        badge.className = 'px-2 py-1 rounded text-xs font-bold text-red-400 bg-red-500/20'; badge.innerText = 'Getrennt'; 
                        btn.innerText = 'Kabel einstecken'; btn.onclick = () => window.saveNetwork(false); 
                    } else { 
                        badge.className = 'px-2 py-1 rounded text-xs font-bold text-green-400 bg-green-500/20'; badge.innerText = 'Verbunden'; 
                        btn.innerText = 'Kabel ziehen'; btn.onclick = () => window.saveNetwork(true); 
                    } 
                }
            } else { 
                if(document.getElementById('netStatusBadge')) document.getElementById('netStatusBadge').innerText = 'Kein net0'; 
                if(document.getElementById('btnToggleNet')) document.getElementById('btnToggleNet').style.display = 'none'; 
            } 
            
            let diskName = ''; if (type === 'lxc' && cfg.rootfs) diskName = 'rootfs'; else if (cfg.scsi0) diskName = 'scsi0'; else if (cfg.virtio0) diskName = 'virtio0'; else if (cfg.ide0) diskName = 'ide0'; 
            if (diskName) { 
                if(document.getElementById('setPrimaryDisk')) document.getElementById('setPrimaryDisk').value = diskName; 
                if(document.getElementById('diskLabelName')) document.getElementById('diskLabelName').innerText = diskName; 
            } else {
                if(document.getElementById('diskLabelName')) document.getElementById('diskLabelName').innerText = 'Nicht gefunden'; 
            }
        } 
        
        // Helfer-Funktionen aufrufen (Definitionen siehe unten)
        if(typeof window.loadSnapshots === 'function') window.loadSnapshots(vmid, host, type, nodeId);
        
        const stRes = await (await fetch(`api.php?action=get_backup_storages&node_id=${nodeId}&host=${host}`)).json();
        if (stRes.success && document.getElementById('backupTargetStorage')) { 
            const bSelect = document.getElementById('backupTargetStorage'); 
            bSelect.innerHTML = ''; 
            stRes.data.forEach(st => bSelect.innerHTML += `<option value="${st}">${st}</option>`); 
        }
        
        if(typeof window.loadBackups === 'function') window.loadBackups(vmid, host, nodeId);
    } catch (e) {} 
}
window.closeVmSettings = function() { const m = document.getElementById('vmSettingsModal'); if(m) m.classList.add('hidden'); }

window.sendVmCommand = async function(vmid, host, type, cmd, nodeId) { 
    if(!confirm(`Maschine '${vmid}' wirklich ${cmd}?`)) return; 
    const fd = new FormData(); fd.append('vmid', vmid); fd.append('host', host); fd.append('type', type); fd.append('cmd', cmd); fd.append('node_id', nodeId); 
    try { 
        const res = await (await fetch('api.php?action=vm_action', { method: 'POST', body: fd })).json(); 
        if(res.success) { setTimeout(() => { if(window.currentSelectedHost === host && !document.getElementById('tab-node-view').classList.contains('hidden')) { window.openNodeView(nodeId, host); } else if(typeof window.loadVmsIntoTable === 'function') { window.loadVmsIntoTable(); } }, 2000); } 
        else alert(res.error); 
    } catch (err) {} 
}

// ---------------------------------------------------------
// 4. MAIN INIT LOGIC (Nur wenn eingeloggt)
// ---------------------------------------------------------
if (window.APP.isLoggedIn && window.APP.nodeCount > 0) {

    // Global Stats Polling
    window.fetchGlobalStats = async function() { 
        if(document.getElementById('tab-pve') && document.getElementById('tab-pve').classList.contains('hidden')) return;
        try { 
            const res = await (await fetch('api.php?action=get_stats')).json(); 
            if(res.success && res.data) { 
                const d = res.data; 
                if(document.getElementById('stat-cpu-text')) document.getElementById('stat-cpu-text').innerText = `${d.cpu_percent}% (${d.cpu_cores} Cores)`; 
                if(document.getElementById('stat-cpu-bar')) document.getElementById('stat-cpu-bar').style.width = `${d.cpu_percent}%`; 
                let ramPercent = (d.ram_used / d.ram_total) * 100 || 0; 
                if(document.getElementById('stat-ram-text')) document.getElementById('stat-ram-text').innerText = `${formatBytes(d.ram_used)} / ${formatBytes(d.ram_total)}`; 
                if(document.getElementById('stat-ram-bar')) document.getElementById('stat-ram-bar').style.width = `${ramPercent}%`; 
                let diskPercent = (d.disk_used / d.disk_total) * 100 || 0; 
                if(document.getElementById('stat-disk-text')) document.getElementById('stat-disk-text').innerText = `${formatBytes(d.disk_used)} / ${formatBytes(d.disk_total)}`; 
                if(document.getElementById('stat-disk-bar')) document.getElementById('stat-disk-bar').style.width = `${diskPercent}%`; 
                
                if (d.cluster_stats) {
                    const elNodesOn = document.getElementById('stat-nodes-online');
                    if (elNodesOn) { elNodesOn.innerText = d.cluster_stats.nodes_online; elNodesOn.className = (d.cluster_stats.nodes_online < d.cluster_stats.nodes_total) ? 'text-red-500' : 'text-green-500'; }
                    if(document.getElementById('stat-nodes-total')) document.getElementById('stat-nodes-total').innerText = d.cluster_stats.nodes_total;
                    if(document.getElementById('stat-vms-total')) document.getElementById('stat-vms-total').innerText = d.cluster_stats.vms_total;
                    if(document.getElementById('stat-vms-run')) document.getElementById('stat-vms-run').innerText = d.cluster_stats.vms_running;
                    if(document.getElementById('stat-vms-stop')) document.getElementById('stat-vms-stop').innerText = d.cluster_stats.vms_stopped;
                }

                if(liveChart) { 
                    const now = new Date(); const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0'); 
                    liveChart.data.labels.push(timeStr); liveChart.data.datasets[0].data.push(d.cpu_percent); liveChart.data.datasets[1].data.push(ramPercent.toFixed(1)); 
                    if (liveChart.data.labels.length > 15) { liveChart.data.labels.shift(); liveChart.data.datasets[0].data.shift(); liveChart.data.datasets[1].data.shift(); } liveChart.update(); 
                    
                    if(liveNetChart && d.nodes_net) { 
                        const nowTs = Date.now(); 
                        if (prevGlobalTime !== null) { 
                            liveNetChart.data.labels.push(timeStr); if (liveNetChart.data.labels.length > 15) liveNetChart.data.labels.shift(); 
                            const colors = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']; 
                            d.nodes_net.forEach((n, idx) => { 
                                let rxSpeed = n.netin / (1024 * 1024); let txSpeed = n.netout / (1024 * 1024); let totalSpeed = (rxSpeed + txSpeed).toFixed(2); 
                                let ds = liveNetChart.data.datasets.find(ds => ds.label === n.name); 
                                if (!ds) { const c = colors[idx % colors.length]; ds = { label: n.name, borderColor: c, backgroundColor: c + '1a', borderWidth: 2, tension: 0.4, fill: true, data: new Array(Math.max(0, liveNetChart.data.labels.length - 1)).fill(0) }; liveNetChart.data.datasets.push(ds); } 
                                ds.data.push(totalSpeed); if (ds.data.length > 15) ds.data.shift(); 
                            }); 
                            liveNetChart.update(); 
                        } prevGlobalTime = nowTs; 
                    } 
                }
            } 
        } catch (err) {} 
    }

    // Zusätzliche API Polling Funktionen
    window.fetchTopVms = async function() { if(!document.getElementById('top-vms-container') || (document.getElementById('tab-pve') && document.getElementById('tab-pve').classList.contains('hidden'))) return; try { const res = await (await fetch('api.php?action=get_top_vms')).json(); if(res.success && res.data) { const container = document.getElementById('top-vms-container'); container.innerHTML = ''; if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-400 text-sm">Keine aktiven VMs.</p>'; return; } res.data.forEach((vm, i) => { const cpuPercent = ((vm.cpu || 0) * 100).toFixed(1); const ramUsed = formatBytes(vm.mem || 0); const icon = vm.type === 'lxc' ? '📦' : '🖥️'; const numberColor = i === 0 ? 'text-red-500' : (i === 1 ? 'text-orange-400' : (i === 2 ? 'text-yellow-400' : 'text-gray-400')); container.innerHTML += `<div class="bg-darkbg border border-darkborder rounded-lg p-3 flex justify-between items-center transition-transform hover:scale-[1.02] cursor-default"><div class="flex items-center gap-3"><span class="font-bold text-xl ${numberColor}">#${i + 1}</span><div><h4 class="text-white font-semibold text-sm truncate w-32">${icon} ${vm.name}</h4><p class="text-xs text-gray-500">Host: ${vm.host}</p></div></div><div class="text-right"><p class="text-proxmox font-bold text-sm">${cpuPercent}% CPU</p><p class="text-xs text-gray-400">${ramUsed} RAM</p></div></div>`; }); } } catch (err) {} }
    window.fetchRecentJobs = async function() { if(!document.getElementById('recent-jobs-container')) return; try { const res = await (await fetch('api.php?action=get_recent_jobs')).json(); if(res.success && res.data) { const container = document.getElementById('recent-jobs-container'); container.innerHTML = ''; if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-400 text-sm">Keine aktuellen Jobs.</p>'; return; } res.data.forEach(job => { const jobTypeStr = job.type || job.worker_type || 'unknown'; let statusColor = 'text-gray-400', statusIcon = '⏳', statusText = job.status || 'running...'; if(statusText.toLowerCase() === 'ok') { statusColor = 'text-green-500'; statusIcon = '✅'; } else if(statusText !== 'running...') { statusColor = 'text-red-500'; statusIcon = '❌'; } else { statusColor = 'text-blue-400'; statusIcon = '🔄'; } const date = new Date(job.starttime * 1000); const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); const isBackup = jobTypeStr.includes('sync') || jobTypeStr.includes('prune') || jobTypeStr.includes('garbage_collection') || jobTypeStr.includes('vzdump') || jobTypeStr.includes('verify'); const jobTypeColor = isBackup ? 'text-purple-400' : 'text-white'; container.innerHTML += `<div class="bg-darkbg border border-darkborder rounded-lg p-3 flex justify-between items-center transition-colors hover:bg-darkborder/50"><div class="flex items-center gap-3"><div class="text-lg">${statusIcon}</div><div class="max-w-[120px]"><p class="${jobTypeColor} font-medium text-sm capitalize truncate" title="${jobTypeStr}">${jobTypeStr}</p><p class="text-xs text-gray-500 truncate" title="${job.node_name}">Host: <span class="text-proxmox">${job.node_name}</span></p></div></div><div class="text-right"><p class="${statusColor} font-bold text-sm uppercase">${statusText}</p><p class="text-xs text-gray-500">${dateStr} - ${timeStr}</p></div></div>`; }); } } catch (err) {} }

    // Start Intervals
    setInterval(window.fetchGlobalStats, 10000); 
    setInterval(window.fetchTopVms, 10000); 
    setInterval(window.fetchRecentJobs, 15000); 
    
    // Fallback Initial Calls
    window.fetchGlobalStats();
    window.fetchTopVms();
    window.fetchRecentJobs();

    // Event Listener für Formulare (Create VM)
    const createVmForm = document.getElementById('createVmForm');
    if(createVmForm) { 
        createVmForm.addEventListener('submit', async function(e) { 
            e.preventDefault(); 
            const hostDataStr = document.getElementById('createVmHost').value; 
            if(!hostDataStr) return; 
            const hostData = JSON.parse(hostDataStr); 
            const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Richte VM ein...'; 
            const fd = new FormData(); fd.append('node_id', hostData.id); fd.append('host', hostData.host); fd.append('name', document.getElementById('createVmName').value); fd.append('memory', document.getElementById('createVmRam').value); fd.append('cores', document.getElementById('createVmCores').value); 
            try { 
                const res = await (await fetch('api.php?action=create_vm', { method: 'POST', body: fd })).json(); 
                if(res.success) { 
                    alert(`Erfolgreich! VM-ID: ${res.vmid}`); createVmForm.reset(); window.closeCreateVm(); 
                    if(window.currentSelectedHost === hostData.host && !document.getElementById('tab-node-view').classList.contains('hidden')) {
                        window.openNodeView(hostData.id, hostData.host); 
                    }
                } else alert(res.error); 
            } catch(e) {} finally { btn.innerText = oTxt; } 
        }); 
    }

    // --- ALLE WEITEREN PBS / PMG / ADMIN MODAL FUNKTIONEN ---
    // (Diese Funktionen werden erst aufgerufen, wenn die entsprechenden Menüs geklickt werden,
    // daher definieren wir sie einfach am Ende, falls sie existieren.)
    
    window.openUserManager = function() { const m = document.getElementById('userManagerModal'); if(m) { m.classList.remove('hidden'); if(typeof loadUsersIntoTable === 'function') loadUsersIntoTable(); } }
    window.closeUserManager = function() { const m = document.getElementById('userManagerModal'); if(m) m.classList.add('hidden'); }
    
    window.openNodeTopology = function() { const m = document.getElementById('nodeTopologyModal'); if(m) m.classList.remove('hidden'); /* ... Lade Logik ... */ }
    window.closeNodeTopology = function() { const m = document.getElementById('nodeTopologyModal'); if(m) m.classList.add('hidden'); }

    window.openAuditLog = function() { const m = document.getElementById('auditLogModal'); if(m) m.classList.remove('hidden'); }
    window.closeAuditLog = function() { const m = document.getElementById('auditLogModal'); if(m) m.classList.add('hidden'); }

    window.openCronManager = function() { const m = document.getElementById('cronManagerModal'); if(m) m.classList.remove('hidden'); }
    window.closeCronManager = function() { const m = document.getElementById('cronManagerModal'); if(m) m.classList.add('hidden'); }

    window.openPmgManager = function(nodeId, hostName, internalName) { const m = document.getElementById('pmgManagerModal'); if(m) m.classList.remove('hidden'); }
    window.closePmgManager = function() { const m = document.getElementById('pmgManagerModal'); if(m) m.classList.add('hidden'); }

    window.openPbsDatastore = function(nodeId, storeName) { const m = document.getElementById('pbsDatastoreModal'); if(m) m.classList.remove('hidden'); }
    window.closePbsDatastore = function() { const m = document.getElementById('pbsDatastoreModal'); if(m) m.classList.add('hidden'); }

    // VM List Modal
    window.openVmManager = async function() { 
        const m = document.getElementById('vmManagerModal'); if(!m) return; m.classList.remove('hidden'); 
        const tbody = document.getElementById('vmTableBody'); if(!tbody) return; tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center animate-pulse text-gray-500">Lade VMs...</td></tr>'; 
        try { 
            const res = await (await fetch('api.php?action=get_all_vms')).json(); 
            if(res.success) { 
                tbody.innerHTML = ''; 
                if(res.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">Keine VMs.</td></tr>'; return; } 
                res.data.forEach(vm => { 
                    const isRunning = vm.status === 'running'; const typeStr = vm.type === 'lxc' ? '📦 LXC' : '🖥️ QEMU'; const statusBadge = isRunning ? '<span class="text-green-500 font-bold">Online</span>' : '<span class="text-red-500 font-bold">Offline</span>'; 
                    let actionButtons = isRunning ? `<button onclick="window.sendVmCommand('${vm.vmid}', '${vm.host}', '${vm.type}', 'stop', ${vm.node_id})" class="text-red-500 hover:text-red-400 px-2 text-lg transition-colors">⏹️</button>` : `<button onclick="window.sendVmCommand('${vm.vmid}', '${vm.host}', '${vm.type}', 'start', ${vm.node_id})" class="text-green-500 hover:text-green-400 px-2 text-lg transition-colors">▶️</button>`; 
                    actionButtons += `<button onclick="window.openVmSettings('${vm.vmid}', '${vm.host}', '${vm.type}', ${vm.node_id}, '${vm.name}')" class="text-gray-400 hover:text-white px-2 ml-2 border-l border-darkborder text-lg transition-colors">⚙️</button>`; 
                    tbody.innerHTML += `<tr class="border-b border-darkborder/50 hover:bg-darkbg transition-colors"><td class="py-2 px-3 text-white font-mono">${vm.vmid} <span class="font-bold font-sans ml-2">${vm.name}</span></td><td class="py-2 px-3 text-gray-400">${typeStr} - ${vm.host}</td><td class="py-2 px-3 text-gray-400">${vm.maxcpu||1} C / ${formatBytes(vm.maxmem||0)}</td><td class="py-2 px-3">${statusBadge}</td><td class="py-2 px-3 text-right">${actionButtons}</td></tr>`; 
                }); 
            } 
        } catch (err) {} 
    }
    window.closeVmManager = function() { const m = document.getElementById('vmManagerModal'); if(m) m.classList.add('hidden'); }
    
    // Server & API Modal
    window.openNodeManager = async function() { 
        const m = document.getElementById('nodeManagerModal'); if(!m) return; m.classList.remove('hidden'); 
        try { 
            const res = await (await fetch('api.php?action=get_nodes')).json(); 
            if(res.success) { 
                const tbody = document.getElementById('nodeTableBody'); if(!tbody) return; tbody.innerHTML = ''; 
                if(res.data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center">Keine Server.</td></tr>'; return; } 
                res.data.forEach(node => { 
                    let typeBadge = node.type === 'pbs' ? '<span class="bg-purple-500/20 text-pbs px-2 py-0.5 rounded text-xs font-bold">PBS Backup</span>' : (node.type === 'pmg' ? '<span class="bg-blue-500/20 text-pmg px-2 py-0.5 rounded text-xs font-bold">PMG Mail</span>' : '<span class="bg-proxmox/20 text-proxmox px-2 py-0.5 rounded text-xs font-bold">PVE Node</span>'); 
                    tbody.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors"><td class="px-4 py-3 font-medium text-white">${node.name}</td><td class="px-4 py-3">${typeBadge}</td><td class="px-4 py-3">${node.ip_address}</td><td class="px-4 py-3 text-right"><button onclick="deleteNode(${node.id}, '${node.name}')" class="text-red-500 hover:text-red-400 text-sm font-medium">Löschen</button></td></tr>`; 
                }); 
            } 
        } catch (err) {} 
    }
    window.closeNodeManager = function() { const m = document.getElementById('nodeManagerModal'); if(m) m.classList.add('hidden'); }
    window.toggleAddNodeForm = function() { const f = document.getElementById('addNodeFormContainer'); if(f) f.classList.toggle('hidden'); }
}