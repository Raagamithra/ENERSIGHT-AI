import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const socketUrl = import.meta.env.VITE_SOCKET_URL || apiBase.replace(/\/api\/?$/, '');

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [connectionState, setConnectionState] = useState('offline');
  const [energyUpdate, setEnergyUpdate] = useState(null);
  const [meterStatuses, setMeterStatuses] = useState({});
  const [facilityUpdates, setFacilityUpdates] = useState(null);
  const [meterUpdates, setMeterUpdates] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [aiUpdate, setAiUpdate] = useState(null);
  const [demandResponseResult, setDemandResponseResult] = useState(null);

  useEffect(() => {
    if (!user) {
      setConnectionState('offline');
      return undefined;
    }

    const token = localStorage.getItem('enerSightToken');
    const socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5000,
      timeout: 8000,
    });

    const onConnect = () => setConnectionState('live');
    const onDisconnect = () => setConnectionState('reconnecting');
    const onConnectError = () => setConnectionState('reconnecting');
    const onEnergyUpdate = (update) => setEnergyUpdate(update);
    const onMeterStatus = (update) => setMeterStatuses((current) => ({ ...current, [update.meterId]: update }));
    const onFacilityUpdate = (update) => setFacilityUpdates(update);
    const onMeterUpdate = (update) => setMeterUpdates(update);
    const onAnomaly = (anomaly) => setAnomalies((current) => [anomaly, ...current].slice(0, 100));
    const onAlert = (alert) => setAlerts((current) => [alert, ...current].slice(0, 100));
    const onAiUpdate = (update) => setAiUpdate(update);
    const onDemandResponseUpdate = (update) => setDemandResponseResult(update);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('energyUpdate', onEnergyUpdate);
    socket.on('meterStatus', onMeterStatus);
    socket.on('facilityUpdate', onFacilityUpdate);
    socket.on('meterUpdate', onMeterUpdate);
    socket.on('anomalyDetected', onAnomaly);
    socket.on('alertCreated', onAlert);
    socket.on('aiUpdate', onAiUpdate);
    socket.on('demandResponseUpdate', onDemandResponseUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('energyUpdate', onEnergyUpdate);
      socket.off('meterStatus', onMeterStatus);
      socket.off('facilityUpdate', onFacilityUpdate);
      socket.off('meterUpdate', onMeterUpdate);
      socket.off('anomalyDetected', onAnomaly);
      socket.off('alertCreated', onAlert);
      socket.off('aiUpdate', onAiUpdate);
      socket.off('demandResponseUpdate', onDemandResponseUpdate);
      socket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ connectionState, energyUpdate, meterStatuses, facilityUpdates, meterUpdates, anomalies, alerts, aiUpdate, demandResponseResult }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};
