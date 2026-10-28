import test from 'node:test';
import assert from 'node:assert/strict';

import { getDemandResponseHistory, getDemandResponseStatus, getFlexibleLoads, simulateDemandResponse } from '../services/demandResponse.js';
import { energyStore } from '../store/energyStore.js';

test('status derives demand, facility contributions, and flexible loads from current meter data', async () => {
  const status = await getDemandResponseStatus();
  assert.ok(status.currentDemandKW > 0);
  assert.ok(status.predictedPeakKW >= status.currentDemandKW);
  assert.equal(status.facilityContributions.length, 4);
  assert.ok(status.flexibleLoads.every((load) => load.currentPowerKW > 0 && load.maxReductionKW <= load.currentPowerKW));
});

test('simulation selects only necessary available load and calculates cost/carbon from duration', async () => {
  const before = getDemandResponseHistory().length;
  const result = await simulateDemandResponse({ targetPeakKW: 700 });
  assert.ok(result.predictedPeakKW >= result.currentDemandKW);
  assert.ok(result.peakReductionKW <= result.requiredReductionKW);
  assert.ok(result.optimizedDemandKW <= result.predictedPeakKW);
  assert.ok(result.actions.every((action) => action.reductionKW <= action.currentLoadKW));
  assert.ok(result.actions.every((action) => action.issue && action.reason && action.action && action.estimatedImpact && action.priority));
  assert.ok(result.recommendations.every((recommendation) => recommendation.issue && recommendation.reason && recommendation.action && recommendation.estimatedImpact && recommendation.priority));
  assert.equal(result.estimatedCostImpactINR, Number((result.estimatedEnergyReductionKWh * result.tariffINRPerKWh).toFixed(2)));
  assert.equal(result.estimatedCarbonReductionKG, Number((result.estimatedEnergyReductionKWh * result.carbonFactorKgPerKWh).toFixed(2)));
  assert.equal(getDemandResponseHistory().length, before + 1);
});

test('no optimization is selected when forecast is already below target', async () => {
  const status = await getDemandResponseStatus();
  const result = await simulateDemandResponse({ targetPeakKW: status.predictedPeakKW + 1 });
  assert.equal(result.requiredReductionKW, 0);
  assert.equal(result.peakReductionKW, 0);
  assert.equal(result.actions.length, 0);
  assert.equal(result.estimatedCostImpactINR, 0);
});

test('invalid target peaks are rejected and history is bounded in memory', async () => {
  await assert.rejects(simulateDemandResponse({ targetPeakKW: -1 }), { status: 400 });
  await assert.rejects(simulateDemandResponse({ targetPeakKW: 'not-a-number' }), { status: 400 });
  energyStore.demandResponseHistory.length = 12;
  const result = await simulateDemandResponse({ targetPeakKW: 700 });
  assert.equal(getDemandResponseHistory().length, 10);
  assert.equal(getDemandResponseHistory()[0].id, result.id);
});

test('status clearly marks the Node forecast fallback when FastAPI is unavailable', async () => {
  const previousUrl = process.env.ML_SERVICE_URL;
  process.env.ML_SERVICE_URL = 'http://127.0.0.1:1';
  try {
    const status = await getDemandResponseStatus();
    assert.equal(status.forecastStatus, 'fallback');
    assert.equal(status.forecastSource, 'Node fallback forecast');
    assert.ok(status.predictedPeakKW >= status.currentDemandKW);
  } finally {
    if (previousUrl === undefined) delete process.env.ML_SERVICE_URL;
    else process.env.ML_SERVICE_URL = previousUrl;
  }
});
