import { energyStore } from '../store/energyStore.js';
import { getAnomalies, getCarbonSummary, getEnergySummary, getReports as getReportTemplates } from './simulator.js';
import { getDemandResponseHistory, getDemandResponseStatus } from './demandResponse.js';

const MAX_GENERATED_REPORTS = 50;

async function buildCurrentMetrics() {
  const [demandResponseStatus] = await Promise.all([getDemandResponseStatus()]);
  const energy = getEnergySummary();
  const carbon = getCarbonSummary();
  const anomalies = getAnomalies();
  const latestSimulation = getDemandResponseHistory()[0] || null;
  const demandByTick = new Map();
  for (const reading of energyStore.readings.slice(-64)) {
    const timestamp = reading.timestamp || reading.time;
    if (timestamp) demandByTick.set(timestamp, (demandByTick.get(timestamp) || 0) + (Number(reading.power) || 0));
  }
  const currentPeakDemandKW = Math.max(Number(energy.totalPower) || 0, ...demandByTick.values());

  return {
    currentDemandKW: Number(energy.totalPower) || 0,
    currentEnergyKWh: Number(energy.energyToday) || 0,
    currentPeakDemandKW,
    predictedPeakKW: Number(demandResponseStatus.predictedPeakKW) || 0,
    targetPeakKW: latestSimulation?.targetPeakKW ?? null,
    optimizedDemandKW: latestSimulation?.optimizedDemandKW ?? null,
    peakReductionKW: latestSimulation?.peakReductionKW ?? null,
    reductionPercent: latestSimulation?.reductionPercent ?? null,
    energyReductionKWh: latestSimulation?.estimatedEnergyReductionKWh ?? null,
    costEstimateINR: Number(energy.costEstimate) || 0,
    estimatedCostImpactINR: latestSimulation?.estimatedCostImpactINR ?? null,
    carbonEstimateKG: Number(carbon.today) || 0,
    estimatedCarbonReductionKG: latestSimulation?.estimatedCarbonReductionKG ?? null,
    anomalyCount: anomalies.length,
    latestAnomaly: anomalies[0] || null,
    forecastSource: demandResponseStatus.forecastSource,
    forecastStatus: demandResponseStatus.forecastStatus,
    demandResponseSimulationId: latestSimulation?.id ?? null,
  };
}

export async function generateCurrentReport() {
  const metrics = await buildCurrentMetrics();
  const report = {
    id: `report-generated-${Date.now()}`,
    type: 'Current Operations Report',
    date: new Date().toISOString(),
    facility: 'All Facilities',
    status: 'Ready',
    metrics,
  };
  energyStore.generatedReports.unshift(report);
  energyStore.generatedReports.length = Math.min(energyStore.generatedReports.length, MAX_GENERATED_REPORTS);
  return report;
}

export async function getReportRows() {
  const metrics = await buildCurrentMetrics();
  const templates = getReportTemplates().map((report) => ({ ...report, metrics: report.metrics ? { ...metrics, ...report.metrics } : metrics }));
  return [...energyStore.generatedReports, ...templates];
}

export async function getCsvReport() {
  const rows = await getReportRows();
  const columns = [
    ['Report', (row) => row.type],
    ['Date', (row) => row.date],
    ['Facility', (row) => row.facility],
    ['Status', (row) => row.status],
    ['CurrentDemandKW', (row) => row.metrics?.currentDemandKW],
    ['CurrentEnergyKWh', (row) => row.metrics?.currentEnergyKWh],
    ['CurrentPeakDemandKW', (row) => row.metrics?.currentPeakDemandKW],
    ['PredictedPeakKW', (row) => row.metrics?.predictedPeakKW],
    ['TargetPeakKW', (row) => row.metrics?.targetPeakKW],
    ['OptimizedDemandKW', (row) => row.metrics?.optimizedDemandKW],
    ['PeakReductionKW', (row) => row.metrics?.peakReductionKW],
    ['ReductionPercent', (row) => row.metrics?.reductionPercent],
    ['EnergyReductionKWh', (row) => row.metrics?.energyReductionKWh],
    ['CostEstimateINR', (row) => row.metrics?.costEstimateINR],
    ['EstimatedCostImpactINR', (row) => row.metrics?.estimatedCostImpactINR],
    ['CarbonEstimateKG', (row) => row.metrics?.carbonEstimateKG],
    ['EstimatedCarbonReductionKG', (row) => row.metrics?.estimatedCarbonReductionKG],
    ['AnomalyCount', (row) => row.metrics?.anomalyCount],
    ['LatestAnomaly', (row) => row.metrics?.latestAnomaly?.reason || row.metrics?.latestAnomaly?.facility],
    ['ForecastSource', (row) => row.metrics?.forecastSource],
    ['DemandResponseSimulationId', (row) => row.metrics?.demandResponseSimulationId],
  ];
  const escapeCsv = (value) => {
    if (value === undefined || value === null) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns.map(([header]) => escapeCsv(header)).join(','), ...rows.map((row) => columns.map(([, value]) => escapeCsv(value(row))).join(','))].join('\r\n');
}
