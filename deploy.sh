#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  OneIQ — Deployment Script for Debian Linux
#  Usage:  sudo bash deploy.sh
#  Tested: Debian 11 (Bullseye) · Debian 12 (Bookworm)
# ══════════════════════════════════════════════════════════════
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
APP_DIR="/var/www/oneiq"
DOMAIN="iq.e9i.me"
NGINX_MAIN="/etc/nginx/nginx.conf"
NGINX_CONF="/etc/nginx/sites-available/oneiq"
NGINX_ENABLED="/etc/nginx/sites-enabled/oneiq"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colours ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✔]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✘]${NC} $*" >&2; exit 1; }
section() { echo -e "\n${YELLOW}══ $* ══${NC}"; }

# ── Root check ────────────────────────────────────────────────
[[ "$EUID" -ne 0 ]] && error "Run as root:  sudo bash deploy.sh"

echo ""
echo "  ██████  ███    ██ ███████     ██  ██████  "
echo "  ██   ██ ████   ██ ██         ██  ██    ██ "
echo "  ██   ██ ██ ██  ██ █████     ██   ██    ██ "
echo "  ██   ██ ██  ██ ██ ██       ██    ██ ▄▄ ██ "
echo "  ██████  ██   ████ ███████ ██      ██████  "
echo ""
echo "  واحد العراق — World Cup Streaming Platform"
echo "  Domain: $DOMAIN"
echo ""

# ═══════════════════════════════════════════════════════════════
section "1/7  Detect PHP version & install packages"
# ═══════════════════════════════════════════════════════════════

apt-get update -qq

# Find the best available PHP version (prefer 8.2, then 8.1, then 8.0, then 7.4)
PHP_VER=""
for v in 8.3 8.2 8.1 8.0 7.4; do
    if apt-cache show "php${v}-fpm" &>/dev/null 2>&1; then
        PHP_VER="$v"
        break
    fi
done

