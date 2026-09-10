import React, { useState, useEffect } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { OverviewView } from './components/OverviewView';
import { RequestsView } from './components/RequestsView';
import { ModelsView } from './components/ModelsView';
import { ProjectsView } from './components/ProjectsView';
import { BudgetsView } from './components/BudgetsView';
import { PricingView } from './components/PricingView';
import { SetupModal } from './components/SetupModal';
import { api } from './api';
import {
  Project,
  OverviewMetrics,
  SpendBucket,
  ProviderBreakdown,
  ModelBreakdown,
  CostInsight,
  AIRequestItem
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSetupNeeded, setIsSetupNeeded] = useState<boolean | null>(null);

  // Filter state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [dateRange, setDateRange] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Overview metrics state
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    totalCost: 0,
    totalRequests: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    avgLatencyMs: 0,
    errorRate: 0,
    successfulRequests: 0,
    failedRequests: 0
  });
  const [timeline, setTimeline] = useState<SpendBucket[]>([]);
  const [providers, setProviders] = useState<ProviderBreakdown[]>([]);
  const [models, setModels] = useState<ModelBreakdown[]>([]);
  const [insights, setInsights] = useState<CostInsight[]>([]);
  const [recentRequests, setRecentRequests] = useState<AIRequestItem[]>([]);

  // Check setup status on load
  const checkStatus = async () => {
    try {
      const res = await api.checkStatus();
      setIsSetupNeeded(!res.isSetup);
    } catch {
      // If API not reachable yet, don't show setup modal immediately
      setIsSetupNeeded(false);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await api.getProjects();
      setProjects(res.projects);
    } catch (err) {
      console.warn('Could not load projects:', err);
    }
  };

  const loadOverviewData = async () => {
    setIsRefreshing(true);
    try {
      const filterParams: Record<string, string> = {};
      if (selectedProject) filterParams.projectId = selectedProject;

      // Calculate start date based on preset
      const now = new Date();
      let start: Date | null = null;
      if (dateRange === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === 'yesterday') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      } else if (dateRange === '7d') {
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '30d') {
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '90d') {
        start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      }

      if (start) {
        filterParams.startDate = start.toISOString();
      }

      const [mRes, tRes, pRes, modRes, inRes, rRes] = await Promise.all([
        api.getOverview(filterParams).catch(() => ({ overview: metrics })),
        api.getSpendOverTime({ ...filterParams, interval: dateRange === 'today' ? 'hour' : 'day' }).catch(() => ({ timeline: [] })),
        api.getSpendByProvider(filterParams).catch(() => ({ providers: [] })),
        api.getSpendByModel(filterParams).catch(() => ({ models: [] })),
        api.getInsights(selectedProject || undefined).catch(() => ({ insights: [] })),
        api.getRequests({ ...filterParams, limit: 6 }).catch(() => ({ data: [] }))
      ]);

      setMetrics(mRes.overview);
      setTimeline(tRes.timeline);
      setProviders(pRes.providers);
      setModels(modRes.models);
      setInsights(inRes.insights);
      setRecentRequests((rRes as any).data || []);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkStatus();
    loadProjects();
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [selectedProject, dateRange]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          dateRange={dateRange}
          onSelectDateRange={setDateRange}
          onRefresh={loadOverviewData}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              metrics={metrics}
              timeline={timeline}
              providers={providers}
              models={models}
              insights={insights}
              recentRequests={recentRequests}
              onNavigateToRequests={() => setActiveTab('requests')}
            />
          )}

          {activeTab === 'requests' && <RequestsView selectedProjectId={selectedProject} />}

          {activeTab === 'models' && <ModelsView selectedProjectId={selectedProject} />}

          {activeTab === 'projects' && <ProjectsView />}

          {activeTab === 'budgets' && <BudgetsView projects={projects} />}

          {activeTab === 'pricing' && <PricingView />}
        </main>
      </div>

      {/* Setup modal if initial admin is not created */}
      {isSetupNeeded && (
        <SetupModal
          onCompleted={() => {
            setIsSetupNeeded(false);
            loadProjects();
            loadOverviewData();
          }}
        />
      )}
    </div>
  );
};
