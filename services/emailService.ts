import type { SmtpSettings } from '../types';

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const fetchSmtpSettings = async (): Promise<SmtpSettings | null> => {
  const api = electronAPI();
  if (api?.getSmtpSettings) {
    return api.getSmtpSettings();
  }
  throw new Error('Electron API unavailable: SMTP settings require SQLite backend.');
};

export const saveSmtpSettings = async (payload: SmtpSettings): Promise<SmtpSettings | null> => {
  const api = electronAPI();
  if (api?.saveSmtpSettings) {
    return api.saveSmtpSettings(payload);
  }
  throw new Error('Electron API unavailable: SMTP settings require SQLite backend.');
};

export const sendIssueReportEmail = async (payload: {
  projectId: string;
  issueId: string;
  to: string;
  subject?: string;
  message?: string;
  format?: 'pdf' | 'html' | 'docx';
}): Promise<{ ok?: boolean; error?: string }> => {
  const api = electronAPI();
  if (api?.sendIssueReportEmail) {
    return api.sendIssueReportEmail(payload);
  }
  throw new Error('Electron API unavailable: email sending requires SQLite backend.');
};

export const sendProjectReportEmail = async (payload: {
  projectId: string;
  to: string;
  subject?: string;
  message?: string;
  format?: 'pdf' | 'html' | 'docx';
}): Promise<{ ok?: boolean; error?: string }> => {
  const api = electronAPI();
  if (api?.sendProjectReportEmail) {
    return api.sendProjectReportEmail(payload);
  }
  throw new Error('Electron API unavailable: email sending requires SQLite backend.');
};
