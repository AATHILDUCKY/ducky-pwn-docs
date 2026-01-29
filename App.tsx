
import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  LayoutDashboard, 
  AlertTriangle, 
  CheckSquare, 
  Download, 
  Search, 
  Bell, 
  Plus, 
  Briefcase, 
  X, 
  ChevronDown, 
  FileText, 
  Layers, 
  Database, 
  Monitor, 
  SearchX,
  Command,
  Loader2,
  Trash2,
  RefreshCw
} from 'lucide-react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const IssueList = lazy(() => import('./components/IssueList'));
const MethodologyTracker = lazy(() => import('./components/MethodologyTracker'));
const ExportPanel = lazy(() => import('./components/ExportPanel'));
const NotesPanel = lazy(() => import('./components/NotesPanel'));
import { Project, UserProfile, UserProfileInput, SmtpSettings } from './types';
import { fetchProjects, createProject, deleteProject } from './services/projectService';
import { createUserProfile, fetchUserProfile, updateUserProfile } from './services/userService';
import { fetchSmtpSettings, saveSmtpSettings } from './services/emailService';
import ProfilePage from './components/ProfilePage';
import HistoryPage from './components/HistoryPage';
import ToastHost from './components/ui/ToastHost';
import { notify } from './utils/notify';

const Navigation: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/notes', label: 'Notes', icon: FileText },
    { path: '/issues', label: 'Findings', icon: AlertTriangle },
    { path: '/methodologies', label: 'Methodology', icon: CheckSquare },
    { path: '/export', label: 'Deliverables', icon: Download },
  ];

  return (
    <nav className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 bg-white/80 backdrop-blur-md sticky top-16 z-[90]">
      <div className="flex items-center gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
              isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={14} strokeWidth={2.5} />
            {item.label}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]" />
            )}
          </Link>
        );
      })}
      </div>
      <button
        onClick={onRefresh}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
        title="Refresh"
      >
        <RefreshCw size={16} />
      </button>
    </nav>
  );
};

