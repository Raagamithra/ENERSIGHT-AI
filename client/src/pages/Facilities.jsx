import { useEffect, useState } from 'react';
import { Building2, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name: '', location: '', type: 'Industrial', manager: '', status: 'ONLINE' };
const number = (value) => (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });

function mergeRows(current, update) {
  if (Array.isArray(update)) return update;
  if (!update?.id) return current;
  if (update.deleted) return current.filter((row) => row.id !== update.id);
  const index = current.findIndex((row) => row.id === update.id);
  if (index < 0) return [...current, update];
  return current.map((row) => row.id === update.id ? { ...row, ...update } : row);
}

export function Facilities() {
  const { data, loading, error } = useApiData('/facilities', []);
  const { facilityUpdates } = useSocket();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const { data: meters = [] } = useApiData('/meters', []);
  const canWrite = ['ADMIN', 'ENERGY_MANAGER'].includes(user?.role);
  const canDelete = user?.role === 'ADMIN';

  useEffect(() => { if (Array.isArray(data)) setRows(data); }, [data]);
  useEffect(() => { if (facilityUpdates) setRows((current) => mergeRows(current, facilityUpdates)); }, [facilityUpdates]);

  const openForm = (facility = null) => {
    setPageError('');
    setNotice('');
    setEditing(facility);
    setForm(facility ? { name: facility.name || '', location: facility.location || '', type: facility.type || '', manager: facility.manager || '', status: facility.status || 'ONLINE' } : emptyForm);
    setFormOpen(true);
  };

  const saveFacility = async (event) => {
    event.preventDefault();
    setSaving(true);
    setPageError('');
    try {
      const response = editing
        ? await api.put(`/facilities/${editing.id}`, form)
        : await api.post('/facilities', form);
      setRows((current) => mergeRows(current, response.data.data));
      setNotice(editing ? 'Facility updated for this server session.' : 'Facility added for this server session.');
      setEditing(null);
      setFormOpen(false);
    } catch (requestError) {
      setPageError(requestError.response?.data?.message || 'Unable to save facility.');
    } finally {
      setSaving(false);
    }
  };

  const deleteFacility = async (facility) => {
    setPageError('');
    setNotice('');
    const assignedMeterCount = meters.filter((meter) => meter.facilityId === facility.id || meter.facilityName === facility.name || meter.facility === facility.name).length;
    if (assignedMeterCount > 0) {
      setPageError(`Cannot delete ${facility.name} while ${assignedMeterCount} meter${assignedMeterCount === 1 ? ' is' : 's are'} assigned. Move or delete the meters first.`);
      return;
    }
    try {
      await api.delete(`/facilities/${facility.id}`);
      setRows((current) => current.filter((row) => row.id !== facility.id));
      setNotice('Facility deleted for this server session.');
    } catch (requestError) {
      setPageError(requestError.response?.data?.message || 'Unable to delete facility.');
    }
  };

  const statusStyle = (status) => status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-300' : status === 'WARNING' ? 'bg-amber-500/10 text-amber-300' : status === 'CRITICAL' || status === 'OFFLINE' ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-700 text-slate-300';

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-xs uppercase tracking-[0.32em] text-slate-400">Facility management</div><div className="mt-2 text-xl font-semibold text-white">Portfolio overview</div><div className="mt-1 text-xs text-slate-500">Current readings are simulated and update live. Changes reset when the server restarts.</div></div>
          {canWrite && <button type="button" onClick={() => openForm()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"><Plus className="h-4 w-4" />Add facility</button>}
        </div>
        {pageError && <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{pageError}</div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
        {loading && rows.length === 0 ? <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading facilities...</div>
          : error && rows.length === 0 ? <div role="alert" className="py-10 text-sm text-rose-300">Unable to load facilities. Check your connection and try again.</div>
            : rows.length === 0 ? <div className="py-10 text-center text-sm text-slate-400"><Building2 className="mx-auto mb-3 h-7 w-7 text-slate-600" />No facilities yet.</div>
              : <div className="overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[860px] text-left text-sm text-slate-300"><thead className="bg-slate-950/80 text-xs uppercase tracking-[0.18em] text-slate-400"><tr>{['Facility', 'Location', 'Type', 'Current power', 'Energy today', 'Peak power', 'Meters', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody>{rows.map((facility) => <tr key={facility.id} className="border-t border-slate-800"><td className="px-4 py-3"><div className="font-medium text-white">{facility.name}</div><div className="mt-1 text-xs text-slate-500">{facility.manager || 'Manager not assigned'}</div></td><td className="px-4 py-3">{facility.location || '—'}</td><td className="px-4 py-3">{facility.type || '—'}</td><td className="px-4 py-3 font-medium text-cyan-200">{number(facility.currentPowerKW)} kW</td><td className="px-4 py-3">{number(facility.energyTodayKWh)} kWh</td><td className="px-4 py-3">{number(facility.peakPowerKW)} kW</td><td className="px-4 py-3">{facility.meterCount ?? 0}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.15em] ${statusStyle(facility.status)}`}>{facility.status}</span></td><td className="px-4 py-3"><div className="flex items-center gap-3">{canWrite && <button type="button" onClick={() => openForm(facility)} aria-label={`Edit ${facility.name}`} title="Edit facility" className="text-cyan-300 hover:text-white"><Pencil className="h-4 w-4" /></button>}{canDelete && <button type="button" onClick={() => deleteFacility(facility)} aria-label={`Delete ${facility.name}`} title="Delete facility" className="text-rose-300 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button>}{!canWrite && !canDelete && <span className="text-xs text-slate-600">Read only</span>}</div></td></tr>)}</tbody></table></div>}
      </section>

      {formOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setFormOpen(false); setEditing(null); } }}>
        <form onSubmit={saveFacility} className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
          <div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Runtime configuration</div><h2 className="mt-1 text-lg font-semibold text-white">{editing ? 'Edit facility' : 'Add facility'}</h2></div><button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setFormOpen(false); }} aria-label="Close facility form" className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button></div>
          {[['name', 'Facility name'], ['location', 'Location'], ['type', 'Facility type'], ['manager', 'Manager']].map(([key, label]) => <label key={key} className="block text-sm text-slate-300">{label}<input required={key === 'name'} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-500" /></label>)}
          <label className="block text-sm text-slate-300">Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"><option>ONLINE</option><option>WARNING</option><option>OFFLINE</option><option>CRITICAL</option></select></label>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setFormOpen(false); }} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{saving ? 'Saving...' : editing ? 'Save changes' : 'Add facility'}</button></div>
        </form>
      </div>}
    </div>
  );
}
