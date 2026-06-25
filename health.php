<?php
/**
 * health.php — Railway health check endpoint
 *
 * Railway probes GET /health.php to verify the container is alive.
 * Checks MySQL connectivity via a lightweight SELECT 1.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store');
header('X-Robots-Tag: noindex');

$status  = 'ok';
$details = [];
$code    = 200;

// ── Check MySQL connectivity ──────────────────────────────────
try {
    require_once __DIR__ . '/db.php';
    $db = getDB();
    $db->query('SELECT 1')->fetchColumn();
    $details['database'] = 'mysql:ok';
} catch (Throwable $e) {
    $status              = 'degraded';
    $details['database'] = 'mysql:error';
    // Don't expose the actual error message in the response
    $code = 503;
}

// ── Include connection host for debugging (no credentials) ────
$cfg = getMysqlConfig();
$details['db_host'] = $cfg['host'] . ':' . $cfg['port'];
$details['db_name'] = $cfg['dbname'];

http_response_code($code);
echo json_encode([
    'status'  => $status,
    'details' => $details,
    'time'    => date('c'),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
