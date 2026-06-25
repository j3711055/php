<?php
/**
 * health.php — Railway health check endpoint
 *
 * Railway probes GET /health.php to verify the container is alive.
 * Also verifies the database connection is working.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store');
header('X-Robots-Tag: noindex');

$status  = 'ok';
$details = [];
$code    = 200;

// ── Check DB connectivity ─────────────────────────────────────
try {
    require_once __DIR__ . '/db.php';
    $db = getDB();
    $db->query('SELECT 1')->fetchColumn();
    $details['database'] = 'ok';
} catch (Throwable $e) {
    $status             = 'degraded';
    $details['database'] = 'error';
    $code               = 503;
}

// ── Check writable data directory ────────────────────────────
$dbPath  = getenv('SQLITE_DB_PATH') ?: './database/oneiq.sqlite';
$dbDir   = dirname($dbPath);
$details['db_path']   = $dbPath;
$details['db_writable'] = is_writable($dbDir) ? 'yes' : 'no';

http_response_code($code);
echo json_encode([
    'status'  => $status,
    'details' => $details,
    'time'    => date('c'),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
