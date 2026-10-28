import { energyStore } from '../store/energyStore.js';
import { getEnergySummary, getForecast } from './simulator.js';
import { requestForecast } from './mlEngine.js';

const MAX_HISTORY = 10;
const round = (value, digits = 1) => Number(value.toFixed(digits));

function getFacilityContributions() {
  const totals = new Map();
  for (const meter of energyStore.meters) {
    totals.set(meter.facility, (totals.get(meter.facility) || 0) + Math.max(0, Number(meter.kW) || 0));
  }
  const sitePower = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()].map(([facility, currentPowerKW]) => ({
    facility,
    currentPowerKW: round(currentPowerKW),
    sharePercent: sitePower > 0 ? round((currentPowerKW / sitePower) * 100, 1) : 0,
  }));
}

export function getFlexibleLoads() {
  const facilityTotals = new Map(getFacilityContributions().map((item) => [item.facility, item.currentPowerKW]));
  const lightingMeter = energyStore.meters.find((meter) => /lighting/i.test(meter.type));
  const candidates = [
    {
      id: 'hvac-setpoint', name: 'HVAC load shift', facility: 'HVAC',
      currentPowerKW: facilityTotals.get('HVAC') || 0, flexibleFraction: 0.28, capacityKW: 65,
      shiftable: true, priority: 'Medium', priorityRank: 2, estimatedDurationMinutes: 30,
      reason: 'HVAC demand can be trimmed temporarily while maintaining operating limits.',
    },
    {
      id: 'warehouse-operations', name: 'Warehouse operations', facility: 'Warehouse',
      currentPowerKW: (facilityTotals.get('Warehouse') || 0) * 0.55, flexibleFraction: 0.25, capacityKW: 35,
      shiftable: true, priority: 'Low', priorityRank: 1, estimatedDurationMinutes: 45,
      reason: 'Non-critical warehouse activity can be shifted outside the predicted peak window.',
    },
    {
      id: 'office-lighting', name: 'Office lighting', facility: 'Office',
      currentPowerKW: lightingMeter ? Math.max(0, Number(lightingMeter.kW) || 0) : 0, flexibleFraction: 0.2, capacityKW: 18,
      shiftable: true, priority: 'Low', priorityRank: 1, estimatedDurationMinutes: 45,
      reason: 'A limited lighting reduction is available where operationally acceptable.',
    },
    {
      id: 'production-shift', name: 'Non-critical production shift', facility: 'Production',
      currentPowerKW: (facilityTotals.get('Production') || 0) * 0.18, flexibleFraction: 0.55, capacityKW: 55,
      shiftable: true, priority: 'High', priorityRank: 3, estimatedDurationMinutes: 60,
      reason: 'Only non-critical production activity is shiftable; critical production load is excluded.',
    },
  ];

  return candidates
    .map(({ flexibleFraction, capacityKW, priorityRank, ...load }) => {
      const maxReductionKW = round(Math.min(load.currentPowerKW * flexibleFraction, capacityKW));
      return {
        ...load,
        flexiblePowerKW: maxReductionKW,
        maxReductionKW,
        shiftable: load.shiftable && maxReductionKW > 0,
        status: maxReductionKW > 0 ? 'Available' : 'No flexible capacity',
        priorityRank,
      };
    })
    .filter((load) => load.currentPowerKW > 0);
}

