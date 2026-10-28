import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, LoaderCircle, Search } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';

export function Monitoring() {
  const [selectedFacility, setSelectedFacility] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { energyUpdate, meterStatuses } = useSocket();
  const { data: meters = [], loading: metersLoading, error: metersError } = useApiData('/meters', []);
  const { data: facilities = [] } = useApiData('/facilities', []);
  const { data: trends = null, loading: trendsLoading, error: trendsError } = useApiData('/energy/trends', null);

  const meterDataSet = useMemo(() => {
    if (!Array.isArray(meters)) return [];
    return meters.map((meter) => ({
      id: meter.id || meter.meterId || meter.externalId,
      facility: meter.facility || 'Unknown',
      power: meter.kW ?? meter.power ?? 0,
      voltage: meter.voltage ?? 0,
      current: meter.current ?? 0,
      frequency: meter.frequency ?? 60,
      energy: meter.energyToday ?? meter.energy ?? 0,
      status: meter.status || 'ONLINE',
    }));
  }, [meters]);

  const liveMeters = meterDataSet.map((meter) => {
    const reading = energyUpdate?.readings?.find((item) => item.meterId === meter.id);
    const status = meterStatuses[meter.id]?.status;
    return reading ? { ...meter, power: reading.power, voltage: reading.voltage, current: reading.current, frequency: reading.frequency, energy: meter.energy + reading.energy } : status ? { ...meter, status } : meter;
  });
  const filteredMeters = liveMeters.filter((meter) => {
    const facilityMatches = selectedFacility === 'All' || meter.facility === selectedFacility;
    const query = searchQuery.trim().toLowerCase();
    const textMatches = !query || `${meter.id} ${meter.facility} ${meter.name || ''}`.toLowerCase().includes(query);
    return facilityMatches && textMatches;
  });
  const historicalSeries = Array.isArray(trends?.hourly) ? trends.hourly : [];
  const chartSeries = energyUpdate?.timestamp
    ? [...historicalSeries.slice(-23), { time: new Date(energyUpdate.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), total: energyUpdate.total, load: energyUpdate.total }]
    : historicalSeries;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-slate-400">Monitoring center</div>
            <div className="mt-2 text-xl font-semibold text-white">Smart meter telemetry</div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <label className="flex min-w-36 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-300"><Search className="h-4 w-4 shrink-0 text-slate-400" /><input aria-label="Search meters" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-24 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 sm:w-32" placeholder="Search meters" /></label>
            {['All', ...facilities.map((facility) => facility.name)].filter((facility, index, items) => items.indexOf(facility) === index).map((facility) => (
              <button key={facility} type="button" onClick={() => setSelectedFacility(facility)} className={`rounded-xl border px-3 py-2 ${selectedFacility === facility ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 text-slate-300'}`}>
                {facility}
              </button>
            ))}
          </div>
        </div>

        {trendsError && !trends && <div role="alert" className="mb-3 text-sm text-rose-300">Unable to load energy trends.</div>}
        <div className="h-64">
          {chartSeries.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-slate-500">{trendsLoading ? 'Loading energy readings…' : 'No energy readings available.'}</div> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartSeries}>
              <defs>
                <linearGradient id="liveLoad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Area type="monotone" dataKey={chartSeries[0]?.load ? 'load' : 'total'} stroke="#22d3ee" fill="url(#liveLoad)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredMeters.map((meter) => (
          <motion.div key={meter.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{meter.id}</div>
                <div className="mt-1 text-lg font-semibold text-white">{meter.facility}</div>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.22em] ${meter.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-300' : meter.status === 'WARNING' ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'}`}>
                {meter.status}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div><span className="text-slate-400">kW</span><div className="mt-1 text-lg text-white">{meter.power}</div></div>
              <div><span className="text-slate-400">Voltage</span><div className="mt-1 text-lg text-white">{meter.voltage}V</div></div>
              <div><span className="text-slate-400">Current</span><div className="mt-1 text-lg text-white">{meter.current}A</div></div>
              <div><span className="text-slate-400">Frequency</span><div className="mt-1 text-lg text-white">{meter.frequency}Hz</div></div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
              <span>{meter.energy} kWh today</span>
              <span className="flex items-center gap-1 text-emerald-300"><Activity className="h-3.5 w-3.5" /> Live</span>
            </div>
          </motion.div>
        ))}
        {metersError && filteredMeters.length === 0 && <div role="alert" className="col-span-full rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">Unable to load meter readings.</div>}
        {metersLoading && filteredMeters.length === 0 && <div className="col-span-full flex items-center gap-2 py-8 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading meters...</div>}
        {!metersLoading && !metersError && filteredMeters.length === 0 && <div className="col-span-full rounded-xl border border-slate-800 p-8 text-center text-sm text-slate-400">No meters match this view.</div>}
      </div>
    </div>
  );
}
