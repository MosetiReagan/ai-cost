import React, { useState } from 'react';
import { api, setAuthToken } from '../api';
import { ShieldCheck, Sparkles } from 'lucide-react';

interface SetupModalProps {
  onCompleted: () => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({ onCompleted }) => {
  const [email, setEmail] = useState('admin@aicost.local');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Admin');
  const [orgName, setOrgName] = useState('Engineering Team');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.setup({
        email,
        password,
        name,
        organizationName: orgName
      });
      if (res.token) {
        setAuthToken(res.token);
      }
      onCompleted();
    } catch (err: any) {
      setError(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-emerald-950/40 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center mx-auto text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
            ac
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Welcome to AI Cost</h2>
          <p className="text-xs text-slate-400">
            Self-hosted AI usage, cost, latency, and model observability platform. Let's create your administrator account.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/30 border border-rose-500/30 text-rose-300 rounded-lg text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Admin Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-950 disabled:opacity-50"
          >
            {loading ? 'Initializing AI Cost...' : 'Initialize AI Cost Platform'}
          </button>
        </form>
      </div>
    </div>
  );
};
