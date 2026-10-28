# EnerSight AI

EnerSight AI is an industrial energy monitoring and optimization demo for **Raaga Industries**. It demonstrates what an energy operations team can learn from simulated meter telemetry: current facility demand, historical trends, forecasts, anomalies, emissions estimates, and possible demand-response actions.

This is a software simulation. The application does not connect to physical smart meters and never controls industrial equipment.

## Architecture

```text
Simulated meter readings
        ↓
Node.js + Express + Socket.IO
        ↓
React + Vite dashboard
        ↓
FastAPI forecasting and anomaly service

Historical sample data: local CSV
Live application state: bounded Node.js memory
Database: none
```

- **React + Vite** serves the authenticated dashboard, monitoring, analytics, forecast, anomaly, insight, demand-response, carbon, report, facility, meter, and settings screens. Recharts and Framer Motion provide charts and restrained transitions.
- **Node.js + Express** provides JWT-protected APIs, role checks, the simulated meter engine, current operational state, and report/CSV generation.
- **Socket.IO** sends `energyUpdate`, `meterStatus`, `meterUpdate`, `facilityUpdate`, `anomalyDetected`, `alertCreated`, `aiUpdate`, and `demandResponseUpdate` events to authenticated clients.
- **FastAPI** exposes demand prediction at `/predict` and meter anomaly analysis at `/anomaly`. If the ML service is unavailable, Node uses its labeled local forecast fallback and the simulator uses a local anomaly fallback.
- **Historical data** is generated deterministically as four weeks of hourly facility data and stored in `server/data/historical-energy.csv`.
- **Runtime data** including readings, alerts, anomalies, registered demo users, editable facilities/meters, generated reports, and the latest ten demand-response simulations lives in memory. It resets when the Node process restarts; it is not durable persistence.

## Features

- **Live monitoring:** simulated Production, HVAC, Warehouse, Office, and meter readings with smooth time-of-day patterns, meter status, and occasional anomalies.
- **Energy analytics:** hourly, daily, weekly, and monthly trends; facility comparisons; cost estimates; and carbon estimates derived from the available readings.
- **Forecasting:** a Random Forest service predicts demand from the recent load context. Dashboard status distinguishes the FastAPI model from the Node fallback.
- **Anomaly detection:** an Isolation Forest evaluates meter-shaped telemetry; anomaly events appear in the existing monitoring and alert surfaces.
- **Demand response:** a decision-support simulation compares current load, a six-hour forecast, and a target. It selects only the flexible reduction needed where capacity allows, estimates shifted kWh by action duration, and calculates INR and CO₂ impact from the configured tariff and carbon factor. Results and their history are simulated, not guarantees.
- **Facilities and meters:** authenticated users can inspect runtime aggregates. ADMIN and ENERGY_MANAGER may create/update; only ADMIN may delete. A facility cannot be deleted while it has assigned meters.
- **Reports:** report generation and CSV export use current runtime metrics, anomalies, and the latest demand-response result. PDF export is not implemented; the PDF status control is informational only.
- **Authentication:** demo JWT login, registration, and role-aware API access. Demo users and registered accounts are in-memory and reset with the API process.

## Development Requirements

- Node.js 20 or later
- Python 3.12 recommended for the included scikit-learn service
- npm

## Install Dependencies

From the project root in PowerShell:

```powershell
Set-Location .\server
npm install
Set-Location ..\client
npm install
Set-Location ..\ml-service
python -m pip install -r requirements.txt
```

Use the Python environment selected in your editor. The ML requirements are installed into that environment.

## Configure Environment

Copy `.env.example` to `server/.env` for local backend configuration. The supported backend values are:

- `PORT`: Express and Socket.IO port, default `5000`.
- `JWT_SECRET`: signing secret. Development uses a local-only fallback when unset; production refuses to start without a secret of at least 32 characters.
- `CLIENT_ORIGIN`: comma-separated browser origins allowed by Express and Socket.IO. Defaults to `http://localhost:5173` for local development.
- `ML_SERVICE_URL`: FastAPI base URL, default `http://localhost:8000`.
- `ENERGY_TARIFF`: estimated rupees per kWh, default `8.5`.
- `CARBON_FACTOR`: estimated kg CO₂ per kWh, default `0.7`.

Optional Vite overrides belong in `client/.env.local`:

- `VITE_API_URL`, default `http://localhost:5000/api`.
- `VITE_SOCKET_URL`, default `http://localhost:5000`.

Never put private secrets in `VITE_*` variables; those values are bundled into the browser application.

## Run Locally

Start the Node API and Socket.IO simulator:

```powershell
Set-Location .\server
npm run dev
```

Start the frontend in a second terminal:

```powershell
Set-Location .\client
npm run dev
```

Start FastAPI in a third terminal:

```powershell
Set-Location .\ml-service
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

The browser app is normally available at `http://localhost:5173`, the Node health route at `http://localhost:5000/health`, and FastAPI health at `http://localhost:8000/health`.

## Development Login

The local demo account is shown on the Login page and in the development auth fixture:

- Email: `admin@enersight.ai`
- Password: `Password123!`

These are demo-only credentials. Do not reuse them in a deployed environment. Registration creates an ENERGY_MANAGER account in current server memory. The seeded demo roles are ADMIN, ENERGY_MANAGER, and VIEWER.

## Tests and Build

```powershell
Set-Location .\server
npm test
Set-Location ..\client
npm run build
```

## Important Limitations

- No database is used or required.
- CSV history is local demo data. Live meter readings, API-created records, reports, accounts, alerts, and demand-response history are held in memory and reset when Node restarts.
- Meter readings and all resulting forecasts, savings, and emissions are simulated estimates. The app does not operate physical equipment, certify an energy baseline, or guarantee savings.
- PDF report generation is not implemented. Report generation and CSV export work independently of PDF status.
- Authentication, the demo JWT fallback, and sample credentials are intended for local development; production deployment requires a strong secret, correctly restricted origins, TLS, and a separate security review.
