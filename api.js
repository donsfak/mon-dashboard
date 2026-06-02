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
  jellyfinMovies: { data: null, timestamp: 0, ttl: 30000 },
  serviceUpdates: { data: null, timestamp: 0, ttl: 300000 },
  jellyseerRequests: { data: null, timestamp: 0, ttl: 30000 },
  jellyseerRecentlyAdded: { data: null, timestamp: 0, ttl: 30000 }
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
// Endpoint to get Continue Watching items from Jellyfin
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

    if (!jellyfinUrl || !apiKey || !userId) {
      console.warn('⚠️ Jellyfin configuration missing');
      return res.status(400).json({ error: 'Jellyfin not configured' });
    }

    const fetchJson = async (url) => {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jellyfin API Error ${response.status}: ${errorText}`);
      }
      return response.json();
    };

    const normalizeItem = (item) => {
      const playbackPositionTicks = item.UserData?.PlaybackPositionTicks || 0;
      const isEpisode = item.Type === 'Episode';
      const title = isEpisode && item.SeriesName ? item.SeriesName : item.Name;
      const imageItemId = item.SeriesId || item.ParentId || item.Id;
      const seasonNumber = item.ParentIndexNumber ?? item.SeasonNumber ?? null;
      const episodeNumber = item.IndexNumber ?? null;
      const episodeCode = (seasonNumber && episodeNumber)
        ? `S${String(seasonNumber).padStart(2, '0')}:E${String(episodeNumber).padStart(2, '0')}`
        : null;
      return {
        id: item.SeriesId || item.Id,
        title,
        episodeTitle: isEpisode ? item.Name : null,
        episodeCode,
        year: item.ProductionYear,
        poster: item.ImageTags?.Primary
          ? `${jellyfinUrl}/Items/${imageItemId}/Images/Primary?api_key=${apiKey}`
          : null,
        playCount: item.UserData?.PlayCount || 0,
        lastPlayed: item.UserData?.LastPlayedDate || null,
        playbackPosition: playbackPositionTicks ? Math.round(playbackPositionTicks / 10000000) : 0,
        runtime: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 10000000 / 60) : 0,
        duration: item.RunTimeTicks ? item.RunTimeTicks / 10000000 : 0,
        overview: item.Overview
      };
    };

    let items = [];

    try {
      const resumeData = await fetchJson(
        `${jellyfinUrl}/Users/${userId}/Items/Resume?api_key=${apiKey}&Limit=20&Fields=Overview,RunTimeTicks,UserData,SeriesId,SeriesName,ProductionYear,ImageTags,IndexNumber,ParentIndexNumber,SeasonNumber`
      );
      items = Array.isArray(resumeData.Items) ? resumeData.Items : [];
    } catch (error) {
      console.warn('⚠️ Jellyfin Resume endpoint failed, falling back:', error.message);
    }

    if (items.length === 0) {
      const libraries = await fetchJson(
        `${jellyfinUrl}/Users/${userId}/Items?api_key=${apiKey}&IncludeItemTypes=CollectionFolder`
      );
      const libraryIds = (libraries.Items || [])
        .filter((lib) => lib.Type === 'CollectionFolder')
        .map((lib) => lib.Id);

      const inProgressResponses = await Promise.all(
        libraryIds.map((libraryId) => fetchJson(
          `${jellyfinUrl}/Users/${userId}/Items?api_key=${apiKey}&ParentId=${libraryId}&Filters=IsInProgress&SortBy=DatePlayed&SortOrder=Descending&Limit=20&IncludeItemTypes=Episode,Movie`
        ))
      );

      items = inProgressResponses.flatMap((response) => response.Items || []);
    }

    const seen = new Set();
    const movies = items
      .filter((item) => item.Type !== 'CollectionFolder')
      .map(normalizeItem)
      .filter((item) => {
        if (!item.title || seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      })
      .slice(0, 10);

    setCacheData('jellyfinMovies', movies);
    res.json(movies);
  } catch (error) {
    console.error('Jellyfin API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============= JELLYSEERR API =============
const jellyseerImageBase = 'https://image.tmdb.org/t/p/w342';

const getJellyseerConfig = () => ({
  url: process.env.JELLYSEERR_URL,
  apiKey: process.env.JELLYSEERR_API_KEY
});

const jellyseerRequest = async (path) => {
  const { url, apiKey } = getJellyseerConfig();
  if (!url || !apiKey) {
    return null;
  }
  const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
    headers: { 'X-Api-Key': apiKey }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jellyseerr API Error ${response.status}: ${errorText}`);
  }
  return response.json();
};

const buildPoster = (posterPath) => posterPath ? `${jellyseerImageBase}${posterPath}` : null;

