import { createStore } from "zustand/vanilla";

export type AuthState = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
};

function readInitialToken(): string | null {
  return localStorage.getItem("access_token");
}

function persistToken(token: string | null) {
  if (!token) {
    localStorage.removeItem("access_token");
    return;
  }
  localStorage.setItem("access_token", token);
}

export const authStore = createStore<AuthState>((set) => ({
  accessToken: readInitialToken(),

  setAccessToken: (token) => {
    persistToken(token);
    set({ accessToken: token });
  },

  logout: () => {
    persistToken(null);
    set({ accessToken: null });
  },
}));
