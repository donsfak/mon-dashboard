import { Film, Tv, Download, Search, MonitorPlay, Play, Magnet } from 'lucide-react';

export const systemData = {
  ip: "100.70.128.90",   // Tailscale VPN IP
};

export const services = [
  {
    title: "Jellyseerr",
    icon: MonitorPlay,
    status: "active",
    href: `http://${systemData.ip}:5055`,
    stats: [
      { label: "En attente", value: "3", color: "text-amber-400" }, 
      { label: "Traitées", value: "142", color: "text-emerald-400" }
    ],
    health: "healthy",
    updateAvailable: false
  },
  {
    title: "Radarr",
    icon: Film,
    status: "active",
    href: `http://${systemData.ip}:7878`,
    stats: [
      { label: "Films", value: "847", color: "text-cyan-400" }, 
      { label: "Manquants", value: "12", color: "text-red-400" }
    ],
    health: "healthy",
    updateAvailable: false
  },
  {
    title: "Sonarr",
    icon: Tv,
    status: "active",
    href: `http://${systemData.ip}:8989`,
    stats: [
      { label: "Séries", value: "45", color: "text-cyan-400" }, 
      { label: "À venir", value: "8", color: "text-amber-400" }
    ],
    health: "healthy",
    updateAvailable: false
  },
  {
    title: "Prowlarr",
    icon: Search,
    status: "active",
    href: `http://${systemData.ip}:9696`,
    stats: [
      { label: "Indexeurs", value: "6 actifs", color: "text-emerald-400" }, 
      { label: "Santé", value: "100%", color: "text-emerald-400" }
    ],
    health: "healthy",
    updateAvailable: false
  },
  {
    title: "RDT Client",
    icon: Download,
    status: "active",
    href: `http://${systemData.ip}:6500`,
    stats: [
      { label: "Actifs", value: "2 DL", color: "text-emerald-400" },
      { label: "Stockage", value: "1.4 TB", color: "text-cyan-400" }
    ],
    health: "healthy",
    updateAvailable: false
  },
  {
    title: "Jellyfin",
    icon: Play,
    status: "active",
    href: `http://${systemData.ip}:8096`,
    stats: [
      { label: "Films", value: "847", color: "text-cyan-400" },
      { label: "Séries", value: "45", color: "text-emerald-400" }
    ],
    health: "healthy",
    updateAvailable: false
  },
  {
    title: "qBittorrent",
    icon: Magnet,
    status: "active",
    href: `http://0.0.0.0:8090`,
    stats: [
      { label: "Actifs", value: "3 DL", color: "text-emerald-400" },
      { label: "Vitesse", value: "4.2 MB/s", color: "text-cyan-400" }
    ],
    health: "healthy",
    updateAvailable: false
  }
];

export const dockerContainers = [
  // Écosystème Multimédia
  { name: "jellyseerr", state: "running", port: "5055", health: "healthy", uptime: "14d 5h", cpu: "2.1%", memory: "342MB" },
  { name: "radarr", state: "running", port: "7878", health: "healthy", uptime: "14d 3h", cpu: "0.8%", memory: "156MB" },
  { name: "sonarr", state: "running", port: "8989", health: "healthy", uptime: "12d 18h", cpu: "1.2%", memory: "298MB" },
  { name: "prowlarr", state: "running", port: "9696", health: "healthy", uptime: "14d 2h", cpu: "0.3%", memory: "89MB" },
  { name: "rdtclient", state: "running", port: "6500", health: "healthy", uptime: "8d 4h", cpu: "0.5%", memory: "127MB" },
  
  // Nouveaux Services d'Infrastructure
  { name: "jellyfin", state: "running", port: "8096", health: "healthy", uptime: "21d 1h", cpu: "3.2%", memory: "512MB" },
  { name: "filebrowser", state: "running", port: "8080", health: "healthy", uptime: "14d 5h", cpu: "0.1%", memory: "45MB" },
  { name: "adguard-service", state: "running", port: "53", health: "healthy", uptime: "30d 0h", cpu: "0.6%", memory: "78MB" },
  { name: "portainer", state: "running", port: "9000", health: "healthy", uptime: "14d 5h", cpu: "0.9%", memory: "198MB" }
];

export const jellyfinMovies = [
  {
    id: "1",
    title: "Spider-Noir",
    year: 2023,
    episodeTitle: "Passez dans mon bureau",
    episodeCode: "S01:E01",
    poster: "https://images.justwatch.com/poster/307216425/s332",
    playCount: 5,
    lastPlayed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    playbackPosition: 3120,
    duration: 8100,
    runtime: 135
  },
  {
    id: "2",
    title: "The Cruel Queen and the Fiancé",
    year: 2024,
    episodeTitle: "Pour un monde meilleur",
    episodeCode: "S04:E01",
    poster: "https://images.justwatch.com/poster/312156802/s332",
    playCount: 2,
    lastPlayed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    playbackPosition: 2460,
    duration: 4320,
    runtime: 72
  },
  {
    id: "3",
    title: "The Banished Court Magician",
    year: 2024,
    poster: "https://images.justwatch.com/poster/308723141/s332",
    playCount: 1,
    lastPlayed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    playbackPosition: 960,
    duration: 1440,
    runtime: 24
  },
  {
    id: "4",
    title: "Assassination of Assassin",
    year: 2024,
    poster: "https://images.justwatch.com/poster/316348929/s332",
    playCount: 3,
    lastPlayed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    playbackPosition: 3840,
    duration: 6480,
    runtime: 108
  },
  {
    id: "5",
    title: "My Status as an Assassin",
    year: 2024,
    poster: "https://images.justwatch.com/poster/317423091/s332",
    playCount: 4,
    lastPlayed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    playbackPosition: 4140,
    duration: 7200,
    runtime: 120
  }
];

export const jellyseerRequests = [
  {
    id: 'req-1',
    title: 'Lanterns',
    type: 'tv',
    status: 'APPROVED',
    poster: 'https://image.tmdb.org/t/p/w342/6Oh5ZT2XpOmpH4VJpHew9NTkqCR.jpg'
  },
  {
    id: 'req-2',
    title: 'Reborn Rich',
    type: 'tv',
    status: 'APPROVED',
    poster: 'https://image.tmdb.org/t/p/w342/mKIrbZp3nG5XV5ocW4ndQgt7xBe.jpg'
  },
  {
    id: 'req-3',
    title: 'Swapped',
    type: 'movie',
    status: 'AVAILABLE',
    poster: 'https://image.tmdb.org/t/p/w342/fbywVPR3YpVbM8e0mH6XqzJg7RG.jpg'
  }
];

export const jellyseerRecentlyAdded = [
  {
    id: 'add-1',
    title: 'Spider-Noir',
    type: 'tv',
    poster: 'https://image.tmdb.org/t/p/w342/6Oh5ZT2XpOmpH4VJpHew9NTkqCR.jpg'
  },
  {
    id: 'add-2',
    title: 'Swapped',
    type: 'movie',
    poster: 'https://image.tmdb.org/t/p/w342/fbywVPR3YpVbM8e0mH6XqzJg7RG.jpg'
  },
  {
    id: 'add-3',
    title: 'Harry Potter',
    type: 'movie',
    poster: 'https://image.tmdb.org/t/p/w342/8lMLlE9QwU8oM4kKZrmkSLvZ2dP.jpg'
  }
];

export const tailscaleDevices = [
  { 
    name: "sfak55-ideapad (Serveur)", 
    os: "Linux", 
    ip: "100.70.128.90", 
    status: "online" 
  },
  { 
    name: "iphone-14", 
    os: "iOS", 
    ip: "100.70.186.72", 
    status: "online" 
  },
  { 
    name: "mibox4", 
    os: "Android", 
    ip: "100.106.14.79", 
    status: "offline" 
  }
];