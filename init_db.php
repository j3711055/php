<?php
/**
 * init_db.php — MySQL Database Initialization Script
 *
 * Usage:  php init_db.php
 * Called automatically by docker/entrypoint.sh after MySQL is confirmed ready.
 *
 * Safe to run multiple times (idempotent — uses CREATE TABLE IF NOT EXISTS
 * and seeds data only when the table is empty).
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

echo "OneIQ — MySQL Database Initialization\n";
echo str_repeat('─', 45) . "\n";

// ── Show connection info (no passwords) ───────────────────────
$cfg = getMysqlConfig();
echo "Host:     {$cfg['host']}:{$cfg['port']}\n";
echo "Database: {$cfg['dbname']}\n";
echo "User:     {$cfg['user']}\n";
echo str_repeat('─', 45) . "\n";

try {
    $pdo = getDB();
    echo "✅ Connected to MySQL successfully.\n";

    // ── Create matches table ──────────────────────────────────
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS matches (
            id          INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
            match_name  VARCHAR(255)  NOT NULL,
            team_a      VARCHAR(100)  NOT NULL DEFAULT '',
            team_b      VARCHAR(100)  NOT NULL DEFAULT '',
            match_time  VARCHAR(50)   NOT NULL DEFAULT '',
            stream_link VARCHAR(2000) NOT NULL,
            is_live     TINYINT(1)    NOT NULL DEFAULT 0,
            created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_is_live (is_live),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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

    echo str_repeat('─', 45) . "\n";
    echo "✅ Database initialization complete!\n";

} catch (PDOException $e) {
    echo "❌ Database Error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
