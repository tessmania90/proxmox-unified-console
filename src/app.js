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

document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('liveChart')?.getContext('2d');
    if(ctx) { liveChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [{ label: 'CPU (%)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, tension: 0.4, fill: true, data: [] }, { label: 'RAM (%)', borderColor: '#E57000', backgroundColor: 'rgba(229, 112, 0, 0.1)', borderWidth: 2, tension: 0.4, fill: true, data: [] }] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } }, y: { min: 0, max: 100, ticks: { color: '#9ca3af', callback: v => v + '%' }, grid: { color: '#33334d' } } }, plugins: { legend: { labels: { color: '#e2e8f0', usePointStyle: true } } } } }); }

    const ctxNet = document.getElementById('liveNetChart')?.getContext('2d');
    if(ctxNet) { liveNetChart = new Chart(ctxNet, { type: 'line', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } }, y: { min: 0, ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } } }, plugins: { legend: { labels: { color: '#e2e8f0', usePointStyle: true } } } } }); }
});

// ---------------------------------------------------------
// 3. LOGIN & SETUP ROUTING (Mit Debugging)
// ---------------------------------------------------------
if (!window.APP.isLoggedIn) {
    const loginForm = document.getElementById('loginForm');
    if(loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = this.querySelector('button[type="submit"]');
            const oTxt = btn.innerText;
            btn.innerText = 'Prüfe...';
            const fd = new FormData();
            fd.append('username', document.getElementById('loginUser').value);
            fd.append('password', document.getElementById('loginPass').value);
            try {
                // Wir laden den Response erst als reinen Text, um eventuelle PHP-Fehler abzufangen
                const response = await fetch('api.php?action=login', { method: 'POST', body: fd });
                const text = await response.text(); 
                try {
                    const res = JSON.parse(text);
                    if(res.success) {
                        btn.innerText = 'Erfolgreich! Lade...';
                        // Cache-Busting zwingt den Browser zum Neuladen
                        window.location.href = window.location.pathname + '?t=' + Date.now(); 
                    } else {
                        alert(res.error);
                        btn.innerText = oTxt;
                    }
                } catch(parseErr) {
                    alert('API Fehler (Kein JSON). PHP Output: ' + text);
                    btn.innerText = oTxt;
                }
            } catch (e) {
                alert('Netzwerkfehler.');
                btn.innerText = oTxt;
            }
        });
    }
} else if (window.APP.nodeCount === 0) {
    const setupForm = document.getElementById('setupForm');
    if(setupForm) { setupForm.addEventListener('submit', async function(e) { e.preventDefault(); const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Verbinde...'; const fd = new FormData(); fd.append('name', document.getElementById('nodeName').value); fd.append('ip', document.getElementById('nodeIp').value); fd.append('user', document.getElementById('nodeUser').value); fd.append('pass', document.getElementById('nodePass').value); fd.append('type', 'pve'); try { const res = await (await fetch('api.php?action=add_node', { method: 'POST', body: fd })).json(); if(res.success) { btn.innerText = 'Erfolgreich!'; setTimeout(() => window.location.reload(), 1000); } else { alert(res.error); btn.innerText = oTxt; } } catch (e) { alert('Netzwerkfehler.'); btn.innerText = oTxt; } }); }
}

// ---------------------------------------------------------
// 4. MAIN APP LOGIC (Nur wenn eingeloggt und Nodes da sind)
// ---------------------------------------------------------
if (window.APP.isLoggedIn && window.APP.nodeCount > 0) {
    
    // UI Helpers (Audit Log Button Injection)
    if (window.APP.username === 'admin' || document.querySelector('a[onclick="openUserManager()"]')) {
        const userBtn = document.querySelector('a[onclick="openUserManager()"]');
        if (userBtn && !document.getElementById('btnAuditLog')) {
            const auditBtnHTML = `<a href="#" id="btnAuditLog" onclick="openAuditLog()" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> Audit Log</a>`;
            userBtn.insertAdjacentHTML('afterend', auditBtnHTML);
        }
    }

    // Password Modal
    window.openPasswordModal = function() { const m = document.getElementById('passwordModal'); if(m) { m.classList.remove('hidden'); document.getElementById('changePasswordForm').reset(); } }
    window.closePasswordModal = function() { const m = document.getElementById('passwordModal'); if(m) m.classList.add('hidden'); }
    const pwdForm = document.getElementById('changePasswordForm');
    if(pwdForm) {
        pwdForm.addEventListener('submit', async function(e) {
            e.preventDefault(); const oldP = document.getElementById('oldPassword').value; const newP = document.getElementById('newPassword').value; const confirmP = document.getElementById('newPasswordConfirm').value;
            if (newP !== confirmP) { alert('Die neuen Passwörter stimmen nicht überein!'); return; }
            const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Speichere...';
            const fd = new FormData(); fd.append('old_password', oldP); fd.append('new_password', newP);
            try { const res = await (await fetch('api.php?action=change_password', {method: 'POST', body: fd})).json(); if(res.success) { alert('Passwort erfolgreich geändert! Bitte neu anmelden.'); closePasswordModal(); logout(); } else { alert(res.error || 'Fehler beim Ändern des Passworts.'); } } catch(err) { alert('Netzwerkfehler.'); } finally { btn.innerText = oTxt; }
        });
    }

    // Sidebar Nodes laden
    async function loadSidebarNodes() {
        const container = document.getElementById('sidebar-pve-nodes'); if(!container) return;
        try {
            const res = await (await fetch('api.php?action=get_pve_nodes')).json();
            if(res.success && res.data) {
                container.innerHTML = '';
                res.data.forEach(n => {
                    container.innerHTML += `<a href="#" id="nav-node-${n.host}" onclick="window.openNodeView(${n.node_id}, '${n.host}')" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 pl-8 pr-3 py-1.5 rounded-r-lg transition-colors text-sm">🖥️ ${n.display}</a>`;
                });
            }
        } catch(e) {}
    }
    loadSidebarNodes();

    // Tab Switching System
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

    // Node-Specific Dashboard (PVE)
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
                        let actionButtons = isRunning ? `<button onclick="window.sendVmCommand('${vm.vmid}', '${vm.host}', '${vm.type}', 'stop', ${vm.node_id})" class="text-red-500 hover:text-red-400 px-2 text-lg transition-colors">⏹️</button>` : `<button onclick="window.sendVmCommand('${vm.vmid}', '${vm.host}', '${vm.type}', 'start', ${vm.node_id})" class="text-green-500 hover:text-green-400 px-2 text-lg transition-colors">▶️</button>`;
                        actionButtons += `<button onclick="window.openVmSettings('${vm.vmid}', '${vm.host}', '${vm.type}', ${vm.node_id}, '${vm.name}')" class="text-gray-400 hover:text-white px-2 ml-2 border-l border-darkborder text-lg transition-colors">⚙️</button>`;
                        vmsBody.innerHTML += `<tr class="border-b border-darkborder/50 hover:bg-darkbg transition-colors"><td class="py-2 px-3 text-white font-mono">${vm.vmid}</td><td class="py-2 px-3 text-white font-bold truncate max-w-[200px]">${vm.name}</td><td class="py-2 px-3 text-gray-400 whitespace-nowrap">${typeStr}</td><td class="py-2 px-3 whitespace-nowrap">${statusBadge}</td><td class="py-2 px-3 text-right whitespace-nowrap">${actionButtons}</td></tr>`;
                    });
                }
            }
        } catch(e) {}
    }

    // Graph & Performance Modal
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

    // Node Backups Modal
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

    // VM Erstellung
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

    // Global Stats Polling (Cluster Dashboard)
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

    window.fetchTopVms = async function() { if(!document.getElementById('top-vms-container') || (document.getElementById('tab-pve') && document.getElementById('tab-pve').classList.contains('hidden'))) return; try { const res = await (await fetch('api.php?action=get_top_vms')).json(); if(res.success && res.data) { const container = document.getElementById('top-vms-container'); container.innerHTML = ''; if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-400 text-sm">Keine aktiven VMs.</p>'; return; } res.data.forEach((vm, i) => { const cpuPercent = ((vm.cpu || 0) * 100).toFixed(1); const ramUsed = formatBytes(vm.mem || 0); const icon = vm.type === 'lxc' ? '📦' : '🖥️'; const numberColor = i === 0 ? 'text-red-500' : (i === 1 ? 'text-orange-400' : (i === 2 ? 'text-yellow-400' : 'text-gray-400')); container.innerHTML += `<div class="bg-darkbg border border-darkborder rounded-lg p-3 flex justify-between items-center transition-transform hover:scale-[1.02] cursor-default"><div class="flex items-center gap-3"><span class="font-bold text-xl ${numberColor}">#${i + 1}</span><div><h4 class="text-white font-semibold text-sm truncate w-32">${icon} ${vm.name}</h4><p class="text-xs text-gray-500">Host: ${vm.host}</p></div></div><div class="text-right"><p class="text-proxmox font-bold text-sm">${cpuPercent}% CPU</p><p class="text-xs text-gray-400">${ramUsed} RAM</p></div></div>`; }); } } catch (err) {} }
    window.fetchRecentJobs = async function() { if(!document.getElementById('recent-jobs-container')) return; try { const res = await (await fetch('api.php?action=get_recent_jobs')).json(); if(res.success && res.data) { const container = document.getElementById('recent-jobs-container'); container.innerHTML = ''; if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-400 text-sm">Keine aktuellen Jobs.</p>'; return; } res.data.forEach(job => { const jobTypeStr = job.type || job.worker_type || 'unknown'; let statusColor = 'text-gray-400', statusIcon = '⏳', statusText = job.status || 'running...'; if(statusText.toLowerCase() === 'ok') { statusColor = 'text-green-500'; statusIcon = '✅'; } else if(statusText !== 'running...') { statusColor = 'text-red-500'; statusIcon = '❌'; } else { statusColor = 'text-blue-400'; statusIcon = '🔄'; } const date = new Date(job.starttime * 1000); const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); const isBackup = jobTypeStr.includes('sync') || jobTypeStr.includes('prune') || jobTypeStr.includes('garbage_collection') || jobTypeStr.includes('vzdump') || jobTypeStr.includes('verify'); const jobTypeColor = isBackup ? 'text-purple-400' : 'text-white'; container.innerHTML += `<div class="bg-darkbg border border-darkborder rounded-lg p-3 flex justify-between items-center transition-colors hover:bg-darkborder/50"><div class="flex items-center gap-3"><div class="text-lg">${statusIcon}</div><div class="max-w-[120px]"><p class="${jobTypeColor} font-medium text-sm capitalize truncate" title="${jobTypeStr}">${jobTypeStr}</p><p class="text-xs text-gray-500 truncate" title="${job.node_name}">Host: <span class="text-proxmox">${job.node_name}</span></p></div></div><div class="text-right"><p class="${statusColor} font-bold text-sm uppercase">${statusText}</p><p class="text-xs text-gray-500">${dateStr} - ${timeStr}</p></div></div>`; }); } } catch (err) {} }

    window.sendVmCommand = async function(vmid, host, type, cmd, nodeId) { 
        if(!confirm(`Maschine '${vmid}' wirklich ${cmd}?`)) return; 
        const fd = new FormData(); fd.append('vmid', vmid); fd.append('host', host); fd.append('type', type); fd.append('cmd', cmd); fd.append('node_id', nodeId); 
        try { 
            const res = await (await fetch('api.php?action=vm_action', { method: 'POST', body: fd })).json(); 
            if(res.success) { setTimeout(() => { if(window.currentSelectedHost === host && !document.getElementById('tab-node-view').classList.contains('hidden')) { window.openNodeView(nodeId, host); } else if(typeof window.loadVmsIntoTable === 'function') { window.loadVmsIntoTable(); } }, 2000); } 
            else alert(res.error); 
        } catch (err) {} 
    }

    // VM Settings Modal
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
    window.saveHardwareSettings = async function() { 
        const fd = new FormData(); 
        fd.append('vmid', document.getElementById('setVmid').value); fd.append('host', document.getElementById('setHost').value); fd.append('type', document.getElementById('setType').value); fd.append('node_id', document.getElementById('setNodeId').value); 
        fd.append('memory', document.getElementById('setMemory').value); fd.append('cores', document.getElementById('setCores').value); 
        fd.append('onboot', document.getElementById('setOnboot').checked ? 1 : 0);
        if(document.getElementById('setType').value === 'qemu') { fd.append('ide2', document.getElementById('setIso').value); }
        
        const res = await (await fetch('api.php?action=update_vm_config', { method: 'POST', body: fd })).json(); 
        if(res.success) { alert('Gespeichert!'); if(window.currentSelectedHost) window.openNodeView(fd.get('node_id'), fd.get('host')); } else alert(res.error); 
    }

    // --- WEITERE PBS FUNKTIONEN ---
    window.fetchPbsStats = async function() { if(document.getElementById('tab-pbs') && document.getElementById('tab-pbs').classList.contains('hidden')) return; try { const res = await (await fetch('api.php?action=get_pbs_stats')).json(); if(res.success) { const container = document.getElementById('pbs-datastores-container'); if(!container) return; if(res.data.length === 0) { container.innerHTML = '<div class="col-span-full text-center text-gray-500 p-10 bg-darkcard rounded-lg border border-darkborder">Keine PBS Server gefunden.</div>'; return; } container.innerHTML = ''; res.data.forEach(ds => { const total = ds.total || 0; const used = ds.used || 0; const percent = total > 0 ? ((used / total) * 100).toFixed(1) : 0; const colorClass = percent > 85 ? 'bg-red-500' : (percent > 70 ? 'bg-orange-500' : 'bg-pbs'); container.innerHTML += `<div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg hover:border-pbs cursor-pointer transition-colors" onclick="window.openPbsDatastore(${ds.node_id}, '${ds.store}')"><div class="flex justify-between items-start mb-4"><div><h3 class="text-lg font-bold text-white">${ds.store}</h3><p class="text-xs text-gray-400">PBS Host: ${ds.host}</p></div><div class="p-2 bg-purple-500/10 rounded-lg"><svg class="w-6 h-6 text-pbs" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg></div></div><div class="mb-2 flex justify-between text-sm"><span class="text-gray-400">Auslastung</span><span class="text-white font-bold">${percent}%</span></div><div class="w-full bg-darkbg rounded-full h-2 mb-3"><div class="${colorClass} h-2 rounded-full transition-all duration-1000" style="width: ${percent}%"></div></div><div class="flex justify-between text-xs text-gray-500"><span>Used: ${formatBytes(used)}</span><span>Total: ${formatBytes(total)}</span></div></div>`; }); } } catch(e) {} }
    window.openPbsDatastore = async function(nodeId, storeName) { if (!nodeId) return alert('Node ID fehlt.'); const m = document.getElementById('pbsDatastoreModal'); if(!m) return; m.classList.remove('hidden'); document.getElementById('pbsModalTitle').innerText = 'Datastore: ' + storeName; document.getElementById('pbsNodeId').value = nodeId; document.getElementById('pbsStoreName').value = storeName; loadPbsBackups(nodeId, storeName); loadPbsJobs(nodeId, storeName); loadPbsSyncJobs(nodeId); }
    window.closePbsDatastore = function() { const m = document.getElementById('pbsDatastoreModal'); if(m) m.classList.add('hidden'); }
    async function loadPbsBackups(nodeId, storeName) { const container = document.getElementById('pbsBackupsContainer'); if(!container) return; container.innerHTML = '<p class="text-gray-500 animate-pulse">Durchsuche Namespaces nach Backups...</p>'; try { const res = await (await fetch(`api.php?action=pbs_get_datastore_content&node_id=${nodeId}&store=${storeName}`)).json(); if(res.success && res.data) { if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm">Keine Backups vorhanden.</p>'; return; } container.innerHTML = ''; res.data.sort((a,b) => b['backup-time'] - a['backup-time']).forEach(b => { const timeStr = formatDate(b['backup-time']); const sizeStr = formatBytes(b.size); const nsLabel = b.ns ? `<span class="text-pbs font-normal ml-2">[${b.ns}]</span>` : `<span class="text-gray-500 font-normal ml-2">[Root]</span>`; container.innerHTML += `<div class="flex justify-between items-center bg-darkbg p-2 border border-darkborder rounded mb-2 hover:border-pbs transition-colors"><div><p class="text-white text-xs font-bold">${b['backup-type']} / ${b['backup-id']} ${nsLabel}</p><p class="text-xs text-gray-500">${timeStr} | ${sizeStr}</p></div><button onclick="window.deletePbsSnapshot('${b['backup-type']}', '${b['backup-id']}', ${b['backup-time']}, '${b.ns || ''}')" class="text-red-500 hover:text-white text-xs font-bold px-3 py-1 bg-red-500/10 hover:bg-red-500 rounded transition-colors">Löschen</button></div>`; }); } } catch(e) { container.innerHTML = 'Fehler beim Laden.'; } }
    window.deletePbsSnapshot = async function(btype, bid, btime, ns) { if(!confirm(`Backup ${btype}/${bid} wirklich löschen?`)) return; const fd = new FormData(); fd.append('node_id', document.getElementById('pbsNodeId').value); fd.append('store', document.getElementById('pbsStoreName').value); fd.append('btype', btype); fd.append('bid', bid); fd.append('btime', btime); fd.append('ns', ns); const res = await (await fetch('api.php?action=pbs_delete_snapshot', {method: 'POST', body: fd})).json(); if(res.success) { loadPbsBackups(document.getElementById('pbsNodeId').value, document.getElementById('pbsStoreName').value); } else alert('Fehler beim Löschen.'); }
    async function loadPbsJobs(nodeId, storeName) { const mixCont = document.getElementById('pbsVerifyGcContainer'); if(!mixCont) return; mixCont.innerHTML = '<p class="text-gray-500 animate-pulse">Lade System-Jobs...</p>'; const table = document.getElementById('pbsJobsTable'); table.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Lade Historie...</td></tr>'; try { const res = await (await fetch(`api.php?action=pbs_get_jobs&node_id=${nodeId}`)).json(); if(res.success && res.data) { mixCont.innerHTML = ''; table.innerHTML = ''; let mixCount = 0; res.data.sort((a,b) => b.starttime - a.starttime).forEach(job => { const statusColor = job.status === 'OK' ? 'text-green-500' : (job.status ? 'text-red-500' : 'text-blue-400'); const timeStr = formatDate(job.starttime); const runtime = job.endtime ? (Math.round(job.endtime - job.starttime) + 's') : 'Running...'; const isSystemJob = job.worker_type === 'verify' || job.worker_type === 'garbage_collection' || job.worker_type === 'prune'; if (isSystemJob && mixCount < 6) { mixCont.innerHTML += `<div class="flex justify-between items-center bg-darkbg p-2 border border-darkborder rounded mb-1"><div><p class="text-white text-xs font-bold uppercase">${job.worker_type}</p><p class="text-xs text-gray-500">${timeStr}</p></div><div class="flex items-center gap-2"><span class="${statusColor} font-bold text-xs uppercase mr-2">${job.status || 'Active'}</span><button onclick="window.openTaskLog('${job.upid}', ${nodeId}, 'localhost')" class="text-gray-400 hover:text-white text-xs bg-darkcard px-2 py-1 rounded border border-darkborder transition-colors">📄 Log</button></div></div>`; mixCount++; } table.innerHTML += `<tr class="hover:bg-darkbg transition-colors border-b border-darkborder/50"><td class="px-4 py-2">${timeStr}</td><td class="px-4 py-2 font-medium text-white">${job.worker_type}</td><td class="px-4 py-2 ${statusColor} font-bold uppercase">${job.status || 'Active'}</td><td class="px-4 py-2">${runtime}</td><td class="px-4 py-2 text-right"><button onclick="window.openTaskLog('${job.upid}', ${nodeId}, 'localhost')" class="text-pbs hover:text-white font-bold text-xs transition-colors">Ansehen</button></td></tr>`; }); if(mixCount === 0) mixCont.innerHTML = '<p class="text-gray-500 text-xs italic">Keine System-Jobs gefunden.</p>'; if(res.data.length === 0) table.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Keine Historie gefunden.</td></tr>'; } } catch(e) {} }
    async function loadPbsSyncJobs(nodeId) { const container = document.getElementById('pbsSyncContainer'); if(!container) return; container.innerHTML = '<p class="text-gray-500 animate-pulse">Lade Sync-Jobs...</p>'; try { const res = await (await fetch(`api.php?action=pbs_get_sync_jobs&node_id=${nodeId}`)).json(); if(res.success && res.data) { if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm">Keine Sync-Jobs eingerichtet.</p>'; return; } container.innerHTML = ''; res.data.forEach(sync => { container.innerHTML += `<div class="bg-darkbg p-3 border border-darkborder rounded mb-2 hover:border-blue-500 transition-colors"><h4 class="text-white text-sm font-bold truncate">${sync.id}</h4><p class="text-xs text-gray-400 mt-1">Quelle: <span class="text-blue-400">${sync.remote || 'Lokal'} -> ${sync['remote-store']}</span></p><p class="text-xs text-gray-400">Ziel: <span class="text-emerald-400">${sync.store}</span></p><div class="mt-2 text-xs text-gray-500 bg-darkcard p-1.5 rounded inline-block">Zeitplan: ${sync.schedule || 'Manuell'}</div></div>`; }); } } catch(e) { container.innerHTML = 'Fehler.'; } }

    // --- PMG FUNKTIONEN ---
    window.fetchPmgStats = async function() { if(document.getElementById('tab-pmg') && document.getElementById('tab-pmg').classList.contains('hidden')) return; try { const res = await (await fetch('api.php?action=get_pmg_stats')).json(); if(res.success) { const container = document.getElementById('pmg-nodes-container'); if(!container) return; if(res.data.length === 0) { container.innerHTML = '<div class="col-span-full text-center text-gray-500 p-10 bg-darkcard rounded-lg border border-darkborder">Keine Mail Gateways angebunden.</div>'; return; } container.innerHTML = ''; res.data.forEach(pmg => { const cpuPercent = ((pmg.cpu || 0) * 100).toFixed(1); const ramPercent = pmg.memory && pmg.memory.total ? ((pmg.memory.used / pmg.memory.total) * 100).toFixed(1) : 0; const diskPercent = pmg.rootfs && pmg.rootfs.total ? ((pmg.rootfs.used / pmg.rootfs.total) * 100).toFixed(1) : 0; container.innerHTML += `<div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg hover:border-pmg cursor-pointer transition-colors" onclick="window.openPmgManager(${pmg.node_id}, '${pmg.host}', '${pmg.internal_name}')"><div class="flex justify-between items-start mb-4"><div><h3 class="text-lg font-bold text-white">${pmg.host}</h3><p class="text-xs text-green-400">Online</p></div><div class="p-2 bg-blue-500/10 rounded-lg"><svg class="w-6 h-6 text-pmg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg></div></div><div class="mb-1 flex justify-between text-xs"><span class="text-gray-400">CPU</span><span class="text-white font-bold">${cpuPercent}%</span></div><div class="w-full bg-darkbg rounded-full h-1.5 mb-3"><div class="bg-blue-500 h-1.5 rounded-full" style="width: ${cpuPercent}%"></div></div><div class="mb-1 flex justify-between text-xs"><span class="text-gray-400">RAM</span><span class="text-white font-bold">${ramPercent}%</span></div><div class="w-full bg-darkbg rounded-full h-1.5 mb-3"><div class="bg-proxmox h-1.5 rounded-full" style="width: ${ramPercent}%"></div></div><div class="mb-1 flex justify-between text-xs"><span class="text-gray-400">System Disk</span><span class="text-white font-bold">${diskPercent}%</span></div><div class="w-full bg-darkbg rounded-full h-1.5"><div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${diskPercent}%"></div></div></div>`; }); } } catch(e) {} }
    window.openPmgManager = function(nodeId, hostName, internalName) { const m = document.getElementById('pmgManagerModal'); if(!m) return; m.classList.remove('hidden'); document.getElementById('pmgModalTitle').innerText = 'Mail Gateway: ' + hostName; document.getElementById('pmgNodeId').value = nodeId; document.getElementById('pmgHostName').value = hostName; document.getElementById('pmgInternalName').value = internalName; window.switchPmgTab('spam'); }
    window.closePmgManager = function() { const m = document.getElementById('pmgManagerModal'); if(m) m.classList.add('hidden'); }
    window.switchPmgTab = function(tabName) { ['spam', 'tracking', 'queues', 'settings'].forEach(t => { const btn = document.getElementById('btn-pmg-' + t); const content = document.getElementById('pmg-tab-' + t); if(btn && content) { if (t === tabName) { btn.classList.add('border-pmg', 'text-white'); btn.classList.remove('border-transparent', 'text-gray-400'); content.classList.remove('hidden'); } else { btn.classList.remove('border-pmg', 'text-white'); btn.classList.add('border-transparent', 'text-gray-400'); content.classList.add('hidden'); } } }); const nodeId = document.getElementById('pmgNodeId').value; if (!nodeId) return; if(tabName === 'spam') window.loadPmgSpamQueue(nodeId); if(tabName === 'tracking') window.loadPmgTracking(); if(tabName === 'queues') window.loadPmgQueues(); if(tabName === 'settings') { window.loadPmgConfig(nodeId); window.loadPmgSsl(nodeId); window.loadPmgDomains(nodeId); window.loadPmgNetworks(nodeId); } }
    window.loadPmgSpamQueue = async function(nodeId) { const table = document.getElementById('pmgSpamTable'); if(!table) return; table.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-500 animate-pulse">Lade Spam Quarantäne...</td></tr>'; try { const res = await (await fetch(`api.php?action=pmg_get_spam_queue&node_id=${nodeId}`)).json(); if(res.success && res.data) { table.innerHTML = ''; if(res.data.length === 0) { table.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-500">🎉 Keine Mails in der Quarantäne.</td></tr>'; return; } res.data.sort((a,b) => b.time - a.time).forEach(mail => { const timeStr = formatDate(mail.time); const subject = mail.subject || 'Kein Betreff'; const sender = mail.sender || 'Unbekannt'; const receiver = mail.receiver || 'Unbekannt'; const score = mail.spamlevel || 0; table.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors border-b border-darkborder/50"><td class="px-4 py-3 whitespace-nowrap">${timeStr}</td><td class="px-4 py-3 text-white truncate max-w-[200px]" title="${sender}">${sender}</td><td class="px-4 py-3 text-gray-300 truncate max-w-[200px]" title="${receiver}">${receiver}</td><td class="px-4 py-3 truncate max-w-[250px]" title="${subject}">${subject}</td><td class="px-4 py-3 text-red-400 font-bold text-center">${score}</td><td class="px-4 py-3 text-right whitespace-nowrap"><button onclick="window.pmgSpamAction('deliver', '${mail.id}')" class="text-green-500 hover:text-white px-2 py-1.5 bg-green-500/10 hover:bg-green-500 rounded text-xs font-bold transition-colors mr-2">Deliver</button><button onclick="window.pmgSpamAction('delete', '${mail.id}')" class="text-red-500 hover:text-white px-2 py-1.5 bg-red-500/10 hover:bg-red-500 rounded text-xs font-bold transition-colors">Delete</button></td></tr>`; }); } else { table.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-red-500">Fehler beim Laden.</td></tr>'; } } catch(e) { table.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-red-500">Netzwerkfehler.</td></tr>'; } }
    window.pmgSpamAction = async function(actionType, mailId) { if(actionType === 'delete' && !confirm('Mail unwiderruflich löschen?')) return; if(actionType === 'deliver' && !confirm('Soll diese Mail zugestellt werden?')) return; const fd = new FormData(); fd.append('node_id', document.getElementById('pmgNodeId').value); fd.append('pmg_action', actionType); fd.append('mailid', mailId); try { const res = await (await fetch('api.php?action=pmg_quarantine_action', {method: 'POST', body: fd})).json(); if(res.success) window.loadPmgSpamQueue(document.getElementById('pmgNodeId').value); else alert('Aktion fehlgeschlagen.'); } catch(e) { alert('Netzwerkfehler'); } }
    window.loadPmgTracking = async function() { const nodeId = document.getElementById('pmgNodeId').value; const internalName = document.getElementById('pmgInternalName').value; const filter = document.getElementById('pmgTrackingFilter').value.trim(); const table = document.getElementById('pmgTrackingTable'); if(!table) return; table.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500 animate-pulse">Lese Syslog (Letzte 24h)...</td></tr>'; try { const res = await (await fetch(`api.php?action=pmg_get_tracking&node_id=${nodeId}&internal_name=${internalName}&filter=${encodeURIComponent(filter)}`)).json(); if(res.success && res.data) { table.innerHTML = ''; if(res.data.length === 0) { table.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">Keine Logs für diesen Filter gefunden.</td></tr>`; return; } res.data.forEach(log => { const timestamp = log.time || log.timestamp || 0; const timeStr = timestamp ? formatDate(timestamp) : 'Unbekannt'; const sender = log.from || log.sender || '-'; const receiver = log.to || log.receiver || '-'; let statusTxt = 'Unbekannt'; let statusColor = 'text-gray-400'; if (log.dstatus) { if (log.dstatus === 'A') { statusTxt = 'Delivered / Accept'; statusColor = 'text-green-500'; } else if (log.dstatus === 'N') { statusTxt = 'Rejected / Blocked'; statusColor = 'text-red-500'; } else if (log.dstatus === 'Q') { statusTxt = 'Quarantined'; statusColor = 'text-orange-500'; } else if (log.dstatus === 'B') { statusTxt = 'Bounced'; statusColor = 'text-red-500'; } else { statusTxt = log.dstatus; statusColor = 'text-blue-400'; } } else if (log.relay) { statusTxt = 'Relayed (' + log.relay.split('[')[0] + ')'; statusColor = 'text-blue-400'; } else if (log.msgid) { statusTxt = 'In Processing (' + log.msgid + ')'; statusColor = 'text-gray-400'; } else if (log.client) { statusTxt = 'Connection from ' + log.client.split('[')[0]; statusColor = 'text-gray-500'; } else if (log.id && log.id.length > 5) { statusTxt = 'Queue ID: ' + log.id; statusColor = 'text-gray-400'; } else { statusTxt = JSON.stringify(log).substring(0, 30); } table.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors border-b border-darkborder/50"><td class="px-4 py-3 whitespace-nowrap text-gray-400">${timeStr}</td><td class="px-4 py-3 text-white truncate max-w-[200px]">${sender}</td><td class="px-4 py-3 text-gray-300 truncate max-w-[200px]">${receiver}</td><td class="px-4 py-3 font-bold uppercase ${statusColor} truncate max-w-[300px]" title="${statusTxt}">${statusTxt}</td></tr>`; }); } else { table.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-red-500">Syslog konnte nicht gelesen werden.</td></tr>'; } } catch(e) { table.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-red-500">Netzwerkfehler.</td></tr>'; } }
    window.loadPmgQueues = async function() { const nodeId = document.getElementById('pmgNodeId').value; const internalName = document.getElementById('pmgInternalName').value; const table = document.getElementById('pmgQueueTable'); const summary = document.getElementById('pmgQueuesSummary'); if(!table || !summary) return; table.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-gray-500 animate-pulse">Lese Warteschlangen aus Postfix...</td></tr>'; summary.innerHTML = '<div class="col-span-3 text-center text-gray-500 animate-pulse">Lade...</div>'; try { const res = await (await fetch(`api.php?action=pmg_get_queues&node_id=${nodeId}&internal_name=${internalName}`)).json(); if(res.success && res.data) { let activeCount = 0, deferCount = 0, holdCount = 0; res.data.forEach(q => { const queueName = q.queue_name || q.queue || ''; if(queueName === 'active') activeCount++; else if(queueName === 'deferred') deferCount++; else holdCount++; }); summary.innerHTML = `<div class="bg-darkcard border ${activeCount > 0 ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-darkborder'} rounded-xl p-5 text-center transition-all"><p class="text-gray-400 text-sm font-bold uppercase mb-1">Active Queue</p><h4 class="text-3xl font-bold ${activeCount > 0 ? 'text-blue-500' : 'text-white'}">${activeCount}</h4></div><div class="bg-darkcard border ${deferCount > 0 ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-darkborder'} rounded-xl p-5 text-center transition-all"><p class="text-gray-400 text-sm font-bold uppercase mb-1">Deferred (Greylisted/Wartend)</p><h4 class="text-3xl font-bold ${deferCount > 0 ? 'text-orange-500' : 'text-white'}">${deferCount}</h4></div><div class="bg-darkcard border ${holdCount > 0 ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-darkborder'} rounded-xl p-5 text-center"><p class="text-gray-400 text-sm font-bold uppercase mb-1">Other / Hold</p><h4 class="text-3xl font-bold ${holdCount > 0 ? 'text-red-500' : 'text-white'}">${holdCount}</h4></div>`; table.innerHTML = ''; if(res.data.length === 0) { table.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">Alle Postfix-Queues sind komplett leer.</td></tr>`; return; } res.data.forEach(q => { const queueName = q.queue_name || q.queue || 'unknown'; const timestamp = q.arrival_time || q.time || 0; const timeStr = timestamp ? formatDate(timestamp) : 'Unbekannt'; const sender = q.sender || '-'; let receiver = q.receiver || q.recipients || '-'; if (Array.isArray(receiver)) receiver = receiver[0]; const reason = q.reason || q.error || '-'; const qColor = queueName === 'deferred' ? 'text-orange-400' : (queueName === 'active' ? 'text-blue-400' : 'text-gray-400'); table.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors border-b border-darkborder/50"><td class="px-4 py-3 font-bold uppercase ${qColor}">${queueName}</td><td class="px-4 py-3 whitespace-nowrap text-gray-400">${timeStr}</td><td class="px-4 py-3 text-white truncate max-w-[200px]" title="${sender}">${sender}</td><td class="px-4 py-3 text-gray-300 truncate max-w-[200px]" title="${receiver}">${receiver}</td><td class="px-4 py-3 text-xs text-gray-500 truncate max-w-[300px]" title="${reason}">${reason}</td></tr>`; }); } else { table.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-red-500">Queues konnten nicht gelesen werden.</td></tr>'; } } catch(e) { table.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-red-500">Netzwerkfehler.</td></tr>'; } }
    window.loadPmgConfig = async function(nodeId) { try { const res = await (await fetch(`api.php?action=pmg_get_config&node_id=${nodeId}`)).json(); if(res.success && res.data) { document.getElementById('pmgCfgRelay').value = res.data.relay || ''; document.getElementById('pmgCfgExtPort').value = res.data.ext_port || 25; document.getElementById('pmgCfgIntPort').value = res.data.int_port || 26; document.getElementById('pmgCfgTls').value = res.data.tls || 0; document.getElementById('pmgCfgTlsLog').value = res.data.tlslog || 0; } } catch(e) {} }
    window.savePmgConfig = async function() { const btn = event.target; const oTxt = btn.innerText; btn.innerText = 'Speichere...'; const fd = new FormData(); fd.append('node_id', document.getElementById('pmgNodeId').value); fd.append('relay', document.getElementById('pmgCfgRelay').value); fd.append('ext_port', document.getElementById('pmgCfgExtPort').value); fd.append('int_port', document.getElementById('pmgCfgIntPort').value); fd.append('tls', document.getElementById('pmgCfgTls').value); fd.append('tlslog', document.getElementById('pmgCfgTlsLog').value); try { const res = await (await fetch('api.php?action=pmg_set_config', {method: 'POST', body: fd})).json(); if(res.success) { alert('Proxy Einstellungen gespeichert!'); } else { alert('Fehler beim Speichern.'); } } catch(e) { alert('Netzwerkfehler.'); } finally { btn.innerText = oTxt; } }
    window.loadPmgDomains = async function(nodeId) { const container = document.getElementById('pmgDomainsContainer'); if(!container) return; container.innerHTML = '<p class="text-gray-500 text-sm animate-pulse">Lade...</p>'; try { const res = await (await fetch(`api.php?action=pmg_get_domains&node_id=${nodeId}`)).json(); if(res.success && res.data) { if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm">Keine Domains.</p>'; return; } container.innerHTML = ''; res.data.forEach(d => { container.innerHTML += `<div class="flex justify-between items-center bg-darkbg p-2 border border-darkborder rounded mb-1"><span class="text-white text-sm font-bold">${d.domain}</span><button onclick="window.deletePmgDomain('${d.domain}')" class="text-red-500 hover:text-red-400 text-xs font-bold">Löschen</button></div>`; }); } else { container.innerHTML = '<p class="text-red-500 text-sm">Fehler.</p>'; } } catch(e) {} }
    window.addPmgDomain = async function() { const domain = document.getElementById('pmgNewDomain').value.trim(); if(!domain) return; const fd = new FormData(); fd.append('node_id', document.getElementById('pmgNodeId').value); fd.append('domain', domain); const res = await (await fetch('api.php?action=pmg_add_domain', {method: 'POST', body: fd})).json(); if(res.success) { document.getElementById('pmgNewDomain').value = ''; window.loadPmgDomains(document.getElementById('pmgNodeId').value); } else alert('Fehler.'); }
    window.deletePmgDomain = async function(domain) { if(!confirm(`Domain ${domain} löschen?`)) return; const fd = new FormData(); fd.append('node_id', document.getElementById('pmgNodeId').value); fd.append('domain', domain); const res = await (await fetch('api.php?action=pmg_delete_domain', {method: 'POST', body: fd})).json(); if(res.success) window.loadPmgDomains(document.getElementById('pmgNodeId').value); else alert('Fehler.'); }
    window.loadPmgNetworks = async function(nodeId) { const container = document.getElementById('pmgNetworksContainer'); if(!container) return; container.innerHTML = '<p class="text-gray-500 text-sm animate-pulse">Lade...</p>'; try { const res = await (await fetch(`api.php?action=pmg_get_networks&node_id=${nodeId}`)).json(); if(res.success && res.data) { if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm">Keine Netzwerke.</p>'; return; } container.innerHTML = ''; res.data.forEach(n => { container.innerHTML += `<div class="flex justify-between items-center bg-darkbg p-2 border border-darkborder rounded mb-1"><span class="text-white text-sm font-bold">${n.cidr}</span><button onclick="window.deletePmgNetwork('${n.cidr}')" class="text-red-500 hover:text-red-400 text-xs font-bold">Löschen</button></div>`; }); } else { container.innerHTML = '<p class="text-red-500 text-sm">Fehler.</p>'; } } catch(e) {} }
    window.addPmgNetwork = async function() { const cidr = document.getElementById('pmgNewNetwork').value.trim(); if(!cidr) return; const fd = new FormData(); fd.append('node_id', document.getElementById('pmgNodeId').value); fd.append('cidr', cidr); const res = await (await fetch('api.php?action=pmg_add_network', {method: 'POST', body: fd})).json(); if(res.success) { document.getElementById('pmgNewNetwork').value = ''; window.loadPmgNetworks(document.getElementById('pmgNodeId').value); } else alert('Fehler.'); }
    window.deletePmgNetwork = async function(cidr) { if(!confirm(`Netzwerk ${cidr} löschen?`)) return; const fd = new FormData(); fd.append('node_id', document.getElementById('pmgNodeId').value); fd.append('cidr', cidr); const res = await (await fetch('api.php?action=pmg_delete_network', {method: 'POST', body: fd})).json(); if(res.success) window.loadPmgNetworks(document.getElementById('pmgNodeId').value); else alert('Fehler.'); }
    window.loadPmgSsl = async function(nodeId) { const internalName = document.getElementById('pmgInternalName').value; const container = document.getElementById('pmgSslContainer'); if(!container) return; container.innerHTML = '<p class="text-gray-500 animate-pulse text-sm">Lade Zertifikate...</p>'; try { const res = await (await fetch(`api.php?action=pmg_get_ssl&node_id=${nodeId}&internal_name=${internalName}`)).json(); if(res.success && res.data) { container.innerHTML = ''; res.data.forEach(cert => { const validUntil = cert.notafter ? formatDate(cert.notafter) : 'Unbekannt'; const isExpired = cert.notafter && cert.notafter < (Date.now() / 1000); const statusDot = isExpired ? '<span class="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>' : '<span class="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>'; container.innerHTML += `<div class="bg-darkbg border border-darkborder rounded p-3 text-sm flex gap-3"><div class="mt-1">${statusDot}</div><div class="flex-1 overflow-hidden"><h4 class="text-white font-bold mb-1 break-all">${cert.filename || cert.subject || 'Zertifikat'}</h4><p class="text-gray-400 text-xs mb-1"><span class="font-bold text-gray-500">Aussteller:</span> ${cert.issuer || '-'}</p><p class="text-gray-400 text-xs truncate" title="${cert.subject}"><span class="font-bold text-gray-500">Subject:</span> ${cert.subject || '-'}</p><div class="mt-2 text-xs font-bold ${isExpired ? 'text-red-400' : 'text-emerald-400'} bg-darkcard inline-block px-2 py-1 rounded border border-darkborder">Ablaufdatum: ${validUntil}</div></div></div>`; }); } else { container.innerHTML = '<p class="text-red-500 text-sm">Fehler beim Laden.</p>'; } } catch(e) { container.innerHTML = '<p class="text-red-500 text-sm">Netzwerkfehler.</p>'; } }
    window.uploadPmgSsl = async function() { const cert = document.getElementById('pmgSslCert').value.trim(); const key = document.getElementById('pmgSslKey').value.trim(); if(!cert || !key) return alert('Bitte Key und Zertifikat einfügen!'); const btn = event.target; const oTxt = btn.innerText; btn.innerText = 'Lade hoch...'; const fd = new FormData(); fd.append('node_id', document.getElementById('pmgNodeId').value); fd.append('internal_name', document.getElementById('pmgInternalName').value); fd.append('certificate', cert); fd.append('private_key', key); try { const res = await (await fetch('api.php?action=pmg_upload_ssl', {method: 'POST', body: fd})).json(); if(res.success) { alert('Zertifikat hochgeladen! Dienste neustart...'); document.getElementById('pmgSslCert').value = ''; document.getElementById('pmgSslKey').value = ''; window.loadPmgSsl(document.getElementById('pmgNodeId').value); } else { alert('Fehler beim Upload.'); } } catch(e) { alert('Netzwerkfehler.'); } finally { btn.innerText = oTxt; } }

    // --- SONSTIGE MODALS ---
    window.openUserManager = function() { const m = document.getElementById('userManagerModal'); if(m) { m.classList.remove('hidden'); if(typeof window.loadUsersIntoTable === 'function') window.loadUsersIntoTable(); } }
    window.closeUserManager = function() { const m = document.getElementById('userManagerModal'); if(m) m.classList.add('hidden'); }
    window.loadUsersIntoTable = async function() { const tbody = document.getElementById('userTableBody'); if(!tbody) return; try { const res = await (await fetch('api.php?action=get_users')).json(); if(res.success) { tbody.innerHTML = ''; res.data.forEach(user => { const isMe = user.username === window.APP.username; const deleteBtn = isMe ? `<span class="text-xs text-gray-500">Das bist du</span>` : `<button onclick="window.deleteUser(${user.id}, '${user.username}')" class="text-red-500 hover:text-red-400 text-sm font-medium">Löschen</button>`; let roleBadge = user.role === 'admin' ? '<span class="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">Admin</span>' : (user.role === 'vm_manager' ? '<span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">VM Manager</span>' : '<span class="bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded text-xs">Viewer</span>'); tbody.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors"><td class="px-4 py-3 font-medium text-white">${user.username}</td><td class="px-4 py-3">${roleBadge}</td><td class="px-4 py-3 text-right">${deleteBtn}</td></tr>`; }); } } catch (err) {} }
    window.handleRoleChange = async function() { const role = document.getElementById('newUserRole').value; const vmBlock = document.getElementById('vmPermissionsBlock'); if (role === 'vm_manager') { vmBlock.classList.remove('hidden'); try { const res = await (await fetch('api.php?action=get_top_vms')).json(); if (res.success && res.data) { const list = document.getElementById('vmCheckboxList'); list.innerHTML = ''; res.data.forEach(vm => { list.innerHTML += `<label class="flex items-center gap-2 hover:bg-darkbg p-1 rounded cursor-pointer"><input type="checkbox" name="allowed_vms[]" value="${vm.vmid}" class="accent-proxmox"><span>${vm.name} <span class="text-xs text-gray-500">(${vm.host})</span></span></label>`; }); } } catch(e) {} } else vmBlock.classList.add('hidden'); }
    const addNewUserForm = document.getElementById('addNewUserForm');
    if(addNewUserForm) { addNewUserForm.addEventListener('submit', async function(e) { e.preventDefault(); const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Speichere...'; const fd = new FormData(); fd.append('username', document.getElementById('newUsername').value); fd.append('password', document.getElementById('newUserPass').value); const role = document.getElementById('newUserRole').value; fd.append('role', role); let permissions = {}; if (role === 'vm_manager') { let allowedVms = []; document.querySelectorAll('input[name="allowed_vms[]"]:checked').forEach(cb => allowedVms.push(cb.value)); permissions.allowed_vms = allowedVms; } fd.append('permissions', JSON.stringify(permissions)); const res = await (await fetch('api.php?action=create_user', { method: 'POST', body: fd })).json(); if(res.success) { addNewUserForm.reset(); window.handleRoleChange(); window.loadUsersIntoTable(); } else alert('Fehler.'); btn.innerText = oTxt; }); }
    window.deleteUser = async function(id, name) { if(!confirm(`Benutzer '${name}' löschen?`)) return; const fd = new FormData(); fd.append('id', id); await fetch('api.php?action=delete_user', { method: 'POST', body: fd }); window.loadUsersIntoTable(); }

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
    
    window.openNodeManager = async function() { 
        const m = document.getElementById('nodeManagerModal'); if(!m) return; m.classList.remove('hidden'); 
        window.loadNodesIntoTable();
    }
    window.closeNodeManager = function() { const m = document.getElementById('nodeManagerModal'); if(m) m.classList.add('hidden'); }
    window.toggleAddNodeForm = function() { const f = document.getElementById('addNodeFormContainer'); if(f) f.classList.toggle('hidden'); }
    window.loadNodesIntoTable = async function() {
        try { 
            const res = await (await fetch('api.php?action=get_nodes')).json(); 
            if(res.success) { 
                const tbody = document.getElementById('nodeTableBody'); if(!tbody) return; tbody.innerHTML = ''; 
                if(res.data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center">Keine Server.</td></tr>'; return; } 
                res.data.forEach(node => { 
                    let typeBadge = node.type === 'pbs' ? '<span class="bg-purple-500/20 text-pbs px-2 py-0.5 rounded text-xs font-bold">PBS Backup</span>' : (node.type === 'pmg' ? '<span class="bg-blue-500/20 text-pmg px-2 py-0.5 rounded text-xs font-bold">PMG Mail</span>' : '<span class="bg-proxmox/20 text-proxmox px-2 py-0.5 rounded text-xs font-bold">PVE Node</span>'); 
                    tbody.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors"><td class="px-4 py-3 font-medium text-white">${node.name}</td><td class="px-4 py-3">${typeBadge}</td><td class="px-4 py-3">${node.ip_address}</td><td class="px-4 py-3 text-right"><button onclick="window.deleteNode(${node.id}, '${node.name}')" class="text-red-500 hover:text-red-400 text-sm font-medium">Löschen</button></td></tr>`; 
                }); 
            } 
        } catch (err) {}
    }
    window.deleteNode = async function(id, name) { if(!confirm(`Server '${name}' löschen?`)) return; const fd = new FormData(); fd.append('id', id); await fetch('api.php?action=delete_node', { method: 'POST', body: fd }); window.loadNodesIntoTable(); loadSidebarNodes(); }
    
    const addNewNodeForm = document.getElementById('addNewNodeForm');
    if(addNewNodeForm) { addNewNodeForm.addEventListener('submit', async function(e) { e.preventDefault(); const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Verbinde...'; const fd = new FormData(); fd.append('name', document.getElementById('newNodeName').value); fd.append('ip', document.getElementById('newNodeIp').value); fd.append('user', document.getElementById('newNodeUser').value); fd.append('pass', document.getElementById('newNodePass').value); fd.append('type', document.getElementById('newNodeType').value); try { const res = await (await fetch('api.php?action=add_node', { method: 'POST', body: fd })).json(); if(res.success) { addNewNodeForm.reset(); window.toggleAddNodeForm(); window.loadNodesIntoTable(); loadSidebarNodes(); alert('Erfolgreich angebunden!'); } else alert(res.error); } catch(err) {} btn.innerText = oTxt; }); }

    window.openNodeTopology = async function() { const m = document.getElementById('nodeTopologyModal'); if(!m) return; m.classList.remove('hidden'); const container = document.getElementById('nodeTopologyContainer'); if(!container) return; container.innerHTML = '<div class="text-center text-gray-500 py-10 animate-pulse">Lade Cluster-Daten...</div>'; try { const [nodesRes, vmsRes] = await Promise.all([ fetch('api.php?action=get_nodes').then(r => r.json()), fetch('api.php?action=get_all_vms').then(r => r.json()) ]); if(nodesRes.success && vmsRes.success) { container.innerHTML = ''; const pveNodes = nodesRes.data.filter(n => n.type === 'pve'); if(pveNodes.length === 0) return; pveNodes.forEach(node => { const nodeVms = vmsRes.data.filter(v => v.node_id == node.id); let vmsHtml = ''; if(nodeVms.length > 0) { nodeVms.sort((a, b) => { if(a.status === 'running' && b.status !== 'running') return -1; if(a.status !== 'running' && b.status === 'running') return 1; return a.name.localeCompare(b.name); }); nodeVms.forEach(vm => { const icon = vm.type === 'lxc' ? '📦' : '🖥️'; const isRunning = vm.status === 'running'; const statusColor = isRunning ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-darkborder bg-darkcard text-gray-400'; const dot = isRunning ? '<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></span>' : '<span class="w-2 h-2 rounded-full bg-gray-600 shrink-0"></span>'; vmsHtml += `<div class="flex flex-col p-3 rounded-lg border ${statusColor} transition-transform hover:scale-[1.02]"><div class="flex items-center gap-2 mb-1">${dot}<span class="font-bold text-sm truncate" title="${vm.name}">${icon} ${vm.name}</span></div><div class="flex justify-between text-xs opacity-75"><span>ID: ${vm.vmid}</span><span>${vm.maxcpu || 1}C / ${formatBytes(vm.maxmem || 0)}</span></div></div>`; }); } container.innerHTML += `<div class="bg-darkcard border border-darkborder rounded-xl p-5 shadow-lg"><div class="flex justify-between items-center mb-4 border-b border-darkborder pb-3"><h3 class="text-lg font-bold text-white flex items-center gap-2"><svg class="w-5 h-5 text-proxmox" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>${node.name}</h3><div class="flex gap-3"><button onclick="window.openLiveGraph('node', 0, '${node.name}', ${node.id}, '${node.name}')" class="text-blue-400 hover:text-white transition-colors text-sm" title="Node Performance">📈 Live Graph</button><span class="text-xs font-bold text-gray-400 bg-darkbg px-3 py-1 rounded-full border border-darkborder">${node.ip_address}</span></div></div><div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">${vmsHtml}</div></div>`; }); } } catch(e) {} }
    window.closeNodeTopology = function() { const m = document.getElementById('nodeTopologyModal'); if(m) m.classList.add('hidden'); }

    window.openAuditLog = async function() { const m = document.getElementById('auditLogModal'); if(m) m.classList.remove('hidden'); const tbody = document.getElementById('auditLogTableBody'); if(!tbody) return; tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4 animate-pulse">Lade Protokoll...</td></tr>'; try { const res = await (await fetch('api.php?action=get_audit_logs')).json(); if (res.success) { tbody.innerHTML = ''; if(res.data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">Noch keine Einträge.</td></tr>'; return; } res.data.forEach(log => { const d = new Date(log.timestamp + 'Z'); const timeStr = d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE'); const isSystem = log.username === 'System'; tbody.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors border-b border-darkborder/50"><td class="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">${timeStr}</td><td class="px-4 py-3"><span class="${isSystem ? 'text-gray-500' : 'text-blue-400 font-bold'}">${log.username}</span></td><td class="px-4 py-3 font-bold text-white">${log.action}</td><td class="px-4 py-3 text-gray-300 text-xs">${log.target || '-'}</td></tr>`; }); } } catch(e) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Fehler beim Laden.</td></tr>'; } }
    window.closeAuditLog = function() { const m = document.getElementById('auditLogModal'); if(m) m.classList.add('hidden'); }

    window.openTaskLog = async function(upid, nodeId, host) { const m = document.getElementById('taskLogModal'); if(!m) return; m.classList.remove('hidden'); document.getElementById('taskLogContent').innerText = 'Lade Log vom Server...'; try { const res = await (await fetch(`api.php?action=get_task_log&node_id=${nodeId}&upid=${encodeURIComponent(upid)}&host=${host}`)).json(); if(res.success && res.data) { let logText = ''; res.data.forEach(line => logText += line.t + '\n'); document.getElementById('taskLogContent').innerText = logText || 'Log ist leer.'; } else { document.getElementById('taskLogContent').innerText = 'Fehler beim Laden des Logs.'; } } catch(e) {} }
    window.closeTaskLog = function() { const m = document.getElementById('taskLogModal'); if(m) m.classList.add('hidden'); }

    window.openCronManager = async function() { const m = document.getElementById('cronManagerModal'); if(!m) return; m.classList.remove('hidden'); const select = document.getElementById('cronNodeId'); if(select) { select.innerHTML = '<option value="">Lade Hosts...</option>'; try { const res = await (await fetch('api.php?action=get_nodes')).json(); if (res.success) { select.innerHTML = '<option value="">-- PVE Node auswählen --</option>'; res.data.filter(n => n.type === 'pve').forEach(node => { select.innerHTML += `<option value="${node.id}">${node.name} (${node.ip_address})</option>`; }); } } catch(e) {} } window.loadCronJobs(); }
    window.closeCronManager = function() { const m = document.getElementById('cronManagerModal'); if(m) m.classList.add('hidden'); }
    window.checkCronAction = function() { const action = document.getElementById('cronAction').value; const vmBlock = document.getElementById('cronVmBlock'); if(vmBlock) { if (action.includes('_vm')) vmBlock.classList.remove('hidden'); else vmBlock.classList.add('hidden'); } }
    window.loadCronJobs = async function() { const tbody = document.getElementById('cronTableBody'); if(!tbody) return; tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4 animate-pulse">Lade Jobs...</td></tr>'; try { const res = await (await fetch('api.php?action=get_cron_jobs')).json(); if (res.success) { tbody.innerHTML = ''; if(res.data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Keine geplanten Jobs.</td></tr>'; return; } res.data.forEach(job => { const lastRun = formatDate(job.last_run); const isActive = parseInt(job.is_active) === 1; const statusDot = isActive ? '<span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span> Aktiv' : '<span class="w-2 h-2 rounded-full bg-gray-600"></span> Pausiert'; const targetStr = job.action_type.includes('_vm') ? `VM ${job.target_vmid}` : 'Gesamter Host'; let actionStr = job.action_type; if(actionStr === 'reboot_node') actionStr = 'Host Reboot'; if(actionStr === 'start_vm') actionStr = 'VM Start'; if(actionStr === 'stop_vm') actionStr = 'VM Stop'; if(actionStr === 'reboot_vm') actionStr = 'VM Reboot'; tbody.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors border-b border-darkborder/50"><td class="px-4 py-3 whitespace-nowrap cursor-pointer" onclick="window.toggleCronJob(${job.id}, ${isActive ? 0 : 1})"><div class="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white">${statusDot}</div></td><td class="px-4 py-3"><p class="text-white font-bold">${job.name}</p><p class="text-xs text-proxmox font-bold">${actionStr}</p></td><td class="px-4 py-3"><p class="text-gray-300">${job.node_name}</p><p class="text-xs text-gray-500">Ziel: ${targetStr}</p></td><td class="px-4 py-3 font-mono text-blue-400 font-bold tracking-widest">${job.cron_schedule}</td><td class="px-4 py-3 text-gray-400 whitespace-nowrap">${lastRun}</td><td class="px-4 py-3 text-right"><button onclick="window.deleteCronJob(${job.id})" class="text-red-500 hover:text-white px-2 py-1 bg-red-500/10 hover:bg-red-500 rounded text-xs font-bold transition-colors">Löschen</button></td></tr>`; }); } } catch(e) {} }
    window.toggleCronDate = function() { const d = document.getElementById('cronDays').value; const i = document.getElementById('cronSpecificDate'); if(i) { if (d === 'specific') { i.classList.remove('hidden'); i.required = true; } else { i.classList.add('hidden'); i.required = false; } } }
    const addCronForm = document.getElementById('addCronJobForm');
    if(addCronForm) { addCronForm.addEventListener('submit', async function(e) { e.preventDefault(); const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Speichere...'; const timeVal = document.getElementById('cronTime').value; const daysVal = document.getElementById('cronDays').value; const [hour, minute] = timeVal.split(':'); let generatedCronStr = ''; if (daysVal === 'specific') { const dateVal = document.getElementById('cronSpecificDate').value; if (!dateVal) { btn.innerText = oTxt; return alert('Bitte Datum wählen!'); } const dParts = dateVal.split('-'); generatedCronStr = `${parseInt(minute, 10)} ${parseInt(hour, 10)} ${parseInt(dParts[2], 10)} ${parseInt(dParts[1], 10)} *`; } else { generatedCronStr = `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * ${daysVal}`; } const fd = new FormData(); fd.append('name', document.getElementById('cronName').value); fd.append('node_id', document.getElementById('cronNodeId').value); fd.append('action_type', document.getElementById('cronAction').value); fd.append('target_vmid', document.getElementById('cronTargetVmid').value); fd.append('cron_schedule', generatedCronStr); try { const res = await (await fetch('api.php?action=add_cron_job', {method: 'POST', body: fd})).json(); if(res.success) { addCronForm.reset(); document.getElementById('cronTime').value = '03:00'; window.toggleCronDate(); window.checkCronAction(); window.loadCronJobs(); } else alert('Fehler.'); } catch(e) {} finally { btn.innerText = oTxt; } }); }
    window.toggleCronJob = async function(id, newState) { const fd = new FormData(); fd.append('id', id); fd.append('is_active', newState); await fetch('api.php?action=toggle_cron_job', {method: 'POST', body: fd}); window.loadCronJobs(); }
    window.deleteCronJob = async function(id) { if(!confirm('Diesen geplanten Job wirklich löschen?')) return; const fd = new FormData(); fd.append('id', id); await fetch('api.php?action=delete_cron_job', {method: 'POST', body: fd}); window.loadCronJobs(); }

    window.openUpdateManager = async function() { const m = document.getElementById('updateManagerModal'); if(m) m.classList.remove('hidden'); const content = document.getElementById('updateManagerContent'); if(!content) return; content.innerHTML = '<div class="text-center py-10 text-gray-500 animate-pulse">Prüfe Updates...</div>'; try { const res = await (await fetch('api.php?action=get_update_details')).json(); if (res.success) { content.innerHTML = ''; if(res.data.length === 0) { content.innerHTML = '<div class="text-center py-10 text-green-500 font-bold">🎉 Alle Systeme sind auf dem neuesten Stand!</div>'; return; } res.data.forEach(node => { let pkgsHtml = ''; node.packages.forEach(p => { pkgsHtml += `<div class="flex justify-between text-xs py-1 border-b border-darkborder/50"><span class="text-gray-300">${p.Title}</span><span class="text-gray-500">${p.OldVersion} ➔ <span class="text-proxmox">${p.Version}</span></span></div>`; }); content.innerHTML += `<div class="bg-darkcard border border-darkborder rounded-xl p-5 mb-4 shadow-lg"><div class="flex justify-between items-center mb-4 border-b border-darkborder pb-2"><h3 class="text-white font-bold flex items-center gap-2"><svg class="w-5 h-5 text-proxmox" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg> ${node.display_name} <span class="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded ml-2">${node.packages.length} Updates</span></h3><button onclick="window.triggerAptUpgrade(${node.node_id}, '${node.host}')" class="bg-proxmox hover:bg-orange-600 text-white font-bold py-1.5 px-4 rounded text-sm transition-colors">Installieren & Upgraden</button></div><div class="max-h-60 overflow-y-auto pr-2">${pkgsHtml}</div></div>`; }); } } catch(e) {} }
    window.closeUpdateManager = function() { const m = document.getElementById('updateManagerModal'); if(m) m.classList.add('hidden'); if(typeof window.fetchUpdates === 'function') window.fetchUpdates(); }
    window.triggerAptUpgrade = async function(nodeId, host) { if(!confirm(`Updates auf ${host} jetzt installieren?`)) return; const fd = new FormData(); fd.append('node_id', nodeId); fd.append('host', host); try { const res = await (await fetch('api.php?action=trigger_apt_upgrade', {method: 'POST', body: fd})).json(); if(res.success && res.upid) { window.openTaskLog(res.upid, nodeId, host); } else alert('Fehler: ' + res.error); } catch(e) {} }
}