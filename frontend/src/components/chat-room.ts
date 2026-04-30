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

    if (changedProperties.has("messages")) {
      const el = this.shadowRoot?.querySelector(".chat-room__messages");
      if (el) el.scrollTop = el.scrollHeight;
    }
  }

  private addMessage(msg: UiMessage) {
    if (msg.kind === "user") {
      if (this.seenMessageIds.has(msg.id)) return;
      this.seenMessageIds.add(msg.id);
    }
    this.messages = [...this.messages, msg];
  }

  private formatTime(isoString: string): string {
    // If the backend sends a naive UTC datetime (without 'Z' or offset),
    // JS will parse it as local time. By appending 'Z', we ensure it's treated as UTC.
    const normalizedIso = isoString.endsWith("Z") || isoString.includes("+") || isoString.includes("-") && isoString.lastIndexOf("-") > 10
      ? isoString
      : `${isoString}Z`;
      
    return new Date(normalizedIso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
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
      <section class="chat-room">
        <header class="chat-room__header">
          <h2 class="chat-room__title">Room: ${this.room}</h2>
          <p class="chat-room__meta">Logged in as ${this.username}</p>
        </header>

        ${this.isReconnecting
          ? html`<div class="chat-room__banner">Reconnecting…</div>`
          : nothing}

        <div class="chat-room__messages">
          ${this.isLoadingHistory
            ? html`<div class="message message--system">Loading history…</div>`
            : this.messages.length === 0
              ? html`<div class="message message--system">No messages yet. Say hello!</div>`
              : repeat(
                  this.messages,
                  (m) => m.id,
                  (m) =>
                    m.kind === "system"
                      ? html`<div class="message message--system">${m.text}</div>`
                      : html`
                          <article
                            class="message message--user ${m.username === this.username ? "message--self" : ""}"
                          >
                            <div class="message__author">${m.username}</div>
                            <div class="message__body">${m.text}</div>
                            <div class="message__time">${this.formatTime(m.createdAt)}</div>
                          </article>
                        `,
                )}
        </div>

        <form class="chat-room__composer" @submit=${this.handleSubmit}>
          <input
            class="chat-room__input"
            type="text"
            placeholder="Type a message…"
            .value=${this.inputValue}
            @input=${(e: Event) =>
              (this.inputValue = (e.target as HTMLInputElement).value)}
          />
          <button class="chat-room__send" type="submit" ?disabled=${!this.inputValue.trim()}>Send</button>
        </form>
      </section>
    `;
  }
}