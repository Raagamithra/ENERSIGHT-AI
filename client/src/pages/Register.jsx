import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, Sparkles, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', organization: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await register(form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Access
            </div>
            <h2 className="text-3xl font-semibold text-white">Create account</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-lg font-bold text-slate-950">AI</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Full name</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3">
              <User className="h-4 w-4 text-slate-400" />
              <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="w-full bg-transparent text-white focus:outline-none" placeholder="Your full name" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full bg-transparent text-white focus:outline-none" type="email" placeholder="name@company.com" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Organization</label>
            <input value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-white focus:outline-none" placeholder="Company or site name" />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3">
              <Lock className="h-4 w-4 text-slate-400" />
              <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full bg-transparent text-white focus:outline-none" type={showPassword ? 'text' : 'password'} placeholder="Create password" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Confirm password</label>
            <input value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-white focus:outline-none" type="password" placeholder="Repeat password" />
          </div>

          {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating account...' : 'Register'}</button>

          <div className="text-center text-sm text-slate-400">
            Already have an account? <Link to="/login" className="font-medium text-cyan-300">Login</Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
