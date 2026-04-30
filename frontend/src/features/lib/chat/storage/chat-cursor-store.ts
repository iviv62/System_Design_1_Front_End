import type { KeyValueStorage } from "../../../../shared/storage/key-value-storage";

export class ChatCursorStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  private key(room: string): string {
    return `chat_last_seen_${room}`;
  }

  getLastSeen(room: string): string | null {
    return this.storage.get(this.key(room));
  }

  setLastSeen(room: string, value: string): void {
    this.storage.set(this.key(room), value);
  }

  clearLastSeen(room: string): void {
    this.storage.remove(this.key(room));
  }
}