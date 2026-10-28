import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientOrigins, getJwtSecret } from '../config/security.js';

test('development secret fallback is local-only and production requires a strong configured secret', () => {
  const original = { secret: process.env.JWT_SECRET, nodeEnv: process.env.NODE_ENV };
  try {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    assert.equal(getJwtSecret(), 'dev-secret');

    process.env.NODE_ENV = 'production';
    assert.throws(() => getJwtSecret(), /JWT_SECRET must be configured/);
    process.env.JWT_SECRET = 'short';
    assert.throws(() => getJwtSecret(), /at least 32 characters/);
    process.env.JWT_SECRET = 'a-production-secret-that-is-at-least-32-characters-long';
    assert.equal(getJwtSecret(), process.env.JWT_SECRET);
  } finally {
    if (original.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original.secret;
    if (original.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.nodeEnv;
  }
});

test('CORS origin list uses explicit local default and supports configured comma-separated origins', () => {
  const original = process.env.CLIENT_ORIGIN;
  try {
    delete process.env.CLIENT_ORIGIN;
    assert.deepEqual(getClientOrigins(), ['http://localhost:5173']);
    process.env.CLIENT_ORIGIN = 'https://app.example.com, https://admin.example.com';
    assert.deepEqual(getClientOrigins(), ['https://app.example.com', 'https://admin.example.com']);
  } finally {
    if (original === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = original;
  }
});