# If none found via apt-cache, check if already installed
if [[ -z "$PHP_VER" ]]; then
    PHP_BIN=$(command -v php 2>/dev/null || true)
    if [[ -n "$PHP_BIN" ]]; then
        PHP_VER=$("$PHP_BIN" -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
    fi
fi

[[ -z "$PHP_VER" ]] && error "Could not detect a supported PHP version. Install PHP manually first."

info "Detected PHP version: $PHP_VER"
PHP_FPM_SVC="php${PHP_VER}-fpm"
# Prefer generic socket (used on some Debian builds), fall back to versioned
if [[ -S "/run/php/php-fpm.sock" ]]; then
    PHP_SOCK="/run/php/php-fpm.sock"
else
    PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"
fi

# Install packages (include php-common for pdo_sqlite)
PKGS=(
    "nginx"
    "php${PHP_VER}-fpm"
    "php${PHP_VER}-cli"
    "php${PHP_VER}-sqlite3"
)
apt-get install -y "${PKGS[@]}" 2>&1 | grep -E "^(Setting up|already)" || true

# Enable the sqlite3 / pdo_sqlite extensions
if command -v phpenmod &>/dev/null; then
    phpenmod sqlite3 2>/dev/null || true
    phpenmod pdo_sqlite 2>/dev/null || true
fi

# Verify pdo_sqlite is available — if not, try the generic php-sqlite3 fallback
if ! php -r "new PDO('sqlite::memory:');" &>/dev/null 2>&1; then
    warn "pdo_sqlite not active via php${PHP_VER}-sqlite3, trying php-sqlite3 fallback..."
    apt-get install -y php-sqlite3 2>&1 | grep -E "^(Setting up|already)" || true
    if command -v phpenmod &>/dev/null; then
        phpenmod sqlite3 pdo_sqlite 2>/dev/null || true
    fi
fi

# Final check
php -r "new PDO('sqlite::memory:');" \
    && info "pdo_sqlite extension — OK" \
    || error "pdo_sqlite still not available. Run: apt-get install php${PHP_VER}-sqlite3 && phpenmod sqlite3"

# ═══════════════════════════════════════════════════════════════
section "2/7  Start PHP-FPM (socket must exist before nginx test)"
# ═══════════════════════════════════════════════════════════════

systemctl enable "$PHP_FPM_SVC"
systemctl start  "$PHP_FPM_SVC" || systemctl restart "$PHP_FPM_SVC"

# Wait up to 5s for socket to appear
for i in {1..10}; do
    [[ -S "$PHP_SOCK" ]] && break
    sleep 0.5
done
[[ -S "$PHP_SOCK" ]] && info "PHP-FPM socket ready: $PHP_SOCK" \
                      || warn "Socket not found at $PHP_SOCK — nginx may fail"

# ═══════════════════════════════════════════════════════════════
section "3/7  Create web directory & copy files"
# ═══════════════════════════════════════════════════════════════

mkdir -p "$APP_DIR"/{assets/{css,js},database}

# Copy everything except the deploy script itself and shell files
rsync -a --exclude='*.sh' --exclude='deploy.sh' --exclude='.git' \
      "$SCRIPT_DIR/" "$APP_DIR/" 2>/dev/null \
  || { cd "$SCRIPT_DIR" && find . -maxdepth 5 \
         ! -name '*.sh' ! -name '.git' -type f \
         -exec cp --parents {} "$APP_DIR/" \; ; }

info "Files copied to $APP_DIR"

# ═══════════════════════════════════════════════════════════════
section "4/7  File permissions"
# ═══════════════════════════════════════════════════════════════

chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod -R 750 "$APP_DIR/database"
# Protect sensitive files
for f in config.php db.php init_db.php; do
    [[ -f "$APP_DIR/$f" ]] && chmod 640 "$APP_DIR/$f"
done
info "Permissions set"

# ═══════════════════════════════════════════════════════════════
section "5/7  Initialise SQLite database"
# ═══════════════════════════════════════════════════════════════

if [[ -f "$APP_DIR/database/oneiq.sqlite" ]]; then
    warn "Database already exists — skipping initialisation (preserving data)"
else
    php "$APP_DIR/init_db.php"
    chown www-data:www-data "$APP_DIR/database/oneiq.sqlite"
    chmod 640 "$APP_DIR/database/oneiq.sqlite"
    info "Database initialised"
fi

# ═══════════════════════════════════════════════════════════════
section "6/7  Configure Nginx"
# ═══════════════════════════════════════════════════════════════

# ── Inject rate-limit zones into main nginx.conf if not present ──
if ! grep -q "zone=api_limit" "$NGINX_MAIN"; then
    # Insert after the opening of the http { block
    sed -i '/^http\s*{/a\\n\t# OneIQ rate limits\n\tlimit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;\n\tlimit_req_zone $binary_remote_addr zone=page_limit:10m rate=60r/m;' "$NGINX_MAIN"
    info "Rate-limit zones added to $NGINX_MAIN"
else
    info "Rate-limit zones already present in $NGINX_MAIN"
fi

# ── Write site config with the detected PHP socket ──────────────
sed "s|unix:/run/php/php[0-9.]\\+-fpm\\.sock|unix:${PHP_SOCK}|g" \
    "$APP_DIR/nginx.conf" > "$NGINX_CONF"

# Enable site, disable default
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t || error "Nginx config test failed — check output above"
systemctl reload nginx
info "Nginx reloaded"

# ═══════════════════════════════════════════════════════════════
section "7/7  Final checks"
# ═══════════════════════════════════════════════════════════════

systemctl is-active --quiet nginx          && info "nginx        — running" || warn "nginx        — NOT running"
systemctl is-active --quiet "$PHP_FPM_SVC" && info "$PHP_FPM_SVC — running" || warn "$PHP_FPM_SVC — NOT running"

DB="$APP_DIR/database/oneiq.sqlite"
[[ -f "$DB" ]] && info "Database     — found ($DB)" || warn "Database     — NOT found"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅  Deployment complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐  http://${DOMAIN}/"
echo -e "  🔐  http://${DOMAIN}/goal  (admin panel)"
echo ""
echo -e "${YELLOW}  ⚠️  Change passwords before going live:${NC}"
echo -e "      nano ${APP_DIR}/config.php"
echo ""
echo -e "  🔒  Add HTTPS (recommended):"
echo -e "      apt install -y certbot python3-certbot-nginx"
echo -e "      certbot --nginx -d ${DOMAIN}"
echo ""
