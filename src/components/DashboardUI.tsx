import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Cloud, CloudSnow, CloudLightning, Sun, CloudSun, Droplets, Cpu, HardDrive, Activity, CheckCircle2, Smartphone, Laptop, Monitor, Package, Zap, Wifi, Signal, AlertCircle, Film as FilmIcon } from 'lucide-react';
const fallbackApiBase = `http://${window.location.hostname}:3001/api`;
const envApiBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE = envApiBase && (!envApiBase.includes('localhost') || window.location.hostname === 'localhost')
  ? envApiBase
  : fallbackApiBase;
const CardHover = "hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-500";
const GlassStyle = "bg-glass border border-glassBorder backdrop-blur-xl rounded-2xl p-6";

// ============================================
// Custom Hooks for Real-time Data
// ============================================

// Custom hooks for fetching real-time data
const useDockerContainers = () => {
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const res = await fetch(`${API_BASE}/docker/containers`);
        if (res.ok) {
          const data = await res.json();
          setContainers(data.map((c: any) => ({
            name: c.name,
            state: c.state,
            port: c.port
          })));
        }
      } catch (err) {
        console.warn('Failed to fetch real Docker data, using mock:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();
    const interval = setInterval(fetchContainers, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return { containers, loading };
};

const useTailscaleDevices = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch(`${API_BASE}/tailscale/devices`);
        if (res.ok) {
          const data = await res.json();
          setDevices(data);
        }
      } catch (err) {
        console.warn('Failed to fetch real Tailscale data, using mock:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return { devices, loading };
};

const useOrangePing = () => {
  const [pingData, setPingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const measurePing = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/network/orange-ping`);
      if (res.ok) {
        const data = await res.json();
        setPingData(data);
      }
    } catch (err) {
      console.error('Failed to fetch Orange ping data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount and periodically
  useEffect(() => {
    measurePing();
    const interval = setInterval(measurePing, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return { pingData, loading, measurePing };
};

const useInternetSpeed = () => {
  const [speed, setSpeed] = useState<{ download: number; upload: number; latency: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const measureSpeed = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/network/orange-speed-test`);
      if (res.ok) {
        const data = await res.json();
        
        // Aggregate speed test results from all servers
        const servers = Object.values(data as any[]);
        const successfulTests = servers.filter((s: any) => s.success);
        
        if (successfulTests.length > 0) {
          // Average the results from all successful servers
          const avgDownload = Math.round(
            successfulTests.reduce((sum: number, s: any) => sum + (s.download || 0), 0) / successfulTests.length
          );
          const avgUpload = Math.round(
            successfulTests.reduce((sum: number, s: any) => sum + (s.upload || 0), 0) / successfulTests.length
          );
          const avgLatency = Math.round(
            successfulTests.reduce((sum: number, s: any) => sum + (s.latency || 0), 0) / successfulTests.length
          );
          
          setSpeed({ download: avgDownload, upload: avgUpload, latency: avgLatency });
        } else {
          throw new Error('No servers responded to speed test');
        }
      }
    } catch (err) {
      console.warn('Orange speed test failed:', err);
      // Fallback mock values
      setSpeed({ download: 85, upload: 40, latency: 55 });
    } finally {
      setLoading(false);
    }
  };

  return { speed, loading, measureSpeed };
};

const useJellyfinMovies = (initialMovies: any[] = []) => {
  const [movies, setMovies] = useState<any[]>(initialMovies);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const res = await fetch(`${API_BASE}/jellyfin/movies`);
        if (res.ok) {
          const data = await res.json();
          setMovies(data.slice(0, 5)); // Get top 5 recent movies
        } else {
          console.warn('Failed to fetch Jellyfin movies:', res.status);
          setMovies(initialMovies);
        }
      } catch (err) {
        console.warn('Failed to fetch Jellyfin movies, using mock data:', err);
        setMovies(initialMovies);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
    const interval = setInterval(fetchMovies, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [initialMovies]);

  return { movies, loading };
};

