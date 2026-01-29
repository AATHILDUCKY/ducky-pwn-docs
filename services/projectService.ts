import type { Project } from '../types';

type CreatePayload = {
  name: string;
  client: string;
  parentId?: string | null;
};

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

const generateProjectId = () => `p${Date.now()}`;

export const fetchProjects = async (): Promise<Project[]> => {
  const api = electronAPI();
  if (api?.getProjects) {
    return api.getProjects();
  }
  throw new Error('Electron API unavailable: projects require SQLite backend.');
};

export const createProject = async (payload: CreatePayload): Promise<Project> => {
  const api = electronAPI();
  const id = generateProjectId();
  const parentId = typeof payload.parentId === 'string' ? payload.parentId.trim() : '';
  if (parentId) {
    if (api?.createSubProject) {
      const created = await api.createSubProject({ id, name: payload.name, client: payload.client, parentId });
      if (created) return created;
    }
    throw new Error('Failed to create subproject. Please retry.');
  }
  if (api?.createProject) {
    return api.createProject({ id, name: payload.name, client: payload.client });
  }
  throw new Error('Electron API unavailable: projects require SQLite backend.');
};

export const deleteProject = async (id: string): Promise<void> => {
  const api = electronAPI();
  if (api?.deleteProject) {
    await api.deleteProject(id);
    return;
  }
  throw new Error('Electron API unavailable: projects require SQLite backend.');
};
