import type { ChatMessage, UiMessage } from "../../../types/message";
import {
  extractChatMessage,
  extractSystemText,
  toSystemMessage,
  toUiMessage,
} from "./chat-message-adapter";
import { getApiBaseUrl, getSocketUrl } from "./chat-config";
import type { ChatCursorStore } from "./storage/chat-cursor-store";

export type Identity = {
  room: string;
  username: string;
};

export type ChatRoomControllerOptions = {
  apiBase: string | undefined;
  wsBase: string | undefined;
  pageProtocol: string;
  cursorStore: ChatCursorStore;
  onMessage: (message: UiMessage) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onReconnectChange: (isReconnecting: boolean) => void;
};

export class ChatRoomController {
  private socket: WebSocket | null = null;
  private lastSeen: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private isReconnecting = false;
  private started = false;
  private room = "general";
  private username = "Guest";
  private readonly options: ChatRoomControllerOptions;

  constructor(options: ChatRoomControllerOptions) {
    this.options = options;
  }

  updateIdentity(identity: Identity): void {
    this.room = identity.room;
    this.username = identity.username;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.intentionalClose = false;
    this.loadHistory();
  }

  stop(): void {
    this.started = false;
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    this.socket = null;
    this.reconnectAttempt = 0;
    this.setReconnectState(false);
  }

  send(text: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(text);
    return true;
  }

  private setReconnectState(isReconnecting: boolean): void {
    if (this.isReconnecting === isReconnecting) return;
    this.isReconnecting = isReconnecting;
    this.options.onReconnectChange(isReconnecting);
  }

  private getResolvedApiBaseUrl(): string {
    return getApiBaseUrl(this.options.apiBase, this.options.wsBase);
  }

  private getResolvedSocketUrl(): string {
    return getSocketUrl({
      configuredWsBase: this.options.wsBase,
      room: this.room,
      username: this.username,
      lastSeen: this.lastSeen,
      pageProtocol: this.options.pageProtocol,
    });
  }

  private async loadHistory(): Promise<void> {
    this.options.onLoadingChange(true);

    const stored = this.options.cursorStore.getLastSeen(this.room);
    if (stored) this.lastSeen = stored;

    try {
      const base = this.getResolvedApiBaseUrl();
      const res = await fetch(
        `${base}/conversations/${encodeURIComponent(this.room)}/messages?limit=50`,
      );
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        for (const msg of data) {
          this.options.onMessage(toUiMessage(msg));
          if (!this.lastSeen || msg.created_at > this.lastSeen) {
            this.lastSeen = msg.created_at;
          }
        }
        if (this.lastSeen) {
          this.options.cursorStore.setLastSeen(this.room, this.lastSeen);
        }
      }
    } catch {
      // History unavailable &mdash; proceed to live connection
    } finally {
      this.options.onLoadingChange(false);
      if (!this.intentionalClose) {
        this.connect();
      }
    }
  }

  private connect(): void {
    this.intentionalClose = false;
    const url = this.getResolvedSocketUrl();
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.setReconnectState(false);
      this.reconnectAttempt = 0;
      this.options.onMessage(
        toSystemMessage(`Connected as ${this.username} to room "${this.room}"`)
      );
    };

    this.socket.onmessage = (event: MessageEvent) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        // Fallback to plain text for transitional servers.
        this.options.onMessage(toSystemMessage(String(event.data)));
        return;
      }

      const systemText = extractSystemText(payload);
      if (systemText) {
        this.options.onMessage(toSystemMessage(systemText));
        return;
      }

      const chatMessage = extractChatMessage(payload);
      if (!chatMessage) {
        return;
      }

      const uiMessage = toUiMessage(chatMessage);
      this.lastSeen = uiMessage.createdAt;
      this.options.cursorStore.setLastSeen(this.room, this.lastSeen);
      this.options.onMessage(uiMessage);
    };

    this.socket.onclose = (event: CloseEvent) => {
      if (this.intentionalClose) return;
      if (!this.isReconnecting) {
        const details = event.reason
          ? `code=${event.code}, reason=${event.reason}`
          : `code=${event.code}`;
        this.options.onMessage(toSystemMessage(`Disconnected (${details})`));
      }
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      // onclose fires after onerror; reconnect is handled there
    };
  }

  private scheduleReconnect(): void {
    this.setReconnectState(true);
    const baseDelay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000);
    const jitter = Math.random() * 0.2 * baseDelay;
    const delay = baseDelay + jitter;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) {
        this.connect();
      }
    }, delay);
  }
}
