import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import Facility from '../models/Facility.js';
import Meter from '../models/Meter.js';
import User from '../models/User.js';
import EnergyReading from '../models/EnergyReading.js';

dotenv.config();

export const buildSeedData = () => ({
  organization: {
    name: 'Raaga Industries',
    industry: 'Industrial Manufacturing',
    location: 'Houston, TX',
  },
  facilities: [
    { id: 'fac-production', name: 'Production', location: 'Plant A', type: 'Manufacturing', status: 'ONLINE', manager: 'Raagamithra' },
    { id: 'fac-hvac', name: 'HVAC', location: 'Plant B', type: 'Utilities', status: 'ONLINE', manager: 'Ethan Brooks' },
    { id: 'fac-warehouse', name: 'Warehouse', location: 'Shipping Bay', type: 'Logistics', status: 'WARNING', manager: 'Priya Shah' },
    { id: 'fac-office', name: 'Office', location: 'HQ', type: 'Commercial', status: 'ONLINE', manager: 'Rafael Kim' },
  ],
  meters: [
    { id: 'meter-001', facility: 'Production', type: 'Main Feeder', status: 'ONLINE', installationDate: '2023-05-12', kW: 612, voltage: 418, current: 1025, frequency: 60, energyToday: 4180 },
    { id: 'meter-002', facility: 'HVAC', type: 'Chiller', status: 'ONLINE', installationDate: '2022-11-04', kW: 148, voltage: 420, current: 260, frequency: 60, energyToday: 1860 },
    { id: 'meter-003', facility: 'Warehouse', type: 'Distribution', status: 'WARNING', installationDate: '2024-01-16', kW: 134, voltage: 416, current: 228, frequency: 60, energyToday: 1730 },
    { id: 'meter-004', facility: 'Office', type: 'Lighting', status: 'ONLINE', installationDate: '2023-08-21', kW: 78, voltage: 221, current: 122, frequency: 60, energyToday: 970 },
    { id: 'meter-005', facility: 'Production', type: 'Compressors', status: 'CRITICAL', installationDate: '2022-09-02', kW: 690, voltage: 408, current: 1080, frequency: 59.8, energyToday: 4850 },
    { id: 'meter-006', facility: 'HVAC', type: 'Air Handler', status: 'ONLINE', installationDate: '2023-02-17', kW: 164, voltage: 421, current: 286, frequency: 60, energyToday: 2100 },
    { id: 'meter-007', facility: 'Warehouse', type: 'Forklift Charging', status: 'OFFLINE', installationDate: '2024-06-05', kW: 0, voltage: 0, current: 0, frequency: 0, energyToday: 0 },
    { id: 'meter-008', facility: 'Office', type: 'Server Room', status: 'ONLINE', installationDate: '2024-03-08', kW: 92, voltage: 220, current: 150, frequency: 60, energyToday: 1040 },
  ],
  users: [
    {
      id: 'admin-user',
      fullName: 'Raagamithra',
      email: 'admin@enersight.ai',
      organization: 'Raaga Industries',
      password: '$2a$10$Rc3b7CA0G8Hh/eMYuE3EkeoLSrO8uywomGLqZapH.vSTiCzTDFKi2',
      role: 'ADMIN',
    },
    {
      id: 'manager-user',
      fullName: 'Ethan Brooks',
      email: 'manager@enersight.ai',
      organization: 'Raaga Industries',
      password: '$2a$10$Rc3b7CA0G8Hh/eMYuE3EkeoLSrO8uywomGLqZapH.vSTiCzTDFKi2',
      role: 'ENERGY_MANAGER',
    },
    {
      id: 'viewer-user',
      fullName: 'Priya Shah',
      email: 'viewer@enersight.ai',
      organization: 'Raaga Industries',
      password: '$2a$10$Rc3b7CA0G8Hh/eMYuE3EkeoLSrO8uywomGLqZapH.vSTiCzTDFKi2',
      role: 'VIEWER',
    },
  ],
});

export async function seedDatabase() {
  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const seed = buildSeedData();

  await Promise.all([
    Facility.deleteMany({}),
    Meter.deleteMany({}),
    User.deleteMany({}),
    EnergyReading.deleteMany({}),
  ]);

  await Facility.insertMany(
    seed.facilities.map((facility) => ({
      externalId: facility.id,
      name: facility.name,
      location: facility.location,
      type: facility.type,
      status: facility.status,
      manager: facility.manager,
      organization: seed.organization.name,
    })),
  );

  await Meter.insertMany(
    seed.meters.map((meter) => ({
      externalId: meter.id,
      facility: meter.facility,
      type: meter.type,
      status: meter.status,
      installationDate: meter.installationDate,
      kW: meter.kW,
      voltage: meter.voltage,
      current: meter.current,
      frequency: meter.frequency,
      energyToday: meter.energyToday,
    })),
  );

  await User.insertMany(
    seed.users.map((user) => ({
      externalId: user.id,
      fullName: user.fullName,
      email: user.email,
      organization: user.organization,
      password: user.password,
      role: user.role,
    })),
  );

  await EnergyReading.insertMany([
    { facility: 'Production', meterId: 'meter-005', total: 640, production: 500, hvac: 140, warehouse: 110, office: 70 },
    { facility: 'HVAC', meterId: 'meter-002', total: 180, production: 120, hvac: 180, warehouse: 90, office: 40 },
    { facility: 'Warehouse', meterId: 'meter-003', total: 146, production: 110, hvac: 50, warehouse: 146, office: 30 },
    { facility: 'Office', meterId: 'meter-004', total: 82, production: 65, hvac: 20, warehouse: 15, office: 82 },
  ]);

  return seed;
}

if (process.argv[1]?.endsWith('seed/index.js')) {
  seedDatabase()
    .then((seed) => {
      console.log('Seed data prepared for EnerSight AI');
      console.log(JSON.stringify(seed, null, 2));
      mongoose.disconnect();
    })
    .catch((error) => {
      console.error('Seed failed:', error.message);
      process.exitCode = 1;
    });
}

