import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHistoricalReadings, historicalReadings } from '../data/historicalData.js';
import { energyStore, MAX_READINGS } from '../store/energyStore.js';
import { getCarbonSummary, getEnergySummary, getFacilities, getForecast, getMeters, getTrends } from '../services/simulator.js';

const requiredFacilities = ['Production', 'HVAC', 'Warehouse', 'Office'];

test('local history provides four weeks of hourly readings for every facility', () => {
  assert.equal(historicalReadings.length, 28 * 24 * requiredFacilities.length);
  assert.deepEqual([...new Set(historicalReadings.map((reading) => reading.facility))].sort(), [...requiredFacilities].sort());
  assert.ok(historicalReadings.every((reading) => reading.timestamp && reading.meterId && reading.power > 0));
});

test('historical industrial loads remain within configured operating ranges', () => {
  const limits = { Production: [450, 700], HVAC: [100, 250], Warehouse: [80, 180], Office: [40, 120] };
  for (const reading of historicalReadings) {
    const [minimum, maximum] = limits[reading.facility];
    assert.ok(reading.power >= minimum && reading.power <= maximum, `${reading.facility} power ${reading.power} outside range`);
  }
});

test('in-memory services expose operational data and hourly, daily, weekly trends', () => {
  assert.equal(getFacilities().length, 4);
  assert.ok(getMeters().length >= 5);
  assert.ok(getEnergySummary().totalPower > 0);
  assert.ok(getCarbonSummary().byFacility.length === 4);
  const trends = getTrends();
  assert.ok(trends.hourly.length > 0);
  assert.ok(trends.daily.length >= 28);
  assert.ok(trends.weekly.length >= 4);
  assert.equal(energyStore.readings.length <= MAX_READINGS, true);
});

test('local fallback forecast does not claim the FastAPI model is online', () => {
  const forecast = getForecast();
  assert.equal(forecast.status, 'FALLBACK');
  assert.equal(forecast.confidence, null);
  assert.equal(forecast.model, 'Node fallback simulation');
  assert.ok(forecast.forecast.length > 0);
});

test('facility totals match current meter power and live daily trend adds kWh instead of repeated kW', () => {
  const timestamp = new Date().toISOString();
  const metersBefore = energyStore.meters.map((meter) => ({ ...meter }));
  const readingsBefore = energyStore.readings.length;
  const originalKWh = energyStore.meters[0].energyToday;
  try {
    energyStore.meters[0].kW = 123;
    energyStore.meters[0].energyToday = 456;
    energyStore.pushReading({ meterId: energyStore.meters[0].id, facility: 'Production', timestamp, time: timestamp, power: 123, energy: 0.25, total: 123 });
    const production = getFacilities().find((facility) => facility.name === 'Production');
    assert.equal(production.currentPowerKW, Number(energyStore.meters.filter((meter) => meter.facility === 'Production').reduce((sum, meter) => sum + meter.kW, 0).toFixed(1)));
    const liveDay = getTrends().daily.find((entry) => entry.day === timestamp.slice(0, 10));
    const historicalDay = historicalReadings.filter((entry) => entry.timestamp.slice(0, 10) === timestamp.slice(0, 10)).reduce((sum, entry) => sum + (entry.energy ?? entry.power), 0);
    assert.equal(liveDay.total, Math.round(historicalDay + 0.25));
  } finally {
    for (const meter of metersBefore) Object.assign(energyStore.meters.find((entry) => entry.id === meter.id), meter);
    energyStore.meters[0].energyToday = originalKWh;
    energyStore.readings.length = readingsBefore;
  }
});

test('historical builder is deterministic for a fixed clock', () => {
  const fixedTime = new Date('2026-10-01T12:00:00.000Z');
  assert.deepEqual(buildHistoricalReadings(fixedTime).slice(0, 4), buildHistoricalReadings(fixedTime).slice(0, 4));
});
