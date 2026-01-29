import type { UserProfile, UserProfileInput } from '../types';

const electronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const fetchUserProfile = async (): Promise<UserProfile | null> => {
  const api = electronAPI();
  if (api?.getUserProfile) {
    return api.getUserProfile();
  }
  throw new Error('Electron API unavailable: user profile requires SQLite backend.');
};

export const createUserProfile = async (input: UserProfileInput): Promise<UserProfile | null> => {
  const api = electronAPI();
  if (api?.createUserProfile) {
    return api.createUserProfile({ id: `u-${Date.now()}`, ...input });
  }
  throw new Error('Electron API unavailable: user profile requires SQLite backend.');
};

export const updateUserProfile = async (input: UserProfile & UserProfileInput): Promise<UserProfile | null> => {
  const api = electronAPI();
  if (api?.updateUserProfile) {
    return api.updateUserProfile(input);
  }
  throw new Error('Electron API unavailable: user profile requires SQLite backend.');
};
