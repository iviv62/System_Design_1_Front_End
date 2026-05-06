import { getBase } from "../http/api-base";
import { authStore } from "../../../store/auth-store";
import {
  fetchWithAuth,
  logoutWithServer,
  refreshAccessToken,
} from "../http/fetch-interceptor";

export type CurrentUser = {
  id?: string;
  username?: string;
  email?: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

export function getAccessToken(): string | null {
  return authStore.getState().accessToken;
}

export async function login(input: LoginInput): Promise<string> {
  const body = new URLSearchParams();
  // OAuth2 password flow expects the user identifier in `username`.
  body.append("username", input.identifier);
  body.append("password", input.password);
  body.append("grant_type", "password");

  const res = await fetchWithAuth(
    `${getBase()}/auth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    { skipAuth: true, retryOn401: false },
  );

  if (!res.ok) {
    throw new Error("Invalid email or password.");
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function register(input: RegisterInput): Promise<void> {
  const res = await fetchWithAuth(
    `${getBase()}/auth/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    { skipAuth: true, retryOn401: false },
  );

  if (!res.ok) {
    let message = "Registration failed.";
    try {
      const data = (await res.json()) as { detail?: string };
      message = data.detail ?? message;
    } catch {
      // Keep default message when response body is not JSON.
    }
    throw new Error(message);
  }
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetchWithAuth(`${getBase()}/auth/users/me`, { method: "GET" });

  if (!res.ok) {
    throw new Error("Unauthorized");
  }

  return (await res.json()) as CurrentUser;
}

export async function tryRefreshSession(): Promise<string | null> {
  return refreshAccessToken();
}

export async function logout(): Promise<void> {
  await logoutWithServer();
}
