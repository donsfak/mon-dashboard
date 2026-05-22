import { Film, Tv, Download, Search, MonitorPlay } from 'lucide-react';

export const systemData = {
  ip: "100.70.128.90",
  os: "Zorin OS (IdeaPad Gaming 3)",
  uptime: "14 jours, 5 heures",
  homepageVersion: "v0.8.10",
};

export const services = [
  {
    title: "Jellyseerr",
    icon: MonitorPlay,
    status: "active",
    href: `http://${systemData.ip}:5055`,
    stats: [{ label: "En attente", value: "3" }, { label: "Traitées", value: "142" }]
  },
  {
    title: "Radarr",
    icon: Film,
    status: "active",
    href: `http://${systemData.ip}:7878`,
    stats: [{ label: "Films", value: "847" }, { label: "Manquants", value: "12" }]
  },
  {
    title: "Sonarr",
    icon: Tv,
    status: "active",
    href: `http://${systemData.ip}:8989`,
    stats: [{ label: "Séries", value: "45" }, { label: "À venir", value: "8" }]
  },
  {
    title: "Prowlarr",
    icon: Search,
    status: "active",
    href: `http://${systemData.ip}:9696`,
    stats: [{ label: "Indexeurs", value: "6 actifs" }, { label: "Santé", value: "100%" }]
  },
  {
    title: "RDT Client",
    icon: Download,
    status: "active",
    href: `http://${systemData.ip}:6500`,
    stats: [{ label: "Actifs", value: "2 DL" }, { label: "Stockage", value: "1.4 TB" }]
  }
];
export const dockerContainers = [
  // Écosystème Multimédia
  { name: "jellyseerr", state: "running", port: "5055" },
  { name: "radarr", state: "running", port: "7878" },
  { name: "sonarr", state: "running", port: "8989" },
  { name: "prowlarr", state: "running", port: "9696" },
  { name: "rdtclient", state: "running", port: "6500" },
  
  // Nouveaux Services d'Infrastructure
  { name: "jellyfin", state: "running", port: "8096" },
  { name: "filebrowser", state: "running", port: "8080" },
  { name: "adguard-service", state: "running", port: "53" },
  { name: "portainer", state: "running", port: "9000" }
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