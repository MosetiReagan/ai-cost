import React, { useState, useEffect } from 'react';
import { Project, ApiKey } from '../types';
import { api } from '../api';
import { Key, Plus, Trash2, Copy, Check, ShieldAlert } from 'lucide-react';

export const ProjectsView: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);

  // New Project modal
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  // New Key modal
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await api.getProjects();
      setProjects(res.projects);
      if (res.projects.length > 0 && !selectedProject) {
        setSelectedProject(res.projects[0]);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const fetchKeys = async (projectId: string) => {
    try {
      const res = await api.getKeys(projectId);
      setKeys(res.keys);
    } catch (err) {
      console.error('Failed to load keys:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchKeys(selectedProject.id);
    }
  }, [selectedProject]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    try {
      const res = await api.createProject({ name: projectName, description: projectDesc });
      setProjectName('');
      setProjectDesc('');
      setShowNewProjectModal(false);
      await fetchProjects();
      setSelectedProject(res.project);
    } catch (err) {
      alert('Failed to create project: ' + (err as Error).message);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !keyName.trim()) return;
    try {
      const res = await api.createKey(selectedProject.id, keyName);
      setGeneratedRawKey(res.rawKey);
      setKeyName('');
      await fetchKeys(selectedProject.id);
    } catch (err) {
      alert('Failed to create key: ' + (err as Error).message);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Any applications using it will immediately be rejected.')) {
      return;
    }
    try {
      await api.revokeKey(keyId);
      if (selectedProject) {
        await fetchKeys(selectedProject.id);
      }
    } catch (err) {
      alert('Failed to revoke key: ' + (err as Error).message);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Projects & API Keys</h2>
          <p className="text-xs text-slate-400 mt-1">
            Segment telemetry by project and securely issue hashed API keys.
          </p>
        </div>
        <button
          onClick={() => setShowNewProjectModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition-all"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider px-1">Projects</h3>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 space-y-1">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className={`w-full text-left p-3 rounded-lg text-xs transition-all ${
                  selectedProject?.id === p.id
                    ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">{p.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 font-mono text-emerald-400 border border-slate-800">
                    {p.environment}
                  </span>
                </div>
                {p.description && <p className="text-[11px] text-slate-400 mt-1 truncate">{p.description}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* API Keys for Selected Project */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-200 text-base flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  API Keys for {selectedProject?.name || 'Project'}
                </h3>
                <p className="text-xs text-slate-400">
                  Pass these keys as <code className="font-mono text-emerald-400">Authorization: Bearer ac_live_...</code>
                </p>
              </div>
              <button
                onClick={() => {
                  setGeneratedRawKey(null);
                  setShowNewKeyModal(true);
                }}
                disabled={!selectedProject}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
              >
                <Plus className="w-3.5 h-3.5" /> Generate Key
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-800 bg-slate-950/60">
                  <tr>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Key Prefix</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3">Last Used</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-medium text-slate-200">{k.name}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400">{k.keyPrefix}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {k.revokedAt ? (
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">Revoked</span>
                        ) : (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {keys.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No active API keys for this project. Generate one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Customer Support Bot"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Brief summary of workload"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 h-20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Key Modal / One-time Key Display per Section 7 */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">
              {generatedRawKey ? 'API Key Generated' : 'Generate Project API Key'}
            </h3>

            {generatedRawKey ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Copy this key now. It is hashed before storage and will <strong>never be shown again</strong>.
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2">
                  <code className="font-mono text-xs text-emerald-400 break-all">{generatedRawKey}</code>
                  <button
                    onClick={() => copyKey(generatedRawKey)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={() => setShowNewKeyModal(false)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Key Name / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Production Backend"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewKeyModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                  >
                    Generate
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
