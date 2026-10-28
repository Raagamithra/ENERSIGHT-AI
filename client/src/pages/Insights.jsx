import { AlertTriangle, Leaf, Zap } from 'lucide-react';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';

const format = (value, digits = 1) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });
const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function Insights() {
  const { data: status = null, loading, error } = useApiData('/demand-response/status', null);
  const { data: history = [] } = useApiData('/demand-response/history', []);
  const { energyUpdate, demandResponseResult } = useSocket();
  const latestSimulation = demandResponseResult || history[0] || null;
  const currentDemand = Number(energyUpdate?.summary?.totalPower ?? status?.currentDemandKW) || 0;
  const predictedPeak = Math.max(currentDemand, currentDemand + Math.max(0, Number(status?.predictedPeakKW || 0) - Number(status?.currentDemandKW || 0)));
  const targetPeak = Number(status?.targetPeakKW) || 0;
  const peakGap = Math.max(0, predictedPeak - targetPeak);
  const possibleReduction = Math.min(peakGap, Number(status?.totalFlexibleCapacityKW) || 0);
  const candidates = status?.flexibleLoads || [];
  const items = latestSimulation?.actions?.length
    ? latestSimulation.actions.map((action) => ({
      key: action.id,
      issue: `${action.facility} demand contributes to the predicted peak`,
      reason: action.reason,
      action: action.action,
      impact: action.estimatedImpact,
      priority: action.priority,
    }))
    : candidates.map((load) => {
      const energyKWh = load.maxReductionKW * load.estimatedDurationMinutes / 60;
      const cost = energyKWh * (status?.tariffINRPerKWh || 0);
      const carbon = energyKWh * (status?.carbonFactorKgPerKWh || 0);
      return {
        key: load.id,
        issue: `${load.facility} has shiftable load capacity`,
        reason: `${format(load.currentPowerKW)} kW measured load; up to ${format(load.maxReductionKW)} kW is marked flexible. ${load.reason}`,
        action: `Simulate a reduction or shift of up to ${format(load.maxReductionKW)} kW for ${load.estimatedDurationMinutes} minutes.`,
        impact: `Potential if selected alone: ${format(energyKWh, 2)} kWh, ${formatINR(cost)} energy-cost estimate, ${format(carbon, 2)} kg CO₂ estimate.`,
        priority: load.priority,
      };
    });

  return (
    <div className="space-y-6">
      {error && !status && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">Unable to load current optimization insights.</div>}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Flexible capacity toward target</div><div className="mt-2 text-3xl font-semibold text-cyan-300">{status ? `${format(possibleReduction)} kW` : '—'}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Forecast peak gap</div><div className="mt-2 text-3xl font-semibold text-emerald-300">{status ? `${format(peakGap)} kW` : '—'}</div></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm text-slate-400">Latest simulated cost impact</div><div className="mt-2 text-3xl font-semibold text-amber-300">{latestSimulation ? formatINR(latestSimulation.estimatedCostImpactINR) : '—'}</div></div>
      </div>

      {!latestSimulation && status && <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${peakGap > 0 ? 'border-amber-500/25 bg-amber-500/[0.06] text-amber-100' : 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-100'}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><div className="font-medium">{peakGap > 0 ? 'Optimization candidates only' : 'Peak demand within target'}</div><div className="mt-1 opacity-80">{peakGap > 0 ? 'These are possible actions, not a selected dispatch. Run Demand Response to simulate a target-specific plan.' : 'No flexible-load reduction is needed at the current target.'}</div></div></div>}

      <div className="space-y-4">
        {items.map((item) => <div key={item.key} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="text-xs uppercase tracking-[0.32em] text-cyan-300">{latestSimulation ? 'Selected simulated action' : 'Flexible load opportunity'}</div><span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300">{item.priority} priority</span></div><div className="text-xl font-semibold text-white">{item.issue}</div><div className="mt-5 space-y-4 text-slate-300"><div><div className="text-xs uppercase tracking-[0.26em] text-slate-400">Reason</div><div className="mt-2">{item.reason}</div></div><div><div className="text-xs uppercase tracking-[0.26em] text-slate-400">Suggested action</div><div className="mt-2">{item.action}</div></div><div><div className="text-xs uppercase tracking-[0.26em] text-slate-400">{latestSimulation ? 'Simulated impact' : 'Estimated impact if selected'}</div><div className="mt-2 flex items-start gap-2 text-emerald-300"><Leaf className="mt-0.5 h-4 w-4 shrink-0" />{item.impact}</div></div></div></div>)}
        {!loading && items.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-sm text-slate-400"><Zap className="mx-auto mb-3 h-6 w-6 text-slate-600" />No flexible-load recommendations are available.</div>}
      </div>
    </div>
  );
}
