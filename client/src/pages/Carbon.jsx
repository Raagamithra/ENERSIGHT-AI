import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';

const format = (value) => value === undefined || value === null ? '—' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });

export function Carbon() {
  const { data: carbon = null, loading, error } = useApiData('/carbon/summary', null);
  const { data: trends = null } = useApiData('/energy/trends', null);
  const { energyUpdate } = useSocket();
  const carbonFactor = Number(carbon?.carbonFactorKgPerKWh) || 0;
  const currentEnergyKWh = Number(energyUpdate?.summary?.energyToday ?? carbon?.today / Math.max(carbonFactor, 1)) || 0;
  const currentCarbonKG = energyUpdate?.summary?.energyToday !== undefined && carbonFactor
    ? currentEnergyKWh * carbonFactor
    : carbon?.today;
  const trendData = useMemo(() => (trends?.daily || []).map((entry) => ({
    day: entry.day,
    value: Number(entry.total) * carbonFactor,
  })), [trends, carbonFactor]);
  const facilityData = Array.isArray(carbon?.byFacility) ? carbon.byFacility : [];
  const monthTons = carbon?.month === undefined ? null : Number(carbon.month) / 1000;
  const totalTons = carbon?.total === undefined ? null : Number(carbon.total) / 1000;

  return (
    <div className="space-y-6">
      {error && !carbon && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">Unable to load carbon estimates.</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">CO₂ today · estimate</div><div className="mt-2 text-3xl font-semibold text-white">{loading && !carbon ? '…' : `${format(currentCarbonKG)} kg`}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">CO₂ this month · estimate</div><div className="mt-2 text-3xl font-semibold text-cyan-300">{monthTons === null ? '—' : `${format(monthTons)} t`}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Historical total · estimate</div><div className="mt-2 text-3xl font-semibold text-emerald-300">{totalTons === null ? '—' : `${format(totalTons)} t`}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Emissions factor</div><div className="mt-2 text-2xl font-semibold text-amber-300">{carbonFactor ? `${format(carbonFactor)} kg/kWh` : '—'}</div></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-5 text-xs uppercase tracking-[0.32em] text-slate-400">Historical carbon estimate</div><div className="h-72 min-w-0">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} /><YAxis stroke="#94a3b8" /><Tooltip formatter={(value) => [`${format(value)} kg CO₂`, 'Estimate']} /><Bar dataKey="value" fill="#34d399" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-500">{loading ? 'Loading historical emissions…' : 'No historical trend data available.'}</div>}</div></div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-5 text-xs uppercase tracking-[0.32em] text-slate-400">Emissions by facility · today</div><div className="space-y-5">{facilityData.map((item) => <div key={item.name}><div className="mb-2 flex items-center justify-between gap-3 text-sm text-slate-300"><span>{item.name}</span><span>{format(item.value)} kg CO₂</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.min(100, currentCarbonKG ? (item.value / currentCarbonKG) * 100 : 0)}%` }} /></div></div>)}{facilityData.length === 0 && <div className="text-sm text-slate-500">Facility emissions are not available.</div>}</div><div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500">Estimates use simulated energy readings multiplied by the configured carbon factor. They are not measured emissions.</div></div>
      </div>
    </div>
  );
}
