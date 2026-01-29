import type { Issue, Project, Methodology, Task, UserProfile, UserProfileInput, Note } from './types';

declare global {
  interface Window {
    electronAPI?: {
      getProjects: () => Promise<Project[]>;
      createProject: (payload: { id: string; name: string; client: string }) => Promise<Project>;
      createSubProject: (payload: { id: string; name: string; client: string; parentId: string }) => Promise<Project | null>;
      deleteProject: (id: string) => Promise<void>;
      getIssues: (projectId: string) => Promise<Issue[]>;
      saveIssue: (projectId: string, issue: Issue) => Promise<void>;
      deleteIssue: (projectId: string, issueId: string) => Promise<void>;
      getMethodologies: () => Promise<Methodology[]>;
      createMethodology: (payload: { id: string; name: string }) => Promise<Methodology | null>;
      createMethodologyTask: (payload: { id: string; methodologyId: string; title: string; status?: Task['status'] }) => Promise<Task | null>;
      updateMethodologyTask: (payload: { id: string; status?: Task['status']; title?: string }) => Promise<{ id: string; status?: Task['status']; title?: string } | null>;
      updateMethodology: (payload: { id: string; name: string }) => Promise<{ id: string; name: string } | null>;
      deleteMethodology: (id: string) => Promise<void>;
      deleteMethodologyTask: (id: string) => Promise<void>;
      getUserProfile: () => Promise<UserProfile | null>;
      createUserProfile: (payload: UserProfileInput) => Promise<UserProfile | null>;
      updateUserProfile: (payload: UserProfileInput & { id: string }) => Promise<UserProfile | null>;
      getNotes: (projectId: string) => Promise<Note[]>;
      saveNote: (projectId: string, note: Note) => Promise<Note | null>;
      deleteNote: (projectId: string, noteId: string) => Promise<void>;
      generateReport: (payload: { projectId: string; format: 'pdf' | 'html' | 'docx' }) => Promise<{ path: string } | null>;
      getReportPreview: (payload: { projectId: string }) => Promise<{ html?: string; error?: string }>;
      getSmtpSettings: () => Promise<{ host: string; port: number; user: string; pass: string; from: string } | null>;
      saveSmtpSettings: (payload: { host: string; port: number; user: string; pass: string; from: string }) => Promise<{ host: string; port: number; user: string; pass: string; from: string } | null>;
      getEmailHistory: (payload: { limit?: number; offset?: number }) => Promise<Array<{
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
      }>>;
      sendIssueReportEmail: (payload: { projectId: string; issueId: string; to: string; subject?: string; message?: string; format?: 'pdf' | 'html' | 'docx' }) => Promise<{ ok?: boolean; error?: string }>;
      sendProjectReportEmail: (payload: { projectId: string; to: string; subject?: string; message?: string; format?: 'pdf' | 'html' | 'docx' }) => Promise<{ ok?: boolean; error?: string }>;
      selectMedia: (mediaType: 'image' | 'video') => Promise<{ url: string; name: string } | null>;
    };
  }
}

export {};
