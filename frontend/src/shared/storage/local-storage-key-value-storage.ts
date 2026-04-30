import type { KeyValueStorage } from "./key-value-storage";

export type LocalStorageKeyValueStorageOptions = {
  prefix?: string;
};

export class LocalStorageKeyValueStorage implements KeyValueStorage {
  private readonly storage: Storage;
  private readonly options: LocalStorageKeyValueStorageOptions;

  constructor(
    storage: Storage,
    options: LocalStorageKeyValueStorageOptions = {},
  ) {
    this.storage = storage;
    this.options = options;
  }

  private buildKey(key: string): string {
    const prefix = this.options.prefix?.trim();
    return prefix ? `${prefix}:${key}` : key;
  }

  get(key: string): string | null {
    return this.storage.getItem(this.buildKey(key));
  }

  set(key: string, value: string): void {
    this.storage.setItem(this.buildKey(key), value);
  }

  remove(key: string): void {
    this.storage.removeItem(this.buildKey(key));
  }
}