# ══════════════════════════════════════════════════════════════
#  OneIQ — Dockerfile
#  Base:  php:8.3-fpm-alpine
#  Stack: PHP-FPM 9000 (TCP) + Nginx (listens on $PORT) + supervisord
#  DB:    Railway MySQL plugin (no local DB in container)
# ══════════════════════════════════════════════════════════════

FROM php:8.3-fpm-alpine

# ── Labels ────────────────────────────────────────────────────
LABEL maintainer="OneIQ" \
      description="واحد العراق — World Cup Streaming Platform" \
      version="3.0.0"

# ── Install system packages ───────────────────────────────────
RUN apk add --no-cache \
        nginx \
        supervisor \
        gettext

# ── Install PHP extensions ────────────────────────────────────
# pdo_mysql uses the bundled mysqlnd driver — no extra Alpine
# packages required. pdo is already compiled into the base image.
RUN docker-php-ext-install pdo_mysql mysqli

# ── PHP configuration ─────────────────────────────────────────
COPY docker/php.ini /usr/local/etc/php/conf.d/oneiq.ini

# ── PHP-FPM pool configuration ────────────────────────────────
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf

# ── Nginx configuration (template — PORT injected at runtime) ─
COPY docker/nginx.conf /etc/nginx/nginx.conf.template

# ── Supervisord configuration ─────────────────────────────────
RUN mkdir -p /etc/supervisor/conf.d
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Entrypoint script ─────────────────────────────────────────
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Application source ────────────────────────────────────────
WORKDIR /var/www/html

COPY . .

# ── Remove files that must not be in the container image ──────
RUN rm -f deploy.sh .env task.md 2>/dev/null || true \
    && rm -rf database/ 2>/dev/null || true

# ── Nginx runtime directories ─────────────────────────────────
RUN mkdir -p /run/nginx /var/log/nginx /var/log/php-fpm \
    && chown -R www-data:www-data /var/www/html \
    && chown -R www-data:www-data /var/log/nginx \
    && chown -R www-data:www-data /var/log/php-fpm

# ── Expose (documentation only — Railway uses $PORT env var) ──
EXPOSE 8080

# ── Health check ──────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD wget -qO- http://127.0.0.1:${PORT:-8080}/health.php | grep -q 'ok' || exit 1

# ── Start ─────────────────────────────────────────────────────
CMD ["/bin/sh", "/entrypoint.sh"]
