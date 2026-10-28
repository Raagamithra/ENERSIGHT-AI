import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileText, LoaderCircle, X, XCircle } from 'lucide-react';
import api from '../services/api';
import { useApiData } from '../hooks/useApiData';

const formatINR = (value) => value === null || value === undefined ? '' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatMetric = (value) => value === null || value === undefined ? '' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const formatDate = (value) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString();
};

export function Reports() {
  const { data: initialReports = [], loading: reportsLoading } = useApiData('/reports', []);
  const [reportRows, setReportRows] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (Array.isArray(initialReports)) setReportRows(initialReports);
  }, [initialReports]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const showToast = (type, message) => setToast({ type, message, id: Date.now() });

  const generateReport = async () => {
    setGenerating(true);
    try {
      const generated = await api.post('/reports/generate');
      if (!generated.data?.success || !generated.data?.data) throw new Error('The report service returned an invalid response.');
      const refreshed = await api.get('/reports');
      const rows = refreshed.data?.data;
      if (!Array.isArray(rows)) throw new Error('The report list could not be refreshed.');
      setReportRows(rows);
      showToast('success', 'Current operations report generated.');
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message || 'Unable to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const response = await api.get('/reports/export.csv', { responseType: 'blob' });
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/csv') || !response.data?.size) throw new Error('The report export did not return CSV data.');
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'enersight-report.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('success', 'CSV report downloaded.');
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message || 'Unable to download CSV. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const showPdfStatus = () => showToast('info', 'PDF export is not connected yet.');

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-slate-400">Reports center</div>
            <div className="mt-2 text-xl font-semibold text-white">Operational reporting</div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" onClick={generateReport} disabled={generating} className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-70">
              {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generating ? 'Generating...' : 'Generate report'}
            </button>
            <button type="button" onClick={downloadCsv} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-slate-300 transition hover:border-cyan-500/30 hover:text-white disabled:cursor-wait disabled:opacity-70">
              {downloading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? 'Downloading...' : 'CSV'}
            </button>
            <button type="button" onClick={showPdfStatus} className="rounded-xl border border-slate-700 px-3 py-2 text-slate-300 transition hover:border-slate-500 hover:text-white">PDF status</button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[680px] text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Facility</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((report) => {
                const metrics = report.metrics;
                return (
                  <tr key={report.id || `${report.type}-${report.date}`} className="border-t border-slate-800 align-top">
                    <td className="px-4 py-3 text-white">
                      {report.type}
                      {metrics && <div className="mt-1 max-w-2xl text-xs font-normal leading-5 text-slate-400">
                        Demand {formatMetric(metrics.currentDemandKW)} kW · Peak {formatMetric(metrics.currentPeakDemandKW)} kW · Cost {formatINR(metrics.costEstimateINR)} · Carbon {formatMetric(metrics.carbonEstimateKG)} kg CO₂ · {formatMetric(metrics.anomalyCount)} anomalies
                        {metrics.latestAnomaly && <span> · Latest: {metrics.latestAnomaly.reason || metrics.latestAnomaly.facility || 'Anomaly detected'}</span>}
                        {metrics.predictedPeakKW !== null && metrics.predictedPeakKW !== undefined && <span> · Forecast {formatMetric(metrics.predictedPeakKW)} kW</span>}
                        {metrics.demandResponseSimulationId && <span> · DR optimized {formatMetric(metrics.optimizedDemandKW)} kW (−{formatMetric(metrics.peakReductionKW)} kW, {formatINR(metrics.estimatedCostImpactINR)} est.)</span>}
                      </div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(report.date)}</td>
                    <td className="px-4 py-3">{report.facility}</td>
                    <td className="px-4 py-3"><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">{report.status}</span></td>
                  </tr>
                );
              })}
              {!reportsLoading && reportRows.length === 0 && <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">No reports are available yet.</td></tr>}
              {reportsLoading && reportRows.length === 0 && <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">Loading current reports...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div role={toast.type === 'error' ? 'alert' : 'status'} aria-live="polite" className={`fixed bottom-5 right-5 z-[100] flex max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${toast.type === 'success' ? 'border-emerald-500/30 bg-slate-950 text-emerald-200' : toast.type === 'error' ? 'border-rose-500/30 bg-slate-950 text-rose-200' : 'border-slate-600 bg-slate-950 text-slate-200'}`}>
        {toast.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : toast.type === 'error' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>{toast.message}</span>
        <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message" className="ml-2 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>}
    </div>
  );
}
