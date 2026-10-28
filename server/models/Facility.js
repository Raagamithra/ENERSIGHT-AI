import mongoose from 'mongoose';

const facilitySchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    type: { type: String, required: true },
    status: {
      type: String,
      enum: ['ONLINE', 'WARNING', 'OFFLINE', 'CRITICAL'],
      default: 'ONLINE',
    },
    manager: { type: String, required: true },
    organization: { type: String, default: 'Raaga Industries' },
  },
  { timestamps: true },
);

const Facility = mongoose.models.Facility || mongoose.model('Facility', facilitySchema);

export default Facility;
