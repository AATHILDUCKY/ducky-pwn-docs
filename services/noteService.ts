import type { Note } from '../types';

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const fetchNotes = async (projectId: string): Promise<Note[]> => {
  if (!projectId) return [];
  const api = electronAPI();
  if (api?.getNotes) {
    return api.getNotes(projectId);
  }
  return [];
};

export const saveNote = async (projectId: string, note: Note): Promise<Note | null> => {
  if (!projectId || !note) return null;
  const api = electronAPI();
  if (api?.saveNote) {
    return api.saveNote(projectId, note);
  }
  return note;
};

export const deleteNote = async (projectId: string, noteId: string): Promise<void> => {
  if (!projectId || !noteId) return;
  const api = electronAPI();
  if (api?.deleteNote) {
    await api.deleteNote(projectId, noteId);
    return;
  }
  return;
};
