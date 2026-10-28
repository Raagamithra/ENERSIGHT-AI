import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';

const format = (value) => value === undefined || value === null ? '—' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const formatINR = (value) => value === undefined || value === null ? '—' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function Analytics() {
  const [view, setView] = useState('Hourly');
  const { data: trends = null, loading: trendsLoading, error: trendsError } = useApiData('/energy/trends', null);
  const { data: summary = null } = useApiData('/energy/summary', null);
  const { data: facilities = [] } = useApiData('/facilities', []);
  const { energyUpdate } = useSocket();
  const seriesKey = { Hourly: 'hourly', Daily: 'daily', Weekly: 'weekly', Monthly: 'monthly' }[view];
  const labels = { Hourly: 'time', Daily: 'day', Weekly: 'day', Monthly: 'month' };
  const trendSeries = useMemo(() => {
    const rows = Array.isArray(trends?.[seriesKey]) ? trends[seriesKey] : [];
    const result = rows.map((entry) => ({ label: entry[labels[view]] || '—', demand: Number(entry.total) || 0 }));
    if (view === 'Hourly' && energyUpdate?.timestamp) {
      const label = new Date(energyUpdate.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (result.at(-1)?.label === label) result.pop();
      result.push({ label, demand: Number(energyUpdate.total) || 0 });
    }
    return result;
  }, [trends, seriesKey, labels, view, energyUpdate]);
  const facilitySeries = facilities.map((facility) => ({ name: facility.name, value: Number(facility.currentPowerKW) || 0 }));
  const displayed = energyUpdate?.summary || summary || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Current demand', format(displayed.totalPower), 'kW'], ['Energy today', format(displayed.energyToday), 'kWh'], ['Energy cost', formatINR(displayed.costEstimate), 'INR'], ['CO₂ today', format(displayed.emissions), 'kg']].map(([label, value, unit]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-white">{value}<span className="ml-1 text-xs font-normal text-slate-500">{unit}</span></div></div>)}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Trend interval">{['Hourly', 'Daily', 'Weekly', 'Monthly'].map((label) => <button key={label} type="button" aria-pressed={view === label} onClick={() => setView(label)} className={`rounded-xl border px-4 py-2.5 text-sm ${view === label ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900/80 text-slate-300'}`}>{label}</button>)}</div>

      {trendsError && !trends && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">Unable to load energy analytics.</div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-5 text-xs uppercase tracking-[0.32em] text-slate-400">{view} demand trend</div><div className="h-72 min-w-0">{trendSeries.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendSeries}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} /><YAxis stroke="#94a3b8" /><Tooltip formatter={(value) => [`${format(value)} ${view === 'Hourly' ? 'kW' : 'kWh'}`, 'Demand']} /><Line type="monotone" dataKey="demand" stroke="#22d3ee" strokeWidth={3} dot={{ r: 2 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-500">{trendsLoading ? 'Loading trend data…' : 'No trend data available.'}</div>}</div></div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-5 text-xs uppercase tracking-[0.32em] text-slate-400">Current facility comparison</div><div className="h-72 min-w-0">{facilitySeries.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={facilitySeries}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} /><YAxis stroke="#94a3b8" /><Tooltip formatter={(value) => [`${format(value)} kW`, 'Current power']} /><Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#22d3ee" /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-500">No facility readings available.</div>}</div></div>
      </div>
    </div>
  );
}
