# ⚡ MEDIAHUB Dashboard - Quick Start Guide

**Status**: 🟢 Ready to Deploy  
**Time to Setup**: ~5 minutes  
**Difficulty**: ⭐ Easy  

---

## 🎯 Two-Minute Setup

### Step 1: Configure Environment (1 min)

```bash
cd /mnt/Data/mon-dashboard

# Make scripts executable
chmod +x scripts/*.sh

# Edit configuration
nano .env
```

**Minimum Required Changes**:
```bash
# Get your Tailscale API key from:
# https://login.tailscale.com/admin/settings/keys

TAILSCALE_API_KEY=tskey_YOUR_KEY_HERE
TAILSCALE_TAILNET=your-email@example.com
```

**Save**: Press `Ctrl+X` then `Y` then `Enter`

### Step 2: Install & Start (4 min)

```bash
# Install as systemd service (auto-starts on boot)
sudo bash scripts/install-service.sh

# Or test locally first:
bash scripts/start.sh
```

### Step 3: Access Dashboard ✅

```
🌐 Frontend: http://localhost:3000
🔧 API: http://localhost:3001
```

---

## 📖 What Works Out of the Box

| Feature | Status | Location |
|---------|--------|----------|
| ✅ Docker Container Monitoring | Ready | Main dashboard |
| ✅ Tailscale Device List | Ready | Right sidebar |
| ✅ Orange CI Ping Tests | Ready | Left sidebar |
| ✅ Real-time Updates | Ready | Auto-refresh 5-30s |
| ✅ Dark Theme UI | Ready | Full responsive design |
| ✅ Auto-start on Boot | Ready | Via systemd |
| ✅ Comprehensive Logging | Ready | `bash scripts/logs.sh` |

---

## 🚀 Common Commands

### Check Service Status

```bash
sudo systemctl status mediahub-dashboard
```

**Expected Output**:
```
● mediahub-dashboard.service - MEDIAHUB Dashboard
   Loaded: loaded (/etc/systemd/system/mediahub-dashboard.service; enabled)
   Active: active (running) since...
```

### View Live Logs

```bash
# Interactive menu (easiest)
bash scripts/logs.sh

# Or direct systemd logs
sudo journalctl -u mediahub-dashboard -f

# Or Docker logs
docker compose -f /mnt/Data/mon-dashboard/docker-compose.yml logs -f
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# Docker containers
curl http://localhost:3001/api/docker/containers | jq

# Tailscale devices  
curl http://localhost:3001/api/tailscale/devices | jq

# Orange CI ping
curl http://localhost:3001/api/network/orange-ping | jq
```

### Restart Service

```bash
sudo systemctl restart mediahub-dashboard

# Wait for startup
sleep 5

# Check status
sudo systemctl status mediahub-dashboard
```

### Stop Service

```bash
sudo systemctl stop mediahub-dashboard
```

### Disable Auto-start (if needed)

```bash
sudo systemctl disable mediahub-dashboard
```

---

## 🔧 Troubleshooting Quick Fixes

### "Service not running"

```bash
# Check what went wrong
sudo journalctl -u mediahub-dashboard -n 20

# Restart it
sudo systemctl restart mediahub-dashboard

# Verify
sudo systemctl status mediahub-dashboard
```

### "Connection refused" (API)

```bash
# Verify container is running
docker ps | grep mediahub

# Check port binding
sudo ss -tlnp | grep 3001

# View API logs
bash scripts/logs.sh api
```

### "Docker permission denied"

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply changes
newgrp docker

# Or logout/login or restart Docker
sudo systemctl restart docker
```

### "Tailscale data not showing"

```bash
# Check API key is set
grep TAILSCALE_API_KEY .env

# Verify Tailscale is running on host
tailscale status

# Check Tailscale service
sudo systemctl status tailscaled
```

---

## 📊 Monitor in Real-Time

### Option 1: Watch Dashboard

Open browser to **http://localhost:3000**

- Dark theme with live updates
- Auto-refreshes every 5-30 seconds
- No manual refresh needed

### Option 2: Watch Logs

```bash
# All logs in one place
bash scripts/logs.sh

# Or follow systemd journal
sudo journalctl -u mediahub-dashboard -f
```

### Option 3: Monitor Endpoints

```bash
# Test all endpoints
for endpoint in health docker/containers tailscale/devices network/orange-ping; do
    echo "=== $endpoint ==="
    curl -s http://localhost:3001/api/$endpoint | head -c 200
    echo ""
done
```

---

## 🎯 Understanding the Dashboard

### Left Sidebar
- **Clock & Calendar**: Current time and date
- **Weather**: Abidjan current conditions
- **Internet Speed**: Manual speed test button
- **Orange CI**: Network latency to servers
  - Abidjan 10G
  - Bassam
  - Color coded: Green (fast), Red (slow)

### Main Content

**Media Center Section**:
- Your media services (Radarr, Sonarr, etc.)
- Status indicators
- Quick access links

**Infrastructure Status**:
- Docker host mode
- Tailscale VPN status
- Real Debrid status

**Docker Containers**:
- Live list of all containers
- Status (running/stopped)
- Port numbers
- Real-time updates

**Tailscale Devices**:
- All connected devices
- Online/offline status
- IP addresses
- Device type icons

---

## 🔐 Security Notes

⚠️ **Never share**:
- `.env` file
- `TAILSCALE_API_KEY`
- Any API credentials

✅ **Already protected**:
- `.env` excluded from git (in .gitignore)
- Container runs as non-root user
- Docker socket access is read-only
- All secrets in environment variables

---

## 📝 Configuration Guide

### Essential Settings (.env)

```bash
# Application
NODE_ENV=production              # Leave as is
TZ=Africa/Abidjan               # Your timezone

# Ports
API_PORT=3001                   # Backend port
DASHBOARD_PORT=3000             # Frontend port

# MUST CONFIGURE - Get from https://login.tailscale.com/admin/settings/keys
TAILSCALE_API_KEY=tskey_...    # Your API key
TAILSCALE_TAILNET=email@...    # Your Tailscale account

# Frontend API URL (usually no change needed)
VITE_API_BASE_URL=http://localhost:3001
```

### Optional Settings

```bash
# Logging (default: info)
LOG_LEVEL=info                  # debug, info, warn, error

# Polling intervals (in milliseconds)
POLLING_INTERVAL=5000           # How often to refresh UI data
DOCKER_CACHE_TTL=5000          # Docker data cache time
NETWORK_CACHE_TTL=10000        # Ping data cache time
```

---

## 🎓 For Advanced Users

### View Docker Image

```bash
docker images | grep mediahub
```

### Manual Container Operations

```bash
# View all containers
docker ps -a

# View logs directly
docker logs mediahub-dashboard

# Execute command in container
docker exec mediahub-dashboard node -v
```

### Check Service File

```bash
# View systemd service
sudo cat /etc/systemd/system/mediahub-dashboard.service

# Edit if needed
sudo nano /etc/systemd/system/mediahub-dashboard.service
sudo systemctl daemon-reload
```

### Rebuild Image

```bash
cd /mnt/Data/mon-dashboard
docker compose build --no-cache
```

---

## 📞 Help & Documentation

| Need | File | Command |
|------|------|---------|
| Full setup guide | DEPLOYMENT.md | `cat DEPLOYMENT.md` |
| Implementation details | IMPLEMENTATION.md | `cat IMPLEMENTATION.md` |
| View logs | scripts/logs.sh | `bash scripts/logs.sh` |
| Configuration | .env.example | `cat .env.example` |
| README | README.md | `cat README.md` |

---

## ✅ Verification Checklist

After installation, verify everything works:

- [ ] Service is running: `sudo systemctl status mediahub-dashboard`
- [ ] Frontend loads: **http://localhost:3000**
- [ ] API responds: `curl http://localhost:3001/api/health`
- [ ] Docker list appears on dashboard
- [ ] Tailscale API key configured in `.env`
- [ ] Tailscale devices show on dashboard
- [ ] Orange CI ping appears in left sidebar
- [ ] Logs show no errors: `sudo journalctl -u mediahub-dashboard -n 20`

---

## 🎯 Next: Configure Tailscale

### Get API Key (2 minutes)

1. Visit: **https://login.tailscale.com/admin/settings/keys**
2. Click **"Generate API key"**
3. Copy the key (starts with `tskey_`)
4. Edit `.env`: `nano .env`
5. Paste into `TAILSCALE_API_KEY=`
6. Set `TAILSCALE_TAILNET=your-email@example.com`
7. Save & restart: `sudo systemctl restart mediahub-dashboard`

### Verify It Works

```bash
# Check API response
curl http://localhost:3001/api/tailscale/devices | jq

# Should show your connected devices
```

---

## 🚀 Ready to Go!

Your dashboard is now:
- ✅ Running continuously on your system
- ✅ Auto-starting on system boot
- ✅ Monitoring Docker containers in real-time
- ✅ Testing network latency to Orange CI servers
- ✅ Displaying live Tailscale device status

**Access it anytime** at **http://localhost:3000**

---

## 💡 Pro Tips

1. **Bookmark it**: Add http://localhost:3000 to browser bookmarks
2. **Monitor logs**: Keep `bash scripts/logs.sh live` in another terminal
3. **Auto-refresh**: Dashboard refreshes automatically (no manual refresh needed)
4. **Night mode**: Dark theme is already active (no configuration needed)
5. **Mobile access**: You can access from other devices on your network

---

## 🆘 Still Having Issues?

```bash
# 1. Check comprehensive logs
bash scripts/logs.sh

# 2. Export logs for analysis
bash scripts/logs.sh export logs/debug-$(date +%s).log

# 3. Read detailed guide
cat DEPLOYMENT.md | grep -A 20 "Troubleshooting"

# 4. Check all endpoints
for ep in health docker/containers tailscale/devices network/orange-ping; do
    echo "Testing: $ep"
    curl http://localhost:3001/api/$ep 2>&1 | head -c 100
    echo ""
done
```

---

**Quick Links**:
- 🌐 **Dashboard**: http://localhost:3000
- 🔧 **API**: http://localhost:3001
- 📖 **Docs**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- ⚙️ **Config**: [.env](./.env)
- 🚀 **Status**: `sudo systemctl status mediahub-dashboard`

---

**Status**: ✅ PRODUCTION READY  
**Version**: 1.0.0  
**Support**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive guide

Enjoy your monitoring dashboard! 🎉
