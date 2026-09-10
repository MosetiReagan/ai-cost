import React from 'react';
import {
  LayoutDashboard,
  Search,
  Cpu,
  FolderGit2,
  PieChart,
  DollarSign,
  Terminal,
  BookOpen
} from 'lucide-react';

export type TabType = 'overview' | 'requests' | 'models' | 'projects' | 'budgets' | 'pricing';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'requests', label: 'Requests Explorer', icon: Search },
    { id: 'models', label: 'Models & Providers', icon: Cpu },
    { id: 'projects', label: 'Projects & Keys', icon: FolderGit2 },
    { id: 'budgets', label: 'Budgets & Alerts', icon: PieChart },
    { id: 'pricing', label: 'Model Pricing', icon: DollarSign },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
            ac
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-base leading-tight tracking-tight">AI Cost</h1>
            <p className="text-[11px] text-slate-400 font-medium">AI Observability</p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Gateway Quick Help & Footer */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>OpenAI Proxy</span>
          </div>
          <code className="text-[11px] text-emerald-400 block break-all font-mono">
            http://localhost:4000/v1
          </code>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>v1.0.0 (Open Source)</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Docs
          </a>
        </div>
      </div>
    </aside>
  );
};
