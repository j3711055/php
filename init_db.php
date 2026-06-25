<?php
/**
 * init_db.php — Database Initialization Script
 *
 * Usage:  php init_db.php
 * Called automatically by:
 *   - docker/entrypoint.sh on first Railway boot (when Volume is empty)
 *   - getDB() in db.php on first request if DB file missing
 *
 * Safe to run multiple times (idempotent — uses CREATE TABLE IF NOT EXISTS
 * and only seeds data when the table is empty).
 */

declare(strict_types=1);

// ── Re-use the same path resolution as db.php ─────────────────
$dbPath = getenv('SQLITE_DB_PATH') ?: (__DIR__ . '/database/oneiq.sqlite');
$dbDir  = dirname($dbPath);

echo "OneIQ — Database Initialization\n";
echo "DB Path: {$dbPath}\n";

// ── Create directory if needed ────────────────────────────────
if (!is_dir($dbDir)) {
    if (!mkdir($dbDir, 0750, true) && !is_dir($dbDir)) {
        echo "❌ Error: Failed to create directory: {$dbDir}\n";
        exit(1);
    }
    echo "✅ Created directory: {$dbDir}\n";
}

try {
    $pdo = new PDO("sqlite:{$dbPath}");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;");

    // ── Create tables ─────────────────────────────────────────
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
    echo "✅ Table 'matches' ready.\n";

    // ── Seed with demo data only if table is empty ────────────
    $count = (int)$pdo->query("SELECT COUNT(*) FROM matches")->fetchColumn();
    if ($count === 0) {
        echo "   Seeding demo data...\n";
        $stmt = $pdo->prepare("
            INSERT INTO matches (match_name, team_a, team_b, match_time, stream_link, is_live)
            VALUES (:name, :a, :b, :t, :link, :live)
        ");
        $demos = [
            ['مباراة الافتتاح',     'البرازيل',    'كرواتيا',   '21:00 بتوقيت بغداد',  'https://example.com/stream1', 1],
            ['ربع النهائي الأول',   'فرنسا',       'إنجلترا',   '18:00 بتوقيت بغداد',  'https://example.com/stream2', 0],
            ['ربع النهائي الثاني',  'الأرجنتين',   'هولندا',    '21:00 بتوقيت بغداد',  'https://example.com/stream3', 0],
            ['نصف النهائي',         'البرتغال',    'المغرب',    '21:00 بتوقيت بغداد',  'https://example.com/stream4', 0],
        ];
        foreach ($demos as [$name, $a, $b, $t, $link, $live]) {
            $stmt->execute([':name' => $name, ':a' => $a, ':b' => $b, ':t' => $t, ':link' => $link, ':live' => $live]);
        }
        echo "✅ Demo data seeded (" . count($demos) . " matches).\n";
    } else {
        echo "   Database already has {$count} matches — skipping seed.\n";
    }

    // ── Secure the file ───────────────────────────────────────
    if (file_exists($dbPath)) {
        chmod($dbPath, 0640);
    }

    echo "✅ Database initialized successfully!\n";
    echo "   Path: {$dbPath}\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
