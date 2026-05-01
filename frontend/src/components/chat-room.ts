import { LitElement, html, nothing, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import chatRoomStylesRaw from "../styles/chat-room.styles.scss?inline";
import type { UiMessage } from "../types/message";
import { ChatRoomController } from "../features/lib/chat/chat-room-controller";
import { fetchUnreadCount } from "../features/lib/chat/chat-room-api";
import "./unread-divider"; // registers <unread-divider>

@customElement("chat-room")
export class ChatRoom extends LitElement {
  static styles = unsafeCSS(chatRoomStylesRaw);

  @property()
  username = "Guest";

  @property()
  roomId = "general";

  @property()
  roomName = "general";

  @state()
  private messages: UiMessage[] = [];

  @state()
  private inputValue = "";

  @state()
  private isLoadingHistory = true;

  @state()
  private isReconnecting = false;

  @state()
  private theme: "light" | "dark" = "light";

  @state()
  private unreadAnchorMessageId: string | null = null;

  @state()
  private hasUnseenMessages = false;

  @state()
  private pendingUnreadCount: number | null = null;

  private waitingForFirstReplayMessage = false;
  private shouldAutoScrollOnNextRender = false;
  private shouldScrollToAnchorOnNextRender = false;
  private isAutoScrolling = false;

  private seenMessageIds = new Set<string>();
  private controller: ChatRoomController;

  constructor() {
    super();

    this.controller = new ChatRoomController({
      apiBase: import.meta.env.VITE_API_BASE_URL,
      wsBase: import.meta.env.VITE_WS_BASE_URL,
      pageProtocol: window.location.protocol,
      onMessage: (message) => this.addMessage(message),
      onLoadingChange: (isLoading) => {
        this.isLoadingHistory = isLoading;
        // After history load completes, the first incoming user message from WS replay
        // is treated as the "last seen" boundary anchor.
        if (!isLoading) {
          this.waitingForFirstReplayMessage = true;
        }
      },
      onReconnectChange: (isReconnecting) => (this.isReconnecting = isReconnecting),
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.controller.updateIdentity({ room: this.roomId, username: this.username });
    this.controller.start();
    void this.loadUnreadCountSnapshot();
    // Sync theme from body attribute set by ChatApp
    const bodyTheme = document.body.getAttribute("data-theme");
    this.theme = bodyTheme === "dark" ? "dark" : "light";
  }

  private async loadUnreadCountSnapshot() {
    try {
      this.pendingUnreadCount = await fetchUnreadCount(this.roomId, this.username);
    } catch {
      this.pendingUnreadCount = null;
    }
  }

  private toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", this.theme);
    document.body.setAttribute("data-theme", this.theme);
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this.controller.stop();
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.has("roomId") || changedProperties.has("username")) {
      this.controller.updateIdentity({ room: this.roomId, username: this.username });
    }

    if (changedProperties.has("messages")) {
      const el = this.shadowRoot?.querySelector(".chat-room__messages");
      if (el && this.shouldAutoScrollOnNextRender && !this.shouldScrollToAnchorOnNextRender) {
        this.isAutoScrolling = true;
        el.scrollTop = el.scrollHeight;
        this.shouldAutoScrollOnNextRender = false;
        // Clear the flag after the scroll event fires
        requestAnimationFrame(() => { this.isAutoScrolling = false; });
      } else if (this.shouldScrollToAnchorOnNextRender) {
        this.shouldScrollToAnchorOnNextRender = false;
          this.scrollToUnreadBoundary("instant");
      }
    }

    // Fallback for servers that don't replay unread messages over WS.
    // Place the anchor from unread-count against loaded history once.
    if (
      changedProperties.has("messages") &&
      !this.isLoadingHistory &&
      !this.unreadAnchorMessageId &&
      this.pendingUnreadCount !== null &&
      this.pendingUnreadCount > 0
    ) {
      const otherUserMessages = this.messages.filter(
        (m) => m.kind === "user" && m.username !== this.username,
      );
      if (otherUserMessages.length > 0) {
        const anchorIndex = Math.max(otherUserMessages.length - this.pendingUnreadCount, 0);
        const anchor = otherUserMessages[anchorIndex];
        if (anchor) {
          this.unreadAnchorMessageId = anchor.id;
          this.hasUnseenMessages = true;
          this.shouldScrollToAnchorOnNextRender = true;
        }
      }
      this.pendingUnreadCount = null;
    }
  }

  private isMessagesNearBottom(): boolean {
    const el = this.shadowRoot?.querySelector(".chat-room__messages") as HTMLElement | null;
    if (!el) return true;
    const threshold = 24;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }

  private clearUnreadMarker() {
    this.unreadAnchorMessageId = null;
    this.hasUnseenMessages = false;
  }

  private handleMessagesScroll() {
    if (this.isAutoScrolling) return;
    if (this.isMessagesNearBottom() && this.hasUnseenMessages) {
      this.clearUnreadMarker();
    }
  }

  private addMessage(msg: UiMessage) {
    const isNearBottom = this.isMessagesNearBottom();

    if (msg.kind === "user") {
      if (this.seenMessageIds.has(msg.id)) return;
      this.seenMessageIds.add(msg.id);

      const isOwnMessage = msg.username === this.username;

      // Always mark the first WS-replayed message as the unread anchor when joining,
      // regardless of scroll position. Skip own messages as they're already "seen".
      if (this.waitingForFirstReplayMessage && !this.unreadAnchorMessageId && !isOwnMessage) {
        this.unreadAnchorMessageId = msg.id;
        this.hasUnseenMessages = true;
        this.waitingForFirstReplayMessage = false;
        this.shouldScrollToAnchorOnNextRender = true;
      } else {
        this.waitingForFirstReplayMessage = false;
      }

      if (isOwnMessage || this.isLoadingHistory) {
        this.shouldAutoScrollOnNextRender = true;
      } else if (isNearBottom && !this.hasUnseenMessages) {
        this.shouldAutoScrollOnNextRender = true;
      } else if (!isNearBottom) {
        if (!this.unreadAnchorMessageId) {
          this.unreadAnchorMessageId = msg.id;
        }
        this.hasUnseenMessages = true;
      }
    } else if ((isNearBottom || this.isLoadingHistory) && !this.hasUnseenMessages) {
      this.shouldAutoScrollOnNextRender = true;
    }

    this.messages = [...this.messages, msg];
  }

  private scrollToUnreadBoundary(behavior: ScrollBehavior = "instant") {
    const dividerEl = this.shadowRoot?.querySelector("[data-unread-anchor]") as HTMLElement | null;
    if (!dividerEl) return;
    // Scroll to the last-read message so the divider appears just below it
    const lastReadEl = dividerEl.previousElementSibling as HTMLElement | null;
    const target = lastReadEl ?? dividerEl;
    target.scrollIntoView({ behavior, block: "start" });
  }

  private scrollToLastSeen() {
    this.scrollToUnreadBoundary("smooth");
  }

  private getUnreadCount(): number {
    if (!this.unreadAnchorMessageId) return 0;
    const anchorIndex = this.messages.findIndex(
      (m) => m.id === this.unreadAnchorMessageId,
    );
    if (anchorIndex < 0) return 0;

    return this.messages
      .slice(anchorIndex)
      .filter((m) => m.kind === "user" && m.username !== this.username).length;
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
    const unreadCount = this.getUnreadCount();

    return html`
      <section class="chat-room ${this.theme === 'dark' ? 'chat-room--dark' : 'chat-room--light'}">
        <header class="chat-room__header">
          <div class="chat-room__header-left">
            <h2 class="chat-room__title"> ${this.roomName || this.roomId}</h2>
            <p class="chat-room__meta">Logged in as <strong>${this.username}</strong></p>
          </div>
          <div class="chat-room__header-right">
            <button class="chat-room__icon-btn" @click=${this.toggleTheme} title="Toggle theme">
              ${this.theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </header>

        ${this.isReconnecting
          ? html`<div class="chat-room__banner">Reconnecting…</div>`
          : nothing}

        <div class="chat-room__messages" @scroll=${this.handleMessagesScroll}>
          ${this.isLoadingHistory
            ? html`<div class="message message--system">Loading history…</div>`
            : this.messages.length === 0
              ? html`<div class="message message--system">No messages yet. Say hello!</div>`
              : repeat(
                  this.messages,
                  (m) => m.id,
                  (m) =>
                    m.kind === "system"
                      ? html`<div class="message message--system" data-message-id=${m.id}>${m.text}</div>`
                      : html`
                          ${this.unreadAnchorMessageId === m.id
                            ? html`<unread-divider data-unread-anchor></unread-divider>`
                            : nothing}
                          <article
                            class="message message--user ${m.username === this.username ? "message--self" : ""}"
                            data-message-id=${m.id}
                          >
                            <div class="message__author">${m.username}</div>
                            <div class="message__body">${m.text}</div>
                            <div class="message__time">${this.formatTime(m.createdAt)}</div>
                          </article>
                        `,
                )}

          ${this.hasUnseenMessages && unreadCount > 0
            ? html`
                <button
                  class="chat-room__jump-last-seen"
                  @click=${this.scrollToLastSeen}
                  title="Jump to first unread message"
                >
                  ${unreadCount} unread • Scroll to last seen
                </button>
              `
            : nothing}
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