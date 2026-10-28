import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function StatCard({ title, value, unit, trend, icon: Icon, tone = 'cyan' }) {
  const trendPositive = Number(trend) >= 0;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-5 shadow-[0_0_0_1px_rgba(15,118,110,0.2)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl border p-2 ${tone === 'cyan' ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300' : tone === 'amber' ? 'border-amber-400/40 bg-amber-500/10 text-amber-300' : tone === 'emerald' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-400/40 bg-rose-500/10 text-rose-300'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-sm text-slate-300">{title}</span>
        </div>
        <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${trendPositive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
          {trendPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(trend)}%
        </div>
      </div>

      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-3xl font-semibold text-white">{value}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{unit}</div>
        </div>
      </div>

      <div className="h-14 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/60 p-2">
        <div className="flex h-full items-end gap-1">
          {[32, 24, 42, 28, 50, 49, 62, 58, 70, 64, 78, 68].map((bar, index) => (
            <div key={index} className="flex-1 rounded-t-sm bg-gradient-to-t from-cyan-500/50 to-emerald-400/80" style={{ height: `${bar}%` }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