const fetchJellyseerTmdb = async (mediaType, tmdbId) => {
  if (!tmdbId || !mediaType) {
    return null;
  }
  const endpoint = mediaType === 'tv'
    ? `/api/v1/tmdb/tv/${tmdbId}`
    : `/api/v1/tmdb/movie/${tmdbId}`;
  try {
    const data = await jellyseerRequest(endpoint);
    if (!data) {
      return null;
    }
    return {
      title: data.name || data.title || null,
      posterPath: data.posterPath || data.poster_path || null,
      year: data.firstAirDate || data.releaseDate || data.first_air_date || data.release_date || null
    };
  } catch (error) {
    console.warn('⚠️ Jellyseerr TMDB lookup failed:', error.message);
    return null;
  }
};

app.get('/api/jellyseer/requests', async (req, res) => {
  try {
    const cached = getCacheData('jellyseerRequests');
    if (cached) {
      return res.json(cached);
    }

    const data = await jellyseerRequest('/api/v1/request?take=10&skip=0&sort=added');
    if (!data) {
      return res.status(400).json({ error: 'Jellyseerr not configured' });
    }

    const requests = await Promise.all((data.results || []).map(async (item) => {
      const mediaType = (item.type || item.media?.mediaType || item.media?.type || '').toLowerCase();
      let title = item.media?.title || item.media?.name || item.title || item.name || null;
      let year = item.media?.releaseDate || item.media?.firstAirDate || null;
      let posterPath = item.media?.posterPath || item.posterPath || null;

      if (!title || !posterPath) {
        const tmdb = await fetchJellyseerTmdb(mediaType, item.media?.tmdbId);
        if (tmdb) {
          title = title || tmdb.title;
          year = year || tmdb.year;
          posterPath = posterPath || tmdb.posterPath;
        }
      }

      return {
        id: item.id,
        title,
        year,
        type: mediaType || null,
        status: item.status || item.media?.status || null,
        poster: buildPoster(posterPath)
      };
    }));

    setCacheData('jellyseerRequests', requests);
    res.json(requests);
  } catch (error) {
    console.error('Jellyseerr requests error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jellyseer/recently-added', async (req, res) => {
  try {
    const cached = getCacheData('jellyseerRecentlyAdded');
    if (cached) {
      return res.json(cached);
    }

    const data = await jellyseerRequest('/api/v1/media?take=12&skip=0&sort=added');
    if (!data) {
      return res.status(400).json({ error: 'Jellyseerr not configured' });
    }

    const items = await Promise.all((data.results || []).map(async (item) => {
      const mediaType = (item.mediaType || item.type || '').toLowerCase();
      let title = item.title || item.name || null;
      let year = item.releaseDate || item.firstAirDate || null;
      let posterPath = item.posterPath || null;

      if (!title || !posterPath) {
        const tmdb = await fetchJellyseerTmdb(mediaType, item.tmdbId);
        if (tmdb) {
          title = title || tmdb.title;
          year = year || tmdb.year;
          posterPath = posterPath || tmdb.posterPath;
        }
      }

      return {
        id: item.id,
        title,
        year,
        type: mediaType || null,
        poster: buildPoster(posterPath)
      };
    }));

    setCacheData('jellyseerRecentlyAdded', items);
    res.json(items);
  } catch (error) {
    console.error('Jellyseerr recently added error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============= SERVICES UPDATE STATUS =============
// Endpoint to get update status for Sonarr/Radarr/Prowlarr
app.get('/api/services/updates', async (req, res) => {
  try {
    const cached = getCacheData('serviceUpdates');
    if (cached) {
      return res.json(cached);
    }

    const services = [
      { key: 'sonarr', url: process.env.SONARR_URL, apiKey: process.env.SONARR_API_KEY },
      { key: 'radarr', url: process.env.RADARR_URL, apiKey: process.env.RADARR_API_KEY },
      { key: 'prowlarr', url: process.env.PROWLARR_URL, apiKey: process.env.PROWLARR_API_KEY }
    ];

    const fetchUpdateStatus = async ({ url, apiKey }) => {
      if (!url || !apiKey) {
        return null;
      }

      const endpoints = ['api/v3/update', 'api/v1/update'];
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${url.replace(/\/$/, '')}/${endpoint}`, {
            headers: { 'X-Api-Key': apiKey }
          });
          if (!response.ok) {
            continue;
          }
          const data = await response.json();
          if (Array.isArray(data)) {
            return data.some((item) => item && item.available === true) || data.length > 0;
          }
          return false;
        } catch (error) {
          // Try next endpoint
        }
      }

      return null;
    };

    const results = {};
    for (const service of services) {
      results[service.key] = {
        updateAvailable: await fetchUpdateStatus(service)
      };
    }

    setCacheData('serviceUpdates', results);
    res.json(results);
  } catch (error) {
    console.error('Service update check error:', error.message);
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