import { apiRequest } from '@/services/api-client';
import { AuthSession, saveSession } from '@/services/token-storage';

export async function login(email: string, password: string): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    authenticated: false,
  });

  await saveSession(session);
  return session;
}

export async function register(
  email: string,
  displayName: string,
  password: string,
): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/auth/register', {
    method: 'POST',
    body: { email, displayName, password },
    authenticated: false,
  });

  await saveSession(session);
  return session;
}

// Revokes the refresh token on the server
export async function logout(refreshToken: string): Promise<void> {
  await apiRequest<unknown>('/api/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    authenticated: false,
  });
}