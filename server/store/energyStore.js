import { historicalReadings } from '../data/historicalData.js';

export const MAX_READINGS = 8000;

const facilities = [
  { id: 'fac-production', name: 'Production', location: 'Plant A', type: 'Manufacturing', status: 'ONLINE', manager: 'Raagamithra' },
  { id: 'fac-hvac', name: 'HVAC', location: 'Plant B', type: 'Utilities', status: 'ONLINE', manager: 'Ethan Brooks' },
  { id: 'fac-warehouse', name: 'Warehouse', location: 'Shipping Bay', type: 'Logistics', status: 'ONLINE', manager: 'Priya Shah' },
  { id: 'fac-office', name: 'Office', location: 'HQ', type: 'Commercial', status: 'ONLINE', manager: 'Rafael Kim' },
];

const meterProfiles = [
  { id: 'meter-001', facility: 'Production', type: 'Main Feeder', factor: 0.58, voltage: 415 },
  { id: 'meter-005', facility: 'Production', type: 'Compressors', factor: 0.42, voltage: 410 },
  { id: 'meter-002', facility: 'HVAC', type: 'Chiller', factor: 0.52, voltage: 420 },
  { id: 'meter-006', facility: 'HVAC', type: 'Air Handler', factor: 0.48, voltage: 420 },
  { id: 'meter-003', facility: 'Warehouse', type: 'Distribution', factor: 0.62, voltage: 416 },
  { id: 'meter-007', facility: 'Warehouse', type: 'Forklift Charging', factor: 0.38, voltage: 416 },
  { id: 'meter-004', facility: 'Office', type: 'Lighting', factor: 0.56, voltage: 221 },
  { id: 'meter-008', facility: 'Office', type: 'Server Room', factor: 0.44, voltage: 220 },
];

const latestByFacility = new Map();
for (const reading of historicalReadings) latestByFacility.set(reading.facility, reading);

const meters = meterProfiles.map((profile) => {
  const facilityReading = latestByFacility.get(profile.facility);
  const power = Math.round((facilityReading?.power || 0) * profile.factor);
  return {
    id: profile.id,
    facility: profile.facility,
    type: profile.type,
    status: 'ONLINE',
    installationDate: '2024-01-01',
    kW: power,
    voltage: profile.voltage,
    current: Number((power * 1000 / (profile.voltage * 1.732)).toFixed(1)),
    frequency: 50,
    energyToday: Math.round(power * 8),
    lastUpdated: facilityReading?.timestamp || new Date().toISOString(),
    factor: profile.factor,
  };
});

const readings = [];
const anomalies = [];
const alerts = [];
const recommendations = [
  { id: 'rec-1', issue: 'Peak demand approaching', reason: 'Projected load will exceed the site target by 12% over the next two hours.', action: 'Shift non-critical production and pre-cool HVAC setpoints by 1.5°C.', estimatedImpact: 'Reduce peak by 48 kW and save ₹34,030 this week', potentialSavings: 410, peakReduction: 48, co2Impact: 168 },
  { id: 'rec-2', issue: 'HVAC consumption unusually high', reason: 'Air handling units are operating above baseline during the morning ramp-up.', action: 'Inspect air filters and align initial start times to match occupancy.', estimatedImpact: 'Lower HVAC load by 22 kW and reduce energy cost by ₹14,940', potentialSavings: 180, peakReduction: 22, co2Impact: 74 },
  { id: 'rec-3', issue: 'Warehouse consumption increased', reason: 'Forklift charging activity exceeded expected daily loading by 15%.', action: 'Reschedule charging windows and stagger equipment startup during the lunch period.', estimatedImpact: 'Trim warehouse load by 19 kW and decrease emissions by 58 kg CO₂', potentialSavings: 150, peakReduction: 19, co2Impact: 58 },
];
const notifications = [];
const demandResponseHistory = [];
const generatedReports = [];

export const energyStore = {
  facilities,
  meters,
  readings,
  anomalies,
  alerts,
  recommendations,
  notifications,
  demandResponseHistory,
  generatedReports,
  historicalReadings,
  pushReading(reading) {
    this.readings.push(reading);
    if (this.readings.length > MAX_READINGS) this.readings.splice(0, this.readings.length - MAX_READINGS);
  },
  pushAnomaly(anomaly) {
    this.anomalies.unshift(anomaly);
    this.anomalies.length = Math.min(this.anomalies.length, 250);
  },
  pushAlert(alert) {
    this.alerts.unshift(alert);
    this.alerts.length = Math.min(this.alerts.length, 250);
    this.notifications.unshift(alert);
    this.notifications.length = Math.min(this.notifications.length, 250);
  },
};
