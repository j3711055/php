# واحد العراق — OneIQ Streaming Platform

A professional Arabic-language sports streaming platform built with **PHP 8.3 + SQLite + Nginx**, containerised with Docker, and production-ready for **Railway** deployment.

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
├── db.php                  ← Shared PDO singleton + helpers
├── init_db.php             ← DB initialization (auto-runs on first boot)
├── composer.json           ← PHP dependency manifest
│
├── Dockerfile              ← Multi-stage Docker build
├── .dockerignore           ← Files excluded from Docker image
├── .gitignore              ← Files excluded from Git
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
    ├── css/
    │   ├── style.css       ← Main site styles
    │   └── admin.css       ← Admin dashboard styles
    └── js/
        ├── main.js         ← Index page logic
        └── admin.js        ← Admin dashboard logic
```

---

## Railway Deployment (Recommended)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Railway-ready"
git remote add origin https://github.com/YOUR_USERNAME/oneiq.git
git push -u origin main
```

### Step 2 — Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo**
3. Select your `oneiq` repository
4. Railway will detect the `Dockerfile` automatically

### Step 3 — Add Environment Variables

In Railway dashboard → your service → **Variables** tab, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `ADMIN_TOKEN` | `your-random-token` | Generate: `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | `your-strong-password` | Min 16 chars recommended |
| `SQLITE_DB_PATH` | `/data/oneiq.sqlite` | Must match Volume mount point |
| `APP_ENV` | `production` | Enables strict CORS |

### Step 4 — Add Persistent Volume

> ⚠️ **Critical:** Without this, your database resets on every redeploy!

1. Railway dashboard → your service → **Volumes** tab
2. Click **Add Volume**
3. Set **Mount Path** to `/data`
4. Click **Add**

Railway will redeploy automatically. Your SQLite database now survives redeploys.

### Step 5 — Verify Deployment

After deploy completes:

```bash
# Health check
curl https://your-app.railway.app/health.php

# Expected response:
# {"status":"ok","details":{"database":"ok","db_writable":"yes",...}}

# API
curl https://your-app.railway.app/api.php

# Expected response:
# {"success":true,"matches":[...]}
```

---

## Local Development with Docker

```bash
# 1. Copy environment template
cp .env.example .env
# Edit .env with your values

# 2. Build the image
docker build -t oneiq .

# 3. Run (with local volume for SQLite persistence)
docker run -d \
  --name oneiq \
  -p 8080:8080 \
  -v oneiq-data:/data \
  -e ADMIN_TOKEN=my-dev-token \
  -e ADMIN_PASSWORD=my-dev-password \
  -e SQLITE_DB_PATH=/data/oneiq.sqlite \
  -e APP_ENV=development \
  oneiq

# 4. Test
curl http://localhost:8080/health.php
open http://localhost:8080/
open http://localhost:8080/goal
```

---

## Local Development (PHP built-in server)

```bash
# 1. Install PHP 8.1+ with pdo_sqlite
# macOS:  brew install php
# Ubuntu: apt install php8.3-sqlite3

# 2. Copy environment file
cp .env.example .env
# Edit .env: set SQLITE_DB_PATH=./database/oneiq.sqlite

# 3. Initialize database
php init_db.php

# 4. Start server
php -S localhost:8080

# 5. Visit
open http://localhost:8080/
open http://localhost:8080/goal.html
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

### `PUT /api.php?id=N` — Update match (admin)
Same body as POST, add `?id=N` to URL.

### `DELETE /api.php?id=N` — Delete match (admin)
```bash
curl -X DELETE https://your-app.railway.app/api.php?id=1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_TOKEN` | ✅ | Bearer token for admin API. Generate: `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | ✅ | Admin panel login password |
| `SQLITE_DB_PATH` | ✅ on Railway | Path to SQLite file. Use `/data/oneiq.sqlite` on Railway |
| `APP_ENV` | ❌ | `production` (strict CORS) or `development`. Default: `production` |
| `PORT` | Auto | Set automatically by Railway. Do not set manually |

---

## Security Notes

- Secrets are **never** in source code — read from environment variables only
- `config.php`, `db.php`, `init_db.php` are blocked by Nginx (403)
- `database/` directory is blocked by Nginx (403)
- SQLite file has `0640` permissions
- Admin login uses `hash_equals()` + random delay to resist timing/brute-force attacks
- `stream_link` is validated as `http/https` before storing and before redirecting
- In production, CORS is same-origin only (no wildcard `*`)
- `go.php` validates stored URLs before redirecting (open-redirect protection)
- `docker/` directory is blocked by Nginx (403)

---

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#000000` | Page background |
| Red | `#FF0000` | Accents, shapes, icons, CTA buttons |
| Lime Yellow | `#E8FF00` | Brand name, primary bold text |
| Bright Green | `#00FF00` | Tagline "قناة الاخبار الاولى" |
