import { API_BASE_URL } from '@/config';
import { AuthSession, getSession, saveSession } from '@/services/token-storage';

const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  // 0 means the server could not be reached at all
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Called when the server rejects the saved token and it cannot be refreshed, so the app can sign the user out
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  // Set to false for requests that must not send the token (login, register)
  authenticated?: boolean;
};

// Only one refresh runs at a time: requests that fail together wait for the same refresh
let refreshInFlight: Promise<boolean> | null = null;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(0, 'Could not reach the server.');
  } finally {
    clearTimeout(timeout);
  }
}

async function send(
  path: string,
  method: 'GET' | 'POST',
  body: unknown,
  authenticated: boolean,
): Promise<{ response: Response; token: string | null }> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let token: string | null = null;
  if (authenticated) {
    const session = await getSession();
    if (session) {
      token = session.token;
      headers.Authorization = `Bearer ${session.token}`;
    }
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { response, token };
}

// Exchanges the saved refresh token for a new session.
// Returns false when there is no refresh token or the server rejected it.
// Throws ApiError(0) when the server could not be reached, so the user is not signed out by a network problem.
async function refreshSession(): Promise<boolean> {
  const session = await getSession();
  if (!session?.refreshToken) {
    return false;
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      return false;
    }
    throw new ApiError(response.status, await readProblemTitle(response));
  }

  await saveSession((await response.json()) as AuthSession);
  return true;
}

async function refreshAfterUnauthorized(failedToken: string | null): Promise<boolean> {
  // Another request may have already refreshed the session while this one was running
  const current = await getSession();
  if (current && current.token !== failedToken) {
    return true;
  }

  if (refreshInFlight === null) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, authenticated = true } = options;

  let { response, token } = await send(path, method, body, authenticated);

  // The access token was rejected: try once to get a new one and repeat the request
  if (response.status === 401 && authenticated) {
    const refreshed = await refreshAfterUnauthorized(token);
    if (refreshed) {
      ({ response, token } = await send(path, method, body, authenticated));
    }
  }

  if (!response.ok) {
    if (response.status === 401 && authenticated) {
      unauthorizedHandler?.();
    }
    throw new ApiError(response.status, await readProblemTitle(response));
  }

  // Empty successful response (204), for example after sign out
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// The API returns errors as "problem details" JSON with a "title" field
async function readProblemTitle(response: Response): Promise<string> {
  try {
    const problem = await response.json();
    if (typeof problem?.title === 'string') {
      return problem.title;
    }
  } catch {
    // The body was empty or not JSON
  }

  return `Request failed (${response.status}).`;
}