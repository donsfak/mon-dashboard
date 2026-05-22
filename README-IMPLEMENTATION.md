# 🎯 MEDIAHUB Dashboard - Real-time Monitoring System

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Latest-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)

A production-ready, full-stack monitoring dashboard that provides real-time insights into your infrastructure on Zorin OS using Docker, Tailscale, and Orange CI network monitoring.

![Screenshot Placeholder](docs/screenshot.png)

## ✨ Features

### 🐳 Docker Integration
- **Real-time Container Monitoring**: View status, ports, and health of all Docker containers
- **Host Mode Support**: Direct access to Docker socket for accurate metrics
- **Caching Layer**: Optimized API responses with configurable TTL

### 🛡️ Tailscale Network
- **Device Inventory**: Monitor all connected Tailscale devices in your network
- **Status Tracking**: See online/offline status with IP addresses
- **Multi-device Support**: iOS, Android, macOS, Linux devices
- **VPN Security**: Secure connection through Tailscale mesh network

### 📊 Network Monitoring
- **Orange CI Latency Testing**: Ping tests to Abidjan 10G (185.36.27.18) and Bassam (185.36.28.18)
- **Real-time Results**: Millisecond-precision latency measurements
- **Automatic Refresh**: Periodic polling without page refresh (30-second intervals)
- **Color-coded Status**: Visual indicators for connection quality

### 📱 Modern UI
- **Dark Theme**: Eye-friendly dark interface optimized for 24/7 monitoring
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Updates**: Live data refresh using React hooks
- **Smooth Animations**: Framer Motion animations for polished UX
- **Weather & Time**: Integrated widgets for context

### 🔧 DevOps Ready
- **Multi-stage Docker Build**: Optimized image size (<500MB)
- **Systemd Integration**: Auto-start on system boot
- **Environment Variables**: Secure secret management
- **Docker Compose**: Simple one-command deployment
- **Health Checks**: Built-in container health monitoring

---

## 🚀 Quick Start

### Prerequisites

- **OS**: Zorin OS (or Ubuntu-based Linux)
- **Docker**: v24.0+ with Compose v2.20+
- **Node.js**: v20+ (for local development)
- **RAM**: 4GB minimum
- **Storage**: 20GB for images and data

### 1. Install Docker (if needed)

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Clone & Setup

```bash
cd /mnt/Data/mon-dashboard
cp .env.example .env
nano .env  # Configure your settings
```

### 3. Quick Start (Development)

```bash
chmod +x scripts/*.sh
bash scripts/start.sh
# Dashboard: http://localhost:3000
# API: http://localhost:3001
```

### 4. Production Deployment

```bash
sudo bash scripts/install-service.sh
# Service auto-starts on boot
```

---

## 📋 Configuration

### Essential Environment Variables

```bash
# API Configuration
API_PORT=3001
DASHBOARD_PORT=3000

# Tailscale (Get from https://login.tailscale.com/admin/settings/keys)
TAILSCALE_API_KEY=tskey_YOUR_KEY_HERE
TAILSCALE_TAILNET=your-email@example.com

# Frontend API Connection
VITE_API_BASE_URL=http://localhost:3001
```

### Complete Configuration

See [.env.example](.env.example) for all available options including:
- Logging levels
- Cache TTL settings
- Resource limits
- Network timeouts
- Optional services (Portainer, Watchtower)

---

## 🛠️ Architecture

### Backend API (Express.js + Node.js)

```
api.js (3001)
├── /api/health              - Health check
├── /api/docker/containers   - Docker container status
├── /api/tailscale/devices   - Tailscale device inventory
└── /api/network/orange-ping - Latency to Orange CI servers
```

**Features**:
- Caching layer for reduced load
- Docker socket integration
- Tailscale API client
- ICMP ping functionality
- Graceful shutdown handling

### Frontend (React 19 + Vite)

```
src/
├── App.tsx                  - Main layout & data orchestration
├── components/
│   └── DashboardUI.tsx     - All UI components & hooks
└── data/
    └── mockData.ts         - Mock data structure
```

**Custom Hooks**:
- `useDockerContainers()` - Real-time container data
- `useTailscaleDevices()` - Tailscale device sync
- `useOrangePing()` - Network latency tests
- `useInternetSpeed()` - Speed test functionality

### Docker Deployment

```
├── Dockerfile              - Multi-stage build
├── docker-compose.yml      - Service orchestration
├── mediahub-dashboard.service - Systemd service file
└── .env                    - Environment configuration
```

