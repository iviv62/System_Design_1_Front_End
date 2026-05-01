import { LitElement, html, nothing, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import chatRoomStylesRaw from "../styles/chat-room.styles.scss?inline";
import type { UiMessage } from "../types/message";
import { ChatRoomController } from "../features/lib/chat/chat-room-controller";
import { fetchUnreadCount } from "../features/lib/chat/chat-room-api";
import { getUnreadBoundaryScrollTarget } from "../features/lib/chat/chat-room-scroll";
import { getTheme, setTheme } from "../utils/theme";
import "./unread-divider"; 
import "./chat/chat-room-header";
import "./chat/chat-message-item";
import "./chat/chat-room-composer";

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
    this.theme = getTheme();
    setTheme(this.theme);
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
    setTheme(this.theme);
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
    const dividerEl = getUnreadBoundaryScrollTarget(this);
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

  private handleMessageSubmit(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text.trim();
    if (!text) return;
    this.controller.send(text);
  }

  render() {
    const unreadCount = this.getUnreadCount();

    return html`
      <section class="chat-room ${this.theme === 'dark' ? 'chat-room--dark' : 'chat-room--light'}">
        <chat-room-header
          .roomName=${this.roomName}
          .roomId=${this.roomId}
          .username=${this.username}
          .theme=${this.theme}
          .isReconnecting=${this.isReconnecting}
          @theme-toggle=${this.toggleTheme}
        ></chat-room-header>

        <div class="chat-room__messages" @scroll=${this.handleMessagesScroll}>
          ${this.isLoadingHistory
            ? html`<div class="message message--system">Loading history…</div>`
            : this.messages.length === 0
              ? html`<div class="message message--system">No messages yet. Say hello!</div>`
              : repeat(
                  this.messages,
                  (m) => m.id,
                  (m) =>
                    html`
                      ${this.unreadAnchorMessageId === m.id
                        ? html`<unread-divider data-unread-anchor></unread-divider>`
                        : nothing}
                      <chat-message-item .message=${m} .username=${this.username}></chat-message-item>
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

        <chat-room-composer @message-submit=${this.handleMessageSubmit}></chat-room-composer>
      </section>
    `;
  }
}