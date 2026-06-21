# MEDIAHUB Dashboard

A real-time personal media center and infrastructure monitoring dashboard built with **React + TypeScript + Vite** and an **Express.js** backend, running on a self-hosted Linux server.

**Access**: Tailscale VPN `http://100.70.128.90:3000` | **Deployment**: Docker Compose

---

## Widgets

### Left sidebar
| Widget | Description |
|---|---|
| Clock | Live time in French locale |
| Calendar | Current month, today highlighted |
| Weather | Live data from OpenWeatherMap (Abobo, CI) — temperature, feels-like, humidity, wind, condition icon |
| Internet Speed | Official **Ookla Speedtest CLI** — download / upload / ping with last-tested timestamp, persisted across reloads |
| Gmail Inbox | Real unread count via Gmail OAuth — refreshes every 2 min |
| Orange CI | Network latency to Google DNS + Cloudflare DNS (auto-refreshes every 30s) |
| Jellyfin | "Continue watching" with playback progress bars |

### Main content
| Widget | Description |
|---|---|
| System Resources | Live CPU (sampled), RAM, dual-disk usage (`/` and `/mnt/Data`) |
| Multimedia Center | Service cards — Jellyseerr, Radarr, Sonarr, Prowlarr, RDT Client, Jellyfin, qBittorrent — each with a real **update check** badge |
| Seerr | Recent media requests + recently added from Jellyseerr |
| Docker Containers | Live container states via Docker socket |
| Tailscale Network | VPN device list with online/offline status |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS, Framer Motion |
| Backend API | Express 5 (Node.js), port 3001 |
| Container | Docker + Docker Compose (multi-stage build) |
| Icons | Lucide React |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Linux host (tested on Zorin OS)
- `.env` file configured (see below)

### 1. Clone

```bash
git clone https://github.com/donsfak/mon-dashboard.git
cd mon-dashboard
cp .env.example .env
```

### 2. Configure `.env`

```bash
# ── Media ──────────────────────────────────────────────────
JELLYFIN_URL=http://your-ip:8096
JELLYFIN_API_KEY=your-api-key
JELLYFIN_USER_ID=your-user-id

JELLYSEERR_URL=http://your-ip:5055
JELLYSEERR_API_KEY=your-api-key

# ── Arr stack (update checks) ──────────────────────────────
SONARR_URL=http://your-ip:8989
SONARR_API_KEY=your-api-key

RADARR_URL=http://your-ip:7878
RADARR_API_KEY=your-api-key

PROWLARR_URL=http://your-ip:9696
PROWLARR_API_KEY=your-api-key

# ── qBittorrent (live stats) ───────────────────────────────
QBITTORRENT_URL=http://host.docker.internal:8090
QBITTORRENT_USERNAME=your-username
QBITTORRENT_PASSWORD=your-password

# ── Tailscale ──────────────────────────────────────────────
TAILSCALE_API_KEY=tskey-api-xxxx
TAILSCALE_TAILNET=your-email@example.com

# ── Gmail OAuth ────────────────────────────────────────────
# Format: email:label:refresh_token  (run scripts/gmail-auth.cjs to get token)
GMAIL_ACCOUNTS=you@gmail.com:Inbox:your-refresh-token
GMAIL_OAUTH_CLIENT_ID=your-client-id
GMAIL_OAUTH_CLIENT_SECRET=your-client-secret

# ── Weather ────────────────────────────────────────────────
OPENWEATHER_API_KEY=your-api-key
WEATHER_CITY=Abobo,CI

# ── System ─────────────────────────────────────────────────
DISK_PATHS=/host_root,/mnt/Data
```

### 3. Deploy

```bash
docker compose up -d --build
```

Frontend → `http://localhost:3000`  
API → `http://localhost:3001`

---

## Gmail OAuth Setup

The Gmail widget shows real unread counts via Google OAuth.

```bash
# 1. Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in .env
# 2. Run the auth script
node scripts/gmail-auth.cjs

# 3. Open the URL shown, authorize, paste the code
# 4. Copy the printed refresh token into GMAIL_ACCOUNTS in .env
# 5. Restart: docker compose up -d --force-recreate
```

> The Google Cloud app must be in **Testing** mode with your email added as a test user.

---

## Update Checks

Every service card shows a live badge:

- **Actif** (green) — service is up to date
- **Mise à jour** (amber, animated) — update available

| Service | Method |
|---|---|
| Sonarr / Radarr / Prowlarr | `/api/v3/update` — checks `installable: true` |
| Jellyfin | Compares running version against latest GitHub release |
| qBittorrent | Badge always Actif (no update API available) |

---

## API Endpoints

| Endpoint | Description | Cache |
|---|---|---|
| `GET /api/docker/containers` | Container list via Docker socket | 10s |
| `GET /api/tailscale/devices` | VPN devices (Cloud API + mock fallback) | 30s |
| `GET /api/jellyfin/movies` | Continue watching items | 60s |
| `GET /api/jellyseer/requests` | Media requests | 60s |
| `GET /api/jellyseer/recently-added` | Recently added media | 60s |
| `GET /api/services/updates` | Update check for Arr + Jellyfin | 5 min |
| `GET /api/network/orange-ping` | Latency to Google/Cloudflare DNS | 30s |
| `GET /api/network/orange-speed-test` | **Official Ookla speedtest** | on-demand |
| `GET /api/system/resources` | CPU, RAM, multi-disk usage | 8s |
| `GET /api/gmail/inboxes` | Gmail unread counts via OAuth | 2 min |
| `GET /api/qbittorrent/stats` | Active torrents, DL/UL speed | 10s |
| `GET /api/weather` | Current weather from OpenWeatherMap | 10 min |
| `GET /api/health` | Health check | — |

---

## Project Structure

```
mon-dashboard/
├── src/
│   ├── App.tsx                  # Root component, hook wiring
│   ├── components/
│   │   └── DashboardUI.tsx      # All widgets + custom hooks
│   └── data/
│       └── mockData.ts          # Default/fallback data
├── api.js                       # Express backend
├── Dockerfile                   # Multi-stage build (builder + runtime)
├── docker-compose.yml
├── scripts/
│   ├── gmail-auth.cjs           # Gmail OAuth token generator
│   ├── gmail-auth-device-flow.js
│   ├── install-service.sh       # systemd service installer
│   └── start.sh
└── .env.example                 # Full configuration reference
```

---

## Development

```bash
npm install
npm run dev        # Vite + API server (concurrently)
```

```bash
npm run build      # TypeScript + Vite production build
npm run lint       # ESLint
```

---

**Repository**: [github.com/donsfak/mon-dashboard](https://github.com/donsfak/mon-dashboard)  
**Last updated**: June 2026
