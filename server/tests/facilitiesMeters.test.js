import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import apiRoutes from '../routes/api.js';

const secret = 'dev-secret';
const tokenFor = (role) => jwt.sign({ id: `${role.toLowerCase()}-test`, email: `${role.toLowerCase()}@test.local`, role, organization: 'Test Org' }, secret, { expiresIn: '5m' });

async function createApi() {
  const emitted = [];
  const io = { emit: (event, payload) => emitted.push({ event, payload }) };
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes(io));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, role, method = 'GET', body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${tokenFor(role)}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const contentType = response.headers.get('content-type') || '';
    return { status: response.status, data: contentType.includes('application/json') ? await response.json() : await response.text() };
  };
  return { request, emitted, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

test('facilities and meters expose runtime data, CRUD, authorization, and socket changes', async (context) => {
  const api = await createApi();
  context.after(api.close);

  const facilitiesResponse = await api.request('/facilities', 'VIEWER');
  const metersResponse = await api.request('/meters', 'VIEWER');
  assert.equal(facilitiesResponse.status, 200);
  assert.equal(metersResponse.status, 200);
  assert.deepEqual(facilitiesResponse.data.data.map((facility) => facility.name).sort(), ['HVAC', 'Office', 'Production', 'Warehouse']);
  assert.ok(facilitiesResponse.data.data.every((facility) => Number.isFinite(facility.currentPowerKW) && Number.isFinite(facility.energyTodayKWh) && Number.isFinite(facility.peakPowerKW) && Number.isInteger(facility.meterCount)));
  assert.ok(metersResponse.data.data.every((meter) => meter.facilityId && meter.facilityName && Number.isFinite(meter.currentPowerKW) && meter.lastReadingAt));

  const createdFacility = await api.request('/facilities', 'ENERGY_MANAGER', 'POST', { name: 'Integration Plant', location: 'Test Yard', type: 'Test', manager: 'QA' });
  assert.equal(createdFacility.status, 201);
  const facilityId = createdFacility.data.data.id;
  assert.equal((await api.request(`/facilities/${facilityId}`, 'VIEWER')).status, 200);
  const updatedFacility = await api.request(`/facilities/${facilityId}`, 'ADMIN', 'PUT', { location: 'North Yard' });
  assert.equal(updatedFacility.data.data.location, 'North Yard');
  assert.ok(api.emitted.some((entry) => entry.event === 'facilityUpdate' && entry.payload.id === facilityId));
  assert.equal((await api.request(`/facilities/${facilityId}`, 'VIEWER', 'DELETE')).status, 403);

  const createdMeter = await api.request('/meters', 'ENERGY_MANAGER', 'POST', { name: 'QA Feeder', type: 'Submeter', facilityId, currentPowerKW: 12.5, voltage: 400 });
  assert.equal(createdMeter.status, 201);
  const meterId = createdMeter.data.data.id;
  assert.equal(createdMeter.data.data.facilityName, 'Integration Plant');
  assert.equal((await api.request(`/meters/${meterId}`, 'VIEWER')).data.data.currentPowerKW, 12.5);
  const updatedMeter = await api.request(`/meters/${meterId}`, 'ENERGY_MANAGER', 'PUT', { name: 'QA Main Feeder', currentPowerKW: 18.2 });
  assert.equal(updatedMeter.data.data.currentPowerKW, 18.2);
  assert.ok(api.emitted.some((entry) => entry.event === 'meterUpdate' && entry.payload.id === meterId));
  assert.equal((await api.request(`/meters/${meterId}`, 'ENERGY_MANAGER', 'DELETE')).status, 403);
  assert.equal((await api.request('/facilities', 'VIEWER', 'POST', { name: 'Denied Plant' })).status, 403);

  assert.equal((await api.request(`/meters/${meterId}`, 'ADMIN', 'DELETE')).status, 200);
  assert.equal((await api.request(`/facilities/${facilityId}`, 'ADMIN', 'DELETE')).status, 200);
  assert.equal((await api.request(`/facilities/${facilityId}`, 'VIEWER')).status, 404);
  assert.ok(api.emitted.some((entry) => entry.event === 'facilityUpdate' && entry.payload.deleted && entry.payload.id === facilityId));
  assert.ok(api.emitted.some((entry) => entry.event === 'meterUpdate' && entry.payload.deleted && entry.payload.id === meterId));
});
