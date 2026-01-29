import type { Methodology, Task } from '../types';

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const fetchMethodologies = async (): Promise<Methodology[]> => {
  const api = electronAPI();
  if (api?.getMethodologies) {
    return api.getMethodologies();
  }
  throw new Error('Electron API unavailable: methodologies require SQLite backend.');
};

export const createMethodology = async (name: string): Promise<Methodology | null> => {
  const api = electronAPI();
  if (api?.createMethodology) {
    return api.createMethodology({ id: `m-${Date.now()}`, name });
  }
  throw new Error('Electron API unavailable: methodologies require SQLite backend.');
};

export const createMethodologyTask = async (
  methodologyId: string,
  title: string,
  status: Task['status'] = 'todo'
): Promise<Task | null> => {
  const api = electronAPI();
  if (api?.createMethodologyTask) {
    return api.createMethodologyTask({ id: `t-${Date.now()}`, methodologyId, title, status });
  }
  throw new Error('Electron API unavailable: methodologies require SQLite backend.');
};

export const updateMethodologyTask = async (
  id: string,
  payload: { status?: Task['status']; title?: string }
): Promise<void> => {
  const api = electronAPI();
  if (api?.updateMethodologyTask) {
    await api.updateMethodologyTask({ id, ...payload });
    return;
  }
  throw new Error('Electron API unavailable: methodologies require SQLite backend.');
};

export const updateMethodology = async (id: string, name: string): Promise<void> => {
  const api = electronAPI();
  if (api?.updateMethodology) {
    await api.updateMethodology({ id, name });
    return;
  }
  throw new Error('Electron API unavailable: methodologies require SQLite backend.');
};

export const deleteMethodology = async (id: string): Promise<void> => {
  const api = electronAPI();
  if (api?.deleteMethodology) {
    await api.deleteMethodology(id);
    return;
  }
  throw new Error('Electron API unavailable: methodologies require SQLite backend.');
};

export const deleteMethodologyTask = async (id: string): Promise<void> => {
  const api = electronAPI();
  if (api?.deleteMethodologyTask) {
    await api.deleteMethodologyTask(id);
    return;
  }
  throw new Error('Electron API unavailable: methodologies require SQLite backend.');
};
