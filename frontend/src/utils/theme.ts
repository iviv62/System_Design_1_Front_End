export type ThemeMode = "light" | "dark";

import { browserKeyValueStorage } from "../shared/storage/browser-key-value-storage";

const THEME_STORAGE_KEY = "theme";

export function setTheme(theme: ThemeMode) {
  browserKeyValueStorage.set(THEME_STORAGE_KEY, theme);
  document.body.setAttribute("data-theme", theme);
}

export function getTheme(): ThemeMode {
  const stored = browserKeyValueStorage.get(THEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}
