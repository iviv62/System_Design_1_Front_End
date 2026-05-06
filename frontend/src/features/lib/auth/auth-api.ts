import { getApiBaseUrl } from "../chat/chat-config";
import { authStore } from "../../../store/auth-store";

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

function getBase(): string {
  return getApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_WS_BASE_URL,
  );
}

export function getAccessToken(): string | null {
  return authStore.getState().accessToken;
}

export async function login(input: LoginInput): Promise<string> {
  const body = new URLSearchParams();
  // OAuth2 password flow expects the user identifier in `username`.
  body.append("username", input.identifier);
  body.append("password", input.password);
  body.append("grant_type", "password");

  const res = await fetch(`${getBase()}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error("Invalid email or password.");
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function register(input: RegisterInput): Promise<void> {
  const res = await fetch(`${getBase()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

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
  const token = getAccessToken();
  if (!token) {
    throw new Error("Missing access token");
  }

  const res = await fetch(`${getBase()}/auth/users/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Unauthorized");
  }

  return (await res.json()) as CurrentUser;
}
