import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createServer } from 'http';
import os from 'os';
import { google } from 'googleapis';

const app = express();
const execAsync = promisify(exec);
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Cache for reducing repeated API calls
const cache = {
  dockerContainers:     { data: null, timestamp: 0, ttl: 10000  }, // 10s
  tailscaleDevices:     { data: null, timestamp: 0, ttl: 30000  }, // 30s
  orangePing:           { data: null, timestamp: 0, ttl: 30000  }, // 30s
  jellyfinMovies:       { data: null, timestamp: 0, ttl: 60000  }, // 1 min
  serviceUpdates:       { data: null, timestamp: 0, ttl: 300000 }, // 5 min
  jellyseerRequests:    { data: null, timestamp: 0, ttl: 60000  }, // 1 min
  jellyseerRecentlyAdded: { data: null, timestamp: 0, ttl: 60000 }, // 1 min
  gmailInboxes:         { data: null, timestamp: 0, ttl: 120000 }, // 2 min
  systemResources:      { data: null, timestamp: 0, ttl: 8000   }  // 8s
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

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,       // SPA served separately on port 3000
  crossOriginEmbedderPolicy: false
}));

// ── CORS — restrict to same-host origins only ─────────────────────────────────
const allowedOrigins = [
  `http://localhost:3000`,
  `http://127.0.0.1:3000`,
  ...(process.env.VITE_API_BASE_URL
    ? [process.env.VITE_API_BASE_URL.replace('/api', '').replace(':3001', ':3000')]
    : [])
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (same-host curl, server-to-server)
    if (!origin || allowedOrigins.some(o => origin.startsWith(o.replace('/api', '')))) {
      cb(null, true);
    } else {
      cb(null, true); // personal dashboard: stay permissive but log unknown origins
      if (origin) console.warn(`⚠️  CORS: unexpected origin ${origin}`);
    }
  },
  credentials: true
}));

// ── Rate limiting — generous for personal use (200 req/min per IP) ─────────────
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
}));

// ── Request timeout (prevent hung connections) ────────────────────────────────
app.use((req, res, next) => {
  res.setTimeout(30000, () => res.status(408).json({ error: 'Request timeout' }));
  next();
});

