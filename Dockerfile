# ══════════════════════════════════════════════════════════════
#  OneIQ — Dockerfile
#  Base:  php:8.3-fpm-alpine
#  Stack: PHP-FPM 9000 (TCP) + Nginx (listens on $PORT) + supervisord
#  Railway: mounts persistent Volume at /data for SQLite
# ══════════════════════════════════════════════════════════════

FROM php:8.3-fpm-alpine

# ── Labels ────────────────────────────────────────────────────
LABEL maintainer="OneIQ" \
      description="واحد العراق — World Cup Streaming Platform" \
      version="2.0.0"

# ── Install system packages ───────────────────────────────────
RUN apk add --no-cache \
        nginx \
        supervisor \
        sqlite \
        gettext \
    && rm -rf /var/cache/apk/*

# ── Install PHP extensions ────────────────────────────────────
RUN docker-php-ext-install pdo pdo_sqlite

# ── PHP configuration ─────────────────────────────────────────
COPY docker/php.ini /usr/local/etc/php/conf.d/oneiq.ini

# ── PHP-FPM pool configuration ────────────────────────────────
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf

# ── Nginx configuration (template — PORT injected at runtime) ─
COPY docker/nginx.conf /etc/nginx/nginx.conf.template

# ── Supervisord configuration ─────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Entrypoint script ─────────────────────────────────────────
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Application source ────────────────────────────────────────
WORKDIR /var/www/html

COPY . .

# ── Remove files that must not be in the container image ──────
RUN rm -f deploy.sh \
           .env \
           task.md \
           database/oneiq.sqlite 2>/dev/null || true

# ── Nginx runtime directories ─────────────────────────────────
RUN mkdir -p /run/nginx /var/log/nginx /var/log/php-fpm \
    && chown -R www-data:www-data /var/www/html \
    && chown -R www-data:www-data /var/log/nginx \
    && chown -R www-data:www-data /var/log/php-fpm

# ── Persistent data directory (Railway Volume mounts here) ────
# The actual /data directory is provided by the Railway Volume.
# We create it here as a fallback so the container still works
# locally (without a volume) using an ephemeral directory.
RUN mkdir -p /data && chown -R www-data:www-data /data

# ── Expose (documentation only — Railway uses $PORT env var) ──
EXPOSE 8080

# ── Health check ──────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:${PORT:-8080}/health.php | grep -q '"ok"' || exit 1

# ── Start ─────────────────────────────────────────────────────
CMD ["/entrypoint.sh"]
