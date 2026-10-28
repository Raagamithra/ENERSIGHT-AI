import { useEffect, useState } from 'react';
import { Activity, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { useApiData } from '../hooks/useApiData';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name: '', type: '', facilityId: '', status: 'ONLINE', currentPowerKW: '', voltage: '400' };
const number = (value) => (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });

function mergeRows(current, update) {
  if (Array.isArray(update)) return update;
  const id = update?.id || update?.meterId;
  if (!id) return current;
  if (update.deleted) return current.filter((row) => row.id !== id);
  const index = current.findIndex((row) => row.id === id);
  if (index < 0) return [...current, update];
  return current.map((row) => row.id === id ? { ...row, ...update } : row);
}

export function Meters() {
  const { data, loading, error } = useApiData('/meters', []);
  const { data: facilities = [] } = useApiData('/facilities', []);
  const { meterUpdates, meterStatuses } = useSocket();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = ['ADMIN', 'ENERGY_MANAGER'].includes(user?.role);
  const canDelete = user?.role === 'ADMIN';

  useEffect(() => { if (Array.isArray(data)) setRows(data); }, [data]);
  useEffect(() => { if (meterUpdates) setRows((current) => mergeRows(current, meterUpdates)); }, [meterUpdates]);
  useEffect(() => {
    const entries = Object.entries(meterStatuses);
    if (!entries.length) return;
    setRows((current) => current.map((meter) => meterStatuses[meter.id] ? { ...meter, status: meterStatuses[meter.id].status, lastReadingAt: meterStatuses[meter.id].timestamp } : meter));
  }, [meterStatuses]);

  const openForm = (meter = null) => {
    setPageError('');
    setNotice('');
    setEditing(meter);
    setForm(meter ? { name: meter.name || meter.type || '', type: meter.type || '', facilityId: meter.facilityId || facilities.find((facility) => facility.name === meter.facilityName)?.id || '', status: meter.status || 'ONLINE', currentPowerKW: String(meter.currentPowerKW ?? meter.kW ?? 0), voltage: String(meter.voltage || 400) } : { ...emptyForm, facilityId: facilities[0]?.id || '' });
    setFormOpen(true);
  };

  const saveMeter = async (event) => {
    event.preventDefault();
    setSaving(true);
    setPageError('');
    try {
      const payload = { ...form, currentPowerKW: Number(form.currentPowerKW), voltage: Number(form.voltage) };
      const response = editing
        ? await api.put(`/meters/${editing.id}`, payload)
        : await api.post('/meters', payload);
      setRows((current) => mergeRows(current, response.data.data));
      setNotice(editing ? 'Meter updated for this server session.' : 'Meter added for this server session.');
      setEditing(null);
      setFormOpen(false);
    } catch (requestError) {
      setPageError(requestError.response?.data?.message || 'Unable to save meter.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMeter = async (meter) => {
    setPageError('');
    setNotice('');
    try {
      await api.delete(`/meters/${meter.id}`);
      setRows((current) => current.filter((row) => row.id !== meter.id));
      setNotice('Meter deleted for this server session.');
    } catch (requestError) {
      setPageError(requestError.response?.data?.message || 'Unable to delete meter.');
    }
  };

  const statusStyle = (status) => status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-300' : status === 'WARNING' ? 'bg-amber-500/10 text-amber-300' : status === 'CRITICAL' || status === 'OFFLINE' ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-700 text-slate-300';

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs uppercase tracking-[0.32em] text-slate-400">Meter management</div><div className="mt-2 text-xl font-semibold text-white">Connected devices</div><div className="mt-1 text-xs text-slate-500">Simulated readings update live. Meter changes reset when the server restarts.</div></div>{canWrite && <button type="button" onClick={() => openForm()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"><Plus className="h-4 w-4" />Add meter</button>}</div>
        {pageError && <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{pageError}</div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
        {loading && rows.length === 0 ? <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading meters...</div>
          : error && rows.length === 0 ? <div role="alert" className="py-10 text-sm text-rose-300">Unable to load meters. Check your connection and try again.</div>
            : rows.length === 0 ? <div className="py-10 text-center text-sm text-slate-400"><Activity className="mx-auto mb-3 h-7 w-7 text-slate-600" />No meters are connected yet.</div>
              : <div className="overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[850px] text-left text-sm text-slate-300"><thead className="bg-slate-950/80 text-xs uppercase tracking-[0.18em] text-slate-400"><tr>{['Meter', 'Facility', 'Type', 'Current power', 'Voltage', 'Current', 'Status', 'Last reading', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody>{rows.map((meter) => { const live = meterStatuses[meter.id]; return <tr key={meter.id} className="border-t border-slate-800"><td className="px-4 py-3"><div className="font-medium text-white">{meter.name || meter.id}</div><div className="mt-1 text-xs text-slate-500">{meter.id}</div></td><td className="px-4 py-3">{meter.facilityName || meter.facility || 'Unknown'}</td><td className="px-4 py-3">{meter.type || '—'}</td><td className="px-4 py-3 font-medium text-cyan-200">{number(meter.currentPowerKW ?? meter.kW)} kW</td><td className="px-4 py-3">{number(meter.voltage)} V</td><td className="px-4 py-3">{number(meter.current)} A</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.15em] ${statusStyle(live?.status || meter.status)}`}>{live?.status || meter.status}</span></td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{meter.lastReadingAt || meter.lastUpdated ? new Date(live?.timestamp || meter.lastReadingAt || meter.lastUpdated).toLocaleString() : 'Waiting for first reading'}</td><td className="px-4 py-3"><div className="flex items-center gap-3">{canWrite && <button type="button" onClick={() => openForm(meter)} aria-label={`Edit ${meter.name || meter.id}`} title="Edit meter" className="text-cyan-300 hover:text-white"><Pencil className="h-4 w-4" /></button>}{canDelete && <button type="button" onClick={() => deleteMeter(meter)} aria-label={`Delete ${meter.name || meter.id}`} title="Delete meter" className="text-rose-300 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button>}{!canWrite && !canDelete && <span className="text-xs text-slate-600">Read only</span>}</div></td></tr>; })}</tbody></table></div>}
      </section>

      {formOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setFormOpen(false); setEditing(null); } }}><form onSubmit={saveMeter} className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Runtime configuration</div><h2 className="mt-1 text-lg font-semibold text-white">{editing ? 'Edit meter' : 'Add meter'}</h2></div><button type="button" onClick={() => { setFormOpen(false); setEditing(null); }} aria-label="Close meter form" className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button></div>
        <label className="block text-sm text-slate-300">Meter name<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, type: current.type || event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label>
        <label className="block text-sm text-slate-300">Meter type<input value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label>
        <label className="block text-sm text-slate-300">Facility<select required value={form.facilityId} onChange={(event) => setForm((current) => ({ ...current, facilityId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"><option value="">Choose facility</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm text-slate-300">Initial power (kW)<input type="number" min="0" step="0.1" value={form.currentPowerKW} onChange={(event) => setForm((current) => ({ ...current, currentPowerKW: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="block text-sm text-slate-300">Voltage<input type="number" min="0" step="0.1" value={form.voltage} onChange={(event) => setForm((current) => ({ ...current, voltage: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label></div>
        <label className="block text-sm text-slate-300">Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"><option>ONLINE</option><option>WARNING</option><option>OFFLINE</option><option>CRITICAL</option></select></label>
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setFormOpen(false); setEditing(null); }} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancel</button><button type="submit" disabled={saving || facilities.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{saving ? 'Saving...' : editing ? 'Save changes' : 'Add meter'}</button></div>
      </form></div>}
    </div>
  );
}
