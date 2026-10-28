import { energyStore } from '../store/energyStore.js';
import { requestAnomalyAnalysis } from './mlEngine.js';

const facilityBands = {
  Production: { min: 450, max: 700, base: 525, amplitude: 115, voltage: 415 },
  HVAC: { min: 100, max: 250, base: 150, amplitude: 48, voltage: 420 },
  Warehouse: { min: 80, max: 180, base: 118, amplitude: 35, voltage: 416 },
  Office: { min: 40, max: 120, base: 72, amplitude: 24, voltage: 221 },
};

const round = (value, digits = 1) => Number(value.toFixed(digits));
const bounded = (value, min, max) => Math.min(max, Math.max(min, value));
const latestReadings = new Map();
const previousPower = new Map(energyStore.meters.map((meter) => [meter.id, meter.kW]));
const dayEnergy = new Map();
let energyDay = new Date().toISOString().slice(0, 10);
const baselinePower = (facility) => energyStore.historicalReadings.filter((reading) => reading.facility === facility).slice(-24).reduce((sum, reading) => sum + reading.power, 0) / 24;

function facilityTarget(facility, date) {
  const profile = facilityBands[facility] || { min: 20, max: 300, base: 100, amplitude: 45 };
  const hour = date.getHours();
  const phase = ((hour - 7) / 24) * Math.PI * 2;
  const weekday = date.getDay() === 0 || date.getDay() === 6 ? 0.84 : 1;
  let schedule = 0.72 + Math.sin(phase - Math.PI / 2) * 0.22;
  if (hour >= 12 && hour < 14) schedule *= 0.92;
  if (hour >= 17 && hour < 20) schedule *= 1.08;
  if (hour >= 22 || hour < 5) schedule *= 0.76;
  if (facility === 'Production' && hour >= 8 && hour < 18) schedule += 0.13;
  if (facility === 'Office' && (hour < 7 || hour >= 19)) schedule *= 0.72;
  return bounded(profile.base + (schedule - 0.72) * profile.amplitude * weekday, profile.min, profile.max);
}

function currentTotals() {
  const totals = Object.fromEntries(Object.keys(facilityBands).map((name) => [name, 0]));
  for (const meter of energyStore.meters) totals[meter.facility] = (totals[meter.facility] || 0) + (meter.kW || 0);
  return totals;
}

const getMeters = () => energyStore.meters.map((meter) => {
  const facility = energyStore.facilities.find((entry) => entry.name === meter.facility || entry.id === meter.facilityId);
  const currentPowerKW = Number(meter.kW ?? meter.currentPowerKW) || 0;
  const lastReadingAt = meter.lastUpdated || meter.lastReadingAt || null;
  return {
    ...meter,
    id: meter.id,
    name: meter.name || meter.type || meter.id,
    facilityId: meter.facilityId || facility?.id || '',
    facilityName: facility?.name || meter.facilityName || meter.facility || 'Unknown',
    facility: facility?.name || meter.facilityName || meter.facility || 'Unknown',
    currentPowerKW,
    kW: currentPowerKW,
    voltage: Number(meter.voltage) || 0,
    current: Number(meter.current) || 0,
    status: meter.status || 'ONLINE',
    lastReadingAt,
    lastUpdated: lastReadingAt,
  };
});

