import { useMemo } from 'react';
import { AlertTriangle, Gauge, Sparkles } from 'lucide-react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';

const format = (value) => value === undefined || value === null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });

export function Forecast() {
  const { data: forecast = null, loading, error } = useApiData('/ai/forecast', null);
  const { data: trends = null } = useApiData('/energy/trends', null);
  const { aiUpdate, connectionState } = useSocket();
  const history = Array.isArray(trends?.hourly) ? trends.hourly.slice(-12) : [];
  const chartData = useMemo(() => {
    const actual = history.map((point) => ({
      time: point.time || point.timestamp,
      actual: Number(point.total) || 0,
      predicted: null,
    }));
    const predicted = (forecast?.forecast || []).map((value, index) => ({
      time: new Date(Date.now() + index * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actual: null,
      predicted: Number(value) || 0,
    }));
    return [...actual, ...predicted];
  }, [history, forecast]);
  const forecastOnline = forecast?.forecastStatus === 'online' || aiUpdate?.status === 'online';
  const forecastLabel = forecast?.forecastStatus === 'fallback' || aiUpdate?.status === 'fallback'
    ? 'NODE FALLBACK'
    : forecastOnline ? 'FASTAPI MODEL ONLINE' : connectionState === 'live' ? 'CHECKING MODEL' : 'OFFLINE';

  return (
    <div className="space-y-6">
      {forecast?.forecastStatus === 'fallback' && <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div><div className="font-medium">AI Forecast Service Offline</div><div className="mt-1 text-amber-100/70">Displayed predictions use the Node fallback simulation.</div></div></div>}
      {error && !forecast && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">Unable to load forecast data. Check the API connection and retry.</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Predicted peak</div><div className="mt-2 text-3xl font-semibold text-white">{loading && !forecast ? '…' : format(forecast?.predictedPeak)} <span className="text-sm text-slate-400">kW</span></div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Peak time</div><div className="mt-2 text-2xl font-semibold text-cyan-300">{forecast?.peakTime || '—'}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Model confidence</div><div className="mt-2 text-3xl font-semibold text-emerald-300">{forecast?.confidence == null ? '—' : `${format(forecast.confidence)}%`}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Forecast source</div><div className="mt-2 text-lg font-semibold text-white">{forecastLabel}</div></div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-xs uppercase tracking-[0.32em] text-slate-400">Energy data pipeline</div><div className="mt-2 text-xl font-semibold text-white">Demand forecast model</div></div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${forecastOnline ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}><Sparkles className="h-3.5 w-3.5" />{forecastLabel}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {['Energy data', 'Data processing', 'Feature engineering', 'ML model', 'Forecast demand'].map((step) => <div key={step} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-center text-sm text-slate-300">{step}</div>)}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-slate-400"><Gauge className="h-4 w-4 text-cyan-300" /> Historical vs predicted demand</div>
        <div className="h-80 min-w-0">
          {chartData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} /><YAxis stroke="#94a3b8" /><Tooltip /><Line type="monotone" dataKey="actual" name="Historical demand" stroke="#22d3ee" strokeWidth={3} dot={{ r: 2 }} connectNulls={false} /><Line type="monotone" dataKey="predicted" name="Predicted demand" stroke="#34d399" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 2 }} connectNulls={false} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-500">{loading ? 'Loading forecast history…' : 'No forecast history is available.'}</div>}
        </div>
      </div>
    </div>
  );
}
