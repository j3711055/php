<?php
/**
 * db.php — Shared database connection helper
 *
 * Changes from original:
 *  - DB_PATH read from SQLITE_DB_PATH environment variable
 *  - Auto-creates the database if it doesn't exist (Railway-safe)
 *  - No more RuntimeException on missing file (init runs on first access)
 *  - DB_DIR constant for directory checks
 */

declare(strict_types=1);

// ── Resolve DB path from environment ─────────────────────────
// On Railway: SQLITE_DB_PATH=/data/oneiq.sqlite  (persistent Volume)
// Locally:    defaults to ./database/oneiq.sqlite
define('DB_PATH', (function (): string {
    $envPath = getenv('SQLITE_DB_PATH');
    if ($envPath && $envPath !== '') {
        return $envPath;
    }
    return __DIR__ . '/database/oneiq.sqlite';
})());

define('DB_DIR', dirname(DB_PATH));

// ── PDO singleton ─────────────────────────────────────────────
function getDB(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        // Ensure the database directory exists
        if (!is_dir(DB_DIR)) {
            if (!mkdir(DB_DIR, 0750, true) && !is_dir(DB_DIR)) {
                throw new RuntimeException('Failed to create database directory: ' . DB_DIR);
            }
        }

        // Auto-initialize if the file doesn't exist yet
        // (This handles Railway fresh deploys with an empty Volume)
        if (!file_exists(DB_PATH)) {
            _initializeDatabase();
        }

        $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        // SQLite performance + reliability settings
        $pdo->exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;");
    }

    return $pdo;
}

// ── Database initialization (called automatically on first run) ─
function _initializeDatabase(): void
{
    $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    $pdo->exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS matches (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            match_name  TEXT    NOT NULL,
            team_a      TEXT    NOT NULL DEFAULT '',
            team_b      TEXT    NOT NULL DEFAULT '',
            match_time  TEXT    NOT NULL DEFAULT '',
            stream_link TEXT    NOT NULL,
            is_live     INTEGER NOT NULL DEFAULT 0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // Set secure file permissions
    if (file_exists(DB_PATH)) {
        chmod(DB_PATH, 0640);
    }
}

// ── JSON response helper ──────────────────────────────────────
function jsonResponse(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache, no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// ── Input sanitizer ───────────────────────────────────────────
function sanitize(string $val): string
{
    return htmlspecialchars(trim($val), ENT_QUOTES, 'UTF-8');
}

// ── URL validator (prevents open-redirect abuse) ──────────────
function isValidStreamUrl(string $url): bool
{
    if (empty($url)) {
        return false;
    }
    $parsed = parse_url($url);
    if (!isset($parsed['scheme'], $parsed['host'])) {
        return false;
    }
    // Only allow http and https schemes
    return in_array(strtolower($parsed['scheme']), ['http', 'https'], true);
}