app.use(express.json({ limit: '10kb' })); // Limit body size

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
    // Method 1: Try fping first — -p 100 spaces pings 100ms apart → ~300ms total vs ~2s default
    try {
      const { stdout } = await execAsync(
        `fping -q -c 3 -p 100 -t ${timeout} ${host} 2>&1`,
        { timeout }
      );
      // fping summary: "host : xmt/rcv/%loss = min/avg/max"
      const summary = stdout.match(/=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/);
      if (summary) {
        return {
          success: true,
          minLatency: Math.round(parseFloat(summary[1])),
          avgLatency: Math.round(parseFloat(summary[2])),
          maxLatency: Math.round(parseFloat(summary[3]))
        };
      }
      // Fallback: individual time format "host : t1 t2 t3"
      const times = stdout.match(/([\d.]+)\s+/g)?.map(x => parseFloat(x));
      if (times?.length) {
        return {
          success: true,
          avgLatency: Math.round(times.reduce((a, b) => a + b) / times.length),
          minLatency: Math.round(Math.min(...times)),
          maxLatency: Math.round(Math.max(...times))
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

const fetchJellyseerDetails = async (mediaType, tmdbId) => {
  if (!tmdbId || !mediaType) {
    return null;
  }
  const endpoint = mediaType === 'tv'
    ? `/api/v1/tv/${tmdbId}`
    : `/api/v1/movie/${tmdbId}`;
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

    const jellyfinUserId = process.env.JELLYFIN_USER_ID;
    const jellyseerUserId = process.env.JELLYSEERR_USER_ID;
    const jellyseerBase = process.env.JELLYSEERR_URL?.replace(/\/$/, '');

    const requests = await Promise.all((data.results || []).map(async (item) => {
      const mediaType = (item.type || item.media?.mediaType || item.media?.type || '').toLowerCase();
      let title = item.media?.title || item.media?.name || item.title || item.name || null;
      let year = item.media?.releaseDate || item.media?.firstAirDate || null;
      let posterPath = item.media?.posterPath || item.posterPath || null;

      if (!title || !posterPath) {
        const tmdb = await fetchJellyseerDetails(mediaType, item.media?.tmdbId);
        if (tmdb) {
          title = title || tmdb.title;
          year = year || tmdb.year;
          posterPath = posterPath || tmdb.posterPath;
        }
      }

      // Build avatar URL from relative path
      const rawAvatar = item.requestedBy?.avatar || null;
      const avatar = rawAvatar
        ? (rawAvatar.startsWith('http') ? rawAvatar : `${jellyseerBase}${rawAvatar}`)
        : null;

      // Season numbers for TV requests
      const seasons = Array.isArray(item.seasons)
        ? item.seasons.map(s => s.seasonNumber).filter(n => n != null).sort((a, b) => a - b)
        : [];

      return {
        id: item.id,
        title,
        year: year ? new Date(year).getFullYear() : null,
        type: mediaType || null,
        requestStatus: item.status || null,       // 1=pending, 2=approved, 3=declined
        mediaStatus:   item.media?.status || null, // 3=processing, 4=partial, 5=available
        poster: buildPoster(posterPath),
        requestedBy: item.requestedBy?.displayName || item.requestedBy?.username || null,
        requestedByJellyfinId: item.requestedBy?.jellyfinUserId || null,
        requestedById: item.requestedBy?.id || null,
        avatar,
        seasons
      };
    }));

    const filteredRequests = requests.filter((item) => {
      if (jellyseerUserId) {
        return String(item.requestedById) === String(jellyseerUserId);
      }
      if (jellyfinUserId) {
        return item.requestedByJellyfinId === jellyfinUserId;
      }
      return true;
    });

    setCacheData('jellyseerRequests', filteredRequests);
    res.json(filteredRequests);
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
        const tmdb = await fetchJellyseerDetails(mediaType, item.tmdbId);
        if (tmdb) {
          title = title || tmdb.title;
          year = year || tmdb.year;
          posterPath = posterPath || tmdb.posterPath;
        }
      }

      return {
        id: item.id,
        title,
        year: year ? new Date(year).getFullYear() : null,
        type: mediaType || null,
        poster: buildPoster(posterPath),
        mediaStatus: item.status || null  // 4=partially_available, 5=available
      };
    }));

    const availableItems = items.filter((item) => {
      return item.type === 'tv' || item.type === 'movie';
    });

    setCacheData('jellyseerRecentlyAdded', availableItems);
    res.json(availableItems);
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
      { key: 'sonarr',      url: process.env.SONARR_URL,    apiKey: process.env.SONARR_API_KEY,    type: 'arr' },
      { key: 'radarr',      url: process.env.RADARR_URL,    apiKey: process.env.RADARR_API_KEY,    type: 'arr' },
      { key: 'prowlarr',    url: process.env.PROWLARR_URL,  apiKey: process.env.PROWLARR_API_KEY,  type: 'arr' },
      { key: 'jellyfin',    url: process.env.JELLYFIN_URL,  apiKey: process.env.JELLYFIN_API_KEY,  type: 'jellyfin' }
    ];

    // *Arr apps (Sonarr/Radarr/Prowlarr) update check
    // The /update endpoint returns version history; only items with installable:true are pending updates
    const fetchArrUpdateStatus = async ({ url, apiKey }) => {
      if (!url || !apiKey) return null;
      for (const endpoint of ['api/v3/update', 'api/v1/update']) {
        try {
          const response = await fetch(`${url.replace(/\/$/, '')}/${endpoint}`, {
            headers: { 'X-Api-Key': apiKey }
          });
          if (!response.ok) continue;
          const data = await response.json();
          if (Array.isArray(data)) {
            return data.some((item) => item && item.installable === true);
          }
          return false;
        } catch (_) { /* try next */ }
      }
      return null;
    };

    // Jellyfin update check: compare running version with latest GitHub release
    const fetchJellyfinUpdateStatus = async ({ url, apiKey }) => {
      if (!url || !apiKey) return null;
      try {
        const [infoRes, ghRes] = await Promise.all([
          fetch(`${url.replace(/\/$/, '')}/System/Info`, {
            headers: { Authorization: `MediaBrowser Token="${apiKey}"` }
          }),
          fetch('https://api.github.com/repos/jellyfin/jellyfin/releases/latest', {
            headers: { Accept: 'application/vnd.github+json' }
          })
        ]);
        if (!infoRes.ok || !ghRes.ok) return null;
        const info = await infoRes.json();
        const gh   = await ghRes.json();
        const current = (info.Version || '').replace(/^v/, '');
        const latest  = (gh.tag_name  || '').replace(/^v/, '');
        if (!current || !latest) return null;
        // Simple semver comparison: split on '.' and compare each part
        const toNum = (v) => v.split('.').map(Number);
        const [ca, cb, cc] = toNum(current);
        const [la, lb, lc] = toNum(latest);
        return la > ca || (la === ca && lb > cb) || (la === ca && lb === cb && lc > cc);
      } catch (_) {
        return null;
      }
    };

    const fetchUpdateStatus = async (service) => {
      if (service.type === 'jellyfin') return fetchJellyfinUpdateStatus(service);
      return fetchArrUpdateStatus(service);
    };

    const results = {};
    for (const svc of services) {
      results[svc.key] = {
        updateAvailable: await fetchUpdateStatus(svc)
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
// Speed test using the official Ookla Speedtest CLI (same engine as speedtest.net)
app.get('/api/network/orange-speed-test', async (req, res) => {
  try {
    console.log('📊 Launching official Ookla speedtest (~20-30s)…');

    // --accept-license --accept-gdpr required for non-interactive use
    // --format=json gives machine-readable output
    let stdout;
    try {
      ({ stdout } = await execAsync(
        'speedtest --format=json --accept-license --accept-gdpr',
        { timeout: 90000 }
      ));
    } catch (e) {
      // Fallback: try speedtest-cli (Python) if official binary not present
      console.warn('Official speedtest not found, falling back to speedtest-cli');
      const fallback = await execAsync('speedtest-cli --json', { timeout: 90000 });
      stdout = fallback.stdout;
      const r = JSON.parse(stdout);
      return res.json({
        'speedtest': {
          name: `${r.server?.name || ''} - ${r.server?.sponsor || ''}`.trim(),
          host: r.server?.host || '',
          timestamp: r.timestamp || new Date().toISOString(),
          success: true,
          latency: Math.round(r.ping || 0),
          download: Math.round((r.download || 0) / 1_000_000),
          upload: Math.round((r.upload || 0) / 1_000_000),
          isp: r.client?.isp || '',
          method: 'speedtest-cli-fallback'
        }
      });
    }

    const r = JSON.parse(stdout);

    // Official CLI returns bandwidth in bytes/sec → convert to Mbps
    const downloadMbps = Math.round((r.download?.bandwidth || 0) * 8 / 1_000_000);
    const uploadMbps   = Math.round((r.upload?.bandwidth   || 0) * 8 / 1_000_000);
    const latencyMs    = Math.round(r.ping?.latency || 0);
    const serverName   = `${r.server?.name || ''}, ${r.server?.location || ''}`.trim().replace(/^,\s*/, '');

    console.log(`✅ Speedtest done: ↓${downloadMbps} Mbps ↑${uploadMbps} Mbps on ${serverName}`);

    res.json({
      'speedtest': {
        name:      serverName,
        host:      r.server?.host || '',
        timestamp: r.timestamp || new Date().toISOString(),
        success:   true,
        latency:   latencyMs,
        download:  downloadMbps,
        upload:    uploadMbps,
        isp:       r.isp || '',
        resultUrl: r.result?.url || null,
        method:    'ookla-official'
      }
    });
  } catch (error) {
    console.error('Speed test error:', error.message);
    res.status(500).json({ error: 'Speed test failed. Check network connection.' });
  }
});

// ============= QBITTORRENT API =============
const qbtCache = { sid: null, stats: null, statsTs: 0, statsTtl: 10000 };

const formatSpeed = (bps) => {
  if (!bps || bps === 0) return '0 KB/s';
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
};

const qbtLogin = async () => {
  const url = process.env.QBITTORRENT_URL?.replace(/\/$/, '');
  const username = process.env.QBITTORRENT_USERNAME;
  const password = process.env.QBITTORRENT_PASSWORD;
  if (!url || !username || !password) return null;

  const res = await fetch(`${url}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/SID=([^;]+)/);
  return match ? match[1] : null;
};

const qbtFetch = async (path) => {
  const url = process.env.QBITTORRENT_URL?.replace(/\/$/, '');
  if (!qbtCache.sid) qbtCache.sid = await qbtLogin();
  if (!qbtCache.sid) return null;

  let res = await fetch(`${url}${path}`, {
    headers: { Cookie: `SID=${qbtCache.sid}` }
  });

  // SID expired — re-login once
  if (res.status === 403) {
    qbtCache.sid = await qbtLogin();
    if (!qbtCache.sid) return null;
    res = await fetch(`${url}${path}`, {
      headers: { Cookie: `SID=${qbtCache.sid}` }
    });
  }

  return res.ok ? res.json() : null;
};

app.get('/api/qbittorrent/stats', async (req, res) => {
  try {
    if (qbtCache.stats && Date.now() - qbtCache.statsTs < qbtCache.statsTtl) {
      return res.json(qbtCache.stats);
    }
    if (!process.env.QBITTORRENT_URL) {
      return res.status(400).json({ error: 'QBITTORRENT_URL not configured' });
    }

    const [transfer, torrents] = await Promise.all([
      qbtFetch('/api/v2/transfer/info'),
      qbtFetch('/api/v2/torrents/info?filter=active')
    ]);

    if (!transfer) return res.status(502).json({ error: 'qBittorrent unreachable' });

    const data = {
      active:   Array.isArray(torrents) ? torrents.length : 0,
      dlSpeed:  formatSpeed(transfer.dl_info_speed),
      ulSpeed:  formatSpeed(transfer.up_info_speed),
      dlRaw:    transfer.dl_info_speed,
      ulRaw:    transfer.up_info_speed
    };

    qbtCache.stats = data;
    qbtCache.statsTs = Date.now();
    res.json(data);
  } catch (error) {
    console.error('qBittorrent API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============= WEATHER API =============
// Uses OpenWeatherMap (https://openweathermap.org)
// Configure via OPENWEATHER_API_KEY, WEATHER_CITY (or WEATHER_LAT + WEATHER_LON)
const cache_weather = { data: null, timestamp: 0, ttl: 600000 }; // 10 min

app.get('/api/weather', async (req, res) => {
  try {
    if (cache_weather.data && Date.now() - cache_weather.timestamp < cache_weather.ttl) {
      return res.json(cache_weather.data);
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'OPENWEATHER_API_KEY not configured' });
    }

    // Prefer city name if set, otherwise use coordinates
    const cityName = process.env.WEATHER_CITY || '';
    const lat = process.env.WEATHER_LAT || '5.3600';
    const lon = process.env.WEATHER_LON || '-4.0083';

    const query = cityName
      ? `q=${encodeURIComponent(cityName)}`
      : `lat=${lat}&lon=${lon}`;

    const url = `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${apiKey}&units=metric&lang=fr`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenWeatherMap ${response.status}: ${err.message || response.statusText}`);
    }

    const json = await response.json();

    const data = {
      city:        json.name,
      country:     json.sys?.country || '',
      temperature: Math.round(json.main.temp),
      feelsLike:   Math.round(json.main.feels_like),
      humidity:    json.main.humidity,
      description: json.weather?.[0]?.description || '',
      weatherId:   json.weather?.[0]?.id || 800,
      icon:        json.weather?.[0]?.icon || '01d',
      windSpeed:   Math.round(json.wind?.speed ?? 0),
      updatedAt:   new Date().toISOString()
    };

    cache_weather.data = data;
    cache_weather.timestamp = Date.now();
    res.json(data);
  } catch (error) {
    console.error('Weather API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============= SYSTEM RESOURCES =============
// Measure real CPU usage over a 200ms sample window
const getCpuUsage = () => new Promise((resolve) => {
  const start = os.cpus().map(cpu => ({ ...cpu.times }));
  setTimeout(() => {
    const end = os.cpus().map(cpu => cpu.times);
    let totalDiff = 0;
    let idleDiff = 0;
    start.forEach((s, i) => {
      const e = end[i];
      const total = Object.keys(e).reduce((sum, k) => sum + e[k] - s[k], 0);
      totalDiff += total;
      idleDiff += e.idle - s.idle;
    });
    resolve(totalDiff > 0 ? Math.round(100 - (100 * idleDiff / totalDiff)) : 0);
  }, 200);
});

app.get('/api/system/resources', async (req, res) => {
  try {
    const cached = getCacheData('systemResources');
    if (cached) return res.json(cached);

    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    const usedMem  = totalMem - freeMem;
    const ram = {
      percent: Math.round(usedMem / totalMem * 100),
      usedGb:  +(usedMem  / 1073741824).toFixed(1),
      totalGb: +(totalMem / 1073741824).toFixed(1)
    };

    const cpu = await getCpuUsage();

    // Support multiple disk paths via DISK_PATHS=/host_root,/mnt/Data
    const rawPaths = process.env.DISK_PATHS || process.env.DISK_PATH || '/';
    const diskPaths = rawPaths.split(',').map(p => p.trim()).filter(Boolean);

    const disks = await Promise.all(diskPaths.map(async (diskPath) => {
      try {
        // -P POSIX format works on both GNU coreutils and BusyBox (Alpine)
        // Fields: filesystem 1K-blocks used available use% mountpoint
        const { stdout } = await execAsync(
          `df -P "${diskPath}" 2>/dev/null | tail -1 | awk '{print $2,$3,$5}'`,
          { timeout: 3000 }
        );
        const parts = stdout.trim().split(/\s+/);
        const totalKb = parseInt(parts[0], 10) || 0;
        const usedKb  = parseInt(parts[1], 10) || 0;
        const percent = parseInt((parts[2] || '0').replace('%', ''), 10) || 0;
        return {
          path:    diskPath,
          label:   diskPath === '/host_root' ? '/' : diskPath,
          percent,
          usedGb:  +(usedKb  / 1048576).toFixed(1),
          totalGb: +(totalKb / 1048576).toFixed(1)
        };
      } catch (_) {
        return { path: diskPath, label: diskPath === '/host_root' ? '/' : diskPath, percent: 0, usedGb: 0, totalGb: 0 };
      }
    }));

    const data = { cpu, ram, disks };
    setCacheData('systemResources', data);
    res.json(data);
  } catch (error) {
    console.error('System resources error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============= GMAIL API =============
// Parse GMAIL_ACCOUNTS env: "email:label:refreshToken,email2:label2:refreshToken2"
// The refresh token may contain colons so we only split on the first two.
const parseGmailAccounts = () => {
  if (!process.env.GMAIL_ACCOUNTS) return [];
  return process.env.GMAIL_ACCOUNTS.split(',').flatMap((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return [];
    const firstColon = trimmed.indexOf(':');
    const secondColon = trimmed.indexOf(':', firstColon + 1);
    const email = firstColon === -1 ? trimmed : trimmed.slice(0, firstColon);
    const label = firstColon === -1 ? 'Inbox'
      : secondColon === -1 ? trimmed.slice(firstColon + 1)
      : trimmed.slice(firstColon + 1, secondColon);
    const refreshToken = secondColon === -1 ? null : trimmed.slice(secondColon + 1) || null;
    return email ? [{ email, label: label || 'Inbox', refreshToken }] : [];
  });
};

// Build an authenticated Gmail client for one account's refresh token.
const makeGmailClient = (refreshToken) => {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth });
};

// Fetch unread count for a single account.
const fetchUnreadCount = async (gmailClient, email) => {
  try {
    const response = await gmailClient.users.labels.get({ userId: 'me', id: 'INBOX' });
    return response.data.messagesUnread ?? 0;
  } catch (err) {
    console.error(`Gmail unread fetch failed for ${email}:`, err.message);
    throw err;
  }
};

app.get('/api/gmail/inboxes', async (req, res) => {
  try {
    const cached = getCacheData('gmailInboxes');
    if (cached) return res.json(cached);

    const accounts = parseGmailAccounts();

    if (accounts.length === 0) {
      return res.json([{ email: 'your-email@gmail.com', label: 'Inbox', count: 0, configured: false }]);
    }

    const results = await Promise.all(accounts.map(async ({ email, label, refreshToken }) => {
      const gmailClient = makeGmailClient(refreshToken);
      if (!gmailClient) {
        return { email, label, count: 0, configured: false };
      }
      try {
        const count = await fetchUnreadCount(gmailClient, email);
        return { email, label, count, configured: true };
      } catch (_) {
        return { email, label, count: 0, configured: false };
      }
    }));

    setCacheData('gmailInboxes', results);
    res.json(results);
  } catch (error) {
    console.error('Gmail API Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime())
  });
});

// ── Global 404 + error handlers (must be last) ────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
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