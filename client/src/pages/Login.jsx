import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Eye, EyeOff, Lock, Mail, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 p-10 lg:flex">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.25),transparent_25%),radial-gradient(circle_at_80%_10%,rgba(52,211,153,0.18),transparent_25%)]" />
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="relative z-10 flex h-full w-full flex-col justify-between rounded-[32px] border border-slate-800 bg-slate-900/40 p-8 backdrop-blur-sm">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/30">AI</div>
              <div>
                <div className="text-sm uppercase tracking-[0.28em] text-cyan-300">Industrial intelligence</div>
                <div className="text-2xl font-semibold text-white">ENERGYSIGHT AI</div>
              </div>
            </div>
            <div className="max-w-md">
              <p className="mb-2 text-sm uppercase tracking-[0.3em] text-cyan-200">AI-powered energy operations</p>
              <h1 className="text-5xl font-semibold leading-tight text-white">Intelligent Energy. Smarter Decisions.</h1>
            </div>
          </div>

          <div className="relative mt-8 h-72 overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-950/70 p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15),transparent_40%)]" />
            <div className="absolute left-8 top-10 h-40 w-40 rounded-full border border-cyan-400/25" />
            <div className="absolute right-12 top-16 h-32 w-32 rounded-full border border-emerald-400/25" />
            <div className="absolute left-12 top-10 flex gap-3">
              {[65, 95, 124, 112].map((value, index) => (
                <div key={value} className="flex flex-col items-center justify-end gap-2">
                  <div className="w-8 rounded-t-2xl bg-gradient-to-t from-cyan-500 to-emerald-400" style={{ height: `${value}px` }} />
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{index + 1}</div>
                </div>
              ))}
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-xs text-slate-300">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-cyan-300" /> Simulated demand profile</div>
              <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-300" /> Demo telemetry</div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center justify-center bg-slate-950 px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Secure access
            </div>
            <h2 className="text-3xl font-semibold text-white">Welcome back</h2>
            <p className="mt-2 text-slate-400">Sign in to manage your energy portfolio and optimize performance.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Email</label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3">
                <Mail className="h-4 w-4 text-slate-400" />
                <input required autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full bg-transparent text-white placeholder:text-slate-500 focus:outline-none" type="email" placeholder="name@company.com" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Password</label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3">
                <Lock className="h-4 w-4 text-slate-400" />
                <input required autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full bg-transparent text-white placeholder:text-slate-500 focus:outline-none" type={showPassword ? 'text' : 'password'} placeholder="Enter password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>

            {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Signing in...' : 'Login'}
            </button>

            <div className="text-center text-sm text-slate-400">
              Need an account?{' '}
              <Link to="/register" className="font-medium text-cyan-300">Create account</Link>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
