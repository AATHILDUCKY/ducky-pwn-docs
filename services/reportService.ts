type ReportFormat = 'pdf' | 'html' | 'docx';

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const generateReport = async (
  projectId: string,
  format: ReportFormat
): Promise<{ path: string } | { error: string } | null> => {
  const api = electronAPI();
  if (api?.generateReport) {
    return api.generateReport({ projectId, format });
  }
  throw new Error('Electron API unavailable: report generation requires SQLite backend.');
};

export const getReportPreview = async (
  projectId: string
): Promise<{ html?: string; error?: string }> => {
  const api = electronAPI();
  if (api?.getReportPreview) {
    return api.getReportPreview({ projectId });
  }
  throw new Error('Electron API unavailable: report preview requires SQLite backend.');
};
