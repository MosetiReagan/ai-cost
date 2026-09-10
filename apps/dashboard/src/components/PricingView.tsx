import React, { useState, useEffect } from 'react';
import { ModelPricing } from '../types';
import { api } from '../api';
import { Plus, Shield } from 'lucide-react';

export const PricingView: React.FC = () => {
  const [officialPricing, setOfficialPricing] = useState<ModelPricing[]>([]);
  const [customPricing, setCustomPricing] = useState<ModelPricing[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inputRate, setInputRate] = useState('');
  const [outputRate, setOutputRate] = useState('');
  const [cachedRate, setCachedRate] = useState('');

  const fetchPricing = async () => {
    try {
      const res = await api.getPricing();
      setOfficialPricing(res.official);
      setCustomPricing(res.custom);
    } catch (err) {
      console.error('Failed to load pricing catalog:', err);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim() || !inputRate || !outputRate) return;

    try {
      await api.addCustomPricing({
        provider,
        model: model.trim(),
        displayName: displayName.trim() || model.trim(),
        inputCostPerMillion: parseFloat(inputRate),
        outputCostPerMillion: parseFloat(outputRate),
        cachedInputCostPerMillion: cachedRate ? parseFloat(cachedRate) : undefined,
        isCustom: true
      });
      setShowModal(false);
      setModel('');
      setDisplayName('');
      setInputRate('');
      setOutputRate('');
      setCachedRate('');
      await fetchPricing();
    } catch (err) {
      alert('Failed to save custom pricing: ' + (err as Error).message);
    }
  };

  const handleDeleteCustom = async (p: string, m: string) => {
    if (!confirm(`Delete custom pricing override for ${p}/${m}?`)) return;
    try {
      await api.deleteCustomPricing(p, m);
      await fetchPricing();
    } catch (err) {
      alert('Failed to delete custom pricing: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Model Pricing Registry</h2>
          <p className="text-xs text-slate-400 mt-1">
            Centralized pricing catalog per 1,000,000 tokens for accurate cost estimations.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Custom Rate
        </button>
      </div>

      {/* Custom Model Pricing Overrides (if any) */}
      {customPricing.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-slate-200 text-sm">Custom Pricing Overrides</h3>
            <span className="text-xs text-emerald-400 font-mono">{customPricing.length} custom rates</span>
          </div>

          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-950/60 font-sans">
              <tr>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Input / 1M</th>
                <th className="py-2.5 px-3">Output / 1M</th>
                <th className="py-2.5 px-3">Cached / 1M</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {customPricing.map((cp) => (
                <tr key={`${cp.provider}-${cp.model}`} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-emerald-400">{cp.model}</td>
                  <td className="py-2.5 px-3 capitalize font-sans text-slate-300">{cp.provider}</td>
                  <td className="py-2.5 px-3 text-white">${cp.inputCostPerMillion.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-white">${cp.outputCostPerMillion.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {cp.cachedInputCostPerMillion ? `$${cp.cachedInputCostPerMillion.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    <button
                      onClick={() => handleDeleteCustom(cp.provider, cp.model)}
                      className="text-rose-400 hover:text-rose-300 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Official Provider Catalog */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-slate-200 text-sm">Official Model Rates (per 1,000,000 Tokens)</h3>
          </div>
          <span className="text-xs text-slate-500">{officialPricing.length} models</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-950/60">
              <tr>
                <th className="py-3 px-4">Display Name</th>
                <th className="py-3 px-4">Model ID</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Input / 1M</th>
                <th className="py-3 px-4">Output / 1M</th>
                <th className="py-3 px-4">Prompt Cache / 1M</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-mono">
              {officialPricing.map((p) => (
                <tr key={`${p.provider}-${p.model}`} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-sans font-medium text-slate-200">{p.displayName}</td>
                  <td className="py-3 px-4 text-emerald-400">{p.model}</td>
                  <td className="py-3 px-4 capitalize font-sans text-slate-400">{p.provider}</td>
                  <td className="py-3 px-4 font-bold text-white">${p.inputCostPerMillion.toFixed(2)}</td>
                  <td className="py-3 px-4 font-bold text-white">${p.outputCostPerMillion.toFixed(2)}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {p.cachedInputCostPerMillion !== undefined
                      ? `$${p.cachedInputCostPerMillion.toFixed(3)}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Custom Rate Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Add Custom Model Pricing</h3>
            <form onSubmit={handleAddCustom} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="custom">Custom Provider</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Model Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. fine-tuned-llama3"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Fine-Tuned Llama 3"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Input / 1M ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1.50"
                    value={inputRate}
                    onChange={(e) => setInputRate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Output / 1M ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="5.00"
                    value={outputRate}
                    onChange={(e) => setOutputRate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
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
                  Save Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
