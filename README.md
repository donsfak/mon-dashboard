# MEDIAHUB Dashboard 🎬

A real-time multimedia and infrastructure monitoring dashboard built with **React + TypeScript + Vite**, running on your private home server.

**Status**: 🟢 Fully Operational | **Version**: v1.0  
**Deployment**: Docker + systemd | **Access**: `http://your-ip:3000`

---

## 📊 Features

### Media Center Integration
- **Jellyfin Resume Progress** - Continue watching items with playback position and progress bars
- **Jellyseerr Requests** - Monitor all media requests (movies/TV) with status indicators
- **Recently Added** - Display newly available content from your Jellyfin library

### Infrastructure Monitoring
- **Service Health Dashboard** - Jellyseerr, Radarr, Sonarr, Prowlarr, RDT Client status
- **Docker Containers** - Real-time container state and resource usage
- **Tailscale Devices** - Connected devices on your private network
- **Network Latency** - ISP connectivity monitoring (Google DNS, Cloudflare DNS)
- **Internet Speed** - Download/upload/latency metrics

### Personal Integrations
- **Gmail Inbox** - Unread count tracking for email accounts *(configurable)*
- **System Resources** - CPU, RAM, Storage monitoring
- **Date/Time/Weather** - Local system information

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Linux host (tested on Zorin OS, Ubuntu 22.04+)
- 2+ GB available disk space
- Environment variables configured

### 1. Clone & Configure

```bash
cd /mnt/Data/mon-dashboard

# Edit environment variables
nano .env
```

**Required Variables**:
```bash
# Jellyfin
JELLYFIN_URL=http://your-ip:8096
JELLYFIN_API_KEY=your-api-key
JELLYFIN_USER_ID=your-user-id

# Jellyseerr
JELLYSEERR_URL=http://your-ip:5055
JELLYSEERR_API_KEY=your-api-key

# Tailscale
TAILSCALE_API_KEY=tskey_YOUR_KEY
TAILSCALE_TAILNET=your-email@example.com

# Optional: Gmail
GMAIL_ACCOUNTS=your-email@gmail.com:Inbox,another@gmail.com:Alerts
```

### 2. Deploy

```bash
# Install as systemd service (auto-starts on boot)
sudo bash scripts/install-service.sh

# Or manually run
bash scripts/start.sh
```

### 3. Access

```
Frontend: http://localhost:3000
API: http://localhost:3001
```

---

## 📁 Architecture

```
mon-dashboard/
├── src/
│   ├── App.tsx                      # Main app component
│   ├── components/
│   │   └── DashboardUI.tsx         # All widgets and components
│   ├── data/
│   │   └── mockData.ts             # Default/fallback data
│   └── index.css                   # Tailwind CSS
├── api.js                           # Express.js backend (port 3001)
├── vite.config.ts                  # Build config
├── docker-compose.yml              # Container setup
├── Dockerfile                       # Multi-stage build
└── scripts/
    ├── install-service.sh          # Systemd service installer
    ├── start.sh                    # Local dev startup
    └── logs.sh                     # View service logs
```

---

## ⚙️ Configuration

### Environment Variables

**Essential**:
```bash
# Jellyfin (Continue watching)
JELLYFIN_URL=http://100.70.128.90:8096
JELLYFIN_API_KEY=<your-api-key>
JELLYFIN_USER_ID=<your-user-id>

# Jellyseerr (Requests & Recently Added)
JELLYSEERR_URL=http://100.70.128.90:5055
JELLYSEERR_API_KEY=<your-api-key>

# Tailscale VPN
TAILSCALE_API_KEY=tskey_<your-key>
TAILSCALE_TAILNET=your-email@example.com
```

**Optional**:
```bash
# Gmail Integration
GMAIL_ACCOUNTS=you@gmail.com:Inbox,alerts@gmail.com:Important
```

---

## 🔧 Development

### Local Setup

```bash
npm install
bash scripts/start.sh
```

### Production Build

```bash
sudo docker compose build --no-cache
sudo systemctl restart mediahub-dashboard.service
```

---

## 📝 Recent Updates

- ✅ Jellyfin resume progress with playback tracking
- ✅ Jellyseerr requests & recently added sections
- ✅ Dynamic active services count from Docker
- ✅ Gmail widget framework (OAuth ready)
- ✅ Remote hostname detection for multi-device access

---

**Last Updated**: June 3, 2026  
**Repository**: [GitHub](https://github.com/donsfak/mon-dashboard)
