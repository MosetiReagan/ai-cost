import React, { useState, useEffect } from 'react';
import { ModelBreakdown, ProviderBreakdown } from '../types';
import { api } from '../api';
import { Cpu, Zap, DollarSign, Clock, AlertTriangle } from 'lucide-react';

interface ModelsViewProps {
  selectedProjectId: string;
}

export const ModelsView: React.FC<ModelsViewProps> = ({ selectedProjectId }) => {
  const [models, setModels] = useState<ModelBreakdown[]>([]);
  const [providers, setProviders] = useState<ProviderBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [modelRes, provRes] = await Promise.all([
          api.getSpendByModel(selectedProjectId ? { projectId: selectedProjectId } : {}),
          api.getSpendByProvider(selectedProjectId ? { projectId: selectedProjectId } : {})
        ]);
        setModels(modelRes.models);
        setProviders(provRes.providers);
      } catch (err) {
        console.error('Failed to load model data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedProjectId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Models & Providers Observability</h2>
        <p className="text-xs text-slate-400 mt-1">
          Comparative unit economics, request volumes, latency profiles, and error rates across all utilized models.
        </p>
      </div>

      {/* Model Performance Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-slate-200 text-sm">Model Comparison Table</h3>
          </div>
          <span className="text-xs text-slate-500">{models.length} models tracked</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-950/60">
              <tr>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Requests</th>
                <th className="py-3 px-4">Total Tokens</th>
                <th className="py-3 px-4">Total Cost</th>
                <th className="py-3 px-4">Avg Latency</th>
                <th className="py-3 px-4">Error Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-sans">
                    Loading comparative analytics...
                  </td>
                </tr>
              ) : models.length > 0 ? (
                models.map((m) => (
                  <tr key={m.model} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-emerald-400">{m.model}</td>
                    <td className="py-3 px-4 capitalize font-sans text-slate-300">{m.provider}</td>
                    <td className="py-3 px-4 text-slate-300">{m.requests.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-400">{m.tokens.toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-white">${m.cost.toFixed(3)}</td>
                    <td className="py-3 px-4 text-slate-300">{m.avgLatencyMs}ms</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          m.errorRate === 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : m.errorRate < 5
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {m.errorRate}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-sans">
                    No model usage data recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
