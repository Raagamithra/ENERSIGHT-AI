import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';

export function Settings() {
  const { user } = useAuth();
  const { data: runtimeSettings = null, loading, error } = useApiData('/runtime-config', null);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5 text-xs uppercase tracking-[0.32em] text-slate-400">Profile</div>
          <div className="space-y-4 text-sm text-slate-300">
            <div><label className="mb-2 block text-slate-400">Full name</label><div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-white">{user?.fullName || '—'}</div></div>
            <div><label className="mb-2 block text-slate-400">Organization</label><div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-white">{user?.organization || '—'}</div></div>
            <div><label className="mb-2 block text-slate-400">Email</label><div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-white">{user?.email || '—'}</div></div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-5 text-xs uppercase tracking-[0.32em] text-slate-400">Energy tariffs and carbon factor</div>
          <div className="space-y-4 text-sm text-slate-300">
            <div><label className="mb-2 block text-slate-400">Energy tariff (₹/kWh)</label><div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-white">{loading ? 'Loading…' : runtimeSettings?.tariffINRPerKWh ?? '—'}</div></div>
            <div><label className="mb-2 block text-slate-400">Carbon factor (kg CO₂/kWh)</label><div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-white">{loading ? 'Loading…' : runtimeSettings?.carbonFactorKgPerKWh ?? '—'}</div></div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-100">These read-only values come from the Node environment (`ENERGY_TARIFF`, `CARBON_FACTOR`).{error ? ' Configuration could not be loaded.' : ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
