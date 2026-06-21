import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ShieldCheck, Activity, Network, Server, Package, LayoutDashboard } from 'lucide-react';
import { systemData, services, tailscaleDevices, dockerContainers, jellyfinMovies, jellyseerRequests, jellyseerRecentlyAdded } from './data/mockData';
import { ClockWidget, WeatherWidget, CalendarWidget, InternetSpeedWidget, ResourcesWidget, ServiceCard, StatusBadge, TailscaleList, DockerList, OrangePingWidget, JellyfinMovies, useInternetSpeed, useServiceUpdates, useJellyseerData, JellyseerSection, useDockerContainers, GmailWidget, useQbittorrentStats } from './components/DashboardUI';

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const fadeItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
};

// Sidebar section label divider
const SidebarLabel = ({ label }: { label: string }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-1 pt-2 pb-0.5 select-none">
    {label}
  </p>
);

export default function App() {
  const { speed, loading, measureSpeed, testedAt } = useInternetSpeed();
  const servicesWithUpdates = useServiceUpdates(services);
  const jellyseerData = useJellyseerData(jellyseerRequests, jellyseerRecentlyAdded);
  const { containers } = useDockerContainers();
  const qbtStats = useQbittorrentStats();

  const activeContainers = useMemo(
    () => containers.filter((c: any) => c.state === 'running').length,
    [containers]
  );
  const displayActiveCount = activeContainers > 0 ? activeContainers : services.length;

  const servicesWithLiveStats = useMemo(() =>
    servicesWithUpdates.map((svc: any) => {
      if (svc.title === 'qBittorrent' && qbtStats) {
        return {
          ...svc,
          stats: [
            { label: 'Actifs', value: `${qbtStats.active} torrent${qbtStats.active !== 1 ? 's' : ''}`, color: 'text-emerald-400' },
            { label: 'DL', value: qbtStats.dlSpeed, color: 'text-cyan-400' }
          ]
        };
      }
      return svc;
    }),
    [servicesWithUpdates, qbtStats]
  );

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-cyan-500/30">

      {/* ── Top nav bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-wider">
              MEDIAHUB
            </span>
            <span className="text-slate-600 text-xs hidden sm:inline">/ Centre multimédia personnel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-emerald-400">{displayActiveCount} actifs</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span className="text-[11px] font-medium text-cyan-400">VPN {systemData.ip}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex gap-0 max-w-7xl mx-auto">

        {/* ── Left sidebar ────────────────────────────────────────────────────── */}
        <aside className="hidden md:block w-72 flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="sticky top-12 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-2 px-4 py-5 pr-3
                       scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent"
          >
            <SidebarLabel label="Temps &amp; Météo" />
            <ClockWidget />
            <CalendarWidget />
            <WeatherWidget />

            <SidebarLabel label="Connexion" />
            <InternetSpeedWidget speed={speed} loading={loading} onMeasure={measureSpeed} testedAt={testedAt} />
            <OrangePingWidget />

            <SidebarLabel label="Communications" />
            <GmailWidget />

            <SidebarLabel label="Médias" />
            <JellyfinMovies movies={jellyfinMovies} />
          </motion.div>
        </aside>

        {/* ── Main content ────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-4 md:px-6 py-6">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-10"
          >

            {/* System resources */}
            <motion.section variants={fadeItem}>
              <SectionHeader icon={Activity} label="Ressources système" />
              <ResourcesWidget />
            </motion.section>

            {/* Multimedia services */}
            <motion.section variants={fadeItem}>
              <SectionHeader icon={Server} label="Centre multimédia" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {servicesWithLiveStats.map((svc: any) => (
                  <ServiceCard key={svc.title} service={svc} />
                ))}
              </div>
            </motion.section>

            {/* Jellyseerr */}
            <motion.section variants={fadeItem}>
              <JellyseerSection
                requests={jellyseerData.requests}
                recentlyAdded={jellyseerData.recentlyAdded}
              />
            </motion.section>

            {/* Infrastructure status */}
            <motion.section variants={fadeItem}>
              <SectionHeader icon={Activity} label="État de l'infrastructure" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-glass border border-glassBorder rounded-2xl p-5 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Services actifs</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label="Docker Host Mode" active={true} />
                    <StatusBadge label="Tailscale VPN" active={true} />
                    <StatusBadge label="Real Debrid" active={true} />
                  </div>
                </div>
                <div className="bg-glass border border-glassBorder rounded-2xl p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Système</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Host OS', value: systemData.os },
                      { label: 'Uptime',  value: systemData.uptime },
                      { label: 'VPN IP',  value: systemData.ip, mono: true }
                    ].map(({ label, value, mono }) => (
                      <div key={label}>
                        <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
                        <p className={`text-xs font-medium text-white ${mono ? 'font-mono text-cyan-400' : ''} truncate`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Docker + Tailscale */}
            <motion.section variants={fadeItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
              <div>
                <SectionHeader icon={Package} label="Conteneurs Docker" accent="cyan" />
                <DockerList containers={dockerContainers} />
              </div>
              <div>
                <SectionHeader icon={Network} label="Réseau Tailscale" accent="emerald" />
                <TailscaleList devices={tailscaleDevices} />
              </div>
            </motion.section>

          </motion.div>
        </main>
      </div>
    </div>
  );
}

// Reusable section header
function SectionHeader({ icon: Icon, label, accent = 'cyan' }: { icon: any; label: string; accent?: string }) {
  const color = accent === 'emerald' ? 'text-emerald-400' : 'text-cyan-400';
  return (
    <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      {label}
    </h2>
  );
}
