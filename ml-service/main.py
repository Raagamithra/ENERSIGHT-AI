from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime, timezone
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.ensemble import IsolationForest

app = FastAPI(title='EnerSight AI ML Service', version='1.0.0')

# Synthetic training data to keep the model operational without a database pipeline.
X_train = np.array([
    [8, 1, 1, 520, 560],
    [9, 2, 2, 540, 570],
    [10, 3, 3, 610, 620],
    [11, 4, 4, 660, 650],
    [12, 5, 5, 700, 710],
    [13, 6, 6, 720, 760],
    [14, 7, 0, 760, 780],
    [15, 1, 1, 680, 700],
    [16, 2, 2, 710, 740],
    [17, 3, 3, 790, 820],
    [18, 4, 4, 820, 850],
    [19, 5, 5, 760, 790],
    [20, 6, 6, 620, 660],
    [21, 7, 0, 560, 590],
], dtype=float)

y_train = np.array([540, 560, 610, 640, 690, 710, 760, 700, 720, 820, 840, 790, 660, 600], dtype=float)

forecast_model = RandomForestRegressor(n_estimators=150, random_state=42)
forecast_model.fit(X_train, y_train)

anomaly_rng = np.random.RandomState(42)
normal_power = anomaly_rng.uniform(40, 700, 600)
normal_voltage = np.where(normal_power < 120, 220, 415) + anomaly_rng.normal(0, 2, len(normal_power))
normal_current = normal_power * 1000 / (normal_voltage * 1.732) * anomaly_rng.normal(1, 0.025, len(normal_power))
normal_rolling_average = normal_power * anomaly_rng.normal(1, 0.035, len(normal_power))
normal_deviation = anomaly_rng.normal(0, 0.025, len(normal_power)) * normal_power
anomaly_features = np.column_stack((normal_power, normal_voltage, normal_current, normal_rolling_average, normal_deviation))

anomaly_model = IsolationForest(contamination=0.08, random_state=42)
anomaly_model.fit(anomaly_features)


class ForecastRequest(BaseModel):
    hour: int
    day: int
    day_of_week: int
    previous_consumption: float
    rolling_average: float
    peak_indicator: float


class AnomalyRequest(BaseModel):
    power: float
    voltage: float
    current: float
    rolling_average: float
    deviation: float


@app.get('/health')
def health():
    return {'status': 'ok', 'models': ['demand_forecast', 'isolation_forest']}


@app.post('/predict')
def predict(payload: ForecastRequest):
    features = np.array([[
        payload.hour,
        payload.day,
        payload.day_of_week,
        payload.previous_consumption,
        payload.rolling_average,
    ]], dtype=float)

    prediction = float(forecast_model.predict(features)[0])
    uncertainty = float(max(0.02, abs(prediction - payload.previous_consumption) / max(payload.previous_consumption, 1) * 0.35))

    return {
        'predicted_demand': round(prediction, 2),
        'prediction_timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'confidence': round(100 * (1 - uncertainty), 2),
        'uncertainty': round(uncertainty, 4),
        'model': 'RandomForestRegressor',
    }


@app.post('/anomaly')
def anomaly(payload: AnomalyRequest):
    vector = np.array([[payload.power, payload.voltage, payload.current, payload.rolling_average, payload.deviation]], dtype=float)
    score = float(anomaly_model.decision_function(vector)[0])
    anomaly_score = float(anomaly_model.score_samples(vector)[0])
    status = 'NORMAL'
    severity = 'LOW'

    if score < -0.1 or anomaly_score > 0.2:
        status = 'SUSPICIOUS'
        severity = 'WARNING'
    if score < -0.25 or anomaly_score > 0.35:
        status = 'CRITICAL'
        severity = 'CRITICAL'

    return {
        'anomaly_score': round(abs(score), 4),
        'status': status,
        'severity': severity,
        'model': 'IsolationForest',
    }
