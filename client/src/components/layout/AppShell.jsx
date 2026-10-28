import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ title, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-200 antialiased">
      <div className="flex min-h-screen">
        <div className={`fixed inset-y-0 left-0 z-50 md:static md:block ${mobileOpen ? 'block' : 'hidden md:block'}`}>
          <Sidebar collapsed={false} onClose={() => setMobileOpen(false)} />
        </div>

        {mobileOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/70 md:hidden"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-200"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="text-sm font-semibold text-white">EnerSight AI</div>
          </div>
          <Topbar title={title} />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
