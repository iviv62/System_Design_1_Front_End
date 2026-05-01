import type { KeyValueStorage } from "./key-value-storage";

export class BrowserKeyValueStorage implements KeyValueStorage {
  get(key: string): string | null {
    return window.localStorage.getItem(key);
  }

  set(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  }

  remove(key: string): void {
    window.localStorage.removeItem(key);
  }
}

export const browserKeyValueStorage: KeyValueStorage = new BrowserKeyValueStorage();
