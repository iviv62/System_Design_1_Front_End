import type { ChatMessage, UiMessage } from "../../../types/message";
import {
  extractChatMessage,
  extractPresenceUpdate,
  extractReactionUpdate,
  extractSystemText,
  type PresenceUpdate,
  type ReactionUpdate,
  toSystemMessage,
  toUiMessage,
} from "./chat-message-adapter";
import { getApiBaseUrl, getSocketUrl } from "./chat-config";
import { fetchWithAuth } from "../http/fetch-interceptor";
import { updateConversationLastSeen } from "./chat-room-api";

export type Identity = {
  room: string;
  username: string;
};

export type OutgoingChatPayload = {
  text: string;
  imageUrl?: string;
};

export type ChatRoomControllerOptions = {
  apiBase: string | undefined;
  wsBase: string | undefined;
  pageProtocol: string;
  onMessage: (message: UiMessage) => void;
  onConnected?: () => void;
  onPresenceChange?: (users: string[]) => void;
  onReactionUpdate?: (update: ReactionUpdate) => void;
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
  private seenSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncedSeen: string | null = null;
  private readonly activeUsers = new Set<string>();
  private readonly options: ChatRoomControllerOptions;

  constructor(options: ChatRoomControllerOptions) {
    this.options = options;
  }

  updateIdentity(identity: Identity): void {
    this.room = identity.room;
    this.username = identity.username;
    this.activeUsers.clear();
    if (this.username.trim()) {
      this.activeUsers.add(this.username.trim());
    }
    this.emitPresence();
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
    this.flushSeenToServer();
    if (this.seenSyncTimer !== null) {
      clearTimeout(this.seenSyncTimer);
      this.seenSyncTimer = null;
    }
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

  send(payload: string | OutgoingChatPayload): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    if (typeof payload === "string") {
      const text = payload.trim();
      if (!text) return false;
      this.socket.send(JSON.stringify({ text }));
      return true;
    }

    const text = payload.text.trim();
    const imageUrl = payload.imageUrl?.trim();
    if (!text && !imageUrl) {
      return false;
    }

    const outgoing: { text: string; image_url?: string } = { text };
    if (imageUrl) {
      outgoing.image_url = imageUrl;
    }

    this.socket.send(JSON.stringify(outgoing));
    return true;
  }

  private setReconnectState(isReconnecting: boolean): void {
    if (this.isReconnecting === isReconnecting) return;
    this.isReconnecting = isReconnecting;
    this.options.onReconnectChange(isReconnecting);
  }

  private emitPresence(): void {
    this.options.onPresenceChange?.(Array.from(this.activeUsers));
  }

  private applyPresenceUpdate(update: PresenceUpdate): void {
    if (update.kind === "snapshot") {
      const room = update.room.trim();
      if (room && room !== this.room) {
        return;
      }

      this.activeUsers.clear();
      for (const user of update.users) {
        this.activeUsers.add(user);
      }
    }

    if (this.username.trim()) {
      this.activeUsers.add(this.username.trim());
    }
    this.emitPresence();
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

    try {
      const base = this.getResolvedApiBaseUrl();
      const res = await fetchWithAuth(
        `${base}/conversations/${encodeURIComponent(this.room)}/messages?limit=50`,
      );
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        for (const msg of data) {
          this.options.onMessage(toUiMessage(msg));
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
      if (this.username.trim()) {
        this.activeUsers.add(this.username.trim());
        this.emitPresence();
      }
      this.options.onConnected?.();
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

      const presenceUpdate = extractPresenceUpdate(payload);
      if (presenceUpdate) {
        this.applyPresenceUpdate(presenceUpdate);
      }

      const reactionUpdate = extractReactionUpdate(payload);
      if (reactionUpdate) {
        this.options.onReactionUpdate?.(reactionUpdate);
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
      if (uiMessage.username.trim()) {
        this.activeUsers.add(uiMessage.username.trim());
        this.emitPresence();
      }
      this.lastSeen = uiMessage.createdAt;
      this.options.onMessage(uiMessage);
      this.scheduleSeenSync();
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

  private scheduleSeenSync(): void {
    if (!this.lastSeen || this.lastSeen === this.lastSyncedSeen) return;
    if (this.seenSyncTimer !== null) {
      clearTimeout(this.seenSyncTimer);
    }

    // Throttle to avoid posting on every message burst.
    this.seenSyncTimer = setTimeout(() => {
      this.seenSyncTimer = null;
      this.flushSeenToServer();
    }, 800);
  }

  private flushSeenToServer(): void {
    if (!this.lastSeen || this.lastSeen === this.lastSyncedSeen) return;

    const valueToSync = this.lastSeen;
    void updateConversationLastSeen(this.room, this.username, valueToSync)
      .then(() => {
        this.lastSyncedSeen = valueToSync;
      })
      .catch(() => {
        // Best-effort only: chat flow should not fail if this endpoint is absent.
      });
  }
}