---

## 📖 API Reference

### Health Check

```bash
curl http://localhost:3001/api/health
# Response: { status: "ok", timestamp: "...", uptime: 123.45 }
```

### Docker Containers

```bash
curl http://localhost:3001/api/docker/containers
# Response: Array of containers with name, state, port, image
```

### Tailscale Devices

```bash
curl http://localhost:3001/api/tailscale/devices
# Response: Array of devices with name, ip, os, status
```

### Orange CI Network Ping

```bash
curl http://localhost:3001/api/network/orange-ping
# Response:
# {
#   "abidjan-10g": { "name": "Abidjan 10G", "host": "185.36.27.18", "avgLatency": 45, ... },
#   "bassam": { "name": "Bassam", "host": "185.36.28.18", "avgLatency": 52, ... }
# }
```

---

## 📊 Monitoring & Logs

### View Logs (Interactive Menu)

```bash
bash scripts/logs.sh
# Select from: Live logs, API logs, App logs, System logs, Filter, Export, Stats
```

### Command-line Log Viewing

```bash
# Live container logs
bash scripts/logs.sh live

# API server logs
bash scripts/logs.sh api

# System logs (production)
sudo bash scripts/logs.sh systemd

# Filter for errors
bash scripts/logs.sh filter "error|failed"

# Export logs for debugging
bash scripts/logs.sh export logs/backup.log
```

### Service Management

```bash
# Start/Stop/Restart
sudo systemctl start mediahub-dashboard
sudo systemctl stop mediahub-dashboard
sudo systemctl restart mediahub-dashboard

# View status
sudo systemctl status mediahub-dashboard

# Real-time logs
sudo journalctl -u mediahub-dashboard -f

# Last 50 lines
sudo journalctl -u mediahub-dashboard -n 50
```

---

## 🔒 Security

### Key Security Features

✅ **Non-root Container**: Runs as `app` user  
✅ **Secret Management**: All secrets in `.env` file  
✅ **Docker Socket**: Read-only access to `/var/run/docker.sock`  
✅ **CORS Protection**: Configurable CORS origins  
✅ **Graceful Shutdown**: Proper signal handling  
✅ **Resource Limits**: Memory and CPU constraints  

### Never Commit Secrets

```bash
# .gitignore already includes:
.env
.env.local
.env.*.local
```

### Protecting API Keys

```bash
# Secure your .env file
chmod 600 .env

# Never commit or share
cat .gitignore | grep ".env"  # Verify ignored

# Store backups securely
sudo cp .env /var/backups/
```

---

## 🧪 Development

### Local Setup

```bash
# Install dependencies
npm install

# Start development servers (Vite + Express)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

### Testing API Endpoints

```bash
# Terminal 1: Start dashboard
bash scripts/start.sh

# Terminal 2: Test endpoints
for endpoint in /health /docker/containers /tailscale/devices /network/orange-ping; do
    echo "Testing $endpoint..."
    curl -s http://localhost:3001/api$endpoint | jq .
done
```

---

## 📦 Deployment Modes

### Mode 1: Docker Compose (Development/Testing)

```bash
cd /mnt/Data/mon-dashboard
docker compose up -d

# Access at http://localhost:3000
```

### Mode 2: Systemd Service (Production)

```bash
sudo bash scripts/install-service.sh

# Auto-starts on boot, monitored by systemd
```

### Mode 3: Custom Orchestration

The Dockerfile and docker-compose.yml can be used with any orchestration platform (Kubernetes, etc.).

---

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs dashboard

# Verify Docker socket
ls -la /var/run/docker.sock

# Check system resources
docker stats

# Rebuild
docker compose build --no-cache
```

### API Not Responding

```bash
# Test endpoint
curl http://localhost:3001/api/health

# Check container
docker compose ps

# Check logs for errors
bash scripts/logs.sh api
```

### Tailscale Data Missing

```bash
# Verify API key in .env
grep TAILSCALE_API_KEY .env

# Test Tailscale on host
tailscale status

# Check service running
sudo systemctl status tailscaled
```

### Disk Space Issues

```bash
# Check usage
df -h
docker system df

# Clean up
docker system prune -a
bash scripts/logs.sh clean 7
```

**Full troubleshooting guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md#troubleshooting)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Complete deployment & maintenance guide |
| [.env.example](.env.example) | Configuration reference |
| [scripts/](./scripts/) | Utility scripts with inline documentation |

---

## 🔄 Real-time Data Refresh

The dashboard automatically refreshes data without requiring page reloads:

