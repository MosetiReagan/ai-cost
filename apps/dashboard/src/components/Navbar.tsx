import React from 'react';
import { Project } from '../types';
import { ShieldCheck, Calendar, Layers, Activity } from 'lucide-react';

interface NavbarProps {
  projects: Project[];
  selectedProject: string;
  onSelectProject: (id: string) => void;
  dateRange: string;
  onSelectDateRange: (range: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  dateRange,
  onSelectDateRange,
  onRefresh,
  isRefreshing
}) => {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {/* Project Selector */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-sm">
          <Layers className="w-4 h-4 text-emerald-400" />
          <select
            value={selectedProject}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none text-sm font-medium cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-200">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={dateRange}
            onChange={(e) => onSelectDateRange(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none text-sm font-medium cursor-pointer"
          >
            <option value="today" className="bg-slate-900 text-slate-200">Today</option>
            <option value="yesterday" className="bg-slate-900 text-slate-200">Yesterday</option>
            <option value="7d" className="bg-slate-900 text-slate-200">Last 7 Days</option>
            <option value="30d" className="bg-slate-900 text-slate-200">Last 30 Days</option>
            <option value="90d" className="bg-slate-900 text-slate-200">Last 90 Days</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Live Gateway Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Gateway Active :4000</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Refresh metrics"
        >
          <Activity className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
