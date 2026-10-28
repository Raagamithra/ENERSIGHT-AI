import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    externalId: { type: String, unique: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    organization: { type: String, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['ADMIN', 'ENERGY_MANAGER', 'VIEWER'],
      default: 'ENERGY_MANAGER',
    },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
