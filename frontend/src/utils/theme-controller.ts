import type { ReactiveControllerHost } from "lit";
import { browserKeyValueStorage } from "../shared/storage/browser-key-value-storage";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

export class ThemeController {
  private host: ReactiveControllerHost;
  private _observer: MutationObserver | null = null;

  theme: ThemeMode = ThemeController.get();

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected() {
    this._observer = new MutationObserver(() => {
    this.theme = ThemeController.get();
      this.host.requestUpdate();
    });
    this._observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  hostDisconnected() {
    this._observer?.disconnect();
    this._observer = null;
  }

  static set(theme: ThemeMode) {
    browserKeyValueStorage.set(THEME_STORAGE_KEY, theme);
    document.body.setAttribute("data-theme", theme);
  }

  static get(): ThemeMode {
    const stored = browserKeyValueStorage.get(THEME_STORAGE_KEY);
    return stored === "dark" ? "dark" : "light";
  }
}
