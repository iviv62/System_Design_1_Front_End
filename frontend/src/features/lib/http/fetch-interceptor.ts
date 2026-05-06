import { getBase } from "./api-base";
import { authStore } from "../../../store/auth-store";

type FetchWithAuthOptions = {
  skipAuth?: boolean;
  retryOn401?: boolean;
};

// Acts as a lock/singleton to prevent multiple simultaneous refresh requests
// if several API calls fail with a 401 at the exact same time.
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Injects the in-memory Access Token into the request headers.
 * Protects against CSRF because attackers cannot force the browser to attach custom headers.
 */
function applyAuthHeader(headersInit: HeadersInit | undefined): Headers {
  const headers = new Headers(headersInit);
  const token = authStore.getState().accessToken; // Pull token directly from Zustand
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

/**
 * Attempts to get a new Access Token using the HttpOnly Refresh Token cookie.
 */
export async function refreshAccessToken(): Promise<string | null> {
  // 1. "Thundering Herd" Protection: If a refresh is already happening, 
  // just wait for that one to finish instead of firing a second request.
  if (refreshInFlight) {
    return refreshInFlight;
  }

  // 2. Start the refresh process and save the Promise into the lock variable
  refreshInFlight = (async () => {
    const res = await fetch(`${getBase()}/auth/refresh`, {
      method: "POST",
      // 'include' is required so the browser automatically sends the HttpOnly refresh cookie
      credentials: "include", 
    });

    // If the refresh endpoint fails (e.g., refresh token expired or tampered with),
    // force a complete logout on the frontend.
    if (!res.ok) {
      authStore.getState().logout();
      return null;
    }

    // Parse the new short-lived access token and save it into the Zustand store memory
    const data = (await res.json()) as { access_token?: string };
    const token = data.access_token ?? null;
    authStore.getState().setAccessToken(token);
    
    return token;
  })().finally(() => {
    // 3. Cleanup: Once the request resolves or fails, release the lock.
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Hits the backend to invalidate/delete the HttpOnly refresh cookie, 
 * then wipes the local Zustand state.
 */
export async function logoutWithServer(): Promise<void> {
  try {
    await fetch(`${getBase()}/auth/logout`, {
      method: "POST",
      credentials: "include", // Ensures the server knows which cookie session to invalidate
    });
  } finally {
    // Ensure local state is wiped even if the network request drops
    authStore.getState().logout();
  }
}

/**
 * A wrapper around the native browser fetch(). 
 * Automatically attaches the Bearer token and handles transparent retries on 401 Expirations.
 */
export async function fetchWithAuth(
  input: string,
  init: RequestInit = {},
  options: FetchWithAuthOptions = {},
): Promise<Response> {
  const { skipAuth = false, retryOn401 = true } = options;
  
  // Attach the current access token to the headers
  const headers = skipAuth ? new Headers(init.headers) : applyAuthHeader(init.headers);

  const requestInit: RequestInit = {
    ...init,
    headers,
    credentials: "include",
  };

  // 1. Attempt the initial request
  const res = await fetch(input, requestInit);

  // 2. If it succeeds, or if it's an expected failure (not a 401), return the response immediately.
  if (res.status !== 401 || skipAuth || !retryOn401) {
    return res;
  }

  // 3. We hit a 401 Unauthorized. The access token is likely expired.
  // Pause the current flow to fetch a new token in the background.
  const refreshedToken = await refreshAccessToken();
  
  // If the refresh failed, we can't retry. Return the original 401 response.
  if (!refreshedToken) {
    return res;
  }

  // 4. Refresh succeeded! Grab the newly generated token.
  const retryHeaders = applyAuthHeader(init.headers);

  // 5. Transparently retry the original request with the fresh token.
  // The UI/User will not notice the request failed the first time.
  return fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: "include",
  });
}