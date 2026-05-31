import express from 'express';
import cors from 'cors';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createServer } from 'http';

const app = express();
const execAsync = promisify(exec);
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Cache for reducing repeated API calls
const cache = {
  dockerContainers: { data: null, timestamp: 0, ttl: 5000 },
  tailscaleDevices: { data: null, timestamp: 0, ttl: 5000 },
  orangePing: { data: null, timestamp: 0, ttl: 10000 },
  jellyfinMovies: { data: null, timestamp: 0, ttl: 30000 }
};

const getCacheData = (key) => {
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  return null;
};

const setCacheData = (key, data) => {
  cache[key].data = data;
  cache[key].timestamp = Date.now();
};

app.use(cors());
app.use(express.json());

// ============= PING FUNCTIONALITY =============
// Network monitoring servers (configurable via environment variables)
// Defaults: Public DNS servers that are reliably reachable worldwide
const NETWORK_SERVERS = {
  // Primary: Google DNS (highly available, low latency worldwide)
  'google-dns': { 
    host: process.env.NETWORK_SERVER_1 || '8.8.8.8', 
    alias: 'google-dns',
    label: 'Google DNS' 
  },
  // Secondary: Cloudflare DNS (backup, excellent latency)
  'cloudflare-dns': { 
    host: process.env.NETWORK_SERVER_2 || '1.1.1.1', 
    alias: 'cloudflare-dns',
    label: 'Cloudflare DNS' 
  }
};

// Legacy support: Allow custom Orange CI servers via environment
const CUSTOM_SERVERS = process.env.CUSTOM_NETWORK_SERVERS 
  ? JSON.parse(process.env.CUSTOM_NETWORK_SERVERS)
  : null;

