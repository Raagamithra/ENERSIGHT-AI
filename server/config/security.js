export function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production.');
    }
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured with a strong value in production.');
  }
  return 'dev-secret';
}

export function getClientOrigins() {
  return (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
