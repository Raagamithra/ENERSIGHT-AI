import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Monitoring } from './pages/Monitoring';
import { Analytics } from './pages/Analytics';
import { Forecast } from './pages/Forecast';
import { Anomalies } from './pages/Anomalies';
import { Insights } from './pages/Insights';
import { DemandResponse } from './pages/DemandResponse';
import { Carbon } from './pages/Carbon';
import { Reports } from './pages/Reports';
import { Facilities } from './pages/Facilities';
import { Meters } from './pages/Meters';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-cyan-300">Loading EnerSight AI…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={<ProtectedRoute><AppShell title="Dashboard"><Dashboard /></AppShell></ProtectedRoute>} />
      <Route path="/monitoring" element={<ProtectedRoute><AppShell title="Live Monitoring"><Monitoring /></AppShell></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppShell title="Energy Analytics"><Analytics /></AppShell></ProtectedRoute>} />
      <Route path="/forecast" element={<ProtectedRoute><AppShell title="AI Demand Forecast"><Forecast /></AppShell></ProtectedRoute>} />
      <Route path="/anomalies" element={<ProtectedRoute><AppShell title="Anomaly Detection"><Anomalies /></AppShell></ProtectedRoute>} />
      <Route path="/insights" element={<ProtectedRoute><AppShell title="AI Insights"><Insights /></AppShell></ProtectedRoute>} />
      <Route path="/demand-response" element={<ProtectedRoute><AppShell title="Demand Response"><DemandResponse /></AppShell></ProtectedRoute>} />
      <Route path="/carbon" element={<ProtectedRoute><AppShell title="Carbon Intelligence"><Carbon /></AppShell></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><AppShell title="Reports"><Reports /></AppShell></ProtectedRoute>} />
      <Route path="/facilities" element={<ProtectedRoute><AppShell title="Facility Management"><Facilities /></AppShell></ProtectedRoute>} />
      <Route path="/meters" element={<ProtectedRoute><AppShell title="Meter Management"><Meters /></AppShell></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppShell title="Settings"><Settings /></AppShell></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRouter />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