// Ping function with timeout and retry logic
const pingHost = async (host, timeout = 5000) => {
  try {
    // Method 1: Try fping first (fastest)
    try {
      const { stdout, stderr } = await execAsync(
        `fping -q -c 3 -t ${timeout} ${host} 2>&1`,
        { timeout }
      );
      
      // Parse fping output: "185.36.27.18 : 45.2 45.1 45.3"
      const match = stdout.match(/\d+\.\d+\.\d+\.\d+\s*:\s*([\d.]+\s+)+/);
      if (match) {
        const latencies = stdout.match(/([\d.]+)\s+/g).map(x => parseFloat(x));
        return {
          success: true,
          avgLatency: Math.round(latencies.reduce((a, b) => a + b) / latencies.length),
          minLatency: Math.round(Math.min(...latencies)),
          maxLatency: Math.round(Math.max(...latencies))
        };
      }
    } catch (e1) {
      // fping failed, try ping
      const { stdout } = await execAsync(
        `ping -c 3 -W 2 ${host} 2>&1`,
        { timeout }
      );
      
      // Parse ping output: "min/avg/max/stddev = 45.1/45.2/45.3/0.1 ms"
      const match = stdout.match(/= ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
      if (match) {
        return {
          success: true,
          minLatency: Math.round(parseFloat(match[1])),
          avgLatency: Math.round(parseFloat(match[2])),
          maxLatency: Math.round(parseFloat(match[3]))
        };
      }
      
      // Try alternative ping parsing for some systems
      const altMatch = stdout.match(/time=([\d.]+)\s*ms/g);
      if (altMatch && altMatch.length > 0) {
        const times = altMatch.map(x => parseFloat(x.match(/[\d.]+/)[0]));
        return {
          success: true,
          avgLatency: Math.round(times.reduce((a, b) => a + b) / times.length),
          minLatency: Math.round(Math.min(...times)),
          maxLatency: Math.round(Math.max(...times))
        };
      }
    }
    
    // Method 2: Fallback to nslookup + timing (for containers without ICMP)
    const start = Date.now();
    try {
      await execAsync(`nslookup ${host} 8.8.8.8`, { timeout: 2000 });
      const latency = Date.now() - start;
      return {
        success: true,
        avgLatency: latency,
        minLatency: latency,
        maxLatency: latency,
        method: 'dns'
      };
    } catch (e) {
      // DNS lookup failed too
    }
    
    // Method 3: Curl HEAD request timing
    const curlStart = Date.now();
    try {
      await execAsync(`curl -I --max-time 3 --connect-timeout 2 http://${host} 2>/dev/null`, 
        { timeout: 4000 });
      const curlLatency = Date.now() - curlStart;
      return {
        success: true,
        avgLatency: curlLatency,
        minLatency: curlLatency,
        maxLatency: curlLatency,
        method: 'http'
      };
    } catch (e) {
      // HTTP test also failed
    }
    
    throw new Error('All ping methods failed (ICMP, DNS, HTTP)');
  } catch (error) {
    console.warn(`⚠️  Ping failed for ${host}: ${error.message}`);
    return {
      success: false,
      error: error.message,
      avgLatency: null,
      minLatency: null,
      maxLatency: null,
      note: 'Container may lack ICMP permissions. Ensure CAP_NET_RAW is enabled or run with --cap-add=NET_RAW'
    };
  }
};

// Endpoint to get Docker containers with caching
app.get('/api/docker/containers', async (req, res) => {
  try {
    // Check cache first
    const cached = getCacheData('dockerContainers');
    if (cached) {
      return res.json(cached);
    }

    const containers = await docker.listContainers({ all: true });
    const data = containers.map(c => {
      const name = c.Names[0]?.replace(/^\//, '') || 'unknown';
      const ports = c.Ports[0]?.PublicPort || c.Ports[0]?.PrivatePort || null;
      return {
        id: c.Id,
        name: name,
        state: c.State,
        status: c.Status,
        port: ports,
        image: c.Image
      };
    });

    setCacheData('dockerContainers', data);
    res.json(data);
  } catch (error) {
    console.error('Docker API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get Tailscale devices with caching
app.get('/api/tailscale/devices', async (req, res) => {
  const mockDevices = [
    { id: '1', name: 'sfak55-ideapad (Serveur)', os: 'Linux', ip: '100.70.128.90', status: 'online' },
    { id: '2', name: 'iphone-14', os: 'iOS', ip: '100.70.186.72', status: 'online' },
    { id: '3', name: 'mibox4', os: 'Android', ip: '100.106.14.79', status: 'offline' }
  ];

  try {
    // 1. Vérification du cache
    const cached = getCacheData('tailscaleDevices');
    if (cached) return res.json(cached);

    // 2. Variables d'environnement pour l'API Cloud Tailscale
    const apiKey = process.env.TAILSCALE_API_KEY;
    const tailnet = process.env.TAILSCALE_TAILNET;

    // 3. METHODE CLOUD (Fonctionne parfaitement dans Docker)
    if (apiKey && tailnet) {
      try {
        const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
        const response = await fetch(`https://api.tailscale.com/api/v2/tailnet/${tailnet}/devices`, {
          headers: { 'Authorization': authHeader }
        });

        if (response.ok) {
          const data = await response.json();
          const realDevices = data.devices.map(peer => {
            const lastSeen = new Date(peer.lastSeen);
            const isOnline = (Date.now() - lastSeen.getTime()) < (10 * 60 * 1000);
            return {
              id: peer.id,
              name: peer.hostname,
              ip: peer.addresses?.[0] || 'N/A',
              os: peer.os || 'Unknown',
              status: isOnline ? 'online' : 'offline',
            };
          });
          setCacheData('tailscaleDevices', realDevices);
          return res.json(realDevices);
        } else {
          // Si l'API Tailscale refuse la connexion, on affiche POURQUOI
          const errorText = await response.text();
          console.error(`❌ Erreur Tailscale HTTP ${response.status}:`, errorText);
        }
      } catch (apiError) {
        console.warn('⚠️ Échec de l\'API Cloud Tailscale:', apiError.message);
      }
    }

    // 4. METHODE FALLBACK (Si l'API Cloud n'est pas configurée)
    console.warn('Utilisation des fausses données Tailscale (Mocks)');
    setCacheData('tailscaleDevices', mockDevices);
    res.json(mockDevices);

  } catch (error) {
    console.error('Erreur globale Tailscale:', error.message);
    res.json(mockDevices);
  }
});

// ============= JELLYFIN API =============
// Endpoint to get recent Jellyfin movies
app.get('/api/jellyfin/movies', async (req, res) => {
  try {
    // Check cache first
    const cached = getCacheData('jellyfinMovies');
    if (cached) {
      return res.json(cached);
    }

    const jellyfinUrl = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;
    const userId = process.env.JELLYFIN_USER_ID;

    if (!jellyfinUrl || !apiKey) {
      console.warn('⚠️ Jellyfin configuration missing (URL or API key)');
      return res.status(400).json({ error: 'Jellyfin not configured' });
    }

    // Fetch recent movies using Jellyfin API
    const response = await fetch(
      `${jellyfinUrl}/Users/${userId}/Items?api_key=${apiKey}&IncludeItemTypes=Movie&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Limit=10&Fields=Overview,MediaStreams,RunTimeTicks,UserData`,
      { method: 'GET' }
    );

    if (!response.ok) {
      console.error(`❌ Jellyfin API Error ${response.status}:`, await response.text());
      return res.status(response.status).json({ error: 'Failed to fetch from Jellyfin' });
    }

    const data = await response.json();
    
    // Transform Jellyfin items to our format
    const movies = data.Items.map(item => ({
      id: item.Id,
      title: item.Name,
      year: item.ProductionYear,
      poster: item.ImageTags?.Primary 
        ? `${jellyfinUrl}/Items/${item.Id}/Images/Primary?api_key=${apiKey}`
        : null,
      playCount: item.UserData?.PlayCount || 0,
      lastPlayed: item.UserData?.LastPlayedDate || null,
      runtime: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 10000000 / 60) : 0,
      duration: item.RunTimeTicks ? item.RunTimeTicks / 10000000 : 0,
      overview: item.Overview
    }));

    setCacheData('jellyfinMovies', movies);
    res.json(movies);
  } catch (error) {
    console.error('Jellyfin API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============= NETWORK MONITORING =============
// Endpoint for Orange CI latency testing
app.get('/api/network/orange-ping', async (req, res) => {
  try {
    // Check cache first
    const cached = getCacheData('orangePing');
    if (cached) {
      return res.json(cached);
    }

    // Use custom servers if provided, otherwise default to public DNS
    const serversToTest = CUSTOM_SERVERS || NETWORK_SERVERS;
    const results = {};
    
    for (const [key, config] of Object.entries(serversToTest)) {
      console.log(`🔍 Pinging ${config.label || key} (${config.host})...`);
      results[config.alias] = {
        name: config.label || key,
        host: config.host,
        timestamp: new Date().toISOString(),
        ...(await pingHost(config.host))
      };
    }

    setCacheData('orangePing', results);
    res.json(results);
  } catch (error) {
    console.error('Network Ping Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all network metrics at once
app.get('/api/network/metrics', async (req, res) => {
  try {
    const orangeData = getCacheData('orangePing') || {};
    res.json({
      timestamp: new Date().toISOString(),
      orange: orangeData
    });
  } catch (error) {
    console.error('Network Metrics Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Speed test against Orange servers
// Speed test against Orange servers (Using official Ookla Speedtest-CLI)
app.get('/api/network/orange-speed-test', async (req, res) => {
  try {
    console.log(`📊 Lancement du vrai Speedtest Ookla (cela peut prendre 20-30 secondes)...`);
    
    // On exécute le vrai speedtest en ligne de commande avec une sortie JSON
    // On alloue un timeout de 60 secondes car un vrai test télécharge de gros fichiers
    const { stdout } = await execAsync('speedtest-cli --json', { timeout: 60000 });
    const result = JSON.parse(stdout);
    
    // speedtest-cli renvoie les débits en bits par seconde. On convertit en Mbps (Mégabits)
    const downloadMbps = Math.round(result.download / 1000000);
    const uploadMbps = Math.round(result.upload / 1000000);
    const latencyMs = Math.round(result.ping);
    const serverName = `${result.server.name} - ${result.server.sponsor}`;
    
    console.log(`✅ Speedtest terminé : ${downloadMbps} Mbps / ${uploadMbps} Mbps sur ${serverName}`);

    // On formate les données pour que ton frontend React les affiche correctement
    const results = {
      'orange-ci-ookla': {
        name: serverName,
        host: result.server.host,
        timestamp: result.timestamp || new Date().toISOString(),
        success: true,
        latency: latencyMs,
        download: downloadMbps,
        upload: uploadMbps,
        method: 'speedtest-cli'
      }
    };
    
    res.json(results);
  } catch (error) {
    console.error('Speed Test Error:', error.message);
    // En cas d'échec (pas de connexion, timeout), on renvoie une erreur propre
    res.status(500).json({ error: 'Le test de débit a échoué. Vérifiez la connexion.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Graceful shutdown
const server = createServer(app);

const PORT = process.env.API_PORT || 3001;
const HOST = process.env.API_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  🚀 Dashboard API Server Started           ║
╠════════════════════════════════════════════╣
║  🌐 Host: ${HOST}:${PORT}${' '.repeat(Math.max(0, 28 - `${HOST}:${PORT}`.length))}║
║  🐳 Docker: ${process.env.DOCKER_SOCK || '/var/run/docker.sock'}${' '.repeat(Math.max(0, 20 - (process.env.DOCKER_SOCK || '/var/run/docker.sock').length))}║
║  🔄 Cache TTL: ${cache.dockerContainers.ttl}ms             ║
║  ⏱️  Network: ${cache.orangePing.ttl}ms             ║
╚════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('📛 SIGTERM received, gracefully shutting down...');
  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT received, gracefully shutting down...');
  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});