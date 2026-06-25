#!/bin/sh
# ══════════════════════════════════════════════════════════════
#  OneIQ — Docker Entrypoint (MySQL edition)
#  Responsibilities:
#    1. Validate required environment variables
#    2. Build Nginx config from template (inject $PORT)
#    3. Wait for MySQL to be reachable (Railway starts it separately)
#    4. Run init_db.php to create tables if they don't exist
#    5. Start supervisord (manages nginx + php-fpm)
# ══════════════════════════════════════════════════════════════
set -e

# ── Defaults ──────────────────────────────────────────────────
export PORT="${PORT:-8080}"
export APP_ENV="${APP_ENV:-production}"

echo "================================================"
echo " OneIQ Container Starting (MySQL edition)"
echo " PORT     = ${PORT}"
echo " APP_ENV  = ${APP_ENV}"
echo "================================================"

# ── Validate required secrets ─────────────────────────────────
if [ -z "${ADMIN_TOKEN}" ]; then
    echo ""
    echo "ERROR: ADMIN_TOKEN environment variable is not set!"
    echo "  → Railway dashboard → your service → Variables tab"
    echo "  → Add: ADMIN_TOKEN = (openssl rand -hex 32)"
    echo ""
    exit 1
fi

if [ -z "${ADMIN_PASSWORD}" ]; then
    echo ""
    echo "ERROR: ADMIN_PASSWORD environment variable is not set!"
    echo "  → Railway dashboard → your service → Variables tab"
    echo "  → Add: ADMIN_PASSWORD = (strong password)"
    echo ""
    exit 1
fi

# Require at least one form of MySQL connection config
MYSQL_URL_SET="${MYSQL_URL:-${DATABASE_URL:-}}"
MYSQL_HOST_SET="${MYSQLHOST:-${DB_HOST:-}}"
if [ -z "${MYSQL_URL_SET}" ] && [ -z "${MYSQL_HOST_SET}" ]; then
    echo ""
    echo "ERROR: No MySQL connection configured!"
    echo "  → Add a MySQL plugin to your Railway project"
    echo "  → Or set MYSQL_URL / MYSQLHOST env vars manually"
    echo ""
    exit 1
fi

echo "[startup] Secrets and DB config validated OK."

# ── Ensure Nginx runtime directory exists ─────────────────────
mkdir -p /run/nginx /tmp/nginx-cache
echo "[startup] Runtime directories OK."

# ── Build Nginx config from template (inject $PORT) ───────────
echo "[startup] Injecting PORT=${PORT} into Nginx config..."
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# ── Test Nginx config before launching ────────────────────────
nginx -t 2>&1
echo "[startup] Nginx config OK."

# ── Wait for MySQL to be ready ────────────────────────────────
# Railway starts MySQL as a separate service — it may take a few
# seconds before it accepts connections. We poll via PHP PDO.
echo "[startup] Waiting for MySQL to be ready..."
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
        echo "[startup] ERROR: MySQL not reachable after ${MAX_TRIES} attempts (60s)."
        echo "[startup] Check: Railway MySQL plugin is running and env vars are set."
        exit 1
    fi
    echo "[startup] MySQL not ready yet (attempt ${TRIES}/${MAX_TRIES}), retrying in 2s..."
    sleep 2
done

echo "[startup] MySQL is ready!"

# ── Initialize database schema (idempotent) ───────────────────
echo "[startup] Running database initialization..."
php /var/www/html/init_db.php
echo "[startup] Database ready."

# ── Launch supervisord (replaces this shell as PID 1) ─────────
echo "[startup] Starting supervisord..."
echo "================================================"
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
