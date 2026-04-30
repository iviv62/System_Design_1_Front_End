import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { chatRoomStyles } from "../styles/chat-room.styles";
import type { UiMessage } from "../types/message";
import { ChatRoomController } from "../features/lib/chat/chat-room-controller";
import { LocalStorageKeyValueStorage } from "../shared/storage/local-storage-key-value-storage";
import { ChatCursorStore } from "../features/lib/chat/storage/chat-cursor-store";

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

  private seenMessageIds = new Set<string>();
  private controller: ChatRoomController;

  constructor() {
    super();

    const keyValueStorage = new LocalStorageKeyValueStorage(localStorage, {
      prefix: "my-app",
    });

    const cursorStore = new ChatCursorStore(keyValueStorage);

    this.controller = new ChatRoomController({
      apiBase: import.meta.env.VITE_API_BASE_URL,
      wsBase: import.meta.env.VITE_WS_BASE_URL,
      pageProtocol: window.location.protocol,
      cursorStore,
      onMessage: (message) => this.addMessage(message),
      onLoadingChange: (isLoading) => (this.isLoadingHistory = isLoading),
      onReconnectChange: (isReconnecting) => (this.isReconnecting = isReconnecting),
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.controller.updateIdentity({ room: this.room, username: this.username });
    this.controller.start();
  }

  disconnectedCallback(): void {
    this.controller.stop();
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has("room") || changedProperties.has("username")) {
      this.controller.updateIdentity({ room: this.room, username: this.username });
    }

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

  private handleSubmit(e: Event) {
    e.preventDefault();
    const trimmed = this.inputValue.trim();
    if (!trimmed) return;

    if (this.controller.send(trimmed)) {
      this.inputValue = "";
    }
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