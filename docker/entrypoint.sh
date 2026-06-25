#!/bin/sh
# ══════════════════════════════════════════════════════════════
#  OneIQ — Docker Entrypoint (MySQL edition)
#  1. Auto-generate missing secrets and print them for the user
#  2. Build Nginx config from template (inject $PORT)
#  3. Wait for MySQL (Railway starts it as a separate service)
#  4. Run init_db.php to create tables on first boot
#  5. Start supervisord (nginx + php-fpm)
# ══════════════════════════════════════════════════════════════
set -e

# ── Defaults ──────────────────────────────────────────────────
export PORT="${PORT:-8080}"
export APP_ENV="${APP_ENV:-production}"

echo "================================================"
echo " OneIQ Container Starting"
echo " PORT     = ${PORT}"
echo " APP_ENV  = ${APP_ENV}"
echo "================================================"

# ── Auto-generate ADMIN_TOKEN if not set ──────────────────────
# Railway template.json pre-fills this via ${{ secret(64) }}.
# For GitHub-deploy users who skipped the Variables tab,
# we generate one here and print it so they can copy it.
if [ -z "${ADMIN_TOKEN}" ]; then
    ADMIN_TOKEN=$(php -r 'echo bin2hex(random_bytes(32));')
    export ADMIN_TOKEN
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  ⚠️  AUTO-GENERATED ADMIN_TOKEN                      ║"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  ${ADMIN_TOKEN}"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  SAVE THIS NOW — it will change on every redeploy   ║"
    echo "║  → Railway dashboard → your service → Variables     ║"
    echo "║  → Add:  ADMIN_TOKEN = (paste the value above)      ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
else
    echo "[startup] ADMIN_TOKEN ✓ (set via environment)"
fi

# ── Auto-generate ADMIN_PASSWORD if not set ───────────────────
if [ -z "${ADMIN_PASSWORD}" ]; then
    ADMIN_PASSWORD=$(php -r 'echo substr(str_shuffle(str_repeat("ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#%", 5)), 0, 20);')
    export ADMIN_PASSWORD
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  ⚠️  AUTO-GENERATED ADMIN_PASSWORD                   ║"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  ${ADMIN_PASSWORD}"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  SAVE THIS NOW — it will change on every redeploy   ║"
    echo "║  → Railway dashboard → your service → Variables     ║"
    echo "║  → Add:  ADMIN_PASSWORD = (paste the value above)   ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
else
    echo "[startup] ADMIN_PASSWORD ✓ (set via environment)"
fi

# ── Validate MySQL config is available ────────────────────────
MYSQL_URL_SET="${MYSQL_URL:-${DATABASE_URL:-}}"
MYSQL_HOST_SET="${MYSQLHOST:-${DB_HOST:-}}"
if [ -z "${MYSQL_URL_SET}" ] && [ -z "${MYSQL_HOST_SET}" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  ❌  No MySQL connection configured                  ║"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  → Railway dashboard → + New → Database → MySQL     ║"
    echo "║  → Railway injects MYSQL_URL automatically           ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
    exit 1
fi

echo "[startup] MySQL config ✓"

# ── Ensure Nginx runtime directory exists ─────────────────────
mkdir -p /run/nginx /tmp/nginx-cache
echo "[startup] Runtime directories ✓"

# ── Build Nginx config from template (inject $PORT) ───────────
echo "[startup] Building Nginx config for PORT=${PORT}..."
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
nginx -t 2>&1
echo "[startup] Nginx config ✓"

# ── Wait for MySQL to be ready ────────────────────────────────
echo "[startup] Waiting for MySQL..."
MAX_TRIES=30
TRIES=0

until php -r "
    require_once '/var/www/html/db.php';
    \$cfg = getMysqlConfig();
    \$dsn = 'mysql:host='.\$cfg['host'].';port='.\$cfg['port'].';dbname='.\$cfg['dbname'].';charset=utf8mb4';
    try {
        new PDO(\$dsn, \$cfg['user'], \$cfg['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        echo 'READY';
    } catch (PDOException \$e) {
        exit(1);
    }
" 2>/dev/null | grep -q 'READY'; do
    TRIES=$((TRIES + 1))
    if [ "${TRIES}" -ge "${MAX_TRIES}" ]; then
        echo ""
        echo "╔══════════════════════════════════════════════════════╗"
        echo "║  ❌  MySQL not reachable after 60 seconds            ║"
        echo "╠══════════════════════════════════════════════════════╣"
        echo "║  Check: MySQL plugin is running in Railway           ║"
        echo "║  Check: MYSQL_URL or MYSQLHOST var is set            ║"
        echo "╚══════════════════════════════════════════════════════╝"
        exit 1
    fi
    echo "[startup] MySQL not ready (attempt ${TRIES}/${MAX_TRIES}), retrying in 2s..."
    sleep 2
done

echo "[startup] MySQL ✓"

# ── Initialize database schema (idempotent) ───────────────────
echo "[startup] Initializing database schema..."
php /var/www/html/init_db.php
echo "[startup] Database ✓"

# ── Launch supervisord (replaces this shell as PID 1) ─────────
echo ""
echo "================================================"
echo " ✅ OneIQ is starting on port ${PORT}"
echo "================================================"
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
