<?php
/**
 * config.php — Application configuration
 *
 * All sensitive values are read from environment variables.
 * Set these in Railway dashboard → Variables tab.
 * For local development, create a .env file (see .env.example).
 *
 * ⚠️  DO NOT hardcode credentials here. Use environment variables.
 */

declare(strict_types=1);

// ── Load .env file for local development ─────────────────────
// (On Railway, env vars are injected automatically — no .env needed)
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // Skip comments and blank lines
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        // Parse KEY=VALUE
        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $key   = trim($key);
            $value = trim($value);
            // Only set if not already set by the OS environment
            if ($key !== '' && getenv($key) === false) {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
            }
        }
    }
}

// ── Admin bearer token (used by JS fetch() admin calls) ───────
define('ADMIN_TOKEN', (function (): string {
    $token = getenv('ADMIN_TOKEN');
    if (!$token || $token === 'CHANGE_ME_GENERATE_WITH_openssl_rand_hex_32') {
        // Hard-fail in production if token is not set or is still the placeholder
        if ((getenv('APP_ENV') ?: 'development') === 'production') {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Server misconfiguration: ADMIN_TOKEN not set']);
            exit;
        }
        return 'dev-token-change-me-not-for-production';
    }
    return $token;
})());

// ── Admin login password ───────────────────────────────────────
define('ADMIN_PASSWORD', (function (): string {
    $pass = getenv('ADMIN_PASSWORD');
    if (!$pass || $pass === 'CHANGE_ME_STRONG_PASSWORD_HERE') {
        if ((getenv('APP_ENV') ?: 'development') === 'production') {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Server misconfiguration: ADMIN_PASSWORD not set']);
            exit;
        }
        return 'dev-password-change-me-not-for-production';
    }
    return $pass;
})());

// ── Application environment ────────────────────────────────────
define('APP_ENV', getenv('APP_ENV') ?: 'development');

// ── App metadata ───────────────────────────────────────────────
define('APP_NAME',    'واحد العراق');
define('APP_TAGLINE', 'قناة الاخبار الاولى');
