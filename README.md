# MEDIAHUB Dashboard

Personal media-center and home-server monitoring dashboard.  
Built with **React 19 + TypeScript + Vite** on the frontend and **Express 5** on the backend, deployed via Docker Compose.

**Live at** → `http://100.70.128.90:3000` (Tailscale VPN)

---

## Features

### Sidebar
| Widget | Data source |
|---|---|
| Clock | Browser `Date` — updates every second |
| Calendar | Browser `Date` — highlights today |
| Weather | OpenWeatherMap API — city, temperature, feels-like, humidity, wind, condition icon |
| Internet speed | Official Ookla Speedtest CLI (`speedtest --format=json`) — persisted in `localStorage` |
| Orange CI | Network latency to Google DNS + Cloudflare DNS — refreshes every 30 s |
| Gmail | Gmail API via OAuth 2.0 — unread count, refreshes every 2 min |
| Jellyfin | "Continue watching" with playback progress — refreshes every 60 s |

### Main content
| Section | Data source |
|---|---|
| System resources | Live CPU (200 ms sample), RAM, dual-disk usage via `/proc` + `df` |
| Multimedia center | Jellyseerr · Radarr · Sonarr · Prowlarr · RDT Client · Jellyfin · qBittorrent — **real update checks** per service |
| Seerr | Recently added (with availability indicator) + recent requests (with seasons, requester avatar, French status) |
| Infrastructure status | Docker (running/total) · Tailscale VPN · Real-Debrid — **all live**, checked every 60 s |
| System info | Live host OS (from `/host_root/etc/os-release`) + uptime (from `/proc/uptime`) |
| Docker containers | 2-column grid, live from Docker socket |
| Tailscale network | Device list from Tailscale Cloud API |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS, Framer Motion, Lucide React |
| Backend | Express 5, Node.js 20 |
| Security | Helmet, express-rate-limit, non-root container, `no-new-privileges`, dropped capabilities |
| Container | Docker + Docker Compose (multi-stage build) |

---

## Quick start

```bash
git clone https://github.com/donsfak/mon-dashboard.git
cd mon-dashboard
cp .env.example .env
# Edit .env with your keys (see Configuration below)
docker compose up -d --build
```

Frontend → `http://localhost:3000`  
API → `http://localhost:3001`

---

## Configuration

All settings live in `.env`. See `.env.example` for the full reference.

```env
# ── Jellyfin ───────────────────────────────────────────────
JELLYFIN_URL=http://your-ip:8096
JELLYFIN_API_KEY=
JELLYFIN_USER_ID=

# ── Jellyseerr ─────────────────────────────────────────────
JELLYSEERR_URL=http://your-ip:5055
JELLYSEERR_API_KEY=

# ── Arr stack (update checks) ──────────────────────────────
SONARR_URL=http://your-ip:8989
SONARR_API_KEY=
RADARR_URL=http://your-ip:7878
RADARR_API_KEY=
PROWLARR_URL=http://your-ip:9696
PROWLARR_API_KEY=

# ── qBittorrent (live stats) ───────────────────────────────
QBITTORRENT_URL=http://host.docker.internal:8090
QBITTORRENT_USERNAME=
QBITTORRENT_PASSWORD=

# ── Tailscale ──────────────────────────────────────────────
TAILSCALE_API_KEY=tskey-api-xxxx
TAILSCALE_TAILNET=your-tailnet

# ── Weather (OpenWeatherMap) ───────────────────────────────
OPENWEATHER_API_KEY=
WEATHER_CITY=Abobo,CI

# ── Gmail OAuth ────────────────────────────────────────────
# Format: email:label:refresh_token
GMAIL_ACCOUNTS=you@gmail.com:Inbox:your-refresh-token
GMAIL_OAUTH_CLIENT_ID=
GMAIL_OAUTH_CLIENT_SECRET=

# ── Real-Debrid ────────────────────────────────────────────
REAL_DEBRID_API_KEY=

# ── Disks to monitor ───────────────────────────────────────
DISK_PATHS=/host_root,/mnt/Data
```

---

## Gmail OAuth setup

```bash
# 1. Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in .env
# 2. Run the token generator
node scripts/gmail-auth.cjs
# 3. Open the URL, authorize, paste the code
# 4. Copy the printed refresh token into GMAIL_ACCOUNTS in .env
# 5. docker compose up -d --force-recreate
```

> The Google Cloud OAuth app must be in **Testing** mode with your email added as a test user.

---

## API endpoints

| Endpoint | Description | Cache TTL |
|---|---|---|
| `GET /api/docker/containers` | Live container list via Docker socket | 10 s |
| `GET /api/tailscale/devices` | VPN device list (Cloud API + fallback) | 30 s |
| `GET /api/jellyfin/movies` | Continue-watching items | 60 s |
| `GET /api/jellyseer/requests` | Media requests with seasons + status | 60 s |
| `GET /api/jellyseer/recently-added` | Recently added media with availability | 60 s |
| `GET /api/services/updates` | Update check — Sonarr/Radarr/Prowlarr/Jellyfin | 5 min |
| `GET /api/network/orange-ping` | Latency to Google DNS + Cloudflare DNS | 30 s |
| `GET /api/network/orange-speed-test` | Official Ookla speedtest (on demand) | — |
| `GET /api/system/resources` | CPU, RAM, disks, OS, uptime | 8 s |
| `GET /api/system/status` | Docker · Tailscale · Real-Debrid live checks | 60 s |
| `GET /api/gmail/inboxes` | Unread counts via Gmail OAuth | 2 min |
| `GET /api/qbittorrent/stats` | Active torrents, DL/UL speed | 10 s |
| `GET /api/weather` | Current weather — OpenWeatherMap | 10 min |
| `GET /api/health` | Health check | — |

---

## Security

- Container runs as non-root `app` user with Docker-socket access via group membership
- `no-new-privileges:true` + all capabilities dropped except `NET_RAW` (fping)
- [Helmet](https://helmetjs.github.io/) security headers on every API response
- Rate limiting: 200 requests / minute per IP
- 30 s request timeout + 10 kb body limit
- `CORS` logged for unknown origins

---

## Project structure

```
mon-dashboard/
├── src/
│   ├── App.tsx               # Root — layout, hook wiring, live system data
│   ├── components/
│   │   └── DashboardUI.tsx   # All widgets, hooks and display components
│   └── data/
│       └── mockData.ts       # Static seed data (service URLs, fallback values)
├── api.js                    # Express backend — all API routes
├── Dockerfile                # Multi-stage build (builder + slim runtime)
├── docker-compose.yml        # Production deployment
├── scripts/
│   ├── gmail-auth.cjs        # Gmail OAuth token generator (reads from .env)
│   ├── gmail-auth-device-flow.js
│   └── install-service.sh
└── .env.example              # Full configuration reference
```

---

## Development

```bash
npm install
npm run dev        # Vite + API server (concurrently on :3000 and :3001)
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
```

---

**Repository** → [github.com/donsfak/mon-dashboard](https://github.com/donsfak/mon-dashboard)
