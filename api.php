<?php
/**
 * api.php — RESTful JSON API
 *
 * GET    /api.php          → list all matches (public)
 * POST   /api.php          → create match   (admin — Bearer token)
 * PUT    /api.php?id=N     → update match   (admin — Bearer token)
 * DELETE /api.php?id=N     → delete match   (admin — Bearer token)
 *
 * Security improvements over original:
 *  - CORS restricted to same-origin in production (wildcard only in dev)
 *  - stream_link validated as http/https URL before storing
 *  - Input length limits enforced
 *  - 405 returned for unknown methods
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

// ── CORS ──────────────────────────────────────────────────────
// In production: restrict to same-origin (no CORS header = same-origin only)
// In development: allow all origins for local testing convenience
if (APP_ENV !== 'production') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

// ── Input length limits ───────────────────────────────────────
const MAX_NAME_LEN  = 200;
const MAX_LINK_LEN  = 2000;
const MAX_TEAM_LEN  = 100;
const MAX_TIME_LEN  = 50;

// ── Admin authentication ───────────────────────────────────────
function requireAdmin(): void
{
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    // Support both "Bearer TOKEN" and just "TOKEN"
    $token = trim(str_replace('Bearer', '', $authHeader));

    if ($token === '' || !hash_equals(ADMIN_TOKEN, $token)) {
        jsonResponse(['success' => false, 'error' => 'Unauthorised'], 401);
    }
}

// ── Helper: parse and validate body ───────────────────────────
function parseMatchBody(): array
{
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];

    $name = mb_substr(trim($body['match_name'] ?? ''), 0, MAX_NAME_LEN);
    $a    = mb_substr(trim($body['team_a']      ?? ''), 0, MAX_TEAM_LEN);
    $b    = mb_substr(trim($body['team_b']      ?? ''), 0, MAX_TEAM_LEN);
    $t    = mb_substr(trim($body['match_time']  ?? ''), 0, MAX_TIME_LEN);
    $live = isset($body['is_live']) ? (int)(bool)$body['is_live'] : 0;

    // New fields
    $player_type  = mb_substr(trim($body['player_type'] ?? 'default'), 0, 50);
    $channel_logo = mb_substr(trim($body['channel_logo'] ?? ''), 0, 2000);

    // Validate player_type
    if (!in_array($player_type, ['default', 'm3u8'], true)) {
        $player_type = 'default';
    }

    $qualities = [];
    if ($player_type === 'm3u8') {
        $qualities_input = $body['qualities'] ?? [];
        if (is_array($qualities_input)) {
            foreach ($qualities_input as $q) {
                $q_title = mb_substr(trim($q['title'] ?? ''), 0, 100);
                $q_url   = mb_substr(trim($q['url']   ?? ''), 0, 2000);
                if ($q_title !== '' && $q_url !== '') {
                    if (!isValidStreamUrl($q_url)) {
                        jsonResponse(['success' => false, 'error' => "Quality URL '{$q_url}' must be a valid http/https URL"], 422);
                    }
                    $qualities[] = [
                        'title' => $q_title,
                        'url'   => $q_url
                    ];
                }
            }
        }

        if (empty($qualities)) {
            jsonResponse(['success' => false, 'error' => 'At least one quality is required for M3U8 Player'], 422);
        }
        // Set stream_link to the first quality url to satisfy database constraints
        $link = $qualities[0]['url'];

        if ($channel_logo !== '' && !isValidStreamUrl($channel_logo)) {
            jsonResponse(['success' => false, 'error' => 'channel_logo must be a valid http/https URL'], 422);
        }
    } else {
        $link = mb_substr(trim($body['stream_link'] ?? ''), 0, MAX_LINK_LEN);
        if (!$link) {
            jsonResponse(['success' => false, 'error' => 'stream_link is required'], 422);
        }
        if (!isValidStreamUrl($link)) {
            jsonResponse(['success' => false, 'error' => 'stream_link must be a valid http/https URL'], 422);
        }
    }

    if (!$name) {
        jsonResponse(['success' => false, 'error' => 'match_name is required'], 422);
    }

    return compact('name', 'a', 'b', 't', 'link', 'live', 'player_type', 'channel_logo', 'qualities');
}

// ── Public endpoint: list all matches ─────────────────────────
try {
    // ── Public endpoint: list all matches ─────────────────────────
    if ($method === 'GET') {
        $db   = getDB();
        $rows = $db->query(
            "SELECT id, match_name, team_a, team_b, match_time, stream_link, is_live, player_type, channel_logo, qualities, created_at
             FROM matches
             ORDER BY is_live DESC, id DESC"
        )->fetchAll();

        foreach ($rows as &$row) {
            if (isset($row['qualities']) && is_string($row['qualities'])) {
                $row['qualities'] = json_decode($row['qualities'], true) ?? [];
            } else {
                $row['qualities'] = [];
            }
        }
        unset($row);

        jsonResponse(['success' => true, 'matches' => $rows]);
    }

    // ── POST: create match ────────────────────────────────────────
    if ($method === 'POST') {
        requireAdmin();
        ['name' => $name, 'a' => $a, 'b' => $b, 't' => $t, 'link' => $link, 'live' => $live, 'player_type' => $player_type, 'channel_logo' => $channel_logo, 'qualities' => $qualities] = parseMatchBody();

        $db   = getDB();
        $stmt = $db->prepare(
            "INSERT INTO matches (match_name, team_a, team_b, match_time, stream_link, is_live, player_type, channel_logo, qualities)
             VALUES (:n, :a, :b, :t, :l, :live, :player_type, :channel_logo, :qualities)"
        );
        $stmt->execute([
            ':n'            => $name,
            ':a'            => $a,
            ':b'            => $b,
            ':t'            => $t,
            ':l'            => $link,
            ':live'         => $live,
            ':player_type'  => $player_type,
            ':channel_logo' => $channel_logo,
            ':qualities'    => json_encode($qualities, JSON_UNESCAPED_UNICODE)
        ]);

        jsonResponse(['success' => true, 'id' => (int)$db->lastInsertId()], 201);
    }

    // ── PUT: update match ─────────────────────────────────────────
    if ($method === 'PUT') {
        requireAdmin();
        if (!$id) {
            jsonResponse(['success' => false, 'error' => 'id required'], 422);
        }

        ['name' => $name, 'a' => $a, 'b' => $b, 't' => $t, 'link' => $link, 'live' => $live, 'player_type' => $player_type, 'channel_logo' => $channel_logo, 'qualities' => $qualities] = parseMatchBody();

        $db = getDB();
        
        // Verify match exists first to avoid rowCount() === 0 false-negatives on unchanged fields in MySQL
        $check = $db->prepare("SELECT 1 FROM matches WHERE id = :id");
        $check->execute([':id' => $id]);
        if (!$check->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Match not found'], 404);
        }

        $stmt = $db->prepare(
            "UPDATE matches
             SET match_name=:n, team_a=:a, team_b=:b, match_time=:t, stream_link=:l, is_live=:live,
                 player_type=:player_type, channel_logo=:channel_logo, qualities=:qualities
             WHERE id=:id"
        );
        $stmt->execute([
            ':n'            => $name,
            ':a'            => $a,
            ':b'            => $b,
            ':t'            => $t,
            ':l'            => $link,
            ':live'         => $live,
            ':player_type'  => $player_type,
            ':channel_logo' => $channel_logo,
            ':qualities'    => json_encode($qualities, JSON_UNESCAPED_UNICODE),
            ':id'           => $id
        ]);

        jsonResponse(['success' => true]);
    }

    // ── DELETE: remove match ──────────────────────────────────────
    if ($method === 'DELETE') {
        requireAdmin();
        if (!$id) {
            jsonResponse(['success' => false, 'error' => 'id required'], 422);
        }

        $db = getDB();
        
        // Verify match exists first
        $check = $db->prepare("SELECT 1 FROM matches WHERE id = :id");
        $check->execute([':id' => $id]);
        if (!$check->fetch()) {
            jsonResponse(['success' => false, 'error' => 'Match not found'], 404);
        }

        $stmt = $db->prepare("DELETE FROM matches WHERE id=:id");
        $stmt->execute([':id' => $id]);

        jsonResponse(['success' => true]);
    }

    // ── Catch-all: method not allowed ────────────────────────────
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);

} catch (PDOException $e) {
    jsonResponse(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}