const getFacilities = () => {
  const meterRows = getMeters();
  const currentByFacility = new Map();
  const energyByFacility = new Map();
  const peakByFacility = new Map();
  const readingsByTick = new Map();

  for (const meter of meterRows) {
    currentByFacility.set(meter.facilityId, (currentByFacility.get(meter.facilityId) || 0) + meter.currentPowerKW);
    energyByFacility.set(meter.facilityId, (energyByFacility.get(meter.facilityId) || 0) + (Number(meter.energyToday) || 0));
  }
  for (const reading of energyStore.readings) {
    const meter = meterRows.find((entry) => entry.id === reading.meterId);
    if (!meter) continue;
    const tickKey = `${reading.timestamp}|${meter.facilityId}`;
    readingsByTick.set(tickKey, (readingsByTick.get(tickKey) || 0) + (Number(reading.power) || 0));
  }
  for (const [key, power] of readingsByTick) {
    const facilityId = key.slice(key.indexOf('|') + 1);
    peakByFacility.set(facilityId, Math.max(peakByFacility.get(facilityId) || 0, power));
  }

  return energyStore.facilities.map((facility) => {
    const facilityMeters = meterRows.filter((meter) => meter.facilityId === facility.id);
    const currentPowerKW = Number((currentByFacility.get(facility.id) || 0).toFixed(1));
    const energyTodayKWh = Number((energyByFacility.get(facility.id) || 0).toFixed(2));
    const statuses = facilityMeters.map((meter) => meter.status);
    const status = statuses.includes('OFFLINE') ? 'OFFLINE' : statuses.includes('CRITICAL') ? 'CRITICAL' : statuses.includes('WARNING') ? 'WARNING' : facility.status || 'ONLINE';
    return {
      ...facility,
      status,
      currentPowerKW,
      kW: currentPowerKW,
      energyTodayKWh,
      energyToday: energyTodayKWh,
      peakPowerKW: Number((peakByFacility.get(facility.id) || currentPowerKW).toFixed(1)),
      meterCount: facilityMeters.length,
    };
  });
};

const getDashboardSnapshot = () => {
  const facilityTotals = currentTotals();
  const totalPower = Object.values(facilityTotals).reduce((sum, value) => sum + value, 0);
  const energyToday = energyStore.meters.reduce((sum, meter) => sum + (meter.energyToday || 0), 0);
  return {
    overview: {
      currentPower: Math.round(totalPower),
      energyToday: Math.round(energyToday || energyStore.meters.reduce((sum, meter) => sum + meter.energyToday, 0)),
      peakDemand: Math.max(...energyStore.readings.slice(-24).map((reading) => reading.total || reading.power), totalPower),
      cost: Math.round((energyToday || totalPower * 8) * Number(process.env.ENERGY_TARIFF || 8.5)),
      co2: Math.round(totalPower * Number(process.env.CARBON_FACTOR || 0.7)),
      activeAlerts: energyStore.alerts.length,
    },
    readings: energyStore.readings.length
      ? energyStore.readings.slice(-48)
      : energyStore.historicalReadings.slice(-48).map((reading) => ({ ...reading, time: reading.timestamp, total: reading.power })),
    facilities: energyStore.facilities,
    meters: energyStore.meters,
    alerts: energyStore.alerts,
    recommendations: energyStore.recommendations,
    anomalies: energyStore.anomalies,
  };
};

const getEnergySummary = () => {
  const snapshot = getDashboardSnapshot();
  const totals = currentTotals();
  return {
    totalPower: snapshot.overview.currentPower,
    energyToday: snapshot.overview.energyToday,
    peakDemand: Math.round(snapshot.overview.peakDemand),
    costEstimate: snapshot.overview.cost,
    emissions: snapshot.overview.co2,
    activeAlerts: snapshot.overview.activeAlerts,
    metrics: Object.entries(totals).map(([label, value]) => ({ label: label === 'Production' ? 'Production' : label, value: Math.round(value), trend: 0 })),
  };
};

const aggregateByHour = (readings) => {
  const samplesByHour = new Map();
  for (const reading of readings) {
    const date = new Date(reading.timestamp || reading.time);
    if (Number.isNaN(date.getTime())) continue;
    date.setMinutes(0, 0, 0);
    const hourKey = date.toISOString();
    const sampleKey = reading.timestamp || reading.time;
    const samples = samplesByHour.get(hourKey) || new Map();
    samples.set(sampleKey, (samples.get(sampleKey) || 0) + (reading.power ?? reading.total ?? 0));
    samplesByHour.set(hourKey, samples);
  }
  return [...samplesByHour.entries()].map(([timestamp, samples]) => {
    const total = [...samples.values()].reduce((sum, value) => sum + value, 0) / samples.size;
    return { timestamp, time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), total: Math.round(total), load: Math.round(total) };
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};

const getTrends = () => {
  const hourly = aggregateByHour([...energyStore.historicalReadings, ...energyStore.readings]).slice(-48);
  const byDay = new Map();
  for (const reading of energyStore.historicalReadings) {
    const day = reading.timestamp.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + (Number(reading.energy ?? reading.power) || 0));
  }
  for (const reading of energyStore.readings.slice(-MAX_RECENT_READINGS)) {
    const day = (reading.timestamp || reading.time).slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + (reading.energy ?? 0));
  }
  const daily = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-28).map(([day, total]) => ({ day, total: Math.round(total) }));
  const weekly = [];
  for (let index = 0; index < daily.length; index += 7) {
    const group = daily.slice(index, index + 7);
    if (group.length) weekly.push({ day: `Week ${weekly.length + 1}`, total: group.reduce((sum, item) => sum + item.total, 0) });
  }
  const byMonth = new Map();
  for (const item of daily) {
    const month = item.day.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) || 0) + item.total);
  }
  const monthly = [...byMonth.entries()].map(([month, total]) => ({ month, total: Math.round(total) }));
  return { hourly, daily, weekly, monthly };
};

const MAX_RECENT_READINGS = 8000;

const getForecast = () => {
  const hourly = getTrends().hourly;
  const values = hourly.map((entry) => entry.total);
  const last = values.slice(-12);
  const average = last.reduce((sum, value) => sum + value, 0) / Math.max(last.length, 1);
  const forecast = Array.from({ length: 6 }, (_, index) => Math.round(average * (1 + 0.02 * Math.sin((new Date().getHours() + index) / 24 * Math.PI * 2))));
  const peakIndex = forecast.indexOf(Math.max(...forecast));
  const peakDate = new Date();
  peakDate.setHours(peakDate.getHours() + peakIndex, 0, 0, 0);
  return {
    historical: values.slice(-24),
    forecast,
    predictedPeak: Math.round(Math.max(average, ...last, ...forecast)),
    peakTime: peakDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    confidence: null,
    status: 'FALLBACK',
    model: 'Node fallback simulation',
    lastUpdated: new Date().toISOString(),
  };
};

const getAnomalies = () => energyStore.anomalies;
const getRecommendations = () => energyStore.recommendations;

const getCarbonSummary = () => {
  const factor = Number(process.env.CARBON_FACTOR || 0.7);
  const energyByFacility = new Map();
  for (const meter of energyStore.meters) {
    const facility = energyStore.facilities.find((entry) => entry.name === meter.facility || entry.id === meter.facilityId);
    const facilityName = facility?.name || meter.facilityName || meter.facility || 'Unknown';
    energyByFacility.set(facilityName, (energyByFacility.get(facilityName) || 0) + (Number(meter.energyToday) || 0));
  }
  const byFacility = [...energyByFacility.entries()].map(([name, energy]) => ({ name, value: Math.round(energy * factor) }));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const historicalMonthEnergy = energyStore.historicalReadings
    .filter((reading) => reading.timestamp.slice(0, 7) === currentMonth && reading.timestamp.slice(0, 10) !== today)
    .reduce((sum, reading) => sum + (Number(reading.energy ?? reading.power) || 0), 0);
  const historicalTotalEnergy = energyStore.historicalReadings
    .filter((reading) => reading.timestamp.slice(0, 10) !== today)
    .reduce((sum, reading) => sum + (Number(reading.energy ?? reading.power) || 0), 0);
  const liveEnergyToday = energyStore.meters.reduce((sum, meter) => sum + (Number(meter.energyToday) || 0), 0);
  return {
    today: byFacility.reduce((sum, item) => sum + item.value, 0),
    month: Math.round((historicalMonthEnergy + liveEnergyToday) * factor),
    total: Math.round((historicalTotalEnergy + liveEnergyToday) * factor),
    carbonFactorKgPerKWh: factor,
    trend: 0,
    opportunity: 0,
    byFacility,
  };
};

