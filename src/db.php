<?php
session_start();
try {
    // Hier ist der Fix: Der Pfad zeigt wieder auf das ausgelagerte /data Verzeichnis!
    $pdo = new PDO('sqlite:' . __DIR__ . '/../data/dashboard.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'viewer',
        permissions TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        token_id TEXT NOT NULL,
        token_secret TEXT NOT NULL,
        type TEXT DEFAULT 'pve'
    )");

    // Automatisches Datenbank-Upgrade für den PBS! (Fügt Spalte 'type' hinzu, falls sie fehlt)
    try {
        $pdo->exec("ALTER TABLE nodes ADD COLUMN type TEXT DEFAULT 'pve'");
    } catch (PDOException $e) {
        // Ignorieren, wenn die Spalte bereits existiert
    }

    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    if ($stmt->fetchColumn() == 0) {
        $hash = password_hash('admin', PASSWORD_DEFAULT);
        $pdo->exec("INSERT INTO users (username, password_hash, role) VALUES ('admin', '$hash', 'admin')");
    }
} catch (PDOException $e) {
    die("Datenbank-Fehler: " . $e->getMessage());
}
?>