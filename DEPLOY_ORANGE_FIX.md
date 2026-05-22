# Quick Deployment - Orange CI Widget Fix

## For Local Development

### 1. Current Status
✅ API Server: Running on port 3001
✅ Frontend Server: Running on port 5173  
✅ New Configuration: Deployed (uses Google DNS & Cloudflare DNS)

### 2. Test Current Setup
```bash
# Test API endpoint (should return Google & Cloudflare DNS latency)
curl http://localhost:3001/api/network/orange-ping | jq .

# View dashboard at
http://localhost:5173
```

### 3. Restart Services (Optional)
```bash
# Kill current server
pkill -f "node api.js"

# Restart API
node api.js &

# Or with npm
npm run dev
```

---

## For Docker Production Deployment

### 1. Update Environment
```bash
# Edit your .env file
nano .env
```

Ensure you have:
```env
NETWORK_SERVER_1=8.8.8.8          # Google DNS (default)
NETWORK_SERVER_2=1.1.1.1          # Cloudflare DNS (default)
# CUSTOM_NETWORK_SERVERS=...      # (optional) For custom servers
```

### 2. Rebuild and Deploy
```bash
# Build new Docker image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f mediahub-dashboard
```

### 3. Verify Deployment
```bash
# Check API endpoint
curl http://localhost:3001/api/network/orange-ping | jq .

# View dashboard
open http://localhost:3000
```

---

## For Systemd Service Deployment

### 1. Install Service (if not already installed)
```bash
sudo bash scripts/install-service.sh
```

### 2. Restart Service with New Configuration
```bash
# Restart the service
sudo systemctl restart mediahub-dashboard

# Check status
sudo systemctl status mediahub-dashboard

# View logs
sudo journalctl -u mediahub-dashboard -f
```

### 3. Verify Widget
Visit: http://localhost:3000 and check the Orange CI widget

---

## Configuration Reference

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NETWORK_SERVER_1` | 8.8.8.8 | Primary latency test server |
| `NETWORK_SERVER_2` | 1.1.1.1 | Secondary latency test server |
| `CUSTOM_NETWORK_SERVERS` | (none) | JSON string for custom servers |
| `ORANGE_TIMEOUT` | 5000 | Network request timeout (ms) |

### Custom Servers Format
```bash
CUSTOM_NETWORK_SERVERS='{"server-key":{"host":"x.x.x.x","alias":"alias","label":"Display Name"}}'
```

Example:
```bash
CUSTOM_NETWORK_SERVERS='{"orange-abidjan":{"host":"185.36.27.18","alias":"abidjan-10g","label":"Abidjan 10G"},"orange-bassam":{"host":"185.36.28.18","alias":"bassam","label":"Bassam"}}'
```

---

## API Endpoint Documentation

### GET /api/network/orange-ping
Returns latency measurements for configured network servers.

**Response Format:**
```json
{
  "server-key": {
    "name": "Display Name",
    "host": "IP or domain",
    "timestamp": "2026-05-19T16:10:38.938Z",
    "success": true,
    "avgLatency": 53,
    "minLatency": 53,
    "maxLatency": 53,
    "method": "dns"
  }
}
```

**Status Codes:**
- `200`: Success (one or more servers responded)
- `500`: All servers failed

---

## Troubleshooting

### Widget shows "Offline"
1. Verify API is running: `curl http://localhost:3001/api/health`
2. Check endpoint: `curl http://localhost:3001/api/network/orange-ping`
3. Verify internet: `ping 8.8.8.8` (should respond)
4. Check firewall: May be blocking DNS on port 53

### High latency (>100ms)
- Normal if geographically distant from server
- May indicate network congestion
- Check with standard ping: `ping 8.8.8.8`

### DNS method being used instead of ICMP
- Expected behavior when ICMP (ping) is blocked
- Very common in corporate/cloud networks
- Still provides accurate latency measurement

---

## Rollback (Restore Orange CI Servers)

To go back to original Orange CI servers:

```bash
# Set in .env
CUSTOM_NETWORK_SERVERS='{"abidjan-10g":{"host":"185.36.27.18","alias":"abidjan-10g","label":"Abidjan 10G"},"bassam":{"host":"185.36.28.18","alias":"bassam","label":"Bassam"}}'

# Restart service
systemctl restart mediahub-dashboard
```

**Note**: These may still show "Offline" if your network cannot reach them.
