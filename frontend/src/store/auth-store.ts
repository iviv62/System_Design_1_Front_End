import { createStore } from "zustand/vanilla";

export type AuthState = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
};

export const authStore = createStore<AuthState>((set) => ({
  accessToken: null,

  setAccessToken: (token) => {
    set({ accessToken: token });
  },

  logout: () => {
    set({ accessToken: null });
  },
}));
