import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { chatRoomStyles } from "../styles/chat-room.styles";
import type { ChatMessage } from "../types/message";

@customElement("chat-room")
export class ChatRoom extends LitElement {
  static styles = chatRoomStyles;

  @property()
  username = "Guest";

  @property()
  room = "general";

  @state()
  private messages: string[] = [];

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
  private seenLines = new Set<string>();

  private get lastSeenKey(): string {
    return `chat_last_seen_${this.room}`;
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
          const line = `${msg.username}: ${msg.text}`;
          this.seenLines.add(line);
          this.addMessage(line);
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
      const line = event.data as string;
      if (this.seenLines.has(line)) {
        this.seenLines.delete(line);
        return;
      }
      this.lastSeen = new Date().toISOString();
      localStorage.setItem(this.lastSeenKey, this.lastSeen);
      this.addMessage(line);
    };

    this.socket.onclose = (event: CloseEvent) => {
      if (this.intentionalClose) return;
      const details = event.reason
        ? `code=${event.code}, reason=${event.reason}`
        : `code=${event.code}`;
      this.addSystemMessage(`Disconnected (${details})`);
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

  private addMessage(msg: string) {
    this.messages = [...this.messages, msg];
  }

  private addSystemMessage(msg: string) {
    this.addMessage(`[system] ${msg}`);
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
            : this.messages.map((m) =>
                m.startsWith("[system]")
                  ? html`<div class="system">${m}</div>`
                  : html`<div>${m}</div>`,
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