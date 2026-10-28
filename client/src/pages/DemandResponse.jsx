import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, CheckCircle2, Clock3, Factory, Leaf, Play, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../services/api';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';

const formatINR = (value) => `₹${(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatNumber = (value, digits = 0) => (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });

function Metric({ label, value, unit, icon: Icon, tone = 'cyan', detail }) {
  const iconTone = { cyan: 'text-cyan-300', emerald: 'text-emerald-300', amber: 'text-amber-300', rose: 'text-rose-300' }[tone];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-2 text-sm text-slate-400"><span>{label}</span><Icon className={`h-4 w-4 ${iconTone}`} /></div>
      <div className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{value}<span className="ml-1 text-sm font-medium text-slate-400">{unit}</span></div>
      {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
    </div>
  );
}

export function DemandResponse() {
  const { data: status = null, error: statusError } = useApiData('/demand-response/status', null);
  const { data: historyData = [] } = useApiData('/demand-response/history', []);
  const { energyUpdate, demandResponseResult: socketResult, connectionState } = useSocket();
  const [targetDraft, setTargetDraft] = useState('');
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [simulationError, setSimulationError] = useState('');
  const [preset, setPreset] = useState('custom');

  const currentDemandKW = Math.max(0, Number(energyUpdate?.summary?.totalPower ?? status?.currentDemandKW) || 0);
  const forecastLift = Math.max(0, Number(status?.predictedPeakKW || 0) - Number(status?.currentDemandKW || 0));
  const predictedPeakKW = Math.max(currentDemandKW, currentDemandKW + forecastLift);
  const targetPeakKW = Number(targetDraft) > 0 ? Number(targetDraft) : Number(status?.targetPeakKW) || Math.round(predictedPeakKW * 0.9);
  const selectedResult = socketResult && (!result || Date.parse(socketResult.timestamp) > Date.parse(result.timestamp)) ? socketResult : result;
  const history = Array.isArray(historyData) ? historyData : [];
  const stale = Boolean(selectedResult && (
    Math.abs(currentDemandKW - selectedResult.currentDemandKW) > Math.max(10, currentDemandKW * 0.03)
    || targetPeakKW !== selectedResult.targetPeakKW
  ));
  const flexibleLoads = status?.flexibleLoads || [];
  const chartData = useMemo(() => [
    { label: 'Current', value: currentDemandKW, fill: '#22d3ee' },
    { label: 'Predicted peak', value: predictedPeakKW, fill: '#fbbf24' },
    { label: 'Target', value: targetPeakKW, fill: '#94a3b8' },
    { label: 'Optimized', value: selectedResult?.optimizedDemandKW ?? predictedPeakKW, fill: '#34d399' },
  ], [currentDemandKW, predictedPeakKW, targetPeakKW, selectedResult]);

  const runSimulation = async () => {
    if (!Number.isFinite(targetPeakKW) || targetPeakKW <= 0) {
      setSimulationError('Enter a target peak greater than 0 kW.');
      return;
    }
    setSimulationError('');
    setPhase('analyzing');
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      setPhase('calculating');
      const response = await api.post('/demand-response/simulate', { targetPeakKW });
      if (!response.data?.success || !response.data?.data) throw new Error('The optimization service returned an invalid response.');
      setResult(response.data.data);
      setPhase('complete');
    } catch (error) {
      setSimulationError(error.response?.data?.message || error.message || 'Unable to calculate optimization. Please try again.');
      setPhase('idle');
    }
  };

  const setReductionPreset = (percent) => {
    setPreset(String(percent));
    setTargetDraft(String(Math.max(1, Math.round(predictedPeakKW * (1 - percent / 100)))));
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-300"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Simulation mode</span><span className="rounded-full border border-amber-500/25 px-2 py-0.5 text-[10px] uppercase text-amber-200">Decision support only</span></div>
              <p className="mt-2 text-sm text-slate-200">No physical equipment is being controlled. Results are simulated estimates based on current and predicted demand.</p>
            </div>
          </div>
          <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${connectionState === 'live' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-950/50 text-slate-400'}`}><span className={`h-2 w-2 rounded-full ${connectionState === 'live' ? 'bg-emerald-400' : 'bg-slate-500'}`} />{connectionState === 'live' ? 'LIVE DATA' : 'WAITING FOR LIVE DATA'}</div>
        </div>
      </motion.div>

      {(status?.forecastStatus === 'fallback' || !status) && <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div><div className="font-medium">AI Forecast Service Offline</div><div className="mt-1 text-amber-100/70">Using the local fallback forecast. Connect FastAPI for model-generated predictions.{!status && statusError ? ` ${statusError.message}` : ''}</div></div></div>}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-xs uppercase tracking-[0.3em] text-slate-400">Demand outlook</div><h2 className="mt-2 text-xl font-semibold text-white">Live demand response control center</h2></div>
          <div className="text-xs text-slate-500">Forecast: {status?.forecastSource || 'Loading forecast'}{status?.forecastConfidence ? ` · ${formatNumber(status.forecastConfidence)}% confidence` : ''}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Current demand" value={formatNumber(currentDemandKW)} unit="kW" icon={Activity} detail={`${formatNumber(status?.currentEnergyKWh)} kWh consumed today`} />
          <Metric label="Predicted peak" value={formatNumber(predictedPeakKW)} unit="kW" icon={Zap} tone="amber" detail={`Peak window: ${status?.peakTime || 'Forecast in progress'}`} />
          <Metric label="Target peak" value={formatNumber(targetPeakKW)} unit="kW" icon={Factory} tone="cyan" detail={`${formatNumber(predictedPeakKW - currentDemandKW)} kW forecast rise from current`} />
          <Metric label="Simulated reduction" value={formatNumber(selectedResult?.peakReductionKW ?? 0, 1)} unit="kW" icon={ArrowDownRight} tone="emerald" detail={selectedResult ? `${formatNumber(selectedResult.reductionPercent, 1)}% of predicted peak` : 'Run a simulation to see selected actions'} />
        </div>
      </section>

      {predictedPeakKW > targetPeakKW
        ? <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/[0.07] p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" /><div><div className="font-semibold text-rose-200">Peak Demand Risk</div><p className="mt-1 text-sm text-rose-100/75">Predicted demand is expected to exceed the configured target by {formatNumber(predictedPeakKW - targetPeakKW)} kW. Demand-response simulation is recommended.</p></div></motion.div>
        : <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><div className="font-semibold text-emerald-200">Peak Demand Within Target</div><p className="mt-1 text-sm text-emerald-100/70">No optimization action is currently required.</p></div></div>}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5"><div className="text-xs uppercase tracking-[0.3em] text-slate-400">Optimization setup</div><h2 className="mt-2 text-lg font-semibold text-white">Set a peak target</h2></div>
          <div className="mb-4 grid grid-cols-3 gap-2">{[5, 10, 15].map((percent) => <button key={percent} type="button" onClick={() => setReductionPreset(percent)} className={`rounded-xl border px-2 py-2 text-sm transition ${preset === String(percent) ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500'}`}>−{percent}%</button>)}</div>
          <label htmlFor="target-peak" className="mb-2 block text-sm text-slate-300">Custom target peak</label>
          <div className="flex items-center gap-2"><input id="target-peak" type="number" min="1" max="100000" step="1" value={targetDraft || targetPeakKW} onChange={(event) => { setPreset('custom'); setTargetDraft(event.target.value); }} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500" /><span className="text-sm text-slate-400">kW</span></div>
          <input aria-label="Target peak slider" type="range" min={Math.max(1, Math.round(predictedPeakKW * 0.5))} max={Math.max(2, Math.ceil(predictedPeakKW * 1.15))} value={Math.min(Math.max(targetPeakKW, Math.round(predictedPeakKW * 0.5)), Math.ceil(predictedPeakKW * 1.15))} onChange={(event) => { setPreset('custom'); setTargetDraft(event.target.value); }} className="mt-5 w-full accent-cyan-400" />
          <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{formatNumber(predictedPeakKW * 0.5)} kW</span><span>{formatNumber(predictedPeakKW * 1.15)} kW</span></div>
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm"><div className="flex justify-between text-slate-400"><span>Required reduction</span><span className="font-medium text-white">{formatNumber(Math.max(0, predictedPeakKW - targetPeakKW))} kW</span></div><div className="mt-2 flex justify-between text-slate-400"><span>Available flexible capacity</span><span className="font-medium text-cyan-200">{formatNumber(status?.totalFlexibleCapacityKW)} kW</span></div></div>
          <button type="button" onClick={runSimulation} disabled={phase === 'analyzing' || phase === 'calculating'} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70">
            {phase === 'analyzing' || phase === 'calculating' ? <RefreshCw className="h-4 w-4 animate-spin" /> : phase === 'complete' ? <CheckCircle2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {phase === 'analyzing' ? 'Analyzing Loads...' : phase === 'calculating' ? 'Calculating Demand Response...' : phase === 'complete' ? 'Optimization Complete' : 'Simulate Optimization'}
          </button>
          {simulationError && <p role="alert" className="mt-3 text-sm text-rose-300">{simulationError}</p>}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between"><div><div className="text-xs uppercase tracking-[0.3em] text-slate-400">Before / after</div><h2 className="mt-2 text-lg font-semibold text-white">Demand scenario · kW</h2></div><ArrowRight className="h-4 w-4 text-slate-500" /></div>
          <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 14, right: 8, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} /><YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [`${formatNumber(value)} kW`, 'Demand']} contentStyle={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 10 }} /><Bar dataKey="value" radius={[7, 7, 0, 0]} animationDuration={500}>{chartData.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>
          {selectedResult && <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 sm:grid-cols-4"><div><div className="text-xs text-slate-500">Optimized demand</div><div className="mt-1 font-semibold text-emerald-300">{formatNumber(selectedResult.optimizedDemandKW)} kW</div></div><div><div className="text-xs text-slate-500">Peak reduction</div><div className="mt-1 font-semibold text-cyan-200">{formatNumber(selectedResult.peakReductionKW, 1)} kW</div></div><div><div className="text-xs text-slate-500">Energy impact</div><div className="mt-1 font-semibold text-white">{formatNumber(selectedResult.estimatedEnergyReductionKWh, 2)} kWh</div></div><div><div className="text-xs text-slate-500">Target</div><div className="mt-1 font-semibold text-white">{selectedResult.targetReached ? 'Reached' : `${formatNumber(selectedResult.remainingReductionKW)} kW gap`}</div></div></div>}
        </section>
      </div>

      {stale && <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />Optimization result outdated. Current demand has changed; run simulation again.</div>}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4"><div className="text-xs uppercase tracking-[0.3em] text-slate-400">Flexible load inventory</div><h2 className="mt-2 text-lg font-semibold text-white">Measured facility contributors</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{flexibleLoads.map((load) => <div key={load.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-start justify-between gap-2"><div><div className="font-medium text-white">{load.name}</div><div className="mt-1 text-xs text-slate-400">{load.facility} · {load.priority} priority</div></div><span className={`rounded-full px-2 py-1 text-[10px] uppercase ${load.shiftable ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{load.shiftable ? 'Shiftable' : 'Unavailable'}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-slate-500">Current</div><div className="mt-1 text-white">{formatNumber(load.currentPowerKW)} kW</div></div><div><div className="text-xs text-slate-500">Max reduction</div><div className="mt-1 text-cyan-200">{formatNumber(load.maxReductionKW)} kW</div></div></div></div>)}{!flexibleLoads.length && <div className="col-span-full rounded-xl border border-slate-800 p-4 text-sm text-slate-400">Flexible load data is not available yet.</div>}</div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4"><div className="text-xs uppercase tracking-[0.3em] text-slate-400">Facility contribution</div><h2 className="mt-2 text-lg font-semibold text-white">Current site load mix</h2></div>
          <div className="space-y-4">{(status?.facilityContributions || []).map((item) => <div key={item.facility}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="text-slate-200">{item.facility}</span><span className="text-slate-400">{formatNumber(item.currentPowerKW)} kW · {formatNumber(item.sharePercent, 1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all" style={{ width: `${Math.min(100, item.sharePercent)}%` }} /></div></div>)}</div>
          {selectedResult && <div className="mt-6 space-y-3 border-t border-slate-800 pt-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-400">Simulated estimates</div><div className="flex justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-slate-300"><Zap className="h-4 w-4 text-amber-300" /> Energy cost impact</span><span className="font-semibold text-amber-200">{formatINR(selectedResult.estimatedCostImpactINR)}</span></div><div className="flex justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-slate-300"><Leaf className="h-4 w-4 text-emerald-300" /> Carbon reduction</span><span className="font-semibold text-emerald-200">{formatNumber(selectedResult.estimatedCarbonReductionKG, 2)} kg CO₂</span></div><div className="text-[11px] text-slate-500">Based on {formatINR(selectedResult.tariffINRPerKWh)}/kWh, {formatNumber(selectedResult.carbonFactorKgPerKWh, 2)} kg CO₂/kWh, and action durations. Not guaranteed savings.</div></div>}
        </section>
      </div>

      {selectedResult && <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.3em] text-slate-400">Selected optimization</div><h2 className="mt-2 text-lg font-semibold text-white">Simulated actions</h2></div>{selectedResult.targetReached ? <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Target reached</span> : <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">Capacity limit reached</span>}</div>
        {selectedResult.actions.length ? <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400"><tr>{['Load / facility', 'Current load', 'Reduction', 'After optimization', 'Duration', 'Reason', 'Status'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{selectedResult.actions.map((action) => <tr key={action.id} className="border-t border-slate-800 text-slate-300"><td className="px-3 py-3"><div className="font-medium text-white">{action.load}</div><div className="text-xs text-slate-500">{action.facility}</div></td><td className="px-3 py-3">{formatNumber(action.currentLoadKW)} kW</td><td className="px-3 py-3 text-cyan-200">−{formatNumber(action.reductionKW, 1)} kW</td><td className="px-3 py-3">{formatNumber(action.afterLoadKW, 1)} kW</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{action.durationMinutes} min</span></td><td className="max-w-xs px-3 py-3 text-xs text-slate-400">{action.reason}</td><td className="px-3 py-3"><span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">SIMULATED</span></td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">No flexible-load action was needed to meet this target.</div>}
      </section>}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><div className="mb-4"><div className="text-xs uppercase tracking-[0.3em] text-slate-400">Runtime only</div><h2 className="mt-2 text-lg font-semibold text-white">Recent simulations</h2></div><div className="space-y-2">{[...(selectedResult ? [selectedResult] : []), ...history.filter((item) => item.id !== selectedResult?.id)].slice(0, 5).map((item) => <div key={item.id} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm sm:grid-cols-[1.2fr_repeat(4,1fr)] sm:items-center"><div className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</div><div><span className="text-slate-500">Peak </span><span className="text-white">{formatNumber(item.predictedPeakKW)} kW</span></div><div><span className="text-slate-500">Target </span><span className="text-white">{formatNumber(item.targetPeakKW)} kW</span></div><div><span className="text-slate-500">Reduction </span><span className="text-cyan-200">{formatNumber(item.peakReductionKW, 1)} kW</span></div><div className="text-amber-200">{formatINR(item.estimatedCostImpactINR)} est.</div></div>)}{!history.length && !selectedResult && <div className="text-sm text-slate-500">Simulation history will appear here and resets when the server restarts.</div>}</div></section>
    </div>
  );
}