const useJellyseerData = (initialRequests: any[] = [], initialAdded: any[] = []) => {
  const [requests, setRequests] = useState<any[]>(initialRequests);
  const [recentlyAdded, setRecentlyAdded] = useState<any[]>(initialAdded);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [requestsRes, addedRes] = await Promise.all([
          fetch(`${API_BASE}/jellyseer/requests`),
          fetch(`${API_BASE}/jellyseer/recently-added`)
        ]);
        if (requestsRes.ok) {
          setRequests(await requestsRes.json());
        }
        if (addedRes.ok) {
          setRecentlyAdded(await addedRes.json());
        }
      } catch (err) {
        console.warn('Failed to fetch Jellyseer data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return { requests, recentlyAdded };
};

const useGmailData = () => {
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGmail = async () => {
      try {
        const res = await fetch(`${API_BASE}/gmail/inboxes`);
        if (res.ok) {
          const data = await res.json();
          setInboxes(data);
        }
      } catch (err) {
        console.warn('Failed to fetch Gmail data:', err);
        setInboxes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGmail();
    const interval = setInterval(fetchGmail, 120000); // Poll every 2 minutes
    return () => clearInterval(interval);
  }, []);

  return { inboxes, loading };
};

const useServiceUpdates = (initialServices: any[] = []) => {
  const [services, setServices] = useState<any[]>(initialServices);

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const res = await fetch(`${API_BASE}/services/updates`);
        if (res.ok) {
          const data = await res.json();
          setServices((prev) => prev.map((service) => {
            const key = service.title?.toLowerCase();
            if (!key || !data[key]) {
              return service;
            }
            if (typeof data[key].updateAvailable !== 'boolean') {
              return service;
            }
            return { ...service, updateAvailable: data[key].updateAvailable };
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch service updates:', err);
      }
    };

    fetchUpdates();
    const interval = setInterval(fetchUpdates, 300000);
    return () => clearInterval(interval);
  }, []);

  return services;
};

const useSystemResources = () => {
  const [resources, setResources] = useState<{ cpu: number; ram: number; disks: { path: string; percent: number }[] } | null>(null);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/resources`);
        if (res.ok) {
          const data = await res.json();
          setResources(data);
        }
      } catch (err) {
        console.warn('Failed to fetch system resources:', err);
      }
    };

    fetchResources();
    const interval = setInterval(fetchResources, 5000);
    return () => clearInterval(interval);
  }, []);

  return resources;
};

const useWeather = () => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_BASE}/weather`);
        if (res.ok) setWeather(await res.json());
      } catch (err) {
        console.warn('Weather fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
    const interval = setInterval(fetch_, 600000); // refresh every 10 min
    return () => clearInterval(interval);
  }, []);

  return { weather, loading };
};

export { useInternetSpeed, useJellyfinMovies, useServiceUpdates, useJellyseerData, useDockerContainers, useGmailData };

