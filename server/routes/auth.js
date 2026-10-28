import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { protect } from '../middleware/auth.js';
import { getJwtSecret } from '../config/security.js';

const router = express.Router();
const demoUsers = [
  {
    id: 'admin-user',
    fullName: 'Raagamithra',
    email: 'admin@enersight.ai',
    organization: 'Raaga Industries',
    password: '$2a$10$KrAB0ezBRGSGUWQ3uyqnnu5Z9wwk7sde0PibYRJyS15fM38IyR6vq',
    role: 'ADMIN',
  },
  {
    id: 'manager-user',
    fullName: 'Ethan Brooks',
    email: 'manager@enersight.ai',
    organization: 'Raaga Industries',
    password: '$2a$10$KrAB0ezBRGSGUWQ3uyqnnu5Z9wwk7sde0PibYRJyS15fM38IyR6vq',
    role: 'ENERGY_MANAGER',
  },
  {
    id: 'viewer-user',
    fullName: 'Priya Shah',
    email: 'viewer@enersight.ai',
    organization: 'Raaga Industries',
    password: '$2a$10$KrAB0ezBRGSGUWQ3uyqnnu5Z9wwk7sde0PibYRJyS15fM38IyR6vq',
    role: 'VIEWER',
  },
];

const issueToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, organization: user.organization },
    getJwtSecret(),
    { expiresIn: '7d' },
  );

export default function authRoutes(io) {
  router.post('/register', async (req, res) => {
    const { fullName, email, organization, password, confirmPassword } = req.body || {};

    if (!fullName || !email || !organization || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.', error: 'Missing fields' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.', error: 'Password mismatch' });
    }

    const existing = demoUsers.find((user) => user.email.toLowerCase() === String(email).toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.', error: 'Duplicate user' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: `user-${Date.now()}`,
      fullName,
      email,
      organization,
      password: hashedPassword,
      role: 'ENERGY_MANAGER',
    };

    demoUsers.push(newUser);

    const token = issueToken(newUser);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        organization: newUser.organization,
        role: newUser.role,
      },
    });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.', error: 'Missing credentials' });
    }

    const user = demoUsers.find((entry) => entry.email.toLowerCase() === String(email).toLowerCase());
    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found for this email.', error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Incorrect password.', error: 'Invalid password' });
    }

    const token = issueToken(user);
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        organization: user.organization,
        role: user.role,
      },
    });
  });

  router.get('/me', protect, (req, res) => {
    const user = demoUsers.find((entry) => entry.email === req.user.email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.', error: 'No user' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        organization: user.organization,
        role: user.role,
      },
    });
  });

  return router;
}
