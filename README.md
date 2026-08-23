# Proxmox Unified Console (PUC) 🚀

A lightning-fast, unified web dashboard to manage your Proxmox Virtual Environment (PVE), Proxmox Backup Server (PBS), and Proxmox Mail Gateway (PMG) from a single, clean interface. 

Built entirely with native APIs—no slow iframes, no CORS issues.

## ✨ Features

* **Unified Multi-Node Management:** Connect multiple PVE, PBS, and PMG instances via API tokens.
* **Proxmox VE (PVE):** 
  * Live CPU/RAM/Net metrics using Chart.js.
  * Start, Stop, Reboot, Delete, and Create VMs & LXC containers.
  * Smart NoVNC-Console integration (Popout).
  * Hardware & Network config (Resize Disks, add NICs).
  * Backup & Snapshot management.
* **Proxmox Backup Server (PBS):**
  * Live Datastore capacity monitoring.
  * Snapshot explorer with namespace support.
  * System jobs overview (Garbage Collection, Prune, Verify).
  * Task Log Viewer.
* **Proxmox Mail Gateway (PMG):**
  * Unified Spam Quarantine management (Deliver/Delete).
  * Cross-node Mail Queue tracking (Active, Deferred, Hold).
  * Advanced Syslog Tracking Center.
  * Configuration Editor (Relay, Ports, TLS, Trusted Networks, Relay Domains).
  * 1-Click SSL Certificate Upload & Management.
* **Task Scheduler:** Built-in cron system to automate VM and Node reboots overnight.
* **Security First:** 
  * Granular User Roles (Admin, VM-Manager, Viewer).
  * Restrict specific VMs to specific users.
  * Comprehensive Audit Log tracking all actions.
  * Auto-generated Self-Signed SSL out of the box (Port 443).

## 📦 Quickstart (Docker)

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/DEIN_GITHUB_NAME/proxmox-unified-console.git](https://github.com/DEIN_GITHUB_NAME/proxmox-unified-console.git)
   cd proxmox-unified-console