import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import { getClientOrigins, getJwtSecret } from './config/security.js';

import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import { startEnergySimulator } from './services/simulator.js';

dotenv.config();

const clientOrigins = getClientOrigins();
const jwtSecret = getJwtSecret();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

/*
 * ------------------------------------------------------------
 * CORS CONFIGURATION
 * ------------------------------------------------------------
 *
 * Supports the Vite development ports currently used by the
 * EnerSight AI frontend.
 *
 * getClientOrigins() remains the source of truth, but these
 * localhost origins are included as a safe development fallback.
 */
const allowedOrigins = [
  ...new Set([
    ...clientOrigins,
    'http://localhost:5173',
    'http://localhost:5175',
  ]),
];

const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header can be allowed.
    // This includes direct PowerShell/API requests.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },

  credentials: true,

  methods: [
    'GET',
    'HEAD',
    'PUT',
    'PATCH',
    'POST',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
  ],

  optionsSuccessStatus: 204,
};

/*
 * ------------------------------------------------------------
 * SOCKET.IO
 * ------------------------------------------------------------
 */
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'POST'],
    credentials: true,
  },
});

/*
 * Authenticate Socket.IO connections with the same JWT used
 * by the REST API.
 */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || '';

    socket.user = jwt.verify(token, jwtSecret);

    next();
  } catch {
    next(new Error('Authentication required'));
  }
});

/*
 * ------------------------------------------------------------
 * EXPRESS MIDDLEWARE
 * ------------------------------------------------------------
 */

app.use(helmet());

/*
 * CORS MUST be registered before API routes.
 */
app.use(cors(corsOptions));

/*
 * Explicitly handle browser preflight requests.
 */
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '1mb' }));

app.use(morgan('dev'));

/*
 * Rate limiting
 */
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

/*
 * ------------------------------------------------------------
 * HEALTH CHECK
 * ------------------------------------------------------------
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'EnerSight AI API is running',
    status: 'healthy',
  });
});

/*
 * ------------------------------------------------------------
 * API ROUTES
 * ------------------------------------------------------------
 */
app.use('/api/auth', authRoutes(io));
app.use('/api', apiRoutes(io));

/*
 * ------------------------------------------------------------
 * 404 HANDLER
 * ------------------------------------------------------------
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

/*
 * ------------------------------------------------------------
 * ERROR HANDLER
 * ------------------------------------------------------------
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  /*
   * CORS errors should return a normal HTTP response rather
   * than causing the server to crash.
   */
  if (err.message?.startsWith('CORS origin not allowed')) {
    return res.status(403).json({
      success: false,
      message: err.message,
      error: 'CORS origin denied',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong',
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.stack,
  });
});

/*
 * ------------------------------------------------------------
 * ENERGY SIMULATOR
 * ------------------------------------------------------------
 */
startEnergySimulator(io);

/*
 * ------------------------------------------------------------
 * START SERVER
 * ------------------------------------------------------------
 */
server.listen(PORT, () => {
  console.log(
    `EnerSight AI server running on http://localhost:${PORT}`,
  );

  console.log(
    'Allowed frontend origins:',
    allowedOrigins.join(', '),
  );
});