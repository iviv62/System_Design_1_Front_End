import type { ChatMessage, UiMessage } from "../../../types/message";
import {
  extractAckEvent,
  extractChatMessage,
  extractPresenceUpdate,
  extractReactionUpdate,
  extractSystemText,
  extractTypingEvent,
  type PresenceUpdate,
  type ReactionUpdate,
  type TypingEvent,
  toSystemMessage,
  toUiMessage,
} from "./chat-message-adapter";
import { getApiBaseUrl, getSocketUrl } from "./chat-config";
import { updateConversationLastSeen } from "./chat-room-api";

export type Identity = { room: string; username: string; };
export type OutgoingChatPayload = { text: string; imageUrl?: string; };

export type ChatRoomControllerOptions = {
  apiBase: string | undefined;
  wsBase: string | undefined;
  pageProtocol: string;
  getToken?: () => string | null;
  onMessage: (message: UiMessage) => void;
  onConnected?: () => void;
  onPresenceChange?: (users: string[]) => void;
  onReactionUpdate?: (update: ReactionUpdate) => void;
  /** Raw voice WS event — forwarded directly to WebRTCAdapter.handleVoiceEvent() */
  onVoiceEvent?: (msg: Record<string, unknown>) => void;
  onTypingEvent?: (event: TypingEvent) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onReconnectChange: (isReconnecting: boolean) => void;
  /**
   * Called when an ack arrives for a pending message.
   * The host component should flip the message status to 'sent'
   * and replace the temporary clientId-based id with the real server id.
   */
  onMessageAck?: (clientMsgId: string, serverMsgId: string) => void;
  /**
   * Called when a message has not been acked within ACK_TIMEOUT_MS.
   * The host component should mark the message as 'failed'.
   */
  onMessageFailed?: (clientMsgId: string) => void;
};

const ACK_TIMEOUT_MS = 5_000;

/** Generate a lightweight unique id without depending on the `uuid` package. */
function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
  /** clientMsgId → failure timer handle */
  private readonly pendingAcks = new Map<string, ReturnType<typeof setTimeout>>();
  /**
   * Server ids we have already delivered to the UI via onMessageAck.
   * When the server broadcast of our own message arrives, we suppress it here
   * so the optimistic entry is not duplicated.
   */
  private readonly ackedServerIds = new Set<string>();

  constructor(options: ChatRoomControllerOptions) {
    this.options = options;
  }

  updateIdentity(identity: Identity): void {
    this.room = identity.room;
    this.username = identity.username;
    this.activeUsers.clear();
    if (this.username.trim()) this.activeUsers.add(this.username.trim());
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
    this.clearAllPendingAcks();
    this.ackedServerIds.clear();
    if (this.seenSyncTimer !== null) { clearTimeout(this.seenSyncTimer); this.seenSyncTimer = null; }
    if (this.reconnectTimer !== null) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.close();
    this.socket = null;
    this.reconnectAttempt = 0;
    this.setReconnectState(false);
  }

  /**
   * Send a chat message.
   * Returns the clientMsgId so the caller can create an optimistic UiMessage
   * with status='pending' before the ack arrives.
   */
  send(payload: string | OutgoingChatPayload): string | false {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;

    const clientMsgId = generateClientId();

    if (typeof payload === "string") {
      const text = payload.trim();
      if (!text) return false;
      this.socket.send(JSON.stringify({ text, client_msg_id: clientMsgId }));
    } else {
      const text = payload.text.trim();
      const imageUrl = payload.imageUrl?.trim();
      if (!text && !imageUrl) return false;
      const outgoing: { text: string; image_url?: string; client_msg_id: string } = {
        text,
        client_msg_id: clientMsgId,
      };
      if (imageUrl) outgoing.image_url = imageUrl;
      this.socket.send(JSON.stringify(outgoing));
    }

    // Arm failure timer — cleared when ack arrives
    const timer = setTimeout(() => {
      this.pendingAcks.delete(clientMsgId);
      this.options.onMessageFailed?.(clientMsgId);
    }, ACK_TIMEOUT_MS);
    this.pendingAcks.set(clientMsgId, timer);

    return clientMsgId;
  }

  /** Send any voice/screen WS signal. Called by WebRTCAdapter via onVoiceSignal. */
  sendRawSignal(payload: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  sendTyping(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "typing", event: "started", room: this.room, username: this.username,
      }));
    }
  }

  private clearAllPendingAcks(): void {
    for (const timer of this.pendingAcks.values()) clearTimeout(timer);
    this.pendingAcks.clear();
  }

  private handleAck(clientMsgId: string, serverMsgId: string): void {
    const timer = this.pendingAcks.get(clientMsgId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.pendingAcks.delete(clientMsgId);
    }
    // Register the real server id so we can drop the subsequent broadcast
    this.ackedServerIds.add(serverMsgId);
    this.options.onMessageAck?.(clientMsgId, serverMsgId);
  }

  private setReconnectState(isReconnecting: boolean): void {
    if (this.isReconnecting === isReconnecting) return;
    this.isReconnecting = isReconnecting;
    this.options.onReconnectChange(isReconnecting);
  }

  private emitPresence(): void { this.options.onPresenceChange?.(Array.from(this.activeUsers)); }

  private applyPresenceUpdate(update: PresenceUpdate): void {
    const room = update.room.trim();
    if (room && room !== this.room) return;
    if (update.kind === "snapshot") {
      this.activeUsers.clear();
      for (const user of update.users) this.activeUsers.add(user);
    } else if (update.kind === "user_joined") {
      if (update.username.trim()) this.activeUsers.add(update.username.trim());
    } else if (update.kind === "user_left") {
      if (update.username.trim()) this.activeUsers.delete(update.username.trim());
    }
    if (this.username.trim()) this.activeUsers.add(this.username.trim());
    this.emitPresence();
  }

  private getResolvedApiBaseUrl(): string { return getApiBaseUrl(this.options.apiBase, this.options.wsBase); }

  private getResolvedSocketUrl(): string {
    return getSocketUrl({
      configuredWsBase: this.options.wsBase,
      room: this.room,
      username: this.username,
      lastSeen: this.lastSeen,
      pageProtocol: this.options.pageProtocol,
      token: this.options.getToken?.(),
    });
  }

  private async loadHistory(): Promise<void> {
    this.options.onLoadingChange(true);
    try {
      const base = this.getResolvedApiBaseUrl();
      const res = await fetch(`${base}/conversations/${encodeURIComponent(this.room)}/messages?limit=50`);
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        for (const msg of data) this.options.onMessage(toUiMessage(msg));
      }
    } catch {
      // history unavailable — proceed to live connection
    } finally {
      this.options.onLoadingChange(false);
      if (!this.intentionalClose) this.connect();
    }
  }

  private connect(): void {
    this.intentionalClose = false;
    const url = this.getResolvedSocketUrl();
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      if (this.username.trim()) { this.activeUsers.add(this.username.trim()); this.emitPresence(); }
      this.options.onConnected?.();
      this.setReconnectState(false);
      this.reconnectAttempt = 0;
      this.options.onMessage(toSystemMessage(`Connected as ${this.username} to room "${this.room}"`));
    };

    this.socket.onmessage = (event: MessageEvent) => {
      let payload: unknown;
      try { payload = JSON.parse(String(event.data)); }
      catch { this.options.onMessage(toSystemMessage(String(event.data))); return; }

      // ─ ack: server confirmed our message was saved ────────────────────────────────
      const ack = extractAckEvent(payload);
      if (ack) {
        this.handleAck(ack.clientMsgId, ack.serverMsgId);
        return;
      }

      const presenceUpdate = extractPresenceUpdate(payload);
      if (presenceUpdate) { this.applyPresenceUpdate(presenceUpdate); }

      const reactionUpdate = extractReactionUpdate(payload);
      if (reactionUpdate) { this.options.onReactionUpdate?.(reactionUpdate); return; }

      // Route ALL voice events (including server_offer) to WebRTCAdapter
      if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        if (p['type'] === 'voice') {
          const room = String(p['room'] ?? '');
          if (!room || room === this.room) {
            this.options.onVoiceEvent?.(p);
          }
          return;
        }
      }

      const typingEvent = extractTypingEvent(payload);
      if (typingEvent) {
        if (!this.options.onTypingEvent) return;
        if (!typingEvent.room || typingEvent.room === this.room) this.options.onTypingEvent(typingEvent);
        return;
      }

      const systemText = extractSystemText(payload);
      if (systemText) { this.options.onMessage(toSystemMessage(systemText)); return; }

      const chatMessage = extractChatMessage(payload);
      if (!chatMessage) return;
      const uiMessage = toUiMessage(chatMessage);

      // ─ deduplication: drop the server broadcast of our own optimistic message.
      //   handleAck() registered the serverId synchronously before this frame can
      //   arrive, so this check is always reliable regardless of Lit render timing.
      if (this.ackedServerIds.has(uiMessage.id)) {
        this.ackedServerIds.delete(uiMessage.id);
        this.lastSeen = uiMessage.createdAt;
        this.scheduleSeenSync();
        return;
      }

      if (uiMessage.username.trim()) { this.activeUsers.add(uiMessage.username.trim()); this.emitPresence(); }
      this.lastSeen = uiMessage.createdAt;
      this.options.onMessage(uiMessage);
      this.scheduleSeenSync();
    };

    this.socket.onclose = (event: CloseEvent) => {
      if (this.intentionalClose) return;
      // Mark all in-flight messages as failed on disconnect
      this.clearAllPendingAcks();
      this.ackedServerIds.clear();
      if (!this.isReconnecting) {
        const details = event.reason ? `code=${event.code}, reason=${event.reason}` : `code=${event.code}`;
        this.options.onMessage(toSystemMessage(`Disconnected (${details})`));
      }
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {};
  }

  private scheduleReconnect(): void {
    this.setReconnectState(true);
    const baseDelay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000);
    const jitter = Math.random() * 0.2 * baseDelay;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) this.connect();
    }, baseDelay + jitter);
  }

  private scheduleSeenSync(): void {
    if (!this.lastSeen || this.lastSeen === this.lastSyncedSeen) return;
    if (this.seenSyncTimer !== null) clearTimeout(this.seenSyncTimer);
    this.seenSyncTimer = setTimeout(() => {
      this.seenSyncTimer = null;
      this.flushSeenToServer();
    }, 800);
  }

  private flushSeenToServer(): void {
    if (!this.lastSeen || this.lastSeen === this.lastSyncedSeen) return;
    const valueToSync = this.lastSeen;
    void updateConversationLastSeen(this.room, this.username, valueToSync)
      .then(() => { this.lastSyncedSeen = valueToSync; })
      .catch(() => {});
  }
}
