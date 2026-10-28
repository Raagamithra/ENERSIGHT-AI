import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BatteryCharging, Building2, Factory, Gauge, Leaf, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useApiData } from '../hooks/useApiData';

const formatINR = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(2)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

export function Dashboard() {
  const [period, setPeriod] = useState('Hour');
  const { user } = useAuth();
  const { connectionState, energyUpdate, anomalies: liveAnomalies } = useSocket();

  const { data: summary = null } = useApiData('/energy/summary', null);
  const { data: trends = null } = useApiData('/energy/trends', null);
  const { data: facilities = [] } = useApiData('/facilities', []);
  const { data: anomalies = [] } = useApiData('/ai/anomalies', []);
  const { data: carbonSummary = null } = useApiData('/carbon/summary', null);
  const { data: demandResponseStatus = null } = useApiData('/demand-response/status', null);
  const { data: forecast = null } = useApiData('/ai/forecast', null);

  const chartData = useMemo(() => {
    const trendKey = { Hour: 'hourly', Day: 'daily', Week: 'weekly' }[period];
    const source = Array.isArray(trends?.[trendKey]) ? trends[trendKey] : [];
    const points = source.map((entry) => ({
      label: entry.time || entry.day || entry.month || '—',
      total: Number(entry.total ?? entry.value ?? 0),
      forecast: null,
    }));
    if (period === 'Hour' && energyUpdate?.timestamp && Number.isFinite(Number(energyUpdate.total))) {
      const liveLabel = new Date(energyUpdate.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (points.at(-1)?.label === liveLabel) points.pop();
      points.push({ label: liveLabel, total: Number(energyUpdate.total), forecast: null });
    }
    return points.slice(-48);
  }, [trends, period, energyUpdate]);

  const forecastChartData = useMemo(() => {
    const actual = (trends?.hourly || []).slice(-12).map((entry) => ({
      label: entry.time || '—',
      actual: Number(entry.total) || 0,
      predicted: null,
    }));
    const predicted = (forecast?.forecast || []).map((value, index) => ({
      label: new Date(Date.now() + index * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actual: null,
      predicted: Number(value) || 0,
    }));
    return [...actual, ...predicted];
  }, [trends, forecast]);

  const facilityData = Array.isArray(facilities) ? facilities : [];
  const anomalyData = [...liveAnomalies, ...(Array.isArray(anomalies) ? anomalies : [])].filter((item, index, items) => !item.id || items.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 3);
  const carbonData = Array.isArray(carbonSummary?.byFacility) ? carbonSummary.byFacility : [];
  const displayedSummary = energyUpdate?.summary || summary || {};
  const demandResponseCurrent = Number(displayedSummary.totalPower ?? demandResponseStatus?.currentDemandKW) || 0;
  const demandResponseForecastLift = Math.max(0, Number(demandResponseStatus?.predictedPeakKW || 0) - Number(demandResponseStatus?.currentDemandKW || 0));
  const demandResponsePeak = Math.max(demandResponseCurrent, Number(forecast?.predictedPeak) || demandResponseCurrent + demandResponseForecastLift);
  const demandResponseTarget = Number(demandResponseStatus?.targetPeakKW) || Math.round(demandResponseCurrent * 0.9);
  const demandResponseCapacity = Number(demandResponseStatus?.totalFlexibleCapacityKW) || 0;
  const demandResponsePotential = Math.min(Math.max(0, demandResponsePeak - demandResponseTarget), demandResponseCapacity);
  const greetingName = user?.fullName?.split(' ')[0] || 'energy manager';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.34em] text-cyan-300">Good morning, {greetingName}</div>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-300"><span className={`inline-flex h-2.5 w-2.5 rounded-full ${connectionState === 'live' ? 'bg-emerald-400' : connectionState === 'reconnecting' ? 'bg-amber-400' : 'bg-rose-400'}`} /> {connectionState === 'live' ? 'Live telemetry connected' : connectionState === 'reconnecting' ? 'Reconnecting to telemetry' : 'Telemetry offline'}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Current Power" value={displayedSummary.totalPower ?? '—'} unit="kW" trend={0} icon={Zap} tone="cyan" />
        <StatCard title="Energy Today" value={displayedSummary.energyToday === undefined ? '—' : (displayedSummary.energyToday / 1000).toFixed(1)} unit="MWh" trend={0} icon={BatteryCharging} tone="emerald" />
        <StatCard title="Peak Demand" value={displayedSummary.peakDemand ?? '—'} unit="kW" trend={0} icon={Gauge} tone="amber" />
        <StatCard title="Energy Cost" value={displayedSummary.costEstimate === undefined ? '—' : formatINR(displayedSummary.costEstimate)} unit="Est." trend={0} icon={TrendingUp} tone="cyan" />
        <StatCard title="CO₂ Emissions" value={displayedSummary.emissions ?? '—'} unit="kg" trend={0} icon={Leaf} tone="emerald" />
        <StatCard title="Active Alerts" value={displayedSummary.activeAlerts === undefined ? '—' : String(displayedSummary.activeAlerts).padStart(2, '0')} unit="Live" trend={0} icon={Factory} tone="rose" />
      </div>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-cyan-500/20 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300"><Zap className="h-5 w-5" /></div><div><div className="text-xs uppercase tracking-[0.28em] text-cyan-300">Demand response</div><div className="mt-1 text-lg font-semibold text-white">Peak optimization simulation</div></div></div>
          <Link to="/demand-response" className="inline-flex items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20">Open optimizer <span aria-hidden="true" className="ml-2">→</span></Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div><div className="text-xs text-slate-400">Predicted peak</div><div className="mt-1 text-xl font-semibold text-amber-200">{forecast?.predictedPeak !== undefined ? `${Math.round(demandResponsePeak).toLocaleString('en-IN')} kW` : '—'}</div></div>
          <div><div className="text-xs text-slate-400">Target peak</div><div className="mt-1 text-xl font-semibold text-white">{Math.round(demandResponseTarget).toLocaleString('en-IN')} kW</div></div>
          <div><div className="text-xs text-slate-400">Potential flexible reduction</div><div className="mt-1 text-xl font-semibold text-emerald-300">{demandResponseStatus ? `${Math.round(demandResponsePotential).toLocaleString('en-IN')} kW` : '—'}</div></div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-3 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-amber-400" /> Simulation only · no physical equipment control</div>
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.8fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-slate-400">Live energy consumption</div>
              <div className="mt-2 text-xl font-semibold text-white">{period === 'Hour' ? 'Live site demand' : `${period} energy trend`}</div>
            </div>
            <div className="flex gap-2 text-xs text-slate-300">
              {['Hour', 'Day', 'Week'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPeriod(option)}
                  className={`rounded-lg border px-2 py-1 ${period === option ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-slate-700'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="h-80">
            {chartData.length === 0 && <div className="flex h-full items-center justify-center text-sm text-slate-500">No energy trend data available.</div>}
            {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="energyFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="#22d3ee" fill="url(#energyFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-slate-400">AI engine</div>
              <div className="mt-2 text-xl font-semibold text-white">AI status</div>
            </div>
            <div className={`flex items-center gap-2 rounded-full border px-2 py-1 text-xs ${forecast?.forecastStatus === 'online' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : forecast?.forecastStatus === 'fallback' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-slate-700 bg-slate-950/60 text-slate-400'}`}>
              <span className={`h-2 w-2 rounded-full ${forecast?.forecastStatus === 'online' ? 'bg-emerald-400' : forecast?.forecastStatus === 'fallback' ? 'bg-amber-400' : 'bg-slate-500'}`} /> {forecast?.forecastStatus === 'online' ? 'ONLINE' : forecast?.forecastStatus === 'fallback' ? 'FALLBACK' : 'CHECKING'}
            </div>
          </div>

          <div className="space-y-4">
            {['Demand Forecast', 'Isolation Forest', 'Recommendation Engine'].map((model) => (
              <div key={model} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>{model}</span>
                  <span className={forecast?.forecastStatus === 'online' ? 'text-emerald-300' : 'text-slate-500'}>{forecast?.forecastStatus === 'online' ? 'Ready' : forecast?.forecastStatus === 'fallback' ? 'Fallback' : 'Checking'}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${forecast?.forecastStatus === 'online' ? 'w-full bg-gradient-to-r from-cyan-500 to-emerald-400' : 'w-0'}`} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-slate-400">AI demand forecast</div>
              <div className="mt-2 text-xl font-semibold text-white">Next 6 hours</div>
            </div>
            <div className="text-right text-sm text-slate-300">
              <div>Predicted peak: {forecast?.predictedPeak ?? '—'} kW</div>
              <div className="text-cyan-300">Peak time: {forecast?.peakTime || '—'}</div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="actual" name="Historical demand" stroke="#22d3ee" strokeWidth={3} dot={{ r: 2 }} connectNulls={false} />
                <Line type="monotone" dataKey="predicted" name="Predicted demand" stroke="#34d399" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 2 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-slate-400">Carbon summary</div>
              <div className="mt-2 text-xl font-semibold text-white">CO₂ profile</div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={carbonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-slate-400">Facility performance</div>
              <div className="mt-2 text-xl font-semibold text-white">Operations status</div>
            </div>
          </div>
          <div className="space-y-4">
            {facilityData.map((facility) => (
              <div key={facility.id || facility.name} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-cyan-300" />
                    <span className="font-medium text-white">{facility.name}</span>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${facility.status === 'ONLINE' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : facility.status === 'WARNING' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>{facility.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm text-slate-300">
                  <div><div className="text-slate-400">Current power</div><div className="mt-1 text-lg text-white">{facility.currentPowerKW ?? '—'} kW</div></div>
                  <div><div className="text-slate-400">Energy today</div><div className="mt-1 text-lg text-white">{facility.energyTodayKWh ?? '—'} kWh</div></div>
                  <div><div className="text-slate-400">Active meters</div><div className="mt-1 text-lg text-white">{facility.meterCount ?? '—'}</div></div>
                </div>
              </div>
            ))}
            {facilityData.length === 0 && <div className="text-sm text-slate-500">Facility readings are not available.</div>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-slate-400">Active anomalies</div>
              <div className="mt-2 text-xl font-semibold text-white">Priority alerts</div>
            </div>
          </div>
          <div className="space-y-3">
            {anomalyData.map((alert) => (
              <div key={`${alert.meterId || alert.meter}-${alert.time}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between"><span className="font-medium text-white">{alert.meterId || alert.meter}</span><span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-300">{alert.severity}</span></div>
                <div className="mt-2 text-sm text-slate-300">{alert.facility} · {alert.time}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400"><span>Deviation</span><span>{alert.deviation ?? '+12%'}</span></div>
              </div>
            ))}
            {anomalyData.length === 0 && <div className="text-sm text-slate-500">No active anomalies reported.</div>}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
