import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ShieldCheck, Activity, Network, Server, Package } from 'lucide-react';
import { systemData, services, tailscaleDevices, dockerContainers } from './data/mockData';
import { ClockWidget, WeatherWidget, CalendarWidget, InternetSpeedWidget, ResourcesWidget, ServiceCard, StatusBadge, TailscaleList, DockerList, OrangePingWidget, useInternetSpeed } from './components/DashboardUI';

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const fadeItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

export default function App() {
  const { speed, loading, measureSpeed } = useInternetSpeed();

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans p-4 md:p-6 selection:bg-cyan-500/30">
      <div className="flex gap-6 max-w-7xl mx-auto">
        {/* LEFT SIDEBAR */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4 sticky top-6"
          >
            <ClockWidget />
            <CalendarWidget />
            <WeatherWidget />
            <InternetSpeedWidget speed={speed} loading={loading} onMeasure={measureSpeed} />
            <OrangePingWidget />
          </motion.div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 min-w-0">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-8"
          >
            {/* HEADER */}
            <motion.header variants={fadeItem} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
                  MEDIAHUB
                </h1>
                <p className="text-slate-400 mt-1">Dashboard — Centre multimédia personnel</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-400">5 services actifs</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-medium text-cyan-400">Tailscale {systemData.ip}</span>
                </div>
              </div>
            </motion.header>

            {/* RESOURCES WIDGET */}
            <motion.div variants={fadeItem}>
              <ResourcesWidget />
            </motion.div>

            {/* MEDIA CENTER GRID */}
            <motion.section variants={fadeItem}>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Server className="w-5 h-5 text-cyan-400" />
                Mon centre multimédia
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {services.map((svc) => (
                  <ServiceCard key={svc.title} service={svc} />
                ))}
              </div>
            </motion.section>

            {/* SYSTEM STATUS & NETWORK */}
            <motion.div variants={fadeItem} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <section>
                <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-slate-400" />
                  État de l'infrastructure
                </h2>
                <div className="flex flex-wrap gap-3">
                  <StatusBadge label="Docker Host Mode" active={true} />
                  <StatusBadge label="Tailscale VPN" active={true} />
                  <StatusBadge label="Real Debrid" active={true} />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Network className="w-5 h-5 text-slate-400" />
                  Réseau & Système
                </h2>
                <div className="bg-glass border border-glassBorder rounded-2xl p-5 flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Host OS</p>
                    <p className="text-sm font-medium text-white">{systemData.os}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Uptime</p>
                    <p className="text-sm font-medium text-white">{systemData.uptime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Latence</p>
                    <p className="text-sm font-mono text-cyan-400">24ms</p>
                  </div>
                </div>
              </section>
            </motion.div>

            {/* DOCKER & TAILSCALE */}
            <motion.div variants={fadeItem} className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
              <section>
                <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  Conteneurs Docker
                </h2>
                <DockerList containers={dockerContainers} />
              </section>

              <section>
                <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Réseau Tailscale
                </h2>
                <TailscaleList devices={tailscaleDevices} />
              </section>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}