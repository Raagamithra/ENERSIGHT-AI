import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDirectory = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(dataDirectory, 'historical-energy.csv');
const facilities = [
  { name: 'Production', base: 505, swing: 105, voltage: 415, min: 450, max: 700 },
  { name: 'HVAC', base: 158, swing: 48, voltage: 420, min: 100, max: 250 },
  { name: 'Warehouse', base: 118, swing: 34, voltage: 416, min: 80, max: 180 },
  { name: 'Office', base: 74, swing: 24, voltage: 221, min: 40, max: 120 },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function facilityLoad(profile, timestamp, dayIndex, hour) {
  const weekdayFactor = timestamp.getUTCDay() === 0 || timestamp.getUTCDay() === 6 ? 0.72 : 1;
  const daylight = Math.max(0, Math.sin(((hour - 5) / 15) * Math.PI));
  const lunchDip = hour >= 12 && hour <= 13 ? 0.9 : 1;
  const eveningPeak = hour >= 17 && hour <= 19 ? 1.08 : 1;
  const trend = Math.sin((dayIndex / 7) * Math.PI * 2) * 0.025;
  const fluctuation = Math.sin(dayIndex * 7.13 + hour * 2.71) * 0.018;
  const activity = profile.name === 'Production'
    ? 0.55 + daylight * 0.48
    : profile.name === 'HVAC'
      ? 0.72 + daylight * 0.2
      : profile.name === 'Warehouse'
        ? 0.62 + daylight * 0.32
        : 0.58 + daylight * 0.28;
  return Math.round(clamp((profile.base + profile.swing * (activity - 0.55) + profile.base * (trend + fluctuation)) * weekdayFactor * lunchDip * eveningPeak, profile.min, profile.max));
}

function buildHistoricalReadings(now = new Date()) {
  const rows = [];
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 28);

  for (let hourIndex = 0; hourIndex < 28 * 24; hourIndex += 1) {
    const timestamp = new Date(start.getTime() + hourIndex * 60 * 60 * 1000);
    for (const profile of facilities) {
      const power = facilityLoad(profile, timestamp, Math.floor(hourIndex / 24), timestamp.getUTCHours());
      rows.push({
        timestamp: timestamp.toISOString(),
        facility: profile.name,
        meterId: `meter-${profile.name.toLowerCase()}-main`,
        power,
        voltage: profile.voltage,
        current: Number((power * 1000 / (profile.voltage * 1.732)).toFixed(1)),
        frequency: 50,
        energy: power,
      });
    }
  }
  return rows;
}

function loadHistoricalReadings() {
  try {
    const rows = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
    if (rows.length > 100) {
      return rows.slice(1).map((line) => {
        const [timestamp, facility, meterId, power, voltage, current, frequency, energy] = line.split(',');
        return { timestamp, facility, meterId, power: Number(power), voltage: Number(voltage), current: Number(current), frequency: Number(frequency), energy: Number(energy) };
      });
    }
  } catch {
    // Generate the demo dataset on first startup.
  }

  const readings = buildHistoricalReadings();
  const csv = [
    'timestamp,facility,meterId,power,voltage,current,frequency,energy',
    ...readings.map((reading) => [reading.timestamp, reading.facility, reading.meterId, reading.power, reading.voltage, reading.current, reading.frequency, reading.energy].join(',')),
  ].join('\n');
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(csvPath, `${csv}\n`, 'utf8');
  return readings;
}

export const historicalReadings = loadHistoricalReadings();
export { buildHistoricalReadings };