import type { ChatMessage, UiMessage } from "../../../types/message";
import {
  extractChatMessage,
  extractPresenceUpdate,
  extractReactionUpdate,
  extractSystemText,
  extractVoiceEvent,
  extractTypingEvent,
  type PresenceUpdate,
  type ReactionUpdate,
  type VoiceEvent,
  type TypingEvent,
  toSystemMessage,
  toUiMessage,
} from "./chat-message-adapter";
import { getApiBaseUrl, getSocketUrl } from "./chat-config";
import { fetchWithAuth } from "../http/fetch-interceptor";
import { updateConversationLastSeen } from "./chat-room-api";

export type Identity = { room: string; username: string; };
export type OutgoingChatPayload = { text: string; imageUrl?: string; };

export type ChatRoomControllerOptions = {
  apiBase: string | undefined;
  wsBase: string | undefined;
  pageProtocol: string;
  onMessage: (message: UiMessage) => void;
  onConnected?: () => void;
  onPresenceChange?: (users: string[]) => void;
  onReactionUpdate?: (update: ReactionUpdate) => void;
  onVoiceEvent?: (event: VoiceEvent) => void;
  onTypingEvent?: (event: TypingEvent) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onReconnectChange: (isReconnecting: boolean) => void;
  /** Called when the server sends a renegotiation offer; must return the SDP answer. */
  onServerOffer?: (peerId: string, sdp: string, sdpType: RTCSdpType) => Promise<{ sdp: string; type: RTCSdpType }>;
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
    if (this.seenSyncTimer !== null) { clearTimeout(this.seenSyncTimer); this.seenSyncTimer = null; }
    if (this.reconnectTimer !== null) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.close();
    this.socket = null;
    this.reconnectAttempt = 0;
    this.setReconnectState(false);
  }

  send(payload: string | OutgoingChatPayload): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    if (typeof payload === "string") {
      const text = payload.trim();
      if (!text) return false;
      this.socket.send(JSON.stringify({ text }));
      return true;
    }
    const text = payload.text.trim();
    const imageUrl = payload.imageUrl?.trim();
    if (!text && !imageUrl) return false;
    const outgoing: { text: string; image_url?: string } = { text };
    if (imageUrl) outgoing.image_url = imageUrl;
    this.socket.send(JSON.stringify(outgoing));
    return true;
  }

  sendVoiceSignal(payload: {
    type: "voice";
    event: string;
    room: string;
    username?: string;
    candidate?: RTCIceCandidateInit;
    to?: string;
    sdp?: string;
    peer_id?: string;
    [key: string]: unknown;
  }): void {
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
    });
  }

  private async loadHistory(): Promise<void> {
    this.options.onLoadingChange(true);
    try {
      const base = this.getResolvedApiBaseUrl();
      const res = await fetchWithAuth(`${base}/conversations/${encodeURIComponent(this.room)}/messages?limit=50`);
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

      const presenceUpdate = extractPresenceUpdate(payload);
      if (presenceUpdate) { this.applyPresenceUpdate(presenceUpdate); }

      const reactionUpdate = extractReactionUpdate(payload);
      if (reactionUpdate) { this.options.onReactionUpdate?.(reactionUpdate); return; }

      const voiceEvent = extractVoiceEvent(payload);
      if (voiceEvent) {
        if (!this.options.onVoiceEvent) return;

        // server_offer: apply → POST answer back via HTTP
     