import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center">
        <div className="text-xs uppercase tracking-[0.32em] text-cyan-300">404</div>
        <h1 className="mt-4 text-4xl font-semibold text-white">Page not found</h1>
        <p className="mt-3 text-slate-400">This route does not exist within the EnerSight AI workspace.</p>
        <Link to="/dashboard" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-3 font-semibold text-slate-950">Return to dashboard</Link>
      </div>
    </div>
  );
}
