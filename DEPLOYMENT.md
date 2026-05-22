# 🚀 MEDIAHUB Dashboard - Deployment & Configuration Guide

Complete guide to deploy and manage your real-time monitoring dashboard on Zorin OS with Docker, Tailscale, and Orange CI network monitoring.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Logging & Monitoring](#logging--monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Security](#security)
9. [Maintenance](#maintenance)

---

## Quick Start

### For Development (Local Testing)

```bash
# Navigate to project directory
cd /mnt/Data/mon-dashboard

# Make scripts executable
chmod +x scripts/*.sh

# Start the dashboard
bash scripts/start.sh

# Dashboard will be available at:
# - Frontend: http://localhost:3000
# - API: http://localhost:3001
```

### For Production (Auto-start on Boot)

```bash
# Install as systemd service (requires sudo)
sudo bash scripts/install-service.sh

# The service will automatically start and restart on system reboot
```

---

## Prerequisites

### System Requirements

- **OS**: Zorin OS (or any Ubuntu-based Linux distro)
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB+ for container images and logs
- **Docker**: v24.0+ with Compose v2.20+

### Required Software

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify installation
docker --version
docker compose version
```

### User Permissions

Ensure your user is in the docker group:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Apply group changes (choose one)
newgrp docker              # Temporary
logout && login            # Persistent (requires logout/login)
sudo systemctl restart docker
```

---

## Installation

### Step 1: Prepare Environment

```bash
# Navigate to project directory
cd /mnt/Data/mon-dashboard

# Copy environment template
cp .env.example .env

# Make scripts executable
chmod +x scripts/install-service.sh scripts/start.sh scripts/logs.sh
```

### Step 2: Configure Environment Variables

Edit `.env` file with your settings:

```bash
nano .env
```

**Critical configurations**:

```bash
# API Configuration
API_PORT=3001
DASHBOARD_PORT=3000

# Tailscale (get from https://login.tailscale.com/admin/settings/keys)
TAILSCALE_API_KEY=tskey_YOUR_KEY_HERE
TAILSCALE_TAILNET=your-email@example.com

# Frontend API endpoint
VITE_API_BASE_URL=http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Step 3: Build Docker Image

```bash
cd /mnt/Data/mon-dashboard

# Build the production image
docker compose build

# Verify build
docker images | grep mediahub
```

### Step 4: Test Locally

```bash
# Run in development mode
bash scripts/start.sh

# Test endpoints in another terminal
curl http://localhost:3001/api/health
curl http://localhost:3001/api/docker/containers
```

Press `Ctrl+C` to stop.

---

## Configuration

### API Configuration

#### Docker Socket Access

The API needs access to the Docker socket:

```bash
# Verify socket exists
ls -la /var/run/docker.sock

# Check permissions
stat /var/run/docker.sock

# The container runs with docker group to access the socket
```

#### Tailscale Integration

1. **Get API Key**:
   - Visit: https://login.tailscale.com/admin/settings/keys
   - Click "Generate API key"
   - Copy the key (starts with `tskey_`)

2. **Configure in .env**:
   ```bash
   TAILSCALE_API_KEY=tskey_YOUR_KEY_HERE
   TAILSCALE_TAILNET=your-email@example.com
   ```

3. **Verify Connection**:
   ```bash
   curl http://localhost:3001/api/tailscale/devices
   ```

#### Orange CI Network Monitoring

Configured servers:
- **Abidjan 10G**: 185.36.27.18
- **Bassam**: 185.36.28.18

To test manually:

```bash
# Check connectivity
ping -c 3 185.36.27.18
ping -c 3 185.36.28.18

# Via API
curl http://localhost:3001/api/network/orange-ping
```

### Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | production | Node environment |
| `API_PORT` | 3001 | Backend API port |
| `DASHBOARD_PORT` | 3000 | Frontend port |
| `DOCKER_SOCK` | /var/run/docker.sock | Docker socket path |
| `TAILSCALE_API_KEY` | - | Tailscale auth key |
| `TAILSCALE_TAILNET` | - | Tailscale organization |
| `VITE_API_BASE_URL` | http://localhost:3001 | Frontend API URL |
| `LOG_LEVEL` | info | Logging verbosity |

---

## Deployment

### Option 1: Docker Compose (Development/Testing)

```bash
cd /mnt/Data/mon-dashboard

# Start containers
docker compose up -d

# View logs
docker compose logs -f

# Stop containers
docker compose down
```

### Option 2: Systemd Service (Production)

#### Installation

```bash
# Install and enable service
sudo bash scripts/install-service.sh

# The script will:
# - Copy service file to /etc/systemd/system/
# - Reload systemd daemon
# - Enable auto-start on boot
# - Start the service
```

#### Service Management

```bash
# Start service
sudo systemctl start mediahub-dashboard

# Stop service
sudo systemctl stop mediahub-dashboard

# Restart service
sudo systemctl restart mediahub-dashboard

# Check status
sudo systemctl status mediahub-dashboard

# View recent logs
sudo journalctl -u mediahub-dashboard -n 50

# Follow logs in real-time
sudo journalctl -u mediahub-dashboard -f

# Check if enabled for auto-start
sudo systemctl is-enabled mediahub-dashboard
```

#### Auto-start on Boot

The service is automatically enabled during installation. To verify:

```bash
# Check if enabled
sudo systemctl is-enabled mediahub-dashboard

# Should output: enabled

# To disable auto-start
sudo systemctl disable mediahub-dashboard

# To re-enable
sudo systemctl enable mediahub-dashboard
```

---

## Logging & Monitoring

### View Logs

#### Interactive Menu (Easiest)

```bash
# Open interactive logging menu
bash scripts/logs.sh

# Select option from menu:
# 1 - Live container logs
# 2 - API server logs
# 3 - React app logs
# 4 - Systemd service logs
# 5 - Docker file logs
# 6 - Filtered logs
# 7 - Log statistics
# 8 - Export logs
# 9 - Clean old logs
```

#### Command-line Usage

```bash
# Live logs
bash scripts/logs.sh live

# API logs
bash scripts/logs.sh api

# Systemd logs (requires sudo)
sudo bash scripts/logs.sh systemd

# Filter logs (e.g., errors only)
bash scripts/logs.sh filter "error|failed"

# Export logs to file
bash scripts/logs.sh export logs/backup-$(date +%Y%m%d).log

# Show statistics
bash scripts/logs.sh stats
```

#### Direct Docker Logs

```bash
# Real-time container logs
docker compose logs -f dashboard

# Last 100 lines
docker compose logs --tail=100 dashboard

# With timestamps
docker compose logs --timestamps dashboard

# Filter by keyword
docker compose logs dashboard | grep "error"
```

#### Systemd Logs

```bash
# Last 50 lines
journalctl -u mediahub-dashboard -n 50

# Follow in real-time
journalctl -u mediahub-dashboard -f

# From last 30 minutes
journalctl -u mediahub-dashboard --since "30 minutes ago"

# Since today
journalctl -u mediahub-dashboard --since today

# By priority (only errors)
journalctl -u mediahub-dashboard -p err
```

### Monitor Container Health

```bash
# Check container status
docker ps --filter "name=mediahub"

# View resource usage
docker stats mediahub-dashboard

# Inspect container
docker inspect mediahub-dashboard | grep -A 5 "State"

# Check health status
docker inspect --format='{{.State.Health.Status}}' mediahub-dashboard
```

### Monitor Service Health

```bash
# Check API health
curl http://localhost:3001/api/health | jq .

# Check all endpoints
for endpoint in /health /docker/containers /tailscale/devices /network/orange-ping; do
    echo "Testing $endpoint..."
    curl -s http://localhost:3001/api$endpoint | jq .
done
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker compose logs dashboard

# Check system resources
docker stats

# Verify Docker socket is accessible
ls -la /var/run/docker.sock

# Rebuild image
docker compose build --no-cache
```

### API Not Responding

```bash
# Test connectivity
curl -v http://localhost:3001/api/health

# Check container is running
docker compose ps

# Check port bindings
docker port mediahub-dashboard

# Verify API process inside container
docker compose exec dashboard ps aux | grep node
```

### Tailscale Not Working

```bash
# Verify API key
grep TAILSCALE_API_KEY .env

# Test Tailscale command on host
tailscale status

# Check if Tailscale service is running
sudo systemctl status tailscaled

# View API response
curl http://localhost:3001/api/tailscale/devices | jq .
```

### Docker Socket Permission Denied

```bash
# Fix Docker group permissions
sudo usermod -aG docker $(whoami)

# Apply changes
newgrp docker

# Or restart Docker
sudo systemctl restart docker

# Verify access
docker ps
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Check Docker usage
docker system df

# Clean up unused images
docker image prune

# Remove all unused data
docker system prune -a

# Clean logs
bash scripts/logs.sh clean 7  # Keep last 7 days
```

### Service Not Auto-starting

```bash
# Check if service is enabled
sudo systemctl is-enabled mediahub-dashboard

# Enable it
sudo systemctl enable mediahub-dashboard

# Verify
systemctl is-enabled mediahub-dashboard
# Should output: enabled

# Check systemd for errors
sudo systemctl status mediahub-dashboard
journalctl -u mediahub-dashboard -n 20
```

---

## Security

### API Security

The API is configured with:

- ✅ CORS enabled (configurable in docker-compose.yml)
- ✅ Non-root container user (runs as `app` user)
- ✅ Read-only Docker socket access
- ✅ Environment variable secrets management
- ✅ Graceful signal handling

### Environment Variables Security

**Never commit `.env` to version control!**

```bash
# Verify .env is in .gitignore
cat .gitignore | grep ".env"

# Protect .env file permissions
chmod 600 .env

# Never share API keys in logs
# Verify sensitive data is redacted
cat .env | grep -E "API_KEY|TOKEN|SECRET"
```

### Container Security

```bash
# Run as non-root
# - Specified in Dockerfile as USER app
# - Container has limited permissions

# Check running user
docker compose exec dashboard whoami
# Should output: app

# Verify read-only filesystems where possible
docker inspect mediahub-dashboard | grep "ReadOnly"
```

### Firewall Configuration

```bash
# If using UFW firewall
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 3001/tcp  # API

# View open ports
sudo ss -tlnp | grep -E "3000|3001"

# Or
sudo netstat -tlnp | grep -E "3000|3001"
```

---

## Maintenance

### Regular Updates

```bash
# Pull latest images
docker compose pull

# Rebuild with latest base images
docker compose build --pull

# Restart service to apply updates
sudo systemctl restart mediahub-dashboard
```

### Database/Data Backups

```bash
# Backup important data
sudo tar -czf backup-dashboard-$(date +%Y%m%d).tar.gz \
    /mnt/Data/mon-dashboard/.env \
    /mnt/Data/mon-dashboard/logs/

# Store in safe location
sudo mv backup-dashboard-*.tar.gz /var/backups/
```

### Log Rotation

Logs are automatically rotated by Docker (configured in docker-compose.yml):

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"    # Max file size
    max-file: "3"      # Keep 3 files
```

To manually cleanup old logs:

```bash
bash scripts/logs.sh clean 7  # Keep last 7 days
```

### Monitor Disk Usage

```bash
# Check Docker disk usage
docker system df

# View large images
docker images --sort=size

# View container sizes
docker ps -s

# Clean up periodically
docker system prune -a --volumes --force
```

### Health Checks

Set up monitoring with:

```bash
# Monitor endpoint periodically
while true; do
    curl -s http://localhost:3001/api/health | jq .
    sleep 300  # Every 5 minutes
done

# Or use a monitoring service like Grafana
# Or systemd timer for regular health checks
```

---

## Support & Resources

- **Documentation**: See [README.md](./README.md)
- **Issues**: Report bugs with `bash scripts/logs.sh export logs/issue.log`
- **Logs Location**: `/mnt/Data/mon-dashboard/logs/`
- **Service File**: `/etc/systemd/system/mediahub-dashboard.service`
- **Configuration**: `/mnt/Data/mon-dashboard/.env`

---

## Uninstallation

To completely remove the dashboard:

```bash
# Stop service
sudo systemctl stop mediahub-dashboard

# Disable auto-start
sudo systemctl disable mediahub-dashboard

# Remove service file
sudo rm /etc/systemd/system/mediahub-dashboard.service

# Reload systemd
sudo systemctl daemon-reload

# Remove containers and images (optional)
docker compose down
docker image rm mediahub-dashboard:latest
```

---

**Last Updated**: May 2026

**Maintained by**: DevOps Team

For updates and latest documentation, visit the project repository.
