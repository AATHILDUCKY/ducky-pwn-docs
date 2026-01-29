import type { Issue } from '../types';

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const fetchIssues = async (projectId: string): Promise<Issue[]> => {
  if (!projectId) return [];
  const api = electronAPI();
  if (api?.getIssues) {
    return api.getIssues(projectId);
  }
  throw new Error('Electron API unavailable: issues require SQLite backend.');
};

export const persistIssue = async (projectId: string, issue: Issue): Promise<void> => {
  if (!projectId || !issue) return;
  const api = electronAPI();
  if (api?.saveIssue) {
    await api.saveIssue(projectId, issue);
    return;
  }
  throw new Error('Electron API unavailable: issues require SQLite backend.');
};

export const deleteIssue = async (projectId: string, issueId: string): Promise<void> => {
  if (!projectId || !issueId) return;
  const api = electronAPI();
  if (api?.deleteIssue) {
    await api.deleteIssue(projectId, issueId);
    return;
  }
  throw new Error('Electron API unavailable: issues require SQLite backend.');
};
