import { getApiBaseUrl } from "../chat/chat-config";
import { authStore } from "../../../store/auth-store";

type FetchWithAuthOptions = {
  skipAuth?: boolean;
  retryOn401?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;

function getBase(): string {
  return getApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_WS_BASE_URL,
  );
}

function applyAuthHeader(headersInit: HeadersInit | undefined): Headers {
  const headers = new Headers(headersInit);
  const token = authStore.getState().accessToken;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const res = await fetch(`${getBase()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      authStore.getState().logout();
      return null;
    }

    const data = (await res.json()) as { access_token?: string };
    const token = data.access_token ?? null;
    authStore.getState().setAccessToken(token);
    return token;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function logoutWithServer(): Promise<void> {
  try {
    await fetch(`${getBase()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    authStore.getState().logout();
  }
}

export async function fetchWithAuth(
  input: string,
  init: RequestInit = {},
  options: FetchWithAuthOptions = {},
): Promise<Response> {
  const { skipAuth = false, retryOn401 = true } = options;
  const headers = skipAuth ? new Headers(init.headers) : applyAuthHeader(init.headers);

  const requestInit: RequestInit = {
    ...init,
    headers,
    credentials: "include",
  };

  const res = await fetch(input, requestInit);

  if (res.status !== 401 || skipAuth || !retryOn401) {
    return res;
  }

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) {
    return res;
  }

  const retryHeaders = applyAuthHeader(init.headers);

  return fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: "include",
  });
}
