import { Bell, Search, Sparkles, Zap } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export function Topbar({ title }) {
  const { connectionState, aiUpdate, alerts } = useSocket();
  const { user } = useAuth();

  const userName = user?.fullName || 'Signed-in user';

  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const connectionLabel =
    connectionState === 'live'
      ? 'LIVE'
      : connectionState === 'reconnecting'
        ? 'RECONNECTING'
        : 'OFFLINE';

  const connectionTone =
    connectionState === 'live'
      ? 'emerald'
      : connectionState === 'reconnecting'
        ? 'amber'
        : 'rose';

  const aiLabel =
    connectionState === 'offline'
      ? 'AI offline'
      : connectionState === 'reconnecting'
        ? 'AI reconnecting'
        : aiUpdate?.status === 'fallback'
          ? 'AI local fallback'
          : aiUpdate?.status === 'online'
            ? 'AI engine online'
            : 'AI status checking';

  return (
    <header className="border-b border-slate-800 bg-slate-950/70 px-4 py-4 backdrop-blur-xl sm:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

        {/* Page title */}
        <div className="min-w-0 shrink-0">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
            Operations center
          </p>

          <h1 className="mt-1 truncate text-2xl font-semibold text-white">
            {title}
          </h1>
        </div>

        {/* Controls */}
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:gap-3 xl:w-auto xl:justify-end">

          {/* Search */}
          <div className="order-first flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 xl:order-none xl:w-64 xl:flex-none">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />

            <input
              type="text"
              placeholder="Search facilities, meters, reports..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          {/* Connection status */}
          <div
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              connectionTone === 'emerald'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : connectionTone === 'amber'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
            aria-live="polite"
          >
            <div
              className={`h-2 w-2 rounded-full ${
                connectionTone === 'emerald'
                  ? 'bg-emerald-400'
                  : connectionTone === 'amber'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
              }`}
            />

            {connectionLabel}
          </div>

          {/* AI status */}
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />

            <span className="hidden sm:inline">
              {aiLabel}
            </span>
          </div>

          {/* Notifications */}
          <div
            className="relative shrink-0 rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-200"
            aria-label={`Notifications${
              alerts.length ? `, ${alerts.length} live alerts` : ''
            }`}
          >
            <Bell className="h-5 w-5" />

            {alerts.length > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-950">
                {Math.min(alerts.length, 99)}
              </span>
            )}
          </div>

          {/* User */}
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-xs font-bold text-slate-950">
              {initials}
            </div>

            <div className="hidden sm:block">
              <div className="max-w-[140px] truncate text-sm font-medium text-white">
                {userName}
              </div>

              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                {user?.role?.replaceAll('_', ' ') || 'User'}
              </div>
            </div>

            <Zap className="h-4 w-4 shrink-0 text-cyan-300" />
          </div>

        </div>
      </div>
    </header>
  );
}