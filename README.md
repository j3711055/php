# واحد العراق — OneIQ Streaming Platform

A professional Arabic-language sports streaming platform built with **PHP 8.3 + MySQL + Nginx**, containerised with Docker, and production-ready for **Railway** deployment.

---

## Project Structure

```
ONEIQ/
├── index.html              ← Public landing page (matches grid)
├── goal.html               ← Admin dashboard (served at /goal)
├── api.php                 ← REST API (GET public; POST/PUT/DELETE admin)
├── auth.php                ← Login endpoint → returns Bearer token
├── go.php                  ← Referer-stripping stream redirect gateway
├── health.php              ← Railway health check endpoint
├── config.php              ← Reads secrets from environment variables
├── db.php                  ← Shared MySQL PDO singleton + helpers
├── init_db.php             ← DB schema init (auto-runs on boot)
├── composer.json           ← PHP dependency manifest
│
├── Dockerfile              ← PHP 8.3-FPM Alpine + Nginx + supervisord
├── .dockerignore
├── .gitignore
├── railway.json            ← Railway deployment configuration
├── .env.example            ← Template for environment variables
├── supervisord.conf        ← Manages nginx + php-fpm in one container
│
├── docker/
│   ├── nginx.conf          ← Nginx config template (PORT injected at startup)
│   ├── php-fpm.conf        ← PHP-FPM pool (TCP port 9000)
│   ├── php.ini             ← Production PHP settings
│   └── entrypoint.sh       ← Container startup script
│
└── assets/
    ├── css/style.css       ← Main site styles
    ├── css/admin.css       ← Admin dashboard styles
    ├── js/main.js          ← Index page logic
    └── js/admin.js         ← Admin dashboard logic
```

---

## Railway Deployment

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Railway-ready (MySQL)"
git remote add origin https://github.com/YOUR_USERNAME/oneiq.git
git push -u origin main
```

### Step 2 — Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select your `oneiq` repository
3. Railway detects the `Dockerfile` automatically

### Step 3 — Add MySQL Plugin

> ⚠️ **Do this BEFORE the first deploy so env vars are available at boot.**

1. In your Railway project dashboard, click **+ New**
2. Select **Database** → **MySQL**
3. Railway creates a MySQL service and automatically injects these variables into your app service:

| Variable | Set By | Description |
|----------|--------|-------------|
| `MYSQL_URL` | Railway (auto) | Full connection URL |
| `MYSQLHOST` | Railway (auto) | MySQL hostname |
| `MYSQLPORT` | Railway (auto) | MySQL port |
| `MYSQLUSER` | Railway (auto) | MySQL username |
| `MYSQLPASSWORD` | Railway (auto) | MySQL password |
| `MYSQLDATABASE` | Railway (auto) | Database name |

**You do not need to set any MySQL variables manually.**

### Step 4 — Add App Environment Variables

In Railway dashboard → your **app service** (not the MySQL service) → **Variables** tab:

| Variable | Value | Notes |
|----------|-------|-------|
| `ADMIN_TOKEN` | `your-random-token` | Generate: `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | `your-strong-password` | Min 16 chars recommended |
| `APP_ENV` | `production` | Enables strict CORS |

### Step 5 — Deploy

Railway deploys automatically after pushing to GitHub. Watch the deploy logs — the entrypoint will:
1. Wait for MySQL to be ready (up to 60 seconds, 30 retries)
2. Create the `matches` table if it doesn't exist
3. Seed demo data on first boot
4. Start Nginx + PHP-FPM

### Step 6 — Verify

```bash
# Health check (replace with your Railway URL)
curl https://your-app.railway.app/health.php
# Expected: {"status":"ok","details":{"database":"mysql:ok",...}}

# API
curl https://your-app.railway.app/api.php
# Expected: {"success":true,"matches":[...]}
```

---

## Local Development with Docker + MySQL

```bash
# 1. Start a local MySQL container
docker run -d \
  --name oneiq-mysql \
  -e MYSQL_ROOT_PASSWORD=devpass \
  -e MYSQL_DATABASE=oneiq \
  -p 3306:3306 \
  mysql:8.0

# 2. Build the app image
docker build -t oneiq .

# 3. Run the app
docker run -d \
  --name oneiq \
  -p 8080:8080 \
  -e ADMIN_TOKEN=dev-token \
  -e ADMIN_PASSWORD=dev-password \
  -e MYSQLHOST=host.docker.internal \
  -e MYSQLPORT=3306 \
  -e MYSQLUSER=root \
  -e MYSQLPASSWORD=devpass \
  -e MYSQLDATABASE=oneiq \
  -e APP_ENV=development \
  oneiq

# 4. Test
curl http://localhost:8080/health.php
open http://localhost:8080/
open http://localhost:8080/goal
```

---

## URLs

| URL | Purpose |
|-----|---------|
| `https://your-app.railway.app/` | Public streaming landing page |
| `https://your-app.railway.app/goal` | Admin dashboard |
| `https://your-app.railway.app/api.php` | JSON REST API |
| `https://your-app.railway.app/health.php` | Health check (Railway probe) |
| `https://your-app.railway.app/go?id=N` | Referer-stripping stream gateway |

---

## Environment Variables Reference

| Variable | Required | Set By | Description |
|----------|----------|--------|-------------|
| `ADMIN_TOKEN` | ✅ | You | Bearer token for admin API. `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | ✅ | You | Admin panel login password |
| `APP_ENV` | ❌ | You | `production` or `development`. Default: `production` |
| `MYSQL_URL` | ✅* | Railway (auto) | Full MySQL connection URL |
| `MYSQLHOST` | ✅* | Railway (auto) | MySQL hostname |
| `MYSQLPORT` | ✅* | Railway (auto) | MySQL port |
| `MYSQLUSER` | ✅* | Railway (auto) | MySQL username |
| `MYSQLPASSWORD` | ✅* | Railway (auto) | MySQL password |
| `MYSQLDATABASE` | ✅* | Railway (auto) | Database name |
| `PORT` | Auto | Railway (auto) | HTTP port — set automatically, do not override |

*\* Set automatically when you add the Railway MySQL plugin. Only one of `MYSQL_URL` or the individual `MYSQL*` vars is needed.*

---

## API Reference

### `GET /api.php` — List matches (public)
```json
{
  "success": true,
  "matches": [
    {
      "id": 1,
      "match_name": "مباراة الافتتاح",
      "team_a": "البرازيل",
      "team_b": "كرواتيا",
      "match_time": "21:00",
      "stream_link": "https://...",
      "is_live": "1",
      "created_at": "2026-06-25 12:00:00"
    }
  ]
}
```

### `POST /api.php` — Create match (admin)
```bash
curl -X POST https://your-app.railway.app/api.php \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"match_name":"النهائي","team_a":"فرنسا","team_b":"البرازيل","match_time":"21:00","stream_link":"https://stream.example.com","is_live":true}'
```

---

## Security Notes

- Secrets never in source code — read from Railway environment variables
- MySQL credentials injected automatically by Railway's MySQL plugin
- `config.php`, `db.php`, `init_db.php` blocked by Nginx (403)
- Admin login uses `hash_equals()` + random delay (timing/brute-force protection)
- `stream_link` validated as `http/https` before storing and before redirecting
- CORS locked to same-origin in production (`APP_ENV=production`)

---

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#000000` | Page background |
| Red | `#FF0000` | Accents, shapes, icons, CTA buttons |
| Lime Yellow | `#E8FF00` | Brand name, primary bold text |
| Bright Green | `#00FF00` | Tagline "قناة الاخبار الاولى" |
