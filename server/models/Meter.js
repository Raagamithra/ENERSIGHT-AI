import mongoose from 'mongoose';

const meterSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true },
    facility: { type: String, required: true },
    type: { type: String, required: true },
    status: {
      type: String,
      enum: ['ONLINE', 'WARNING', 'OFFLINE', 'CRITICAL'],
      default: 'ONLINE',
    },
    installationDate: { type: String, required: true },
    kW: { type: Number, default: 0 },
    voltage: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },
    energyToday: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const Meter = mongoose.models.Meter || mongoose.model('Meter', meterSchema);

export default Meter;