const getReports = () => {
  const reports = [
    { id: 'report-daily', type: 'Daily Energy Report', date: new Date().toISOString().slice(0, 10), facility: 'All Facilities', status: 'Ready' },
    { id: 'report-weekly', type: 'Weekly Energy Report', date: 'Last 7 days', facility: 'All Facilities', status: 'Ready' },
    { id: 'report-peak', type: 'Peak Demand Report', date: new Date().toISOString().slice(0, 10), facility: 'Production', status: 'Ready' },
    { id: 'report-anomaly', type: 'Anomaly Report', date: new Date().toISOString().slice(0, 10), facility: 'All Facilities', status: 'Ready' },
    { id: 'report-carbon', type: 'Carbon Report', date: new Date().toISOString().slice(0, 10), facility: 'All Facilities', status: 'Ready' },
  ];
  const latestSimulation = energyStore.demandResponseHistory[0];
  if (latestSimulation) reports.unshift({
    id: `report-${latestSimulation.id}`,
    type: 'Demand Response Simulation',
    date: latestSimulation.timestamp,
    facility: 'All Facilities',
    status: 'Simulated',
    metrics: {
      currentDemandKW: latestSimulation.currentDemandKW,
      predictedPeakKW: latestSimulation.predictedPeakKW,
      optimizedPeakKW: latestSimulation.optimizedDemandKW,
      peakReductionKW: latestSimulation.peakReductionKW,
      estimatedEnergyReductionKWh: latestSimulation.estimatedEnergyReductionKWh,
      estimatedCostImpactINR: latestSimulation.estimatedCostImpactINR,
      estimatedCarbonReductionKG: latestSimulation.estimatedCarbonReductionKG,
    },
  });
  return reports;
};

const simulateDemandResponse = (payload = {}) => {
  const currentPeak = Number(payload.currentPeak) || getEnergySummary().peakDemand;
  const goalReduction = Number(payload.goalReduction) || 12;
  const optimizedPeak = Math.max(520, currentPeak * (1 - goalReduction / 100));
  return {
    currentPeak,
    optimizedPeak: Number(optimizedPeak.toFixed(1)),
    peakReduction: Number((currentPeak - optimizedPeak).toFixed(1)),
    estimatedCostImpact: Number(((currentPeak - optimizedPeak) * Number(process.env.ENERGY_TARIFF || 8.5)).toFixed(2)),
    simulationLabel: 'SIMULATION MODE',
    loads: [
      { name: 'HVAC', current: 92, optimized: 70 },
      { name: 'Pumps', current: 88, optimized: 74 },
      { name: 'Compressors', current: 110, optimized: 82 },
      { name: 'Lighting', current: 40, optimized: 30 },
      { name: 'Non-critical production', current: 68, optimized: 42 },
    ],
  };
};

