import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getDashboardSnapshot, getMeters, getFacilities, getEnergySummary, getTrends, getForecast, getAnomalies, getRecommendations, getCarbonSummary } from '../services/simulator.js';
import { requestForecast } from '../services/mlEngine.js';
import { energyStore } from '../store/energyStore.js';
import { getDemandResponseHistory, getDemandResponseStatus, simulateDemandResponse } from '../services/demandResponse.js';
import { generateCurrentReport, getCsvReport, getReportRows } from '../services/reporting.js';

const router = express.Router();

export default function apiRoutes(io) {
  router.use(protect);

  router.get('/facilities/:id', (req, res) => {
    const facility = getFacilities().find((entry) => entry.id === req.params.id);
    if (!facility) return res.status(404).json({ success: false, message: 'Facility not found', error: 'Not found' });
    res.json({ success: true, data: facility });
  });

  router.get('/facilities', (req, res) => {
    res.json({ success: true, data: getFacilities() });
  });

  router.post('/facilities', authorize('ADMIN', 'ENERGY_MANAGER'), (req, res) => {
    const { name, location = '', type = 'Industrial', status = 'ONLINE', manager = '' } = req.body || {};
    if (!String(name || '').trim()) return res.status(400).json({ success: false, message: 'Facility name is required.', error: 'Missing name' });
    const facility = { id: `fac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: String(name).trim(), location: String(location), type: String(type), status: String(status).toUpperCase(), manager: String(manager) };
    energyStore.facilities.push(facility);
    const result = getFacilities().find((entry) => entry.id === facility.id);
    io.emit('facilityUpdate', result);
    io.emit('facilityUpdated', result);
    res.status(201).json({ success: true, data: result });
  });

  router.put('/facilities/:id', authorize('ADMIN', 'ENERGY_MANAGER'), (req, res) => {
    const facilities = energyStore.facilities;
    const index = facilities.findIndex((f) => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Facility not found', error: 'Not found' });
    const oldName = facilities[index].name;
    const { id, currentPowerKW, energyTodayKWh, peakPowerKW, meterCount, ...changes } = req.body || {};
    const updatedName = changes.name === undefined ? facilities[index].name : String(changes.name).trim();
    if (!updatedName) return res.status(400).json({ success: false, message: 'Facility name cannot be empty.', error: 'Missing name' });
    facilities[index] = { ...facilities[index], ...changes, name: changes.name === undefined ? facilities[index].name : String(changes.name).trim() };
    for (const meter of energyStore.meters) {
      if (meter.facilityId === req.params.id || (!meter.facilityId && meter.facility === oldName)) {
        meter.facilityId = req.params.id;
        meter.facility = facilities[index].name;
        meter.facilityName = facilities[index].name;
      }
    }
    const result = getFacilities().find((entry) => entry.id === req.params.id);
    io.emit('facilityUpdate', result);
    io.emit('facilityUpdated', result);
    res.json({ success: true, data: result });
  });

  router.delete('/facilities/:id', authorize('ADMIN'), (req, res) => {
    const facilities = energyStore.facilities;
    const index = facilities.findIndex((f) => f.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Facility not found', error: 'Not found' });
    }
    if (energyStore.meters.some((meter) => meter.facilityId === req.params.id || meter.facility === facilities[index].name)) {
      return res.status(409).json({ success: false, message: 'Cannot delete a facility while meters are assigned to it.', error: 'Facility has meters' });
    }
    const [deleted] = facilities.splice(index, 1);
    io.emit('facilityUpdate', { id: deleted.id, deleted: true });
    io.emit('facilityUpdated', { id: deleted.id, deleted: true });
    res.json({ success: true, message: 'Facility deleted successfully' });
  });

  router.get('/meters/:id', (req, res) => {
    const meter = getMeters().find((entry) => entry.id === req.params.id);
    if (!meter) return res.status(404).json({ success: false, message: 'Meter not found', error: 'Not found' });
    res.json({ success: true, data: meter });
  });

  router.get('/meters', (req, res) => {
    res.json({ success: true, data: getMeters() });
  });

  router.post('/meters', authorize('ADMIN', 'ENERGY_MANAGER'), (req, res) => {
    const { name, type, facilityId, facility, facilityName, status = 'ONLINE', currentPowerKW, kW, voltage = 0, current = 0, frequency = 50, energyToday = 0, installationDate = new Date().toISOString().slice(0, 10) } = req.body || {};
    const facilityRecord = energyStore.facilities.find((entry) => entry.id === facilityId || entry.name === facilityName || entry.name === facility);
    if (!facilityRecord) return res.status(400).json({ success: false, message: 'Select an existing facility for this meter.', error: 'Invalid facility' });
    if (!String(name || type || '').trim()) return res.status(400).json({ success: false, message: 'Meter name is required.', error: 'Missing name' });
    const power = Math.max(0, Number(currentPowerKW ?? kW) || 0);
    const meter = { id: `meter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: String(name || type).trim(), type: String(type || name).trim(), facilityId: facilityRecord.id, facility: facilityRecord.name, facilityName: facilityRecord.name, status: String(status).toUpperCase(), kW: power, voltage: Number(voltage) || 0, current: Number(current) || 0, frequency: Number(frequency) || 50, energyToday: Math.max(0, Number(energyToday) || 0), installationDate: String(installationDate), lastUpdated: new Date().toISOString(), factor: 0.1 };
    energyStore.meters.push(meter);
    const result = getMeters().find((entry) => entry.id === meter.id);
    io.emit('meterUpdate', result);
    io.emit('meterStatus', { meterId: result.id, facility: result.facilityName, status: result.status, timestamp: result.lastReadingAt });
    io.emit('facilityUpdate', getFacilities().find((entry) => entry.id === facilityRecord.id));
    res.status(201).json({ success: true, data: result });
  });

  router.put('/meters/:id', authorize('ADMIN', 'ENERGY_MANAGER'), (req, res) => {
    const meters = energyStore.meters;
    const index = meters.findIndex((m) => m.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Meter not found', error: 'Not found' });
    const changes = req.body || {};
    const updatedName = changes.name === undefined ? meters[index].name : String(changes.name).trim();
    if (!updatedName) return res.status(400).json({ success: false, message: 'Meter name cannot be empty.', error: 'Missing name' });
    const facilityId = changes.facilityId || changes.facility;
    if (facilityId) {
      const facilityRecord = energyStore.facilities.find((entry) => entry.id === facilityId || entry.name === facilityId);
      if (!facilityRecord) return res.status(400).json({ success: false, message: 'Select an existing facility for this meter.', error: 'Invalid facility' });
      meters[index].facilityId = facilityRecord.id;
      meters[index].facility = facilityRecord.name;
      meters[index].facilityName = facilityRecord.name;
    }
    if (changes.name !== undefined) meters[index].name = String(changes.name).trim();
    if (changes.type !== undefined) meters[index].type = String(changes.type).trim();
    if (changes.status !== undefined) meters[index].status = String(changes.status).toUpperCase();
    if (changes.currentPowerKW !== undefined || changes.kW !== undefined) meters[index].kW = Math.max(0, Number(changes.currentPowerKW ?? changes.kW) || 0);
    for (const field of ['voltage', 'current', 'frequency', 'energyToday']) {
      if (changes[field] !== undefined) meters[index][field] = Math.max(0, Number(changes[field]) || 0);
    }
    const result = getMeters().find((entry) => entry.id === req.params.id);
    io.emit('meterUpdate', result);
    io.emit('facilityUpdate', getFacilities().find((entry) => entry.id === result.facilityId));
    res.json({ success: true, data: result });
  });

  router.delete('/meters/:id', authorize('ADMIN'), (req, res) => {
    const meters = energyStore.meters;
    const index = meters.findIndex((m) => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Meter not found', error: 'Not found' });
    }
    const [deleted] = meters.splice(index, 1);
    io.emit('meterUpdate', { id: deleted.id, meterId: deleted.id, deleted: true });
    io.emit('facilityUpdate', getFacilities().find((entry) => entry.id === deleted.facilityId || entry.name === deleted.facility));
    res.json({ success: true, message: 'Meter deleted successfully' });
  });

  router.get('/energy/readings', (req, res) => {
    res.json({ success: true, data: getDashboardSnapshot().readings });
  });

  router.get('/energy/summary', (req, res) => {
    res.json({ success: true, data: getEnergySummary() });
  });

  router.get('/runtime-config', (req, res) => {
    res.json({
      success: true,
      data: {
        tariffINRPerKWh: Number(process.env.ENERGY_TARIFF || 8.5),
        carbonFactorKgPerKWh: Number(process.env.CARBON_FACTOR || 0.7),
      },
    });
  });

  router.get('/energy/trends', (req, res) => {
    res.json({ success: true, data: getTrends() });
  });

  router.get('/ai/forecast', async (req, res) => {
    const fallback = getForecast();
    const lastPower = fallback.historical.at(-1) || fallback.predictedPeak;
    const recentValues = fallback.historical.slice(-6);
    const rollingAverage = recentValues.reduce((sum, value) => sum + value, 0) / Math.max(recentValues.length, 1);
    const now = new Date();
    try {
      const predictions = await Promise.all(Array.from({ length: 6 }, (_, hourOffset) => requestForecast({
        hour: (now.getHours() + hourOffset) % 24,
        day: now.getDate(),
        day_of_week: now.getDay(),
        previous_consumption: lastPower,
        rolling_average: rollingAverage || lastPower,
        peak_indicator: lastPower > rollingAverage ? 1 : 0,
      }).then((prediction) => ({ ...prediction, hourOffset }))));
      const forecast = predictions.map((prediction) => Number(prediction.predicted_demand) || lastPower);
      const peakIndex = forecast.indexOf(Math.max(...forecast));
      const peakTime = new Date(now.getTime() + peakIndex * 60 * 60 * 1000);
      peakTime.setMinutes(0, 0, 0);
      const predictedPeak = Math.max(lastPower, ...forecast);
      const data = {
        ...fallback,
        forecast,
        predictedPeak,
        peakTime: forecast[peakIndex] <= lastPower ? 'Now' : peakTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: Math.round(predictions.reduce((sum, prediction) => sum + (Number(prediction.confidence) || 0), 0) / predictions.length),
        model: predictions[peakIndex]?.model || 'RandomForestRegressor',
        status: 'AI MODEL ONLINE',
        forecastStatus: 'online',
        forecastHorizon: predictions.map(({ hourOffset, predicted_demand: demandKW }) => ({ hourOffset, demandKW })),
      };
      io.emit('aiUpdate', { status: 'online', engine: data.model, prediction: data.predictedPeak, timestamp: now.toISOString() });
      res.json({ success: true, data });
    } catch {
      io.emit('aiUpdate', { status: 'fallback', engine: 'local forecast', timestamp: new Date().toISOString() });
      res.json({ success: true, data: { ...fallback, status: 'NODE FALLBACK', forecastStatus: 'fallback' } });
    }
  });

  router.get('/ai/anomalies', (req, res) => {
    res.json({ success: true, data: getAnomalies() });
  });

  router.get('/ai/recommendations', (req, res) => {
    res.json({ success: true, data: getRecommendations() });
  });

  router.get('/demand-response/status', async (req, res, next) => {
    try {
      res.json({ success: true, data: await getDemandResponseStatus() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/demand-response/history', (req, res) => {
    res.json({ success: true, data: getDemandResponseHistory() });
  });

  router.post('/demand-response/simulate', authorize('ADMIN', 'ENERGY_MANAGER'), async (req, res, next) => {
    try {
      const result = await simulateDemandResponse(req.body || {});
      io.emit('demandResponseUpdate', result);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ success: false, message: error.message, error: error.message });
      next(error);
    }
  });

  router.get('/carbon/summary', (req, res) => {
    res.json({ success: true, data: getCarbonSummary() });
  });

  router.get('/reports/export.csv', authorize('ADMIN', 'ENERGY_MANAGER'), async (req, res, next) => {
    try {
      const csv = await getCsvReport();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="enersight-report.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  router.get('/reports', authorize('ADMIN', 'ENERGY_MANAGER'), async (req, res, next) => {
    try {
      res.json({ success: true, data: await getReportRows() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reports/generate', authorize('ADMIN', 'ENERGY_MANAGER'), async (req, res, next) => {
    try {
      res.status(201).json({ success: true, data: await generateCurrentReport() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