| Component | Interval | Source |
|-----------|----------|--------|
| Docker Containers | 5 seconds | `/api/docker/containers` |
| Tailscale Devices | 5 seconds | `/api/tailscale/devices` |
| Orange CI Ping | 30 seconds | `/api/network/orange-ping` |
| Internet Speed | On-demand | Browser fetch test |

Intervals are configurable in `.env`:
```bash
POLLING_INTERVAL=5000              # 5 seconds
DOCKER_CACHE_TTL=5000              # 5 seconds
NETWORK_CACHE_TTL=10000            # 10 seconds
```

---

## 💡 Tips & Best Practices

### Performance Optimization

- Cache TTLs are pre-tuned for balanced responsiveness
- Docker API calls are throttled to 5-second intervals
- Network pings run asynchronously (30-second intervals)

### Monitoring Best Practices

- Check logs regularly: `sudo journalctl -u mediahub-dashboard -f`
- Monitor disk usage: `docker system df`
- Set up external monitoring: Prometheus, Grafana, etc.
- Keep Docker updated: `docker system df && docker image prune`

### Maintenance Schedule

- **Daily**: Check service status, review error logs
- **Weekly**: Monitor disk space, check for updates
- **Monthly**: Update Docker images, review old logs
- **Quarterly**: Rebuild for latest base images

---

## 📝 Project Structure

```
mon-dashboard/
├── src/
│   ├── App.tsx                 # Main React app
│   ├── main.tsx                # Entry point
│   ├── index.css               # Styles
│   ├── components/
│   │   └── DashboardUI.tsx     # All UI components
│   └── data/
│       └── mockData.ts         # Data structure
├── public/                      # Static assets
├── api.js                       # Express backend
├── Dockerfile                   # Production build
├── docker-compose.yml           # Container orchestration
├── .env                         # Configuration (add to .gitignore)
├── .env.example                 # Configuration template
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript config
├── tailwind.config.js          # Tailwind CSS config
├── scripts/
│   ├── install-service.sh      # Install systemd service
│   ├── start.sh                # Quick start script
│   └── logs.sh                 # Logging utilities
├── DEPLOYMENT.md               # Complete deployment guide
└── README.md                   # This file
```

---

## 🤝 Contributing

This is a personal project, but improvements are welcome:

1. Test changes locally
2. Update documentation
3. Follow existing code style
4. Ensure security is maintained

---

## 📄 License

This project is provided as-is for personal use on Zorin OS infrastructure.

---

## 🙋 Support

### Getting Help

1. **Check Logs**: `bash scripts/logs.sh`
2. **Read Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
3. **Test Endpoints**: Use provided curl examples
4. **Export Logs**: `bash scripts/logs.sh export` for analysis

### Common Issues

- **Service won't start**: Check logs with `sudo journalctl -u mediahub-dashboard -n 50`
- **API not responding**: Verify with `curl http://localhost:3001/api/health`
- **Docker socket error**: Ensure user is in docker group: `id $USER`

---

## 🎯 What's Next

### Planned Features

- [ ] Database persistence (PostgreSQL)
- [ ] Historical data tracking
- [ ] Grafana integration
- [ ] Prometheus metrics export
- [ ] Email alerts
- [ ] Mobile app
- [ ] Multi-user support
- [ ] Advanced analytics

### Optimization Roadmap

- WebSocket support for real-time updates
- GraphQL API option
- caching with Redis
- Load balancing
- Container clustering

---

**Version**: 1.0.0  
**Last Updated**: May 2026  
**Status**: ✅ Production Ready

---

### Quick Reference Commands

```bash
# Development
npm run dev              # Start dev servers
npm run build           # Build for production
npm run lint            # Check code quality

# Docker
docker compose up       # Start containers
docker compose down     # Stop containers
docker compose logs -f  # View logs

# Service Management
sudo systemctl start mediahub-dashboard       # Start
sudo systemctl stop mediahub-dashboard        # Stop
sudo systemctl restart mediahub-dashboard     # Restart
sudo systemctl status mediahub-dashboard      # Status

# Logging
bash scripts/logs.sh                          # Interactive menu
sudo journalctl -u mediahub-dashboard -f     # Real-time
bash scripts/logs.sh stats                    # Statistics

# Troubleshooting
curl http://localhost:3001/api/health        # Health check
docker compose ps                            # Container status
docker stats                                  # Resource usage
```

---

For detailed information, see [DEPLOYMENT.md](./DEPLOYMENT.md) 📖
