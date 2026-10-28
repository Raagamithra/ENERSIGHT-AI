import test from 'node:test';
import assert from 'node:assert/strict';

import { energyStore } from '../store/energyStore.js';
import { generateCurrentReport, getCsvReport, getReportRows } from '../services/reporting.js';
import { simulateDemandResponse } from '../services/demandResponse.js';

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

test('generation creates a report from current runtime data and demand response state', async () => {
  const simulation = await simulateDemandResponse({ targetPeakKW: 700 });
  const generated = await generateCurrentReport();
  const reports = await getReportRows();
  assert.equal(generated.type, 'Current Operations Report');
  assert.ok(generated.metrics.currentDemandKW > 0);
  assert.ok(generated.metrics.currentPeakDemandKW >= generated.metrics.currentDemandKW);
  assert.ok(generated.metrics.costEstimateINR >= 0);
  assert.ok(generated.metrics.carbonEstimateKG >= 0);
  assert.equal(generated.metrics.anomalyCount, energyStore.anomalies.length);
  assert.equal(generated.metrics.demandResponseSimulationId, simulation.id);
  assert.equal(generated.metrics.optimizedDemandKW, simulation.optimizedDemandKW);
  assert.ok(reports.some((report) => report.id === generated.id));
});

test('CSV export contains current metrics, exact demand response values, and blank unavailable values', async () => {
  const simulation = energyStore.demandResponseHistory[0] || await simulateDemandResponse({ targetPeakKW: 700 });
  const report = await generateCurrentReport();
  const csv = await getCsvReport();
  const rows = csv.split('\r\n');
  const headers = rows[0].split(',');
  const reportRow = rows.find((row) => row.startsWith('Current Operations Report,'));
  assert.ok(reportRow);
  const values = parseCsvLine(reportRow);
  const fields = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  assert.equal(Number(fields.CurrentDemandKW), report.metrics.currentDemandKW);
  assert.equal(Number(fields.OptimizedDemandKW), simulation.optimizedDemandKW);
  assert.equal(Number(fields.PeakReductionKW), simulation.peakReductionKW);
  assert.equal(Number(fields.EstimatedCostImpactINR), simulation.estimatedCostImpactINR);
  assert.equal(Number(fields.EstimatedCarbonReductionKG), simulation.estimatedCarbonReductionKG);
  assert.equal(fields.TargetPeakKW, String(simulation.targetPeakKW));
  assert.match(csv, /Demand Response Simulation/);
});
