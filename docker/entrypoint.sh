#!/bin/sh
# ══════════════════════════════════════════════════════════════
#  OneIQ — Docker Entrypoint
#  Runs at container startup before supervisord launches.
#  Responsibilities:
#    1. Build Nginx config from template (inject $PORT)
#    2. Ensure the SQLite data directory exists and is writable
#    3. Auto-initialize the database if it does not exist
#    4. Start supervisord (manages nginx + php-fpm)
# ══════════════════════════════════════════════════════════════
set -e

# ── Defaults ──────────────────────────────────────────────────
export PORT="${PORT:-8080}"
export SQLITE_DB_PATH="${SQLITE_DB_PATH:-/data/oneiq.sqlite}"
export APP_ENV="${APP_ENV:-production}"

echo "[entrypoint] Starting OneIQ container..."
echo "[entrypoint] PORT=${PORT}"
echo "[entrypoint] SQLITE_DB_PATH=${SQLITE_DB_PATH}"
echo "[entrypoint] APP_ENV=${APP_ENV}"

# ── Validate required secrets ─────────────────────────────────
if [ -z "${ADMIN_TOKEN}" ]; then
    echo "[entrypoint] ERROR: ADMIN_TOKEN environment variable is not set!"
    echo "[entrypoint] Set it in Railway dashboard → Variables tab."
    exit 1
fi

if [ -z "${ADMIN_PASSWORD}" ]; then
    echo "[entrypoint] ERROR: ADMIN_PASSWORD environment variable is not set!"
    echo "[entrypoint] Set it in Railway dashboard → Variables tab."
    exit 1
fi

# ── Prepare SQLite data directory ─────────────────────────────
DB_DIR="$(dirname "${SQLITE_DB_PATH}")"
if [ ! -d "${DB_DIR}" ]; then
    echo "[entrypoint] Creating data directory: ${DB_DIR}"
    mkdir -p "${DB_DIR}"
fi
chown -R www-data:www-data "${DB_DIR}" 2>/dev/null || true

# ── Auto-initialize the database if it doesn't exist ──────────
if [ ! -f "${SQLITE_DB_PATH}" ]; then
    echo "[entrypoint] Database not found. Running init_db.php..."
    php /var/www/html/init_db.php
    chown www-data:www-data "${SQLITE_DB_PATH}" 2>/dev/null || true
    echo "[entrypoint] Database initialized at: ${SQLITE_DB_PATH}"
else
    echo "[entrypoint] Database found at: ${SQLITE_DB_PATH}"
fi

# ── Build Nginx config from template (inject $PORT) ───────────
echo "[entrypoint] Building Nginx config for PORT=${PORT}..."
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
echo "[entrypoint] Nginx config written."

# ── Test Nginx config ─────────────────────────────────────────
nginx -t
echo "[entrypoint] Nginx config OK."

# ── Launch supervisord (replaces this shell process) ──────────
echo "[entrypoint] Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
