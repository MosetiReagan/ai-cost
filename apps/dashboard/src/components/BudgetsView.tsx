import React, { useState, useEffect } from 'react';
import { Budget, SpendAlert, Project } from '../types';
import { api } from '../api';
import { PieChart, AlertCircle, CheckCircle, Bell, Plus, ShieldCheck } from 'lucide-react';

interface BudgetsViewProps {
  projects: Project[];
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({ projects }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [alerts, setAlerts] = useState<SpendAlert[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [threshold, setThreshold] = useState('80');

  const fetchData = async () => {
    try {
      const [bRes, aRes] = await Promise.all([api.getBudgets(), api.getAlerts()]);
      setBudgets(bRes.budgets);
      setAlerts(aRes.alerts);
    } catch (err) {
      console.error('Failed to load budgets & alerts:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !monthlyLimit) return;
    try {
      await api.setBudget({
        projectId: selectedProjectId,
        monthlyBudgetUsd: parseFloat(monthlyLimit),
        alertThresholdPercent: parseInt(threshold, 10)
      });
      setShowModal(false);
      setMonthlyLimit('');
      await fetchData();
    } catch (err) {
      alert('Failed to set budget: ' + (err as Error).message);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.resolveAlert(alertId);
      await fetchData();
    } catch (err) {
      alert('Failed to resolve alert: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Budgets & Spend Alerts</h2>
          <p className="text-xs text-slate-400 mt-1">
            Establish project budget caps, configure multi-threshold alarms, and monitor real-time spend spikes.
          </p>
        </div>
        <button
          onClick={() => {
            if (projects.length > 0) setSelectedProjectId(projects[0].id);
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition-all"
        >
          <Plus className="w-4 h-4" /> Set Budget
        </button>
      </div>

      {/* Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {budgets.map((b) => {
          const percent = b.monthlyBudgetUsd > 0 ? (b.currentSpendUsd / b.monthlyBudgetUsd) * 100 : 0;
          const isExceeded = percent >= 100;
          const isWarning = percent >= b.alertThresholdPercent;

          return (
            <div key={b.id} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-sm">{b.projectName || 'Project'}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                    isExceeded
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : isWarning
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {b.status}
                </span>
              </div>

              <div>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Current Spend</span>
                  <span className="font-mono text-white font-bold">
                    ${b.currentSpendUsd.toFixed(2)} / ${b.monthlyBudgetUsd.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>{percent.toFixed(1)}% used</span>
                  <span>Alert threshold: {b.alertThresholdPercent}%</span>
                </div>
              </div>
            </div>
          );
        })}

        {budgets.length === 0 && (
          <div className="col-span-full p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
            No monthly budgets configured. Create one to guard against unexpected usage spikes.
          </div>
        )}
      </div>

      {/* Alerts Log */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-slate-200 text-base">Triggered Spend Alerts</h3>
        </div>

        <div className="space-y-3">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`p-3.5 rounded-lg border flex items-center justify-between text-xs ${
                a.severity === 'critical'
                  ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                  : a.severity === 'warning'
                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  : 'bg-slate-800/40 border-slate-700 text-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{a.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(a.triggeredAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-400 text-xs">{a.message}</p>
              </div>

              {!a.resolvedAt ? (
                <button
                  onClick={() => handleResolveAlert(a.id)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] border border-slate-700"
                >
                  Resolve
                </button>
              ) : (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> Resolved
                </span>
              )}
            </div>
          ))}

          {alerts.length === 0 && (
            <p className="text-slate-500 text-xs py-4 text-center">No alerts triggered. System operating normally.</p>
          )}
        </div>
      </div>

      {/* Set Budget Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Configure Project Budget</h3>
            <form onSubmit={handleSaveBudget} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Monthly Budget ($ USD)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g. 500"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Alert Threshold (%)</label>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="50">50% of budget</option>
                  <option value="75">75% of budget</option>
                  <option value="80">80% of budget</option>
                  <option value="90">90% of budget</option>
                  <option value="100">100% (Budget Exceeded)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
