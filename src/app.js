// /home/docker/pve_dashboard/src/app.js
function formatBytes(bytes) { if (!bytes || bytes === 0) return '0 GB'; const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }
function formatDate(timestamp) { if (!timestamp || timestamp === 0) return 'Nie'; const d = new Date(timestamp * 1000); return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE'); }

if (!window.APP.isLoggedIn) {
    const loginForm = document.getElementById('loginForm');
    if(loginForm) { loginForm.addEventListener('submit', async function(e) { e.preventDefault(); const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Prüfe...'; const fd = new FormData(); fd.append('username', document.getElementById('loginUser').value); fd.append('password', document.getElementById('loginPass').value); try { const res = await (await fetch('api.php?action=login', { method: 'POST', body: fd })).json(); if(res.success) window.location.reload(); else { alert(res.error); btn.innerText = oTxt; } } catch (e) { alert('Netzwerkfehler.'); btn.innerText = oTxt; } }); }
} else if (window.APP.nodeCount === 0) {
    const setupForm = document.getElementById('setupForm');
    if(setupForm) { setupForm.addEventListener('submit', async function(e) { e.preventDefault(); const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Verbinde...'; const fd = new FormData(); fd.append('name', document.getElementById('nodeName').value); fd.append('ip', document.getElementById('nodeIp').value); fd.append('user', document.getElementById('nodeUser').value); fd.append('pass', document.getElementById('nodePass').value); fd.append('type', 'pve'); try { const res = await (await fetch('api.php?action=add_node', { method: 'POST', body: fd })).json(); if(res.success) { btn.innerText = 'Erfolgreich!'; setTimeout(() => window.location.reload(), 1000); } else { alert(res.error); btn.innerText = oTxt; } } catch (e) { alert('Netzwerkfehler.'); btn.innerText = oTxt; } }); }
}

async function logout() { await fetch('api.php?action=logout'); window.location.href = window.location.pathname + '?t=' + Date.now(); }

if (window.APP.isLoggedIn && window.APP.nodeCount > 0) {
    
    if (window.APP.username === 'admin' || document.querySelector('a[onclick="openUserManager()"]')) {
        const userBtn = document.querySelector('a[onclick="openUserManager()"]');
        if (userBtn && !document.getElementById('btnAuditLog')) {
            const auditBtnHTML = `<a href="#" id="btnAuditLog" onclick="openAuditLog()" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> Audit Log</a>`;
            userBtn.insertAdjacentHTML('afterend', auditBtnHTML);
        }
    }

    const pwdModal = document.getElementById('passwordModal');
    window.openPasswordModal = function() { if(pwdModal) { pwdModal.classList.remove('hidden'); document.getElementById('changePasswordForm').reset(); } }
    window.closePasswordModal = function() { if(pwdModal) pwdModal.classList.add('hidden'); }

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

    // NEU: Dynamische Sidebar für PVE Nodes
    async function loadSidebarNodes() {
        const container = document.getElementById('sidebar-pve-nodes'); if(!container) return;
        try {
            const res = await (await fetch('api.php?action=get_pve_nodes')).json();
            if(res.success && res.data) {
                container.innerHTML = '';
                res.data.forEach(n => {
                    container.innerHTML += `<a href="#" id="nav-node-${n.host}" onclick="openNodeView(${n.node_id}, '${n.host}')" class="flex items-center gap-3 text-gray-400 hover:text-white hover:bg-white/5 pl-8 pr-3 py-1.5 rounded-r-lg transition-colors text-sm">🖥️ ${n.display}</a>`;
                });
            }
        } catch(e) {}
    }
    loadSidebarNodes();

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
        // Reset Sidebar Highlights for nodes
        document.querySelectorAll('[id^="nav-node-"]').forEach(el => el.classList.remove('text-white', 'font-bold'));
        
        if(tab === 'pbs') fetchPbsStats(); if(tab === 'pmg') fetchPmgStats();
    }

    // NEU: Node View (Spezifischer Host)
    window.openNodeView = async function(nodeId, host) {
        switchTab('node-view');
        document.querySelectorAll('[id^="nav-node-"]').forEach(el => el.classList.remove('text-white', 'font-bold'));
        document.getElementById(`nav-node-${host}`).classList.add('text-white', 'font-bold');
        document.getElementById('nodeViewTitle').innerText = 'Host: ' + host;
        document.getElementById('nodeViewHeaderBtn').onclick = () => openLiveGraph('node', 0, host, nodeId, host);
        document.getElementById('nodeViewBackupBtn').onclick = () => openNodeBackups(nodeId, host);
        
        // Vorbelegung für "Neue VM" Modal
        window.currentSelectedNodeId = nodeId; window.currentSelectedHost = host;

        const storContainer = document.getElementById('nodeStoragesContainer'); storContainer.innerHTML = 'Lade...';
        const vmsBody = document.getElementById('nodeVmsTableBody'); vmsBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Lade VMs...</td></tr>';
        
        try {
            const res = await (await fetch(`api.php?action=get_node_dashboard&node_id=${nodeId}&host=${host}`)).json();
            if(res.success) {
                // Storages rendern
                storContainer.innerHTML = '';
                res.storages.forEach(st => {
                    const pct = st.total > 0 ? ((st.used / st.total) * 100).toFixed(1) : 0;
                    storContainer.innerHTML += `<div class="bg-darkbg p-3 border border-darkborder rounded">
                        <div class="flex justify-between text-sm mb-1"><span class="font-bold text-white">${st.storage}</span><span class="text-gray-400">${pct}%</span></div>
                        <div class="w-full bg-darkcard rounded-full h-1.5 mb-1"><div class="bg-proxmox h-1.5 rounded-full" style="width: ${pct}%"></div></div>
                        <div class="text-xs text-gray-500">${st.content}</div></div>`;
                });

                // VMs rendern
                vmsBody.innerHTML = '';
                if(res.vms.length === 0) vmsBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Keine VMs auf diesem Host.</td></tr>';
                res.vms.forEach(vm => {
                    const isRunning = vm.status === 'running'; const typeStr = vm.type === 'lxc' ? '📦 LXC' : '🖥️ QEMU';
                    const statusBadge = isRunning ? '<span class="text-green-500 font-bold">Online</span>' : '<span class="text-red-500 font-bold">Offline</span>';
                    let actionButtons = isRunning ? `<button onclick="sendVmCommand('${vm.vmid}', '${vm.host}', '${vm.type}', 'stop', ${vm.node_id})" class="text-red-500 px-2">⏹️</button>` : `<button onclick="sendVmCommand('${vm.vmid}', '${vm.host}', '${vm.type}', 'start', ${vm.node_id})" class="text-green-500 px-2">▶️</button>`;
                    actionButtons += `<button onclick="openVmSettings('${vm.vmid}', '${vm.host}', '${vm.type}', ${vm.node_id}, '${vm.name}')" class="text-gray-400 hover:text-white px-2 ml-2 border-l border-darkborder">⚙️</button>`;
                    vmsBody.innerHTML += `<tr class="border-b border-darkborder/50 hover:bg-darkbg"><td class="py-2 px-3 text-white">${vm.vmid}</td><td class="py-2 px-3 text-white font-bold">${vm.name}</td><td class="py-2 px-3 text-gray-400">${typeStr}</td><td class="py-2 px-3">${statusBadge}</td><td class="py-2 px-3 text-right">${actionButtons}</td></tr>`;
                });
            }
        } catch(e) {}
    }

    const ctx = document.getElementById('liveChart')?.getContext('2d'); let liveChart;
    if(ctx) { liveChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [{ label: 'CPU (%)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, tension: 0.4, fill: true, data: [] }, { label: 'RAM (%)', borderColor: '#E57000', backgroundColor: 'rgba(229, 112, 0, 0.1)', borderWidth: 2, tension: 0.4, fill: true, data: [] }] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } }, y: { min: 0, max: 100, ticks: { color: '#9ca3af', callback: v => v + '%' }, grid: { color: '#33334d' } } }, plugins: { legend: { labels: { color: '#e2e8f0', usePointStyle: true } } } } }); }

    const ctxNet = document.getElementById('liveNetChart')?.getContext('2d'); let liveNetChart;
    if(ctxNet) { liveNetChart = new Chart(ctxNet, { type: 'line', data: { labels: [], datasets: [] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } }, y: { min: 0, ticks: { color: '#9ca3af' }, grid: { color: '#33334d' } } }, plugins: { legend: { labels: { color: '#e2e8f0', usePointStyle: true } } } } }); }

    let prevGlobalTime = null;
    async function fetchGlobalStats() { 
        if(document.getElementById('tab-pve').classList.contains('hidden')) return;
        try { 
            const res = await (await fetch('api.php?action=get_stats')).json(); 
            if(res.success && res.data) { 
                const d = res.data; 
                document.getElementById('stat-cpu-text').innerText = `${d.cpu_percent}% (${d.cpu_cores} Cores)`; document.getElementById('stat-cpu-bar').style.width = `${d.cpu_percent}%`; 
                let ramPercent = (d.ram_used / d.ram_total) * 100 || 0; document.getElementById('stat-ram-text').innerText = `${formatBytes(d.ram_used)} / ${formatBytes(d.ram_total)}`; document.getElementById('stat-ram-bar').style.width = `${ramPercent}%`; 
                let diskPercent = (d.disk_used / d.disk_total) * 100 || 0; document.getElementById('stat-disk-text').innerText = `${formatBytes(d.disk_used)} / ${formatBytes(d.disk_total)}`; document.getElementById('stat-disk-bar').style.width = `${diskPercent}%`; 
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

    async function fetchTopVms() { if(!document.getElementById('top-vms-container') || document.getElementById('tab-pve').classList.contains('hidden')) return; try { const res = await (await fetch('api.php?action=get_top_vms')).json(); if(res.success && res.data) { const container = document.getElementById('top-vms-container'); container.innerHTML = ''; if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-400 text-sm">Keine aktiven VMs.</p>'; return; } res.data.forEach((vm, i) => { const cpuPercent = ((vm.cpu || 0) * 100).toFixed(1); const ramUsed = formatBytes(vm.mem || 0); const icon = vm.type === 'lxc' ? '📦' : '🖥️'; const numberColor = i === 0 ? 'text-red-500' : (i === 1 ? 'text-orange-400' : (i === 2 ? 'text-yellow-400' : 'text-gray-400')); container.innerHTML += `<div class="bg-darkbg border border-darkborder rounded-lg p-3 flex justify-between items-center transition-transform hover:scale-[1.02] cursor-default"><div class="flex items-center gap-3"><span class="font-bold text-xl ${numberColor}">#${i + 1}</span><div><h4 class="text-white font-semibold text-sm truncate w-32">${icon} ${vm.name}</h4><p class="text-xs text-gray-500">Host: ${vm.host}</p></div></div><div class="text-right"><p class="text-proxmox font-bold text-sm">${cpuPercent}% CPU</p><p class="text-xs text-gray-400">${ramUsed} RAM</p></div></div>`; }); } } catch (err) {} }
    async function fetchRecentJobs() { if(!document.getElementById('recent-jobs-container')) return; try { const res = await (await fetch('api.php?action=get_recent_jobs')).json(); if(res.success && res.data) { const container = document.getElementById('recent-jobs-container'); container.innerHTML = ''; if(res.data.length === 0) { container.innerHTML = '<p class="text-gray-400 text-sm">Keine aktuellen Jobs.</p>'; return; } res.data.forEach(job => { const jobTypeStr = job.type || job.worker_type || 'unknown'; let statusColor = 'text-gray-400', statusIcon = '⏳', statusText = job.status || 'running...'; if(statusText.toLowerCase() === 'ok') { statusColor = 'text-green-500'; statusIcon = '✅'; } else if(statusText !== 'running...') { statusColor = 'text-red-500'; statusIcon = '❌'; } else { statusColor = 'text-blue-400'; statusIcon = '🔄'; } const date = new Date(job.starttime * 1000); const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); const isBackup = jobTypeStr.includes('sync') || jobTypeStr.includes('prune') || jobTypeStr.includes('garbage_collection') || jobTypeStr.includes('vzdump') || jobTypeStr.includes('verify'); const jobTypeColor = isBackup ? 'text-purple-400' : 'text-white'; container.innerHTML += `<div class="bg-darkbg border border-darkborder rounded-lg p-3 flex justify-between items-center transition-colors hover:bg-darkborder/50"><div class="flex items-center gap-3"><div class="text-lg">${statusIcon}</div><div class="max-w-[120px]"><p class="${jobTypeColor} font-medium text-sm capitalize truncate" title="${jobTypeStr}">${jobTypeStr}</p><p class="text-xs text-gray-500 truncate" title="${job.node_name}">Host: <span class="text-proxmox">${job.node_name}</span></p></div></div><div class="text-right"><p class="${statusColor} font-bold text-sm uppercase">${statusText}</p><p class="text-xs text-gray-500">${dateStr} - ${timeStr}</p></div></div>`; }); } } catch (err) {} }
    
    window.fetchUpdates = async function() { if(!document.getElementById('stat-updates-text')) return; try { const res = await (await fetch('api.php?action=get_updates')).json(); if(res.success) { const el = document.getElementById('stat-updates-text'), subEl = document.getElementById('stat-updates-sub'); if(res.total === 0) { el.innerText = '0 Updates'; el.className = 'text-2xl font-bold text-green-500 mt-1'; subEl.innerText = 'Alle Systeme sind aktuell.'; } else { el.innerText = res.total + ' Updates'; el.className = 'text-2xl font-bold text-red-500 mt-1'; subEl.innerText = 'Auf: ' + res.details; } } } catch (err) {} }
    window.openUpdateManager = async function() { document.getElementById('updateManagerModal').classList.remove('hidden'); const content = document.getElementById('updateManagerContent'); content.innerHTML = '<div class="text-center py-10 text-gray-500 animate-pulse">Prüfe Updates...</div>'; try { const res = await (await fetch('api.php?action=get_update_details')).json(); if (res.success) { content.innerHTML = ''; if(res.data.length === 0) { content.innerHTML = '<div class="text-center py-10 text-green-500 font-bold">🎉 Alle Systeme sind auf dem neuesten Stand!</div>'; return; } res.data.forEach(node => { let pkgsHtml = ''; node.packages.forEach(p => { pkgsHtml += `<div class="flex justify-between text-xs py-1 border-b border-darkborder/50"><span class="text-gray-300">${p.Title}</span><span class="text-gray-500">${p.OldVersion} ➔ <span class="text-proxmox">${p.Version}</span></span></div>`; }); content.innerHTML += `<div class="bg-darkcard border border-darkborder rounded-xl p-5 mb-4 shadow-lg"><div class="flex justify-between items-center mb-4 border-b border-darkborder pb-2"><h3 class="text-white font-bold flex items-center gap-2"><svg class="w-5 h-5 text-proxmox" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg> ${node.display_name} <span class="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded ml-2">${node.packages.length} Updates</span></h3><button onclick="triggerAptUpgrade(${node.node_id}, '${node.host}')" class="bg-proxmox hover:bg-orange-600 text-white font-bold py-1.5 px-4 rounded text-sm transition-colors">Installieren & Upgraden</button></div><div class="max-h-60 overflow-y-auto pr-2">${pkgsHtml}</div></div>`; }); } } catch(e) {} }
    window.closeUpdateManager = function() { document.getElementById('updateManagerModal').classList.add('hidden'); fetchUpdates(); }
    window.triggerAptUpgrade = async function(nodeId, host) { if(!confirm(`Updates auf ${host} jetzt installieren?`)) return; const fd = new FormData(); fd.append('node_id', nodeId); fd.append('host', host); try { const res = await (await fetch('api.php?action=trigger_apt_upgrade', {method: 'POST', body: fd})).json(); if(res.success && res.upid) { openTaskLog(res.upid, nodeId, host); } else alert('Fehler: ' + res.error); } catch(e) {} }

    fetchGlobalStats(); setInterval(fetchGlobalStats, 10000); fetchTopVms(); setInterval(fetchTopVms, 10000); fetchRecentJobs(); setInterval(fetchRecentJobs, 15000); fetchUpdates(); setInterval(fetchUpdates, 60000); setInterval(fetchPbsStats, 10000); setInterval(fetchPmgStats, 10000);

    const nodeModal = document.getElementById('nodeManagerModal');
    window.openNodeManager = function() { nodeModal.classList.remove('hidden'); loadNodesIntoTable(); }
    window.closeNodeManager = function() { nodeModal.classList.add('hidden'); document.getElementById('addNodeFormContainer').classList.add('hidden'); }
    window.toggleAddNodeForm = function() { document.getElementById('addNodeFormContainer').classList.toggle('hidden'); }
    async function loadNodesIntoTable() { try { const res = await (await fetch('api.php?action=get_nodes')).json(); if(res.success) { const tbody = document.getElementById('nodeTableBody'); tbody.innerHTML = ''; if(res.data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center">Keine Server.</td></tr>'; return; } res.data.forEach(node => { let typeBadge = node.type === 'pbs' ? '<span class="bg-purple-500/20 text-pbs px-2 py-0.5 rounded text-xs font-bold">PBS Backup</span>' : (node.type === 'pmg' ? '<span class="bg-blue-500/20 text-pmg px-2 py-0.5 rounded text-xs font-bold">PMG Mail</span>' : '<span class="bg-proxmox/20 text-proxmox px-2 py-0.5 rounded text-xs font-bold">PVE Node</span>'); tbody.innerHTML += `<tr class="hover:bg-darkcard/50 transition-colors"><td class="px-4 py-3 font-medium text-white">${node.name}</td><td class="px-4 py-3">${typeBadge}</td><td class="px-4 py-3">${node.ip_address}</td><td class="px-4 py-3 text-right"><button onclick="deleteNode(${node.id}, '${node.name}')" class="text-red-500 hover:text-red-400 text-sm font-medium">Löschen</button></td></tr>`; }); } } catch (err) {} }
    window.deleteNode = async function(id, name) { if(!confirm(`Server '${name}' löschen?`)) return; const fd = new FormData(); fd.append('id', id); await fetch('api.php?action=delete_node', { method: 'POST', body: fd }); loadNodesIntoTable(); }
    
    const addNewNodeForm = document.getElementById('addNewNodeForm');
    if(addNewNodeForm) { addNewNodeForm.addEventListener('submit', async function(e) { e.preventDefault(); const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Verbinde...'; const fd = new FormData(); fd.append('name', document.getElementById('newNodeName').value); fd.append('ip', document.getElementById('newNodeIp').value); fd.append('user', document.getElementById('newNodeUser').value); fd.append('pass', document.getElementById('newNodePass').value); fd.append('type', document.getElementById('newNodeType').value); try { const res = await (await fetch('api.php?action=add_node', { method: 'POST', body: fd })).json(); if(res.success) { addNewNodeForm.reset(); toggleAddNodeForm(); loadNodesIntoTable(); loadSidebarNodes(); alert('Erfolgreich angebunden!'); } else alert(res.error); } catch(err) {} btn.innerText = oTxt; }); }

    // VM Erstellung (jetzt mit automatischer Node-Vorauswahl aus dem Sidebar-View)
    const createVmModal = document.getElementById('createVmModal');
    window.openCreateVm = async function() { 
        createVmModal.classList.remove('hidden'); 
        const select = document.getElementById('createVmHost'); select.innerHTML = '<option value="">Suche Hosts...</option>'; 
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
    window.closeCreateVm = function() { createVmModal.classList.add('hidden'); }
    const createVmForm = document.getElementById('createVmForm');
    if(createVmForm) { createVmForm.addEventListener('submit', async function(e) { e.preventDefault(); const hostDataStr = document.getElementById('createVmHost').value; if(!hostDataStr) return; const hostData = JSON.parse(hostDataStr); const btn = this.querySelector('button[type="submit"]'); const oTxt = btn.innerText; btn.innerText = 'Richte VM ein...'; const fd = new FormData(); fd.append('node_id', hostData.id); fd.append('host', hostData.host); fd.append('name', document.getElementById('createVmName').value); fd.append('memory', document.getElementById('createVmRam').value); fd.append('cores', document.getElementById('createVmCores').value); try { const res = await (await fetch('api.php?action=create_vm', { method: 'POST', body: fd })).json(); if(res.success) { alert(`Erfolgreich! VM-ID: ${res.vmid}`); createVmForm.reset(); closeCreateVm(); if(window.currentSelectedHost === hostData.host) openNodeView(hostData.id, hostData.host); } else alert(res.error); } catch(e) {} finally { btn.innerText = oTxt; } }); }

    // VM EDIT MODAL (Erweitert um ISO & OnBoot)
    const settingsModal = document.getElementById('vmSettingsModal');
    window.openVmSettings = async function(vmid, host, type, nodeId, name) { 
        settingsModal.classList.remove('hidden'); document.getElementById('settingsModalTitle').innerText = 'Einstellungen: ' + name; 
        document.getElementById('setVmid').value = vmid; document.getElementById('setHost').value = host; document.getElementById('setType').value = type; document.getElementById('setNodeId').value = nodeId; 
        document.getElementById('snapshotListContainer').innerHTML = '<div class="text-gray-500 text-sm italic">Lade Snapshots...</div>'; document.getElementById('backupListContainer').innerHTML = '<div class="text-gray-500 text-sm italic">Lade Backups...</div>';
        
        // Lade ISOs
        if(type === 'qemu') {
            document.getElementById('setIso').innerHTML = '<option value="">Lade ISOs...</option>';
            fetch(`api.php?action=get_isos&node_id=${nodeId}&host=${host}`).then(r=>r.json()).then(isoRes => {
                const s = document.getElementById('setIso'); s.innerHTML = '<option value="none">Kein ISO gemountet (CD auswerfen)</option>';
                if(isoRes.success) { isoRes.data.forEach(iso => s.innerHTML += `<option value="${iso}">${iso}</option>`); }
            });
        }

        try { 
            const res = await (await fetch(`api.php?action=get_vm_config&vmid=${vmid}&host=${host}&type=${type}&node_id=${nodeId}`)).json(); 
            if (res.success && res.data) { 
                const cfg = res.data; 
                document.getElementById('setMemory').value = cfg.memory || ''; document.getElementById('setCores').value = cfg.cores || 1; 
                document.getElementById('setOnboot').checked = (cfg.onboot == 1);
                if(cfg.ide2 && cfg.ide2 !== 'none,media=cdrom') { const parts = cfg.ide2.split(','); document.getElementById('setIso').value = parts[0]; }
                
                if (cfg.net0) { document.getElementById('setRawNet0').value = cfg.net0; if (cfg.net0.includes('link_down=1')) { document.getElementById('netStatusBadge').className = 'px-2 py-1 rounded text-xs font-bold text-red-400 bg-red-500/20'; document.getElementById('netStatusBadge').innerText = 'Getrennt'; document.getElementById('btnToggleNet').innerText = 'Kabel einstecken'; document.getElementById('btnToggleNet').onclick = () => saveNetwork(false); } else { document.getElementById('netStatusBadge').className = 'px-2 py-1 rounded text-xs font-bold text-green-400 bg-green-500/20'; document.getElementById('netStatusBadge').innerText = 'Verbunden'; document.getElementById('btnToggleNet').innerText = 'Kabel ziehen'; document.getElementById('btnToggleNet').onclick = () => saveNetwork(true); } } else { document.getElementById('netStatusBadge').innerText = 'Kein net0'; document.getElementById('btnToggleNet').style.display = 'none'; } let diskName = ''; if (type === 'lxc' && cfg.rootfs) diskName = 'rootfs'; else if (cfg.scsi0) diskName = 'scsi0'; else if (cfg.virtio0) diskName = 'virtio0'; else if (cfg.ide0) diskName = 'ide0'; if (diskName) { document.getElementById('setPrimaryDisk').value = diskName; document.getElementById('diskLabelName').innerText = diskName; } else document.getElementById('diskLabelName').innerText = 'Nicht gefunden'; 
            } 
            loadSnapshots(vmid, host, type, nodeId);
            const stRes = await (await fetch(`api.php?action=get_backup_storages&node_id=${nodeId}&host=${host}`)).json();
            if (stRes.success) { const bSelect = document.getElementById('backupTargetStorage'); bSelect.innerHTML = ''; stRes.data.forEach(st => bSelect.innerHTML += `<option value="${st}">${st}</option>`); }
            loadBackups(vmid, host, nodeId);
        } catch (e) {} 
    }
    window.closeVmSettings = function() { settingsModal.classList.add('hidden'); }
    window.saveHardwareSettings = async function() { 
        const fd = new FormData(); 
        fd.append('vmid', document.getElementById('setVmid').value); fd.append('host', document.getElementById('setHost').value); fd.append('type', document.getElementById('setType').value); fd.append('node_id', document.getElementById('setNodeId').value); 
        fd.append('memory', document.getElementById('setMemory').value); fd.append('cores', document.getElementById('setCores').value); 
        fd.append('onboot', document.getElementById('setOnboot').checked ? 1 : 0);
        if(document.getElementById('setType').value === 'qemu') { fd.append('ide2', document.getElementById('setIso').value); }
        
        const res = await (await fetch('api.php?action=update_vm_config', { method: 'POST', body: fd })).json(); 
        if(res.success) { alert('Gespeichert!'); if(window.currentSelectedHost) openNodeView(fd.get('node_id'), fd.get('host')); } else alert(res.error); 
    }

    // Node Backups Manager
    window.openNodeBackups = async function(nodeId, host) {
        document.getElementById('nodeBackupsModal').classList.remove('hidden');
        document.getElementById('nodeBackupsTitle').innerText = 'Backup Jobs: ' + host;
        const tbody = document.getElementById('nodeBackupsTableBody'); tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Lade Jobs...</td></tr>';
        try {
            const res = await (await fetch(`api.php?action=get_node_backup_jobs&node_id=${nodeId}&host=${host}`)).json();
            if(res.success) {
                tbody.innerHTML = '';
                if(res.data.length === 0) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Keine Backup Jobs definiert.</td></tr>';
                res.data.forEach(j => {
                    tbody.innerHTML += `<tr class="border-b border-darkborder/50">
                        <td class="py-2 px-3 text-white font-bold">${j.id}</td>
                        <td class="py-2 px-3 text-proxmox">${j.schedule || 'Manuell'}</td>
                        <td class="py-2 px-3">${j.storage}</td>
                        <td class="py-2 px-3 text-gray-400">${j.vmid || 'Alle VMs'}</td>
                        <td class="py-2 px-3 text-right"><span class="text-xs bg-darkcard px-2 py-1 rounded">Read-Only via API</span></td>
                    </tr>`;
                });
            }
        } catch(e) {}
    }
    window.closeNodeBackups = function() { document.getElementById('nodeBackupsModal').classList.add('hidden'); }

    // RRD UND LIVE GRAPH ENGINE
    let perfChartObj = null; let netChartObj = null; let liveInterval = null; let currentGraphParams = {};
    window.openLiveGraph = function(targetMode, vmid, host, nodeId, name) {
        document.getElementById('liveGraphModal').classList.remove('hidden');
        currentGraphParams = { mode: targetMode, vmid: vmid, host: host, nodeId: nodeId, name: name };
        switchGraphTab('live');
    }
    window.closeLiveGraph = function() { document.getElementById('liveGraphModal').classList.add('hidden'); if(liveInterval) clearInterval(liveInterval); }
    window.switchGraphTab = async function(tab) {
        if(liveInterval) clearInterval(liveInterval);
        ['live', 'day', 'week'].forEach(t => { 
            const b = document.getElementById('btn-graph-' + t); 
            if(t === tab) { b.classList.add('border-proxmox', 'text-white'); b.classList.remove('border-transparent', 'text-gray-400'); } 
            else { b.classList.remove('border-proxmox', 'text-white'); b.classList.add('border-transparent', 'text-gray-400'); }
        });
        
        document.getElementById('graphModalTitle').innerText = `${tab === 'live' ? 'Live' : (tab === 'day' ? '24h' : '7 Tage')} Performance: ${currentGraphParams.name}`;
        const dot = document.getElementById('graphStatusDot'); 
        if(tab === 'live') { dot.classList.add('animate-pulse', 'bg-green-500'); dot.classList.remove('bg-blue-500'); document.getElementById('graphSubText').innerText = 'Metriken werden live abgefragt.'; } 
        else { dot.classList.remove('animate-pulse', 'bg-green-500'); dot.classList.add('bg-blue-500'); document.getElementById('graphSubText').innerText = 'Historische RRD-Daten via Proxmox API.'; }

        if(perfChartObj) perfChartObj.destroy(); if(netChartObj) netChartObj.destroy();
        const ctxPerf = document.getElementById('perfChart').getContext('2d'); perfChartObj = new Chart(ctxPerf, { type: 'line', data: { labels: [], datasets: [ { label: 'CPU (%)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: tab==='live'?3:0, data: [] }, { label: 'RAM (%)', borderColor: '#E57000', backgroundColor: 'rgba(229, 112, 0, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: tab==='live'?3:0, data: [] }]}, options: { responsive: true, maintainAspectRatio: false, animation: { duration: tab==='live'?0:500 }, scales: { x: { grid: { color: '#33334d' }, ticks: { color: '#9ca3af' } }, y: { min: 0, max: 100, grid: { color: '#33334d' }, ticks: { color: '#9ca3af' } } }, plugins: { legend: { labels: { color: '#e2e8f0' } } } } });
        const ctxNet = document.getElementById('netChart').getContext('2d'); netChartObj = new Chart(ctxNet, { type: 'line', data: { labels: [], datasets: [ { label: 'RX (MB/s)', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: tab==='live'?3:0, data: [] }, { label: 'TX (MB/s)', borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: tab==='live'?3:0, data: [] }]}, options: { responsive: true, maintainAspectRatio: false, animation: { duration: tab==='live'?0:500 }, scales: { x: { grid: { color: '#33334d' }, ticks: { color: '#9ca3af' } }, y: { min: 0, grid: { color: '#33334d' }, ticks: { color: '#9ca3af' } } }, plugins: { legend: { labels: { color: '#e2e8f0' } } } } });

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
                        
                        perfChartObj.data.labels.push(timeStr); perfChartObj.data.datasets[0].data.push(cpu); perfChartObj.data.datasets[1].data.push(ram); if(perfChartObj.data.labels.length > 30) { perfChartObj.data.labels.shift(); perfChartObj.data.datasets[0].data.shift(); perfChartObj.data.datasets[1].data.shift(); } perfChartObj.update();
                        if(prevTime !== null || d.is_rrd_net) { netChartObj.data.labels.push(timeStr); netChartObj.data.datasets[0].data.push(rxSpeed); netChartObj.data.datasets[1].data.push(txSpeed); if(netChartObj.data.labels.length > 30) { netChartObj.data.labels.shift(); netChartObj.data.datasets[0].data.shift(); netChartObj.data.datasets[1].data.shift(); } netChartObj.update(); }
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
                        perfChartObj.data.labels.push(l); perfChartObj.data.datasets[0].data.push((d.cpu || 0) * 100);
                        let ram = 0; if (d.maxmem > 0) { ram = ((d.mem / d.maxmem) * 100).toFixed(1); } perfChartObj.data.datasets[1].data.push(ram);
                        netChartObj.data.labels.push(l); netChartObj.data.datasets[0].data.push((d.netin || 0) / (1024*1024)); netChartObj.data.datasets[1].data.push((d.netout || 0) / (1024*1024));
                    });
                    perfChartObj.update(); netChartObj.update();
                }
            } catch(e) {}
        }
    }

    window.sendVmCommand = async function(vmid, host, type, cmd, nodeId) { if(!confirm(`Maschine '${vmid}' wirklich ${cmd}?`)) return; const fd = new FormData(); fd.append('vmid', vmid); fd.append('host', host); fd.append('type', type); fd.append('cmd', cmd); fd.append('node_id', nodeId); try { const res = await (await fetch('api.php?action=vm_action', { method: 'POST', body: fd })).json(); if(res.success) { setTimeout(() => { if(window.currentSelectedHost === host) openNodeView(nodeId, host); }, 2000); } else alert(res.error); } catch (err) {} }
    
    // Bestehende Dummy-Funktionen für andere Module der Übersichtlichkeit halber:
    window.openPmgManager = function() {} // Siehe original code
    window.openPbsDatastore = function() {} // Siehe original code
}