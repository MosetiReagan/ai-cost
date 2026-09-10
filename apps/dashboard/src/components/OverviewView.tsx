import React from 'react';
import {
  OverviewMetrics,
  SpendBucket,
  ProviderBreakdown,
  ModelBreakdown,
  CostInsight,
  AIRequestItem
} from '../types';
import { StatCard } from './StatCard';
import {
  DollarSign,
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  Lightbulb,
  ArrowUpRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface OverviewViewProps {
  metrics: OverviewMetrics;
  timeline: SpendBucket[];
  providers: ProviderBreakdown[];
  models: ModelBreakdown[];
  insights: CostInsight[];
  recentRequests: AIRequestItem[];
  onNavigateToRequests: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  timeline,
  providers,
  models,
  insights,
  recentRequests,
  onNavigateToRequests
}) => {
  // Format tokens into human readable string
  const formatTokens = (t: number) => {
    if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`;
    if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K`;
    return t.toString();
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner per Section 41 */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>
            Costs are estimates based on configured model pricing and reported token usage. Actual provider billing may differ.
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Real-time telemetry</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Spend"
          value={`$${metrics.totalCost.toFixed(2)}`}
          subtitle="Estimated AI cost"
          icon={DollarSign}
          highlight={true}
        />
        <StatCard
          title="Requests"
          value={metrics.totalRequests.toLocaleString()}
          subtitle={`${metrics.successfulRequests.toLocaleString()} success`}
          icon={Activity}
        />
        <StatCard
          title="Tokens"
          value={formatTokens(metrics.totalTokens)}
          subtitle={`${formatTokens(metrics.cachedTokens)} cached`}
          icon={Zap}
        />
        <StatCard
          title="Avg Latency"
          value={`${metrics.avgLatencyMs}ms`}
          subtitle="End-to-end response time"
          icon={Clock}
        />
        <StatCard
          title="Error Rate"
          value={`${metrics.errorRate}%`}
          subtitle={`${metrics.failedRequests} failed calls`}
          icon={AlertTriangle}
          trend={metrics.errorRate > 5 ? { value: 'High', isPositive: false } : undefined}
        />
      </div>

      {/* Spend Over Time Chart */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-200 text-base">Spend Over Time</h3>
            <p className="text-xs text-slate-400">Estimated cost across all requests</p>
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded text-slate-300">
            USD ($)
          </span>
        </div>

        <div className="h-64 w-full">
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? val : `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: any) => [`$${Number(value).toFixed(4)}`, 'Spend']}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#spendGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              No usage data available for this timeframe.
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Grids: Provider & Model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Provider */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
          <h3 className="font-semibold text-slate-200 text-base mb-1">Spend by Provider</h3>
          <p className="text-xs text-slate-400 mb-4">Cost share across external AI providers</p>

          <div className="space-y-3.5">
            {providers.length > 0 ? (
              providers.map((p) => (
                <div key={p.provider} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize text-slate-200">{p.provider}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">
                        {p.requests.toLocaleString()} reqs
                      </span>
                      <span className="font-semibold text-white font-mono">${p.cost.toFixed(2)}</span>
                      <span className="text-xs text-slate-500">({p.percentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.max(3, p.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm py-4 text-center">No provider data yet.</p>
            )}
          </div>
        </div>

        {/* Spend by Model */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
          <h3 className="font-semibold text-slate-200 text-base mb-1">Spend by Model</h3>
          <p className="text-xs text-slate-400 mb-4">Top models consuming budget</p>

          <div className="space-y-3.5">
            {models.slice(0, 5).map((m) => (
              <div key={m.model} className="flex items-center justify-between text-sm py-1 border-b border-slate-800/60 last:border-0">
                <div>
                  <span className="font-mono text-xs text-emerald-400 font-medium">{m.model}</span>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>{m.requests.toLocaleString()} calls</span>
                    <span>•</span>
                    <span>{m.avgLatencyMs}ms avg</span>
                    {m.errorRate > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-rose-400">{m.errorRate}% err</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-white font-mono">${m.cost.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{formatTokens(m.tokens)} tokens</div>
                </div>
              </div>
            ))}
            {models.length === 0 && (
              <p className="text-slate-500 text-sm py-4 text-center">No model usage recorded.</p>
            )}
          </div>
        </div>
      </div>

      {/* Cost Optimization Insights (Requirement 15) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-slate-200 text-base">Cost Optimization Insights</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">Rule-based recommendations derived from real request patterns</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-4 rounded-lg border text-sm ${
                insight.type === 'warning'
                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  : insight.type === 'tip'
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-800/40 border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="font-semibold">{insight.title}</span>
                {insight.potentialSavingsMonthly && (
                  <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded shrink-0">
                    Save ~${insight.potentialSavingsMonthly}/mo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-2 leading-relaxed">{insight.message}</p>
              {insight.actionRecommendation && (
                <div className="text-xs font-medium text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800">
                  <span className="text-slate-400">Recommendation: </span>
                  {insight.actionRecommendation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Requests Preview Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-200 text-base">Recent Requests</h3>
            <p className="text-xs text-slate-400">Latest telemetry sent through AI Cost</p>
          </div>
          <button
            onClick={onNavigateToRequests}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
          >
            View all in explorer <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-950/50">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Tokens</th>
                <th className="py-2.5 px-3">Cost</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {recentRequests.slice(0, 6).map((r) => (
                <tr key={r.id || r.requestId} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 text-slate-400 font-mono">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 capitalize font-medium text-slate-300">{r.provider}</td>
                  <td className="py-2.5 px-3 font-mono text-emerald-400">{r.model}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">{r.totalTokens.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-mono font-medium text-white">${r.estimatedCost.toFixed(5)}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{r.latencyMs}ms</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No requests recorded yet. Send your first request to the gateway at http://localhost:4000/v1
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
