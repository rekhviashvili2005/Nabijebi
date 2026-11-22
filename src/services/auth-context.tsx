import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { setUnauthorizedHandler } from '@/services/api-client';
import { login, logout, register } from '@/services/auth-api';
import { AuthSession, clearSession, getSession } from '@/services/token-storage';

type AuthContextValue = {
  session: AuthSession | null;
  // True while the saved session is being read when the app starts
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, displayName: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadValidSession(): Promise<AuthSession | null> {
  try {
    const stored = await getSession();
    if (stored === null) {
      return null;
    }

    // A session with a refresh token stays: the first request renews the expired access token
    if (stored.refreshToken) {
      return stored;
    }

    // A missing or unreadable expiry date counts as expired
    const expiresAt = new Date(stored.expiresAtUtc).getTime();
    if (!(expiresAt > Date.now())) {
      await clearSession();
      return null;
    }

    return stored;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadValidSession().then((stored) => {
      if (!cancelled) {
        setSession(stored);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setSession(await login(email, password));
  }, []);

  const signUp = useCallback(async (email: string, displayName: string, password: string) => {
    setSession(await register(email, displayName, password));
  }, []);

  const signOut = useCallback(async () => {
    const stored = await getSession().catch(() => null);

    await clearSession();
    setSession(null);

    // Revoke the refresh token on the server; a failure here must not block signing out
    if (stored?.refreshToken) {
      void logout(stored.refreshToken).catch(() => {});
    }
  }, []);

  // If the server rejects the token and it cannot be refreshed, sign out automatically
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo(
    () => ({ session, isLoading, signIn, signUp, signOut }),
    [session, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}