import { AlertTriangle } from 'lucide-react';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';

export function Anomalies() {
  const { data: apiAnomalies = [], loading, error } = useApiData('/ai/anomalies', []);
  const { anomalies: liveAnomalies } = useSocket();
  const mergedAnomalies = new Map();
  for (const item of [...liveAnomalies, ...(Array.isArray(apiAnomalies) ? apiAnomalies : [])]) {
    mergedAnomalies.set(item.id || `${item.meterId || item.meter}-${item.time}`, item);
  }
  const anomalies = [...mergedAnomalies.values()];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-slate-400">Anomaly detection</div>
            <div className="mt-2 text-xl font-semibold text-white">Isolation Forest insights</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"><AlertTriangle className="h-3.5 w-3.5" /> {String(anomalies.length).padStart(2, '0')} anomaly events</div>
        </div>

        {error && !apiAnomalies.length && !liveAnomalies.length && <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">Unable to load anomaly data.</div>}

        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Meter</th>
                <th className="px-4 py-3">Facility</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Observed</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Deviation</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((item) => {
                const meter = item.meter || item.meterId || 'Unknown';
                const observed = item.observed ?? item.observedPower ?? 0;
                const expected = item.expected ?? item.expectedPower ?? 0;
                const deviation = typeof item.deviation === 'string'
                  ? item.deviation
                  : expected ? `${(((observed - expected) / expected) * 100).toFixed(1)}%` : `${item.deviation ?? 0} kW`;
                const time = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
                return (
                <tr key={item.id || `${meter}-${item.time}`} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-white">{meter}</td>
                  <td className="px-4 py-3">{item.facility}</td>
                  <td className="px-4 py-3">{time}</td>
                  <td className="px-4 py-3">{observed}</td>
                  <td className="px-4 py-3">{expected}</td>
                  <td className="px-4 py-3 text-amber-300">{deviation}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${item.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300'}`}>{item.severity}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${item.status === 'CRITICAL' ? 'bg-rose-500/10 text-rose-300' : item.status === 'SUSPICIOUS' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{item.status}</span></td>
                </tr>
                );
              })}
              {!loading && anomalies.length === 0 && <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-500">No anomalies have been detected by the simulator.</td></tr>}
              {loading && anomalies.length === 0 && <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-500">Loading anomaly events...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