function createMeterReading(meter, now, eventIndex) {
  const profile = facilityBands[meter.facility] || { min: 20, max: 300, base: 100, amplitude: 45, voltage: Number(meter.voltage) || 400 };
  const factor = Number(meter.factor) || 0.1;
  const target = facilityBands[meter.facility] ? facilityTarget(meter.facility, now) * factor : Math.max(0, Number(meter.kW) || facilityTarget(meter.facility, now));
  const prior = previousPower.get(meter.id) ?? target;
  const meterSeed = [...String(meter.id)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const microDrift = Math.sin(eventIndex * 0.51 + meterSeed) * profile.amplitude * factor * 0.012;
  let power = prior + (target + microDrift - prior) * 0.26;
  const isAnomaly = Math.random() < 0.008;
  let anomalyKind = null;
  if (isAnomaly) {
    anomalyKind = meter.facility === 'HVAC' ? 'HVAC spike' : meter.facility === 'Production' ? 'Production surge' : 'Meter irregularity';
    power += meter.facility === 'HVAC' ? 42 : meter.facility === 'Production' ? 58 : 34;
  }
  power = round(bounded(power, Math.max(0, profile.min * meter.factor * 0.8), profile.max * meter.factor + (isAnomaly ? 60 : 0)));
  previousPower.set(meter.id, power);
  const voltage = round(profile.voltage + Math.sin(eventIndex / 3 + meter.factor) * 2, 1);
  const current = round((power * 1000) / (voltage * 1.732));
  const energy = round((power * 4) / 3600, 4);
  return { meterId: meter.id, facility: meter.facility, timestamp: now.toISOString(), power, voltage, current, frequency: round(50 + Math.sin(eventIndex / 5) * 0.04, 2), energy, anomalyKind };
}

let simulatorTimer;
let tick = 0;
const startEnergySimulator = (io) => {
  if (simulatorTimer) clearInterval(simulatorTimer);
  io.on('connection', (socket) => {
    socket.emit('aiUpdate', { status: 'checking', engine: 'Forecast service', timestamp: new Date().toISOString() });
    socket.emit('energyUpdate', { readings: [...latestReadings.values()], summary: getEnergySummary(), timestamp: new Date().toISOString() });
    socket.emit('facilityUpdate', getFacilities());
    for (const meter of getMeters()) socket.emit('meterUpdate', meter);
  });

  simulatorTimer = setInterval(async () => {
    tick += 1;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (today !== energyDay) {
      energyDay = today;
      dayEnergy.clear();
      for (const meter of energyStore.meters) meter.energyToday = 0;
    }
    const emitted = [];
    for (const meter of energyStore.meters) {
      const reading = createMeterReading(meter, now, tick);
      meter.kW = reading.power;
      meter.voltage = reading.voltage;
      meter.current = reading.current;
      meter.frequency = reading.frequency;
      meter.lastUpdated = reading.timestamp;
      meter.status = reading.frequency < 49.92 || reading.frequency > 50.08 ? 'WARNING' : 'ONLINE';
      const energyKey = `${today}:${meter.id}`;
      meter.energyToday = round((dayEnergy.get(energyKey) || meter.energyToday || 0) + reading.energy, 2);
      dayEnergy.set(energyKey, meter.energyToday);
      const stored = { ...reading, time: reading.timestamp, total: reading.power };
      energyStore.pushReading(stored);
      latestReadings.set(meter.id, reading);
      emitted.push(reading);
      io.emit('meterStatus', { meterId: meter.id, facility: meter.facility, status: meter.status, timestamp: now.toISOString() });
      io.emit('meterUpdate', getMeters().find((entry) => entry.id === meter.id));
      if (reading.anomalyKind) {
        const expectedPower = round(reading.power - (reading.anomalyKind === 'HVAC spike' ? 42 : reading.anomalyKind === 'Production surge' ? 58 : 34));
        let analysis = null;
        try {
          analysis = await requestAnomalyAnalysis({ ...reading, rolling_average: baselinePower(meter.facility), deviation: reading.power - expectedPower });
        } catch {
          analysis = { status: 'SUSPICIOUS', severity: 'WARNING', model: 'local-fallback' };
        }
        const anomaly = {
          id: `anom-${Date.now()}-${meter.id}`,
          meterId: meter.id,
          facility: meter.facility,
          time: reading.timestamp,
          observedPower: reading.power,
          expectedPower,
          deviation: round(reading.power - expectedPower),
          severity: analysis.severity || 'WARNING',
          status: analysis.status || 'SUSPICIOUS',
          reason: reading.anomalyKind,
          recommendedAction: 'Review the meter trend and inspect the associated equipment.',
          model: analysis.model,
        };
        energyStore.pushAnomaly(anomaly);
        io.emit('anomalyDetected', anomaly);
        const alert = { id: `alert-${Date.now()}-${meter.id}`, title: `${reading.anomalyKind} detected`, type: anomaly.severity.toLowerCase(), message: `${meter.facility} meter ${meter.id} reported ${reading.power} kW.`, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        energyStore.pushAlert(alert);
        io.emit('alertCreated', alert);
      }
    }
    const totals = currentTotals();
    const summary = getEnergySummary();
    const facilities = getFacilities();
    const update = { timestamp: now.toISOString(), readings: emitted, facilities: totals, total: summary.totalPower, summary };
    io.emit('energyUpdate', update);
    io.emit('facilityUpdate', facilities);
  }, 4000);

  return io;
};

export {
  getFacilities,
  getMeters,
  getDashboardSnapshot,
  getEnergySummary,
  getTrends,
  getForecast,
  getAnomalies,
  getRecommendations,
  getCarbonSummary,
  getReports,
  simulateDemandResponse,
  startEnergySimulator,
};
