import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, BellRing, Building2, ChartColumnBig, Factory, Flame, Gauge, LayoutGrid, LogOut, MapPinned, Settings, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutGrid },
  { label: 'Live Monitoring', to: '/monitoring', icon: Activity },
  { label: 'Energy Analytics', to: '/analytics', icon: BarChart3 },
  { label: 'AI Forecast', to: '/forecast', icon: Gauge },
  { label: 'Anomalies', to: '/anomalies', icon: BellRing },
  { label: 'AI Insights', to: '/insights', icon: ChartColumnBig },
  { label: 'Demand Response', to: '/demand-response', icon: Flame },
  { label: 'Carbon Intelligence', to: '/carbon', icon: Factory },
  { label: 'Reports', to: '/reports', icon: MapPinned },
  { label: 'Facilities', to: '/facilities', icon: Building2 },
  { label: 'Meters', to: '/meters', icon: Wrench },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function Sidebar({ collapsed, onClose }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const userName = user?.fullName || 'Signed-in user';
  const initials = userName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
    onClose?.();
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-800 bg-slate-950/90 backdrop-blur-xl transition-all duration-300 ${collapsed ? 'w-24' : 'w-72'} md:static md:translate-x-0 ${collapsed ? 'translate-x-0' : 'translate-x-0'}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/30">AI</div>
          {!collapsed && <div><div className="text-lg font-semibold text-white">EnerSight AI</div></div>}
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${isActive ? 'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
          >
            <Icon className="h-4 w-4" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-900/80 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-sm font-bold text-slate-950">{initials}</div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{userName}</div>
              <div className="truncate text-xs text-slate-400">{user?.organization || 'Organization'}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button type="button" onClick={handleLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-cyan-500/40 hover:text-white">
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        )}
      </div>
    </aside>
  );
}
