import React, { useState, useEffect } from 'react';
import { AIRequestItem } from '../types';
import { api } from '../api';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  Shield,
  Clock,
  Zap,
  DollarSign
} from 'lucide-react';

interface RequestsViewProps {
  selectedProjectId: string;
}

export const RequestsView: React.FC<RequestsViewProps> = ({ selectedProjectId }) => {
  const [requests, setRequests] = useState<AIRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Slide-over drawer state
  const [selectedRequest, setSelectedRequest] = useState<AIRequestItem | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.getRequests({
        projectId: selectedProjectId || undefined,
        search: search || undefined,
        provider: providerFilter || undefined,
        status: (statusFilter as any) || undefined,
        page,
        limit: 25
      });
      setRequests(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalRequests(res.pagination.total);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page, selectedProjectId, providerFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRequests();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search request ID, model, error..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => {
              setProviderFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Providers</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="success">Success (2xx)</option>
            <option value="error">Error (4xx/5xx)</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-950/60">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Tokens</th>
                <th className="py-3 px-4">Cost</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading requests...
                  </td>
                </tr>
              ) : requests.length > 0 ? (
                requests.map((r) => (
                  <tr
                    key={r.id || r.requestId}
                    onClick={() => setSelectedRequest(r)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-400 font-mono whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {r.requestId.slice(0, 14)}...
                    </td>
                    <td className="py-3 px-4 capitalize font-medium text-slate-300">{r.provider}</td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-medium">{r.model}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{r.totalTokens.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono font-medium text-white">${r.estimatedCost.toFixed(5)}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{r.latencyMs}ms</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {r.status === 'success' ? '200 OK' : `${r.statusCode || 500} Err`}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No matching requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-mono">{requests.length}</span> of{' '}
            <span className="text-white font-mono">{totalRequests}</span> requests
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 disabled:opacity-40 hover:bg-slate-800 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="font-mono text-slate-300">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 disabled:opacity-40 hover:bg-slate-800 transition-colors flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Drawer for Request Inspector */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Request Details</h3>
                <p className="text-xs text-slate-400 font-mono">{selectedRequest.requestId}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Copy */}
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Request ID</span>
              <button
                onClick={() => copyToClipboard(selectedRequest.requestId)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-mono"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
                <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cost
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  ${selectedRequest.estimatedCost.toFixed(6)}
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
                <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-sky-400" /> Latency
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {selectedRequest.latencyMs}ms
                </div>
              </div>
            </div>

            {/* Token Breakdown */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-emerald-400" /> Token Usage
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">Input</div>
                  <div className="font-bold font-mono text-white mt-0.5">
                    {selectedRequest.inputTokens.toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">Output</div>
                  <div className="font-bold font-mono text-white mt-0.5">
                    {selectedRequest.outputTokens.toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">Cached</div>
                  <div className="font-bold font-mono text-emerald-400 mt-0.5">
                    {(selectedRequest.cachedTokens || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata Information */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Provider</span>
                <span className="text-slate-200 capitalize font-medium">{selectedRequest.provider}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Model</span>
                <span className="text-emerald-400 font-mono">{selectedRequest.model}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">HTTP Status</span>
                <span className="text-slate-200 font-mono">{selectedRequest.statusCode}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Environment</span>
                <span className="text-slate-200 capitalize">{selectedRequest.environment || 'production'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Timestamp</span>
                <span className="text-slate-200 font-mono">{new Date(selectedRequest.timestamp).toISOString()}</span>
              </div>
            </div>

            {/* Error banner if present */}
            {selectedRequest.errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs">
                <div className="font-semibold mb-1">Error Information</div>
                <div className="font-mono text-[11px] break-all">{selectedRequest.errorMessage}</div>
              </div>
            )}

            {/* Privacy notice */}
            <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800 text-slate-400 text-[11px] flex items-start gap-2 leading-relaxed">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                By default, raw prompt and completion content are never persisted by AI Cost to protect data privacy and compliance.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
