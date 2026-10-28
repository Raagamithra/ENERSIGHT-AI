const serviceUrl = () => (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');

async function post(path, payload) {
  const response = await fetch(`${serviceUrl()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`ML service returned ${response.status}`);
  return response.json();
}

export const requestForecast = (payload) => post('/predict', payload);

export const requestAnomalyAnalysis = (reading) => post('/anomaly', {
  power: Number(reading.power) || 0,
  voltage: Number(reading.voltage) || 0,
  current: Number(reading.current) || 0,
  rolling_average: Number(reading.rolling_average) || Number(reading.power) || 0,
  deviation: Number(reading.deviation) || 0,
});
