<?php
/**
 * db.php — Shared MySQL database connection helper
 *
 * Reads connection details from Railway MySQL plugin environment variables.
 * Railway provides either:
 *   - MYSQL_URL = mysql://USER:PASSWORD@HOST:PORT/DATABASE
 *   OR individual vars:
 *   - MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE
 *
 * Both formats are supported, MYSQL_URL takes priority.
 */

declare(strict_types=1);

// ── Parse MySQL connection details from environment ───────────
function getMysqlConfig(): array
{
    $url = getenv('MYSQL_URL') ?: getenv('DATABASE_URL') ?: '';

    if ($url !== '') {
        // Parse Railway MySQL URL: mysql://USER:PASS@HOST:PORT/DATABASE
        $p = parse_url($url);
        return [
            'host'   => $p['host']            ?? 'localhost',
            'port'   => (string)($p['port']   ?? 3306),
            'user'   => $p['user']            ?? 'root',
            'pass'   => urldecode($p['pass']  ?? ''),
            'dbname' => ltrim($p['path'] ?? '/oneiq', '/'),
        ];
    }

    // Fall back to individual Railway MySQL plugin variables
    return [
        'host'   => getenv('MYSQLHOST')     ?: getenv('DB_HOST')     ?: 'localhost',
        'port'   => getenv('MYSQLPORT')     ?: getenv('DB_PORT')     ?: '3306',
        'user'   => getenv('MYSQLUSER')     ?: getenv('DB_USER')     ?: 'root',
        'pass'   => getenv('MYSQLPASSWORD') ?: getenv('DB_PASSWORD') ?: '',
        'dbname' => getenv('MYSQLDATABASE') ?: getenv('DB_NAME')     ?: 'oneiq',
    ];
}

// ── PDO singleton ─────────────────────────────────────────────
function getDB(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $cfg = getMysqlConfig();

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $cfg['host'],
            $cfg['port'],
            $cfg['dbname']
        );

        $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            // Keep connections alive and reconnect on failure
            PDO::ATTR_PERSISTENT         => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ]);
    }

    return $pdo;
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
    return in_array(strtolower($parsed['scheme']), ['http', 'https'], true);
}
