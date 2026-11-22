import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'auth_session';

export type AuthSession = {
  token: string;
  expiresAtUtc: string;
  userId: string;
  email: string;
  displayName: string;
  // Optional: sessions saved by older app versions do not have it
  refreshToken?: string;
};

export async function saveSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}