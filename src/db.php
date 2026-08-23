<?php
// /home/docker/pve_dashboard/src/db.php
session_start();
try {
    $pdo = new PDO('sqlite:' . __DIR__ . '/../data/dashboard.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 1. User Tabelle
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'viewer',
        permissions TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 2. Nodes Tabelle
    $pdo->exec("CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        token_id TEXT NOT NULL,
        token_secret TEXT NOT NULL,
        type TEXT DEFAULT 'pve'
    )");

    // Automatisches Upgrade für ältere Versionen
    try { $pdo->exec("ALTER TABLE nodes ADD COLUMN type TEXT DEFAULT 'pve'"); } catch (PDOException $e) {}

    // 3. NEU: Task Scheduler Tabelle
    $pdo->exec("CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        node_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        target_vmid TEXT,
        cron_schedule TEXT NOT NULL,
        last_run INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 4. NEU: Audit Logs Tabelle
    $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        action TEXT,
        target TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Standard-Admin anlegen, falls noch keine User existieren
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    if ($stmt->fetchColumn() == 0) {
        $hash = password_hash('admin', PASSWORD_DEFAULT);
        $pdo->exec("INSERT INTO users (username, password_hash, role) VALUES ('admin', '$hash', 'admin')");
    }
} catch (PDOException $e) {
    die(json_encode(['success' => false, 'error' => "Datenbank-Fehler: " . $e->getMessage()]));
}
?>