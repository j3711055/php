<?php
/**
 * auth.php — Admin authentication endpoint
 *
 * POST /auth.php  body: {"password":"..."} → {"success":true,"token":"..."}
 *
 * Security: uses hash_equals() for constant-time comparison
 * to prevent timing-based password oracle attacks.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true) ?? [];
$pass = trim($body['password'] ?? '');

// ── Constant-time comparison to prevent timing attacks ────────
if (!$pass || !hash_equals(ADMIN_PASSWORD, $pass)) {
    // Add a small artificial delay to slow brute-force attempts
    usleep(random_int(100_000, 300_000)); // 100-300ms
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid password']);
    exit;
}

// Return the bearer token the client will use for future requests
echo json_encode(['success' => true, 'token' => ADMIN_TOKEN]);