const VaultNode: React.FC<{ 
  project: Project; 
  isActive: boolean; 
  hasChildren: boolean;
  depth: number;
  onSelect: () => void;
  onToggle: () => void;
  onCreateSub: () => void;
  onDelete: () => void;
  isExpanded: boolean;
}> = ({ project, isActive, hasChildren, depth, onSelect, onToggle, onCreateSub, onDelete, isExpanded }) => {
  const total = project.issueCount.critical + project.issueCount.high + project.issueCount.medium + project.issueCount.low;
  const progress = Math.min(Math.round((project.issueCount.low / (total || 1)) * 100) + 20, 100);

  return (
    <div className="space-y-1" style={{ paddingLeft: depth ? depth * 12 : 0 }}>
      <div 
        onClick={onSelect}
        className={`group flex items-center gap-3 py-3 px-3 rounded-2xl cursor-pointer transition-all border ${
          isActive 
            ? 'bg-white border-slate-200 shadow-sm ring-1 ring-indigo-500/5' 
            : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100/60'
        }`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 group-hover:bg-white'
        }`}>
          <Briefcase size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-black truncate leading-tight ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{project.name}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{project.client}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onCreateSub();
            }}
            className="w-6 h-6 flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all active:scale-90"
            title="Add sub project"
          >
            <Plus size={12} />
          </button>
          {hasChildren && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
              title="Toggle"
            >
              <ChevronDown size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
            title="Delete project"
          >
            <Trash2 size={12} />
          </button>
          {project.issueCount.critical > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>}
        </div>
      </div>

      {isExpanded && (
        <div className="ml-7 pl-4 border-l-2 border-slate-100 space-y-1 py-1 animate-in slide-in-from-top-2 duration-200">
          <Link to="/notes" className="flex items-center gap-2.5 py-1.5 text-[9px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em]">
            <FileText size={12} className="text-indigo-400" /> Notes
          </Link>
        </div>
      )}
    </div>
  );
};

const Header: React.FC<{
  profile: UserProfile | null;
  onOpenProfile: () => void;
}> = ({ profile, onOpenProfile }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-[100]">
    <div className="flex items-center gap-3">
      <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg">
        <Shield size={20} strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="text-lg font-black text-slate-800 tracking-tighter leading-none">Ducky Pwn Docs</h1>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Secure Collaboration</p>
      </div>
    </div>

    <div className="flex-1 max-w-md mx-12">
      <div className="relative group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
        <input 
          type="text" 
          placeholder="Quick Command Search..." 
          className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-2xl text-[11px] font-bold focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none"
        />
      </div>
    </div>

    <div className="flex items-center gap-3">
      <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xl transition-all relative">
        <Bell size={18} />
        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full border-2 border-white"></span>
      </button>
      <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>
      <div className="relative">
        <button
          className="flex items-center gap-3 pl-2 cursor-pointer group"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-black text-slate-700 leading-none">{profile?.fullName || profile?.username || 'User'}</p>
          <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{profile?.role || 'Owner'}</p>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-indigo-100 overflow-hidden"
          style={{ backgroundColor: profile?.avatarColor || '#4f46e5' }}
        >
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            (profile?.username || 'U').slice(0, 2).toUpperCase()
          )}
        </div>
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 top-12 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <button onClick={() => { setIsMenuOpen(false); onOpenProfile(); }} className="block w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">Profile</button>
          </div>
        )}
      </div>
    </div>
  </header>
  );
};

const LOADING_PROJECT: Project = {
  id: '',
  name: 'Syncing vault...',
  client: 'Please wait',
  issueCount: { critical: 0, high: 0, medium: 0, low: 0 },
  lastUpdate: '',
  status: 'active'
};

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', client: '' });
  const [vaultSearch, setVaultSearch] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [newProjectParentId, setNewProjectParentId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [smtpForm, setSmtpForm] = useState<SmtpSettings>({
    host: '',
    port: 0,
    user: '',
    pass: '',
    from: '',
  });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectError(null);
    try {
      const data = await fetchProjects();
      setProjects(data);
      setActiveProjectId((prev) => {
        if (!data.length) return '';
        if (prev && data.some((project) => project.id === prev)) return prev;
        return data[0].id;
      });
    } catch (error) {
      console.error('Failed to load projects', error);
      notify('Failed to load projects.');
      setProjects([]);
      setActiveProjectId('');
      setProjectError('SQLite backend unavailable. Please launch the Electron app.');
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    const boot = async () => {
      try {
        let existing = await fetchUserProfile();
        if (!existing) {
          existing = await createUserProfile({
            username: 'user',
            fullName: 'User',
            role: 'Owner',
            email: '',
            avatarColor: '#4f46e5',
            avatarUrl: '',
          });
        }
        if (existing) {
          setProfile(existing);
        }
      } catch (error) {
        console.error('Failed to load user profile', error);
        notify('Failed to load user profile.');
      }
    };
    boot();
  }, []);

  useEffect(() => {
    const loadSmtp = async () => {
      try {
        const settings = await fetchSmtpSettings();
        if (settings) {
          setSmtpSettings(settings);
          setSmtpForm(settings);
        }
      } catch (error) {
        console.error('Failed to load SMTP settings', error);
        notify('Failed to load SMTP settings.');
      }
    };
    loadSmtp();
  }, []);

  useEffect(() => {
    if (smtpSettings) {
      setSmtpForm(smtpSettings);
    }
  }, [smtpSettings]);

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.client) return;
    try {
      setIsCreatingProject(true);
      setProjectError(null);
      await createProject({ ...newProject, parentId: newProjectParentId });
      await refreshProjects();
      setIsAddingProject(false);
      setNewProject({ name: '', client: '' });
      setNewProjectParentId(null);
    } catch (error) {
      console.error('Could not create project', error);
      notify('Unable to create project.');
      setProjectError('Unable to create project. Please launch the Electron app.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    const confirmed = window.confirm(`Delete "${project.name}" and all child projects?`);
    if (!confirmed) return;
    try {
      setProjectError(null);
      await deleteProject(project.id);
      await refreshProjects();
    } catch (error) {
      console.error('Could not delete project', error);
      notify('Unable to delete project.');
      setProjectError('Unable to delete project. Please launch the Electron app.');
    }
  };

  const filteredVaultProjects = useMemo(() => {
    return projects.filter(p => 
      p.name.toLowerCase().includes(vaultSearch.toLowerCase()) || 
      p.client.toLowerCase().includes(vaultSearch.toLowerCase())
    );
  }, [projects, vaultSearch]);

  const projectTree = useMemo(() => {
    const byParent = new Map<string | null, Project[]>();
    filteredVaultProjects.forEach((project) => {
      const parent = project.parentId || null;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent)?.push(project);
    });
    return byParent;
  }, [filteredVaultProjects]);

  const renderVaultNodes = (parentId: string | null, depth = 0): React.ReactNode[] => {
    const nodes = projectTree.get(parentId) || [];
    return nodes.flatMap((project) => {
      const children = projectTree.get(project.id) || [];
      const isExpanded = expandedProjects[project.id] ?? true;
      const node = (
        <VaultNode
          key={project.id}
          project={project}
          isActive={activeProjectId === project.id}
          hasChildren={children.length > 0}
          depth={depth}
          onSelect={() => setActiveProjectId(project.id)}
          onToggle={() => setExpandedProjects((prev) => ({ ...prev, [project.id]: !isExpanded }))}
          onCreateSub={() => {
            setNewProjectParentId(project.id);
            setIsAddingProject(true);
          }}
          onDelete={() => handleDeleteProject(project)}
          isExpanded={isExpanded}
        />
      );
      const childNodes = isExpanded ? renderVaultNodes(project.id, depth + 1) : [];
      return [node, ...childNodes];
    });
  };

  const activeProject = useMemo(() => {
    if (!projects.length) return LOADING_PROJECT;
    return projects.find(p => p.id === activeProjectId) || projects[0];
  }, [activeProjectId, projects]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfe]">
      <ToastHost />
      <Header
        profile={profile}
        onOpenProfile={() => navigate('/profile')}
      />
      <Navigation onRefresh={refreshProjects} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Project Vault Sidebar */}
        <aside className="w-80 border-r border-slate-200 bg-white/40 backdrop-blur-xl overflow-y-auto hidden lg:block custom-scrollbar">
          <div className="p-6 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                   <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">Project Vault</h2>
                </div>
                <button 
                  onClick={() => { setNewProjectParentId(null); setIsAddingProject(true); }}
                  className="w-7 h-7 flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all active:scale-90"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="px-1">
                <div className="relative group">
                  <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${vaultSearch ? 'text-indigo-500' : 'text-slate-300'}`} />
                  <input 
                    type="text" 
                    placeholder="Filter Vault..." 
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-100 rounded-2xl text-[10px] font-black focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-100 outline-none transition-all shadow-sm uppercase tracking-widest placeholder:text-slate-300"
                  />
                  {vaultSearch && (
                    <button onClick={() => setVaultSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 p-1">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {projectError ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-rose-50/60 rounded-3xl border border-dashed border-rose-200">
                    <SearchX size={20} className="text-rose-300 mb-3" />
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-relaxed">{projectError}</p>
                  </div>
                ) : isLoadingProjects ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <Loader2 size={26} className="text-indigo-400 animate-spin" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Syncing vault data...</p>
                  </div>
                ) : filteredVaultProjects.length > 0 ? (
                  renderVaultNodes(null)
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <SearchX size={20} className="text-slate-300 mb-3" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">No matching<br/>intelligence found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50/10 custom-scrollbar">
          <div className={`${location.pathname === '/notes' ? 'max-w-[1400px]' : 'max-w-7xl'} mx-auto p-10`}>
            {projectError ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">
                {projectError}
              </div>
            ) : isLoadingProjects && !projects.length ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                <Loader2 size={30} className="animate-spin text-indigo-400" />
                Central vault initializing...
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    <Loader2 size={30} className="animate-spin text-indigo-400" />
                    Loading workspace...
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Dashboard activeProjectId={activeProjectId} activeProject={activeProject} profile={profile} />} />
                  <Route path="/notes" element={<NotesPanel activeProjectId={activeProjectId} activeProject={activeProject} />} />
                  <Route 
                    path="/issues" 
                    element={<IssueList activeProjectId={activeProjectId} activeProject={activeProject} refreshProjects={refreshProjects} />} 
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProfilePage
                        profile={profile}
                        setProfile={setProfile}
                        smtpForm={smtpForm}
                        setSmtpForm={setSmtpForm}
                        smtpSaving={smtpSaving}
                        smtpError={smtpError}
                        setSmtpError={setSmtpError}
                        onSaveProfile={async () => {
                          try {
                            if (!profile) return;
                            const updated = await updateUserProfile(profile as UserProfile & UserProfileInput);
                            setProfile(updated || profile);
                          } catch (error) {
                            console.error('Failed to update profile', error);
                            notify('Failed to update profile.');
                          }
                        }}
                        onSaveSmtp={async () => {
                          try {
                            setSmtpSaving(true);
                            setSmtpError(null);
                            const saved = await saveSmtpSettings(smtpForm);
                            setSmtpSettings(saved || smtpForm);
                          } catch (error) {
                            console.error('Failed to save SMTP settings', error);
                            notify('Failed to save SMTP settings.');
                            setSmtpError('Unable to save mail settings. Please launch the Electron app.');
                          } finally {
                            setSmtpSaving(false);
                          }
                        }}
                        onBack={() => navigate(-1)}
                        onOpenHistory={() => navigate('/history')}
                      />
                    }
                  />
                  <Route path="/history" element={<HistoryPage onBack={() => navigate(-1)} />} />
                  <Route path="/methodologies" element={<MethodologyTracker />} />
                  <Route 
                    path="/export" 
                    element={<ExportPanel externalProjects={projects} externalActiveId={activeProjectId} onProjectSelect={setActiveProjectId} />} 
                  />
                </Routes>
              </Suspense>
            )}
          </div>
        </main>
        <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
            <span>Ducky Pwn Docs</span>
            <a href="https://github.com/AATHILDUCKY" target="_blank" rel="noreferrer" className="hover:text-indigo-600 transition-colors">github.com/AATHILDUCKY</a>
          </div>
        </footer>
      </div>

      {/* Initialize Modal */}
      {isAddingProject && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddingProject(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-10 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Initialize Vault</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">New Strategic Engagement</p>
                </div>
                <button onClick={() => setIsAddingProject(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Vault Identity</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Annual Cloud Audit"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Client Entity</label>
                  <input 
                    type="text" 
                    placeholder="e.g. OmniConsumer Corp"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsAddingProject(false)} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancel</button>
                <button 
                  onClick={handleCreateProject}
                  disabled={!newProject.name || !newProject.client}
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCreatingProject ? 'Creating...' : 'Create Vault'}
                </button>
              </div>
              {newProjectParentId && (
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Creating sub project
                </p>
              )}
              {projectError && (
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                  {projectError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

const App = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