async function getForecastContext(currentDemandKW) {
  const fallback = getForecast();
  const historical = fallback.historical || [];
  const lastValues = historical.slice(-6);
  const rollingAverage = lastValues.reduce((sum, value) => sum + value, 0) / Math.max(lastValues.length, 1);
  const now = new Date();
  try {
    const predictions = await Promise.all(Array.from({ length: 6 }, (_, hourOffset) => requestForecast({
      hour: (now.getHours() + hourOffset) % 24,
      day: now.getDate(),
      day_of_week: now.getDay(),
      previous_consumption: currentDemandKW,
      rolling_average: rollingAverage || currentDemandKW,
      peak_indicator: currentDemandKW > rollingAverage ? 1 : 0,
    }).then((prediction) => ({ ...prediction, hourOffset }))));
    const peakPrediction = predictions.reduce((peak, prediction) => Number(prediction.predicted_demand) > Number(peak.predicted_demand) ? prediction : peak);
    const predictedPeakKW = Math.max(currentDemandKW, Number(peakPrediction.predicted_demand) || currentDemandKW);
    const peakDate = new Date(now.getTime() + peakPrediction.hourOffset * 60 * 60 * 1000);
    peakDate.setMinutes(0, 0, 0);
    return {
      predictedPeakKW: round(predictedPeakKW),
      peakTime: Number(peakPrediction.predicted_demand) <= currentDemandKW
        ? 'Now'
        : peakDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      forecastConfidence: round(predictions.reduce((sum, prediction) => sum + (Number(prediction.confidence) || 0), 0) / predictions.length, 1) || fallback.confidence || null,
      forecastSource: peakPrediction.model || 'FastAPI demand forecast',
      forecastStatus: 'online',
      forecastHorizon: predictions.map((prediction) => ({ hourOffset: prediction.hourOffset, demandKW: round(Number(prediction.predicted_demand) || currentDemandKW) })),
    };
  } catch {
    const predictedPeakKW = Math.max(currentDemandKW, Number(fallback.predictedPeak) || currentDemandKW);
    return {
      predictedPeakKW: round(predictedPeakKW),
      peakTime: fallback.peakTime || 'Unavailable',
      forecastConfidence: Number(fallback.confidence) || null,
      forecastSource: 'Node fallback forecast',
      forecastStatus: 'fallback',
      forecastHorizon: (fallback.forecast || []).map((demandKW, hourOffset) => ({ hourOffset, demandKW: round(Number(demandKW) || currentDemandKW) })),
    };
  }
}

export async function getDemandResponseStatus() {
  const currentDemandKW = Math.max(0, Number(getEnergySummary().totalPower) || 0);
  const forecast = await getForecastContext(currentDemandKW);
  const targetPeakKW = Math.max(1, Math.round(currentDemandKW * 0.9));
  const flexibleLoads = getFlexibleLoads();
  return {
    timestamp: new Date().toISOString(),
    currentDemandKW: round(currentDemandKW),
    currentEnergyKWh: Math.round(getEnergySummary().energyToday || 0),
    peakStatus: forecast.predictedPeakKW > targetPeakKW ? 'AT_RISK' : 'WITHIN_TARGET',
    targetPeakKW,
    tariffINRPerKWh: Number(process.env.ENERGY_TARIFF || 8.5),
    carbonFactorKgPerKWh: Number(process.env.CARBON_FACTOR || 0.7),
    ...forecast,
    facilityContributions: getFacilityContributions(),
    flexibleLoads,
    totalFlexibleCapacityKW: round(flexibleLoads.reduce((sum, load) => sum + load.maxReductionKW, 0)),
  };
}

