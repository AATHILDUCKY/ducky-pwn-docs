
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface Evidence {
  id: string;
  type: 'image' | 'code' | 'text';
  content: string;
  caption: string;
}

export interface Issue {
  id: string;
  title: string;
  severity: Severity;
  affected: string;
  state: 'Open' | 'In Progress' | 'Fixed' | 'Draft' | 'Published' | 'QA' | 'Closed';
  isFixed: boolean;
  tags: string[];
  cvssScore: string;
  cvssVector: string;
  type: 'Internal' | 'External';
  description: string;
  solution: string;
  evidence: Evidence[];
  customFields: CustomField[];
  comments: Comment[];
  updatedAt: string;
}

export interface Note {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Node {
  id: string;
  name: string;
  type: 'folder' | 'host' | 'service';
  children?: Node[];
}

export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
}

export interface Methodology {
  id: string;
  name: string;
  tasks: Task[];
}

export interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface UserProfile {
  id: string;
  username: string;
  fullName?: string;
  role?: string;
  email?: string;
  avatarColor?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfileInput {
  username: string;
  fullName?: string;
  role?: string;
  email?: string;
  avatarColor?: string;
  avatarUrl?: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/**
 * Interface representing a project in the security framework.
 */
export interface Project {
  id: string;
  name: string;
  client: string;
  issueCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastUpdate: string;
  status: 'active' | 'archived';
  parentId?: string | null;
}
