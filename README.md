<div align="center">

<img src="https://cdn.jsdelivr.net/gh/a9ii/MTProxy-Installer-Manager/images/oneIQ.webp" alt="OneIQ Logo" width="120" />

# واحد العراق — OneIQ Streaming Platform

**Arabic sports streaming platform — PHP 8.3 + MySQL + Nginx on Railway**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

![PHP](https://img.shields.io/badge/PHP-8.3-777BB4?logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-Alpine-009639?logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-Template-0B0D0E?logo=railway&logoColor=white)

</div>

---

## ✨ Features

- 🏆 **Live match dashboard** — real-time sports streaming links with live/upcoming status
- 🔐 **Secure admin panel** — Bearer-token auth, brute-force delay, constant-time comparison
- 🚀 **Railway-native** — auto-detects `$PORT`, MySQL plugin vars injected automatically
- 🐳 **Single Docker container** — PHP-FPM 9000 + Nginx + supervisord, Alpine-based
- 🌐 **Arabic UI** — RTL layout, Cairo/Tajawal fonts, full Unicode support
- 🛡️ **Production-hardened** — CORS locked in production, open-redirect protection, OPcache
- ♻️ **Auto-init DB** — schema + demo data created on first boot, idempotent
- 📡 **Referer-stripping gateway** — `/go?id=N` strips Referer for CDN-protected streams

---

## 🏗️ Architecture

```
Railway Project
├── 🚂 App Service  (this repo — Dockerfile)
│   ├── supervisord (PID 1)
│   │   ├── nginx      → listens on $PORT (Railway-assigned)
│   │   └── php-fpm    → TCP 127.0.0.1:9000
│   └── Routes
│       ├── GET  /           → index.html   (public matches grid)
│       ├── GET  /goal       → goal.html    (admin dashboard)
│       ├── *    /api.php    → REST API
│       ├── POST /auth.php   → login → Bearer token
│       ├── GET  /go?id=N    → referer-strip redirect
│       └── GET  /health.php → Railway health probe
│
└── 🗄️ MySQL Service  (Railway plugin — auto-provisioned)
    └── Injects MYSQL_URL, MYSQLHOST, MYSQLUSER, … automatically
```

---

## 🚀 Deploy on Railway

### One-Click Deploy

> Click the button below — Railway will prompt you for the two required secrets, then deploy everything automatically.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

---

### Manual Deploy

#### 1 — Fork or clone this repo

```bash
git clone https://github.com/YOUR_USERNAME/oneiq.git
cd oneiq
```

#### 2 — Create Railway project

```bash
# Install Railway CLI (optional but handy)
npm install -g @railway/cli
railway login
railway init
```

Or use the [Railway dashboard](https://railway.app) → **New Project** → **Deploy from GitHub**.

#### 3 — Add MySQL plugin

In Railway dashboard → **+ New** → **Database** → **MySQL**

Railway automatically injects all `MYSQL_*` variables into your app service. **No manual DB config needed.**

#### 4 — Set required environment variables

In Railway → your **app service** → **Variables** tab:

| Variable | Required | Example | Description |
|----------|:--------:|---------|-------------|
| `ADMIN_TOKEN` | ✅ | `a3f8b2...` | Bearer token for admin API. Run: `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | ✅ | `MyStr0ngP@ss` | Admin panel login password |
| `APP_ENV` | ✅ | `production` | Enables strict CORS and error suppression |

> ℹ️ All `MYSQL_*` variables are set **automatically** by the Railway MySQL plugin. Do not set them manually.

#### 5 — Deploy

```bash
# Via CLI
railway up

# Or push to GitHub — Railway auto-deploys on every push
git push origin main
```

#### 6 — Verify

```bash
# Replace with your Railway-generated domain
export URL=https://your-app.up.railway.app

curl $URL/health.php
# {"status":"ok","details":{"database":"mysql:ok",...}}

curl $URL/api.php
# {"success":true,"matches":[...demo data...]}
```

---

## 📁 Project Structure

```
oneiq/
├── 📄 index.html              Public streaming landing page
├── 📄 goal.html               Admin dashboard  (/goal)
│
├── 🔧 api.php                 REST API  (GET public · POST/PUT/DELETE admin)
├── 🔧 auth.php                Login → returns Bearer token
├── 🔧 go.php                  Referer-stripping stream gateway  (/go?id=N)
├── 🔧 health.php              Railway health check  (/health.php)
├── 🔧 config.php              Reads all secrets from environment variables
├── 🔧 db.php                  MySQL PDO singleton + helpers
├── 🔧 init_db.php             Schema init — auto-runs on first boot
├── 📦 composer.json           PHP 8.1+ manifest
│
├── 🐳 Dockerfile              php:8.3-fpm-alpine + nginx + supervisord
├── 📋 railway.toml            Railway build/deploy config (config-as-code)
├── 📋 railway.json            Railway config (JSON alternative)
├── 📋 supervisord.conf        Process manager — nginx + php-fpm
├── 📝 .env.example            Environment variable template
│
└── docker/
    ├── nginx.conf             Nginx template  (${PORT} injected at runtime)
    ├── php-fpm.conf           PHP-FPM pool  (TCP 9000)
    ├── php.ini                Production PHP config
    └── entrypoint.sh          Startup: wait MySQL → init DB → start services

assets/
├── css/style.css              Public site styles
├── css/admin.css              Admin panel styles
├── js/main.js                 Public page logic
└── js/admin.js                Admin dashboard logic
```

---

## 🔌 API Reference

### Public endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api.php` | List all matches |
| `GET` | `/go?id=N` | Stream redirect (strips Referer) |
| `GET` | `/health.php` | Health check |

### Admin endpoints (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api.php` | Create match |
| `PUT` | `/api.php?id=N` | Update match |
| `DELETE` | `/api.php?id=N` | Delete match |
| `POST` | `/auth.php` | Login → get token |

#### Example: create a match

```bash
curl -X POST https://your-app.up.railway.app/api.php \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "match_name":  "نهائي كأس العالم",
    "team_a":      "فرنسا",
    "team_b":      "البرازيل",
    "match_time":  "21:00 بتوقيت بغداد",
    "stream_link": "https://stream.example.com/live",
    "is_live":     true
  }'
```

---

## 💻 Local Development

### Option A — Docker Compose (recommended)

```bash
# Copy env template
cp .env.example .env
# Edit .env with local values

# Start everything
docker compose up
```

Create `docker-compose.yml` in the project root:

```yaml
version: "3.9"
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: devpass
      MYSQL_DATABASE: oneiq
    ports:
      - "3306:3306"

  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      ADMIN_TOKEN: dev-token-change-me
      ADMIN_PASSWORD: dev-password-change-me
      MYSQLHOST: db
      MYSQLPORT: 3306
      MYSQLUSER: root
      MYSQLPASSWORD: devpass
      MYSQLDATABASE: oneiq
      APP_ENV: development
    depends_on:
      - db
```

Then visit: `http://localhost:8080/`

### Option B — PHP built-in server

```bash
# Requires PHP 8.1+ with pdo_mysql
# macOS:  brew install php mysql
# Ubuntu: apt install php8.3-mysql mysql-server

cp .env.example .env   # edit with your local MySQL creds
php init_db.php        # create schema + demo data
php -S localhost:8080  # start dev server

# Visit:
open http://localhost:8080/
open http://localhost:8080/goal.html  # admin panel
```

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| No secrets in code | All credentials read from `getenv()` |
| Admin auth | Bearer token via `hash_equals()` (constant-time) |
| Brute-force protection | Random 100–300ms delay on failed login |
| CORS | Same-origin only in production (`APP_ENV=production`) |
| Open-redirect protection | `stream_link` validated as `http/https` on save and on redirect |
| Nginx file blocking | `config.php`, `db.php`, `init_db.php`, `docker/` all return 403 |
| PHP hardening | `expose_php=Off`, `display_errors=Off`, `allow_url_fopen=Off` |
| XSS prevention | All output through `htmlspecialchars()` or DOM `textContent` |

---

## 🌈 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#000000` | Page background |
| Accent Red | `#FF0000` | Shapes, icons, CTA buttons |
| Lime Yellow | `#E8FF00` | Brand name, headings |
| Bright Green | `#00FF00` | Tagline text |

---

## 📝 Notes

- The Railway MySQL plugin auto-provisions a database and injects all connection variables — no manual database setup required.
- The entrypoint polls MySQL for up to 60 seconds before starting. If MySQL isn't ready in time, the container exits and Railway's restart policy retries automatically.
- The `/go?id=N` endpoint strips the HTTP `Referer` header using three independent mechanisms (HTTP header, meta tag, JS `about:blank` redirect) to bypass CDN referer checks.
- Admin session tokens are stored in `sessionStorage` — they expire automatically when the browser tab is closed.

---

<div align="center">

Made with ❤️ for **واحد العراق**

[Telegram](https://t.me/IRAQ2TV) · [Railway Docs](https://docs.railway.app) · [Report Issue](https://github.com/YOUR_USERNAME/oneiq/issues)

</div>