export async function simulateDemandResponse({ targetPeakKW } = {}) {
  const target = Number(targetPeakKW);
  if (!Number.isFinite(target) || target <= 0 || target > 100000) {
    const error = new Error('Target peak must be a positive number no greater than 100,000 kW.');
    error.status = 400;
    throw error;
  }

  const currentDemandKW = Math.max(0, Number(getEnergySummary().totalPower) || 0);
  if (!Number.isFinite(currentDemandKW)) {
    const error = new Error('Current demand is unavailable.');
    error.status = 503;
    throw error;
  }

  const forecast = await getForecastContext(currentDemandKW);
  const predictedPeakKW = Math.max(0, forecast.predictedPeakKW);
  const requiredReductionKW = Math.max(0, predictedPeakKW - target);
  const flexibleLoads = getFlexibleLoads().filter((load) => load.shiftable && load.maxReductionKW > 0);
  flexibleLoads.sort((a, b) => Number(b.shiftable) - Number(a.shiftable) || a.priorityRank - b.priorityRank || b.maxReductionKW - a.maxReductionKW || a.currentPowerKW - b.currentPowerKW);

  let remainingReductionKW = requiredReductionKW;
  const actions = [];
  const tariffINRPerKWh = Number(process.env.ENERGY_TARIFF || 8.5);
  const carbonFactorKgPerKWh = Number(process.env.CARBON_FACTOR || 0.7);
  for (const load of flexibleLoads) {
    if (remainingReductionKW <= 0) break;
    const reductionKW = round(Math.min(remainingReductionKW, load.maxReductionKW, load.currentPowerKW));
    if (reductionKW <= 0) continue;
    remainingReductionKW = Math.max(0, round(remainingReductionKW - reductionKW));
    const afterPowerKW = round(Math.max(0, load.currentPowerKW - reductionKW));
    const energyReductionKWh = round(reductionKW * load.estimatedDurationMinutes / 60, 2);
    const estimatedCostImpactINR = round(energyReductionKWh * tariffINRPerKWh, 2);
    const estimatedCarbonReductionKG = round(energyReductionKWh * carbonFactorKgPerKWh, 2);
    const actionText = `Shift or reduce ${load.name.toLowerCase()} by ${reductionKW} kW for ${load.estimatedDurationMinutes} minutes.`;
    actions.push({
      id: load.id,
      issue: `Predicted peak exceeds target by ${round(requiredReductionKW)} kW`,
      load: load.name,
      facility: load.facility,
      currentLoadKW: load.currentPowerKW,
      reductionKW,
      afterLoadKW: afterPowerKW,
      durationMinutes: load.estimatedDurationMinutes,
      reason: `${load.reason} Selected to address the ${round(requiredReductionKW)} kW forecast-to-target gap.`,
      action: actionText,
      estimatedImpact: `${energyReductionKWh} kWh shifted; ${formatINRValue(estimatedCostImpactINR)} estimated cost impact; ${estimatedCarbonReductionKG} kg CO₂ estimated reduction.`,
      estimatedEnergyReductionKWh: energyReductionKWh,
      estimatedCostImpactINR,
      estimatedCarbonReductionKG,
      priority: load.priority,
      shiftable: load.shiftable,
      status: 'SIMULATED',
    });
  }

  const peakReductionKW = round(actions.reduce((sum, action) => sum + action.reductionKW, 0));
  const optimizedDemandKW = round(Math.max(0, predictedPeakKW - peakReductionKW));
  const estimatedEnergyReductionKWh = round(actions.reduce((sum, action) => sum + action.reductionKW * action.durationMinutes / 60, 0), 2);
  const estimatedCostImpactINR = round(estimatedEnergyReductionKWh * tariffINRPerKWh, 2);
  const estimatedCarbonReductionKG = round(estimatedEnergyReductionKWh * carbonFactorKgPerKWh, 2);
  const reductionPercent = predictedPeakKW > 0 ? round((peakReductionKW / predictedPeakKW) * 100, 2) : 0;
  const result = {
    id: `dr-${Date.now()}`,
    timestamp: new Date().toISOString(),
    mode: 'SIMULATION',
    physicalControl: false,
    currentDemandKW: round(currentDemandKW),
    predictedPeakKW,
    targetPeakKW: round(target),
    optimizedDemandKW,
    peakReductionKW,
    reductionPercent,
    requiredReductionKW: round(requiredReductionKW),
    remainingReductionKW: round(remainingReductionKW),
    targetReached: remainingReductionKW === 0,
    estimatedEnergyReductionKWh,
    estimatedCostImpactINR,
    estimatedCarbonReductionKG,
    tariffINRPerKWh,
    carbonFactorKgPerKWh,
    forecastConfidence: forecast.forecastConfidence,
    forecastSource: forecast.forecastSource,
    forecastStatus: forecast.forecastStatus,
    peakTime: forecast.peakTime,
    facilityContributions: getFacilityContributions(),
    actions,
    recommendations: actions.map(({ issue, reason, action, estimatedImpact, priority, facility, load }) => ({ issue, reason, action, estimatedImpact, priority, facility, load })),
  };
  energyStore.demandResponseHistory.unshift(result);
  energyStore.demandResponseHistory.length = Math.min(energyStore.demandResponseHistory.length, MAX_HISTORY);
  return result;
}

export const getDemandResponseHistory = () => energyStore.demandResponseHistory;

const formatINRValue = (value) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