export const ClockWidget = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(timer); }, []);

  return (
    <motion.div whileHover={{ scale: 1.02 }} className={`${GlassStyle} ${CardHover} flex flex-col justify-center`}>
      <h2 className="text-5xl font-light text-white tracking-tight mb-2">
        {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </h2>
      <p className="text-slate-400 capitalize">
        {time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </motion.div>
  );
};

// Map OpenWeatherMap weather IDs → { Icon, color, bg }
// https://openweathermap.org/weather-conditions
const getWeatherInfo = (id: number) => {
  if (id >= 200 && id < 300) return { Icon: CloudLightning, color: 'text-amber-400',  bg: 'bg-amber-500/10'  };
  if (id >= 300 && id < 400) return { Icon: Droplets,       color: 'text-cyan-300',   bg: 'bg-cyan-500/10'   };
  if (id >= 500 && id < 600) return { Icon: CloudRain,      color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   };
  if (id >= 600 && id < 700) return { Icon: CloudSnow,      color: 'text-blue-300',   bg: 'bg-blue-500/10'   };
  if (id >= 700 && id < 800) return { Icon: Cloud,          color: 'text-slate-400',  bg: 'bg-slate-500/10'  };
  if (id === 800)             return { Icon: Sun,            color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  if (id === 801)             return { Icon: CloudSun,       color: 'text-yellow-300', bg: 'bg-yellow-500/10' };
  return                             { Icon: Cloud,          color: 'text-slate-300',  bg: 'bg-slate-500/10'  };
};

export const WeatherWidget = () => {
  const { weather, loading } = useWeather();
  const info = weather ? getWeatherInfo(weather.weatherId ?? 800) : null;

  return (
    <motion.div whileHover={{ scale: 1.02 }} className={`${GlassStyle} ${CardHover}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-400 mb-1">
            {weather ? `${weather.city}, ${weather.country}` : 'Chargement...'}
          </p>
          {loading ? (
            <div className="h-10 w-24 bg-slate-700/50 rounded animate-pulse mb-2" />
          ) : (
            <h2 className="text-4xl font-light text-white mb-1">
              {weather?.temperature ?? '--'}°<span className="text-xl text-cyan-400 ml-1">C</span>
            </h2>
          )}
          {weather?.description && (
            <p className="text-xs text-slate-400 capitalize mb-1">{weather.description}</p>
          )}
        </div>
        <div className={`p-3 ${info?.bg ?? 'bg-slate-500/10'} rounded-xl flex-shrink-0 ml-3`}>
          {info ? <info.Icon className={`w-8 h-8 ${info.color}`} /> : <Cloud className="w-8 h-8 text-slate-400" />}
        </div>
      </div>
      {loading ? (
        <div className="h-4 w-40 bg-slate-700/50 rounded animate-pulse" />
      ) : (
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 border-t border-white/5 pt-3">
          <div>
            <p className="text-slate-500 mb-0.5">Ressenti</p>
            <p className="text-slate-200 font-medium">{weather?.feelsLike ?? '--'}°C</p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Humidité</p>
            <p className="text-slate-200 font-medium">{weather?.humidity ?? '--'}%</p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Vent</p>
            <p className="text-slate-200 font-medium">{weather?.windSpeed ?? '--'} m/s</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export const CalendarWidget = () => {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <motion.div whileHover={{ scale: 1.02 }} className={`${GlassStyle} ${CardHover}`}>
      <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">
        {today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {weekDays.map(day => (
          <div key={day} className="text-center text-slate-500 py-1 font-medium">{day.substring(0, 1)}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => (
          <div
            key={day}
            className={`aspect-square flex items-center justify-center rounded text-xs font-medium transition-colors ${
              day === today.getDate()
                ? 'bg-cyan-500/30 border border-cyan-500/50 text-cyan-300'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export const InternetSpeedWidget = ({ speed, loading, onMeasure }: any) => (
  <motion.button
    onClick={onMeasure}
    whileHover={{ scale: 1.02 }}
    className={`${GlassStyle} ${CardHover} w-full text-left`}
    disabled={loading}
  >
    <div className="flex items-center gap-2 mb-3">
      <Zap className="w-4 h-4 text-yellow-400" />
      <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Internet</span>
    </div>
    {loading ? (
      <p className="text-slate-400 text-sm">Testing...</p>
    ) : speed ? (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Download</span>
          <span className="font-mono text-cyan-400 font-medium">{speed.download} Mbps</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Upload</span>
          <span className="font-mono text-emerald-400 font-medium">{speed.upload} Mbps</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Latency</span>
          <span className="font-mono text-amber-400 font-medium">{speed.latency}ms</span>
        </div>
      </div>
    ) : (
      <p className="text-slate-400 text-sm">Click to test</p>
    )}
  </motion.button>
);

export const GmailWidget = () => {
  const { inboxes, loading } = useGmailData();

  return (
    <motion.div whileHover={{ scale: 1.02 }} className={`${GlassStyle} ${CardHover}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">INBOXES</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 bg-slate-700/50 rounded animate-pulse" />
          <div className="h-8 bg-slate-700/50 rounded animate-pulse" />
        </div>
      ) : inboxes.length > 0 ? (
        <div className="space-y-2">
          {inboxes.map((inbox, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-slate-300 truncate">{inbox.label || inbox.email || `Gmail ${idx + 1}`}</span>
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  inbox.count > 0
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {inbox.count}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 text-center py-3">No Gmail accounts configured</p>
      )}
    </motion.div>
  );
};

export const ResourceBar = ({ label, icon: Icon, percentage, color }: any) => (
  <div className="mb-4 last:mb-0">
    <div className="flex justify-between text-sm mb-1.5">
      <div className="flex items-center gap-2 text-slate-300">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <span className="font-mono text-cyan-400">{percentage}%</span>
    </div>
    <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }} 
        animate={{ width: `${percentage}%` }} 
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full rounded-full ${color}`} 
      />
    </div>
  </div>
);

const diskColors = [
  'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]',
  'bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.5)]',
  'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]',
];

export const ResourcesWidget = () => {
  const resources = useSystemResources();
  const cpu = resources?.cpu ?? 0;
  const ram = resources?.ram ?? 0;
  const disks = resources?.disks ?? [];

  return (
    <motion.div whileHover={{ scale: 1.02 }} className={`${GlassStyle} ${CardHover}`}>
      <ResourceBar label="CPU" icon={Cpu} percentage={cpu} color="bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
      <ResourceBar label="RAM" icon={Activity} percentage={ram} color="bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
      {disks.map((d, i) => (
        <ResourceBar
          key={d.path}
          label={d.path === '/host_root' ? '/' : d.path}
          icon={HardDrive}
          percentage={d.percent}
          color={diskColors[i % diskColors.length]}
        />
      ))}
    </motion.div>
  );
};

export const ServiceCard = ({ service }: any) => (
  <motion.a 
    href={service.href} 
    target="_blank"
    whileHover={{ scale: 1.02, y: -2 }} 
    className={`${GlassStyle} ${CardHover} group block cursor-pointer relative`}
  >
    <div className="flex justify-between items-start mb-5">
      <div className="p-3 bg-white/5 rounded-xl group-hover:bg-cyan-500/20 transition-colors duration-300">
        <service.icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {service.health === 'healthy' && (
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse-slow" />
          )}
          {service.health === 'warning' && (
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          )}
          <span className="text-xs font-medium text-slate-400 capitalize">{service.health}</span>
        </div>
        {service.updateAvailable && (
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-amber-300 font-medium">Update</span>
          </motion.div>
        )}
      </div>
    </div>
    <h3 className="text-lg font-medium text-white mb-3">{service.title}</h3>
    <div className="space-y-1.5">
      {service.stats.map((stat: any, idx: number) => (
        <div key={idx} className="flex justify-between text-sm">
          <span className="text-slate-400">{stat.label}</span>
          <span className={`font-medium ${stat.color || 'text-slate-200'}`}>{stat.value}</span>
        </div>
      ))}
    </div>
  </motion.a>
);

export const StatusBadge = ({ label, active }: { label: string, active: boolean }) => (
  <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
    <CheckCircle2 className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
    <span className="text-sm font-medium text-slate-200">{label}</span>
  </div>
);

export const TailscaleList = ({ devices: initialDevices }: { devices: any[] }) => {
  const { devices: realDevices, loading } = useTailscaleDevices();
  const devicesToShow = realDevices.length > 0 ? realDevices : initialDevices;
  
  const getDeviceIcon = (os: string) => {
    if (os === 'iOS' || os === 'Android') return <Smartphone className="w-5 h-5 text-slate-400" />;
    if (os === 'macOS') return <Laptop className="w-5 h-5 text-slate-400" />;
    return <Monitor className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className={`${GlassStyle} flex flex-col gap-3`}>
      {loading && realDevices.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-2">Loading...</p>
      )}
      {devicesToShow.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Aucun appareil connecté</p>
      ) : (
        devicesToShow.map((device, idx) => (
          <motion.div 
            key={idx} 
            whileHover={{ x: 4 }}
            className="flex justify-between items-center p-3 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10"
          >
            <div className="flex items-center gap-3 flex-1">
              {getDeviceIcon(device.os)}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-slate-200 truncate">{device.name}</span>
                <span className="text-xs font-mono text-cyan-500/70">{device.ip}</span>
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${device.status === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500/50'}`} />
          </motion.div>
        ))
      )}
    </div>
  );
};

export const JellyfinMovies = ({ movies: initialMovies }: { movies: any[] }) => {
  const { movies: realMovies, loading } = useJellyfinMovies(initialMovies);
  const moviesToShow = realMovies.length > 0 ? realMovies : initialMovies;
  const formatTime = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className={`${GlassStyle} flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FilmIcon className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Jellyfin</h3>
        </div>
        <span className="text-xs uppercase tracking-wider text-slate-500">Continue watching</span>
      </div>
      {loading && realMovies.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">Chargement...</p>
      )}
      {moviesToShow.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Aucun contenu disponible</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 pr-1">
          {moviesToShow.map((movie, idx) => {
            const lastPlayedDate = new Date(movie.lastPlayed);
            const daysAgo = Math.floor((Date.now() - lastPlayedDate.getTime()) / (1000 * 60 * 60 * 24));
            const playbackPosition = movie.playbackPosition || 0;
            const totalDuration = movie.duration || 0;
            const progressPercent = totalDuration > 0
              ? Math.min(100, Math.round((playbackPosition / totalDuration) * 100))
              : 0;

            return (
              <motion.div
                key={idx}
                whileHover={{ y: -4 }}
                className="min-w-[190px] max-w-[190px]"
              >
                <div className="relative h-28 rounded-2xl overflow-hidden bg-slate-800 border border-white/5 shadow-lg">
                  {movie.poster ? (
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96"%3E%3Crect fill="%231e293b" width="64" height="96"/%3E%3Ctext x="32" y="48" text-anchor="middle" dy=".3em" fill="%2364748b" font-size="12" font-family="sans-serif"%3E?%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-slate-800" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                  {movie.playCount > 0 && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-slate-900/70 text-[10px] text-slate-200 border border-white/10">
                      ▶ {movie.playCount}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2">
                    <h4 className="text-sm font-semibold text-white truncate">{movie.title}</h4>
                    <p className="text-[11px] text-slate-300 truncate">
                      {movie.episodeCode ? `${movie.episodeCode} • ` : ''}{movie.episodeTitle || movie.year || ''}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Reprise</span>
                    {progressPercent > 0 && (
                      <span>{formatTime(playbackPosition)} / {formatTime(totalDuration)}</span>
                    )}
                  </div>
                  <div className="h-1.5 w-full bg-slate-800/60 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-emerald-400/80"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {daysAgo >= 0 && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Il y a {daysAgo === 0 ? 'aujourd\'hui' : daysAgo === 1 ? '1j' : `${daysAgo}j`}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const getJellyseerStatus = (status: any) => {
  if (status === 3 || status === 'AVAILABLE') return { label: 'Available', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (status === 2 || status === 'APPROVED') return { label: 'Approved', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
  if (status === 4 || status === 'PARTIALLY_AVAILABLE') return { label: 'Partial', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  if (status === 5 || status === 'PENDING') return { label: 'Pending', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  return { label: 'Requested', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
};

const getMediaTypeBadge = (type: string | null) => {
  if (!type) return null;
  const normalized = type.toLowerCase();
  if (normalized === 'tv') return { label: 'SERIES', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
  if (normalized === 'movie') return { label: 'MOVIE', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  return { label: normalized.toUpperCase(), color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
};

export const JellyseerSection = ({ requests, recentlyAdded }: { requests: any[]; recentlyAdded: any[] }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold text-white">Seerr</h2>
      <span className="text-xs uppercase tracking-wider text-slate-500">Recent requests</span>
    </div>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Recent requests</p>
        <span className="text-xs text-slate-500">Showing {requests.length} items</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {requests.map((item) => {
          const status = getJellyseerStatus(item.status);
          const typeBadge = getMediaTypeBadge(item.type);
          return (
            <div key={item.id} className="min-w-[180px] max-w-[180px]">
              <div className="relative h-28 rounded-2xl overflow-hidden bg-slate-800 border border-white/5">
                {item.poster && (
                  <img src={item.poster} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
                {typeBadge && (
                  <span className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full border ${typeBadge.color}`}>{typeBadge.label}</span>
                )}
                <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border ${status.color}`}>{status.label}</span>
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Recently added</p>
        <span className="text-xs text-slate-500">Showing {recentlyAdded.length} items</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {recentlyAdded.map((item) => {
          const typeBadge = getMediaTypeBadge(item.type);
          return (
            <div key={item.id} className="min-w-[180px] max-w-[180px]">
              <div className="relative h-28 rounded-2xl overflow-hidden bg-slate-800 border border-white/5">
                {item.poster && (
                  <img src={item.poster} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
                {typeBadge && (
                  <span className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full border ${typeBadge.color}`}>{typeBadge.label}</span>
                )}
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export const DockerList = ({ containers: initialContainers }: { containers: any[] }) => {
  const { containers: realContainers, loading } = useDockerContainers();
  const containersToShow = realContainers.length > 0 ? realContainers : initialContainers;

  const getStateColor = (state: string) => {
    switch (state) {
      case 'running':
        return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
      case 'paused':
        return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]';
      case 'exited':
        return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';
      case 'unhealthy':
        return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <div className={`${GlassStyle} flex flex-col gap-2`}>
      {loading && realContainers.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-2">Chargement...</p>
      )}
      {containersToShow.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Aucun conteneur</p>
      ) : (
        containersToShow.map((container, idx) => (
          <motion.div 
            key={idx} 
            whileHover={{ x: 4 }}
            className="flex flex-col p-3 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10 group"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-3 flex-1">
                <Package className="w-5 h-5 text-cyan-400/70 group-hover:text-cyan-400 transition-colors" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-200">{container.name}</span>
                  {container.uptime && (
                    <span className="text-xs text-slate-500">Uptime: {container.uptime}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end text-xs">
                  {container.health && (
                    <span className="text-slate-400">{container.health}</span>
                  )}
                  <span className={`font-mono text-slate-500`}>:{container.port}</span>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${getStateColor(container.state)}`} />
              </div>
            </div>
            {(container.cpu || container.memory) && (
              <div className="flex gap-4 text-xs text-slate-500 ml-8">
                {container.cpu && <span>CPU: {container.cpu}</span>}
                {container.memory && <span>MEM: {container.memory}</span>}
              </div>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
};

// ============================================
// Orange CI Network Monitoring Component
// ============================================

const getLatencyColor = (latency: number | null) => {
  if (!latency) return 'text-slate-400';
  if (latency < 30) return 'text-emerald-400';
  if (latency < 60) return 'text-cyan-400';
  if (latency < 100) return 'text-amber-400';
  return 'text-red-400';
};

const getLatencyBg = (latency: number | null) => {
  if (!latency) return 'bg-slate-500/20';
  if (latency < 30) return 'bg-emerald-500/20 border-emerald-500/30';
  if (latency < 60) return 'bg-cyan-500/20 border-cyan-500/30';
  if (latency < 100) return 'bg-amber-500/20 border-amber-500/30';
  return 'bg-red-500/20 border-red-500/30';
};

export const OrangePingWidget = ({ onRefresh }: { onRefresh?: () => void }) => {
  const { pingData, loading, measurePing } = useOrangePing();
  
  const handleRefresh = async () => {
    await measurePing();
    onRefresh?.();
  };

  return (
    <motion.div className={`${GlassStyle} ${CardHover}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Signal className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Orange CI</h3>
        </div>
        <motion.button
          onClick={handleRefresh}
          disabled={loading}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <Wifi className={`w-4 h-4 transition-transform ${loading ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {loading && !pingData ? (
        <div className="text-center py-6">
          <div className="animate-spin w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-2" />
          <p className="text-xs text-slate-400">Tester les serveurs...</p>
        </div>
      ) : !pingData ? (
        <p className="text-sm text-slate-400 text-center py-4">Pas de données</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(pingData).map(([key, value]: [string, any]) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 border rounded-lg transition-all ${getLatencyBg(value.avgLatency)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-200">{value.name}</span>
                {value.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className={`font-mono font-bold ${getLatencyColor(value.avgLatency)}`}>
                      {value.avgLatency}ms
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-red-400">Offline</span>
                )}
              </div>
              {value.success && (
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Min: {value.minLatency}ms</span>
                  <span>Max: {value.maxLatency}ms</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
      
      <p className="text-xs text-slate-500 mt-4 text-center">
        {pingData ? `Dernière mise à jour: ${new Date(pingData[Object.keys(pingData)[0]]?.timestamp).toLocaleTimeString('fr-FR')}` : ''}
      </p>
    </motion.div>
  );
};