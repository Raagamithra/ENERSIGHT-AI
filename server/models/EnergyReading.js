import mongoose from 'mongoose';

const energyReadingSchema = new mongoose.Schema(
  {
    facility: { type: String, required: true },
    meterId: { type: String, default: 'N/A' },
    timestamp: { type: Date, default: Date.now },
    total: { type: Number, default: 0 },
    production: { type: Number, default: 0 },
    hvac: { type: Number, default: 0 },
    warehouse: { type: Number, default: 0 },
    office: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const EnergyReading = mongoose.models.EnergyReading || mongoose.model('EnergyReading', energyReadingSchema);

export default EnergyReading;
