export type EmailHistoryEntry = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  issue_id: string | null;
  issue_title: string | null;
  recipient: string;
  subject: string | null;
  format: string | null;
  status: string | null;
  sent_at: string;
};

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const fetchEmailHistory = async (payload: { limit?: number; offset?: number }): Promise<EmailHistoryEntry[]> => {
  const api = electronAPI();
  if (api?.getEmailHistory) {
    return api.getEmailHistory(payload);
  }
  throw new Error('Electron API unavailable: email history requires SQLite backend.');
};
