<?php
/**
 * go.php — Referer-stripping stream redirect gateway
 * Usage: /go?id=MATCH_ID
 *
 * Security fix: validates stream_link is a legitimate http/https URL
 * before redirecting (prevents open-redirect exploitation).
 *
 * Why this exists:
 *   Some CDNs check the Referer header and reject requests from
 *   our domain with 401. This page strips the Referer using three
 *   independent mechanisms to guarantee zero Referer on the CDN request.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    exit('Bad Request');
}

try {
    $db   = getDB();
    $stmt = $db->prepare("SELECT stream_link, match_name FROM matches WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $row  = $stmt->fetch();
} catch (Throwable $e) {
    http_response_code(500);
    exit('Server Error');
}

if (!$row) {
    http_response_code(404);
    exit('Match not found');
}

$url = $row['stream_link'];

// ── Security: validate that the stored URL is safe to redirect to ─
// This prevents a stored XSS / open-redirect if a bad stream_link
// somehow ended up in the database.
if (!isValidStreamUrl($url)) {
    http_response_code(400);
    exit('Invalid stream URL');
}

$name = htmlspecialchars($row['match_name'], ENT_QUOTES, 'UTF-8');
$urlE = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');

// ── Strip Referer at HTTP header level ────────────────────────
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <!-- Strip Referer at meta level (belt-and-suspenders) -->
  <meta name="referrer" content="no-referrer" />
  <meta http-equiv="refresh" content="0;url=<?= $urlE ?>" />
  <title>جارٍ تحميل البث… | واحد العراق</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;color:#fff;font-family:'Cairo',sans-serif;
         display:flex;flex-direction:column;align-items:center;
         justify-content:center;min-height:100vh;gap:1.2rem;text-align:center}
    .ball{font-size:3rem;animation:spin 1.5s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    h2{color:#E8FF00;font-size:1.2rem}
    p{color:rgba(255,255,255,.5);font-size:.85rem}
    .bar{width:220px;height:3px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden}
    .fill{height:100%;background:#FF0000;border-radius:99px;animation:load 1.5s ease forwards}
    @keyframes load{from{width:0}to{width:100%}}
  </style>
</head>
<body>
  <div class="ball">⚽</div>
  <h2><?= $name ?></h2>
  <div class="bar"><div class="fill"></div></div>
  <p>جارٍ تحميل البث المباشر…</p>

  <script>
    // Triple-layer Referer stripping:
    // 1. HTTP header  → Referrer-Policy: no-referrer  (above)
    // 2. Meta tag     → <meta name="referrer" content="no-referrer">  (above)
    // 3. JS open via about:blank interim → no Referer sent to CDN
    (function() {
      var url = <?= json_encode($url) ?>;
      try {
        // Open a fresh about:blank context, navigate from there — no Referer
        var w = window.open('about:blank', '_self');
        if (w) { w.location.replace(url); }
        else    { window.location.replace(url); }
      } catch(e) {
        window.location.replace(url);
      }
    })();
  </script>
</body>
</html>
