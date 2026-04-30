import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { chatRoomStyles } from "../styles/chat-room.styles";
import type { ChatMessage, UiMessage } from "../types/message";

@customElement("chat-room")
export class ChatRoom extends LitElement {
  static styles = chatRoomStyles;

  @property()
  username = "Guest";

  @property()
  room = "general";

  @state()
  private messages: UiMessage[] = [];

  @state()
  private inputValue = "";

  @state()
  private isLoadingHistory = true;

  @state()
  private isReconnecting = false;

  private socket: WebSocket | null = null;
  private lastSeen: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private seenMessageIds = new Set<string>();

  private get lastSeenKey(): string {
    return `chat_last_seen_${this.room}`;
  }

  private toUiMessage(msg: ChatMessage): UiMessage {
    return {
      id: msg.id,
      kind: "user",
      username: msg.username,
      text: msg.text,
      createdAt: msg.created_at,
    };
  }

  private toSystemMessage(text: string): UiMessage {
    return {
      id: `sys-${Date.now()}-${Math.random()}`,
      kind: "system",
      username: "",
      text,
      createdAt: new Date().toISOString(),
    };
  }

  private isChatMessage(payload: unknown): payload is ChatMessage {
    return (
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as ChatMessage).id === "string" &&
      typeof (payload as ChatMessage).room === "string" &&
      typeof (payload as ChatMessage).username === "string" &&
      typeof (payload as ChatMessage).text === "string" &&
      typeof (payload as ChatMessage).created_at === "string"
    );
  }

  private extractChatMessage(payload: unknown): ChatMessage | null {
    if (this.isChatMessage(payload)) {
      return payload;
    }

    if (typeof payload !== "object" || payload === null) {
      return null;
    }

    const wrapped = payload as {
      message?: unknown;
      data?: unknown;
      payload?: unknown;
    };

    if (this.isChatMessage(wrapped.message)) {
      return wrapped.message;
    }
    if (this.isChatMessage(wrapped.data)) {
      return wrapped.data;
    }
    if (this.isChatMessage(wrapped.payload)) {
      return wrapped.payload;
    }

    return null;
  }

  private isSystemEvent(payload: unknown): payload is { type: "system"; text: string } {
    return (
      typeof payload === "object" &&
      payload !== null &&
      (payload as { type?: unknown }).type === "system" &&
      typeof (payload as { text?: unknown }).text === "string"
    );
  }

  private extractSystemText(payload: unknown): string | null {
    if (this.isSystemEvent(payload)) {
      return payload.text;
    }

    if (typeof payload !== "object" || payload === null) {
      return null;
    }

    const event = payload as {
      type?: unknown;
      event?: unknown;
      text?: unknown;
      reason?: unknown;
      code?: unknown;
      detail?: unknown;
      message?: unknown;
    };

    if (event.type !== "system") {
      return null;
    }

    if (typeof event.text === "string") {
      return event.text;
    }

    if (typeof event.message === "string") {
      return event.message;
    }

    const eventName = typeof event.event === "string" ? event.event : "event";
    const code = typeof event.code === "number" ? `, code=${event.code}` : "";
    const reason = typeof event.reason === "string" && event.reason
      ? `, reason=${event.reason}`
      : "";
    const detail = typeof event.detail === "string" && event.detail
      ? `, detail=${event.detail}`
      : "";

    return `${eventName}${code}${reason}${detail}`;
  }

  private getApiBaseUrl(): string {
    const apiBase = import.meta.env.VITE_API_BASE_URL?.trim();
    if (apiBase) return apiBase.replace(/\/$/, "");

    const wsBase = import.meta.env.VITE_WS_BASE_URL?.trim();
    if (wsBase) {
      return wsBase
        .replace(/\/$/, "")
        .replace(/^wss:/, "https:")
        .replace(/^ws:/, "http:");
    }

    return "http://127.0.0.1:8000";
  }

  private getSocketUrl(): string {
    const lastSeenParam = this.lastSeen
      ? `&last_seen=${encodeURIComponent(this.lastSeen)}`
      : "";

    const configuredBase = import.meta.env.VITE_WS_BASE_URL?.trim();
    if (configuredBase) {
      const normalizedBase = configuredBase.replace(/\/$/, "");
      return `${normalizedBase}/ws/${encodeURIComponent(this.room)}?username=${encodeURIComponent(this.username)}${lastSeenParam}`;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//127.0.0.1:8000/ws/${encodeURIComponent(this.room)}?username=${encodeURIComponent(this.username)}${lastSeenParam}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.loadHistory();
  }

  disconnectedCallback(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    super.disconnectedCallback();
  }

  private async loadHistory(): Promise<void> {
    this.isLoadingHistory = true;

    const stored = localStorage.getItem(this.lastSeenKey);
    if (stored) this.lastSeen = stored;

    try {
      const base = this.getApiBaseUrl();
      const res = await fetch(
        `${base}/conversations/${encodeURIComponent(this.room)}/messages?limit=50`,
      );
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        for (const msg of data) {
          this.addMessage(this.toUiMessage(msg));
          if (!this.lastSeen || msg.created_at > this.lastSeen) {
            this.lastSeen = msg.created_at;
          }
        }
        if (this.lastSeen) {
          localStorage.setItem(this.lastSeenKey, this.lastSeen);
        }
      }
    } catch {
      // History unavailable — proceed to live connection
    } finally {
      this.isLoadingHistory = false;
      this.connect();
    }
  }

  private connect(): void {
    this.intentionalClose = false;
    const url = this.getSocketUrl();
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.isReconnecting = false;
      this.reconnectAttempt = 0;
      this.addSystemMessage(
        `Connected as ${this.username} to room "${this.room}"`,
      );
    };

    this.socket.onmessage = (event: MessageEvent) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        // Fallback to plain text for transitional servers.
        this.addSystemMessage(String(event.data));
        return;
      }

      const systemText = this.extractSystemText(payload);
      if (systemText) {
        this.addSystemMessage(systemText);
        return;
      }

      const chatMessage = this.extractChatMessage(payload);
      if (!chatMessage) {
        return;
      }

      const uiMessage = this.toUiMessage(chatMessage);
      this.lastSeen = uiMessage.createdAt;
      localStorage.setItem(this.lastSeenKey, this.lastSeen);
      this.addMessage(uiMessage);
    };

    this.socket.onclose = (event: CloseEvent) => {
      if (this.intentionalClose) return;
      if (!this.isReconnecting) {
        const details = event.reason
          ? `code=${event.code}, reason=${event.reason}`
          : `code=${event.code}`;
        this.addSystemMessage(`Disconnected (${details})`);
      }
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      // onclose fires after onerror; reconnect is handled there
    };
  }

  private scheduleReconnect(): void {
    this.isReconnecting = true;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  updated() {
    const el = this.shadowRoot?.querySelector(".messages");
    if (el) el.scrollTop = el.scrollHeight;
  }

  private addMessage(msg: UiMessage) {
    if (msg.kind === "user") {
      if (this.seenMessageIds.has(msg.id)) return;
      this.seenMessageIds.add(msg.id);
    }
    this.messages = [...this.messages, msg];
  }

  private addSystemMessage(msg: string) {
    this.addMessage(this.toSystemMessage(msg));
  }

  private handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const trimmed = this.inputValue.trim();
    if (!trimmed) return;

    this.socket.send(trimmed);
    this.inputValue = "";
  }

  render() {
    return html`
      ${this.isReconnecting
        ? html`<div class="reconnecting-banner">Reconnecting…</div>`
        : nothing}
      <div class="messages">
        ${this.isLoadingHistory
          ? html`<div class="loading">Loading history…</div>`
          : this.messages.length === 0
            ? html`<div class="empty-state">No messages yet. Say hello!</div>`
            : repeat(
                this.messages,
                (m) => m.id,
                (m) =>
                  m.kind === "system"
                    ? html`<div class="system">[system] ${m.text}</div>`
                    : html`<div>${m.username}: ${m.text}</div>`,
              )}
      </div>
      <form @submit=${this.handleSubmit}>
        <input
          type="text"
          placeholder="Type a message…"
          .value=${this.inputValue}
          @input=${(e: Event) =>
            (this.inputValue = (e.target as HTMLInputElement).value)}
        />
        <button type="submit">Send</button>
      </form>
    `;
  }
}