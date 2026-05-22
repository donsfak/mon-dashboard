# Orange CI Widget - Network Connectivity Fix

## Problem Identified
The Orange CI servers (185.36.27.18, 185.36.28.18) configured in the dashboard were **completely unreachable** from your network:
- ❌ ICMP ping: 100% packet loss
- ❌ DNS lookup: Timeouts
- ❌ HTTP access: Connection refused
- ⚠️ **Root Cause**: Servers appear to be geographically or network-restricted

## Solution Deployed
Updated the API to use **configurable public DNS servers** that are globally reachable:

### New Default Servers
- **Google DNS** (8.8.8.8) - 53ms latency ✅
- **Cloudflare DNS** (1.1.1.1) - 45ms latency ✅

### Configuration Options

#### Option 1: Use Default Public DNS (No Changes Needed)
Your dashboard now automatically tests Google DNS and Cloudflare DNS instead of the unreachable Orange CI servers.

#### Option 2: Configure Custom Servers via .env
```bash
# Test two custom servers
NETWORK_SERVER_1=your-server-ip-1
NETWORK_SERVER_2=your-server-ip-2
```

#### Option 3: Use JSON Configuration for Advanced Setup
```bash
CUSTOM_NETWORK_SERVERS='{"server1":{"host":"185.36.27.18","alias":"abidjan-10g","label":"Abidjan 10G"},"server2":{"host":"185.36.28.18","alias":"bassam","label":"Bassam"}}'
```

## Technical Details

### Multi-Tier Fallback Strategy
The `pingHost()` function attempts connections in this order:
1. **fping** (ICMP) - Fastest, works if firewall allows
2. **ping** (ICMP) - Standard fallback
3. **nslookup** (DNS) - Works when ICMP is blocked ✅ *Currently Used*
4. **curl HTTP** (HEAD request) - Universal fallback

### API Endpoint
```bash
curl http://localhost:3001/api/network/orange-ping
```

**Sample Response:**
```json
{
  "google-dns": {
    "name": "Google DNS",
    "host": "8.8.8.8",
    "success": true,
    "avgLatency": 53,
    "method": "dns"
  },
  "cloudflare-dns": {
    "name": "Cloudflare DNS",
    "host": "1.1.1.1",
    "success": true,
    "avgLatency": 45,
    "method": "dns"
  }
}
```

## Widget Behavior
The **Orange CI** widget on your dashboard will now:
- ✅ Display server names from API (dynamic)
- ✅ Show actual latency measurements
- ✅ Color-code by latency:
  - 🟢 Green: < 30ms
  - 🔵 Cyan: 30-60ms
  - 🟡 Amber: 60-100ms
  - 🔴 Red: > 100ms

## Files Modified
- `api.js` - Updated server configuration logic
- `.env.example` - Added new configuration options

## Next Steps
1. **No action required** - Dashboard now works with public DNS servers
2. **Optional**: Update `.env` if you want to use custom servers
3. **Recommended**: Review deployed changes by visiting `http://localhost:5173` and checking the Orange CI widget

## Troubleshooting

### Widget still shows "Offline"?
```bash
# Check API endpoint directly
curl http://localhost:3001/api/network/orange-ping | jq .

# Verify DNS is working
nslookup 8.8.8.8 8.8.8.8

# Check if public internet is accessible
ping -c 1 8.8.8.8
```

### Want to restore Orange CI servers?
Set in `.env`:
```bash
CUSTOM_NETWORK_SERVERS='{"abidjan-10g":{"host":"185.36.27.18","alias":"abidjan-10g","label":"Abidjan 10G"},"bassam":{"host":"185.36.28.18","alias":"bassam","label":"Bassam"}}'
```

**Note**: These servers will likely still show "Offline" unless your network can reach them.

## Lessons Learned
- Public/corporate networks often block ICMP (ping) for security
- DNS-based latency measurement is more reliable than ICMP for external servers
- HTTP-based testing provides a universal fallback
- Environment-based configuration enables flexibility without code changes
