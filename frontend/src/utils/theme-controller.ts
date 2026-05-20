import type { ReactiveControllerHost } from "lit";
import { browserKeyValueStorage } from "../shared/storage/browser-key-value-storage";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

export class ThemeController {
  private host: ReactiveControllerHost;
  private _handleThemeChange: EventListener;

  theme: ThemeMode = ThemeController.get();

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    this._handleThemeChange = () => {
      this.theme = ThemeController.get();
      if (this.host instanceof HTMLElement) {
        this.host.setAttribute("data-theme", this.theme);
      }
      this.host.requestUpdate();
    };
    host.addController(this);
  }

  hostConnected() {
    window.addEventListener("theme-changed", this._handleThemeChange);
    // sync in case it changed before connection
    this.theme = ThemeController.get();
    if (this.host instanceof HTMLElement) {
      this.host.setAttribute("data-theme", this.theme);
    }
  }

  hostDisconnected() {
    window.removeEventListener("theme-changed", this._handleThemeChange);
  }

  static set(theme: ThemeMode) {
    browserKeyValueStorage.set(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    window.dispatchEvent(new Event("theme-changed"));
  }

  static get(): ThemeMode {
    const stored = browserKeyValueStorage.get(THEME_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  }
}
