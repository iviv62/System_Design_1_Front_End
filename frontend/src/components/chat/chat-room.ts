import { LitElement, html, nothing, unsafeCSS } from "lit";
import type { PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import chatRoomStylesRaw from "../../styles/chat-room.styles.scss?inline";
import type { UiMessage } from "../../types/message";
import { ChatRoomController } from "../../features/lib/chat/chat-room-controller";
import { fetchUnreadCount } from "../../features/lib/chat/chat-room-api";
import {
  DEFAULT_NEAR_BOTTOM_THRESHOLD_PX,
  getMessagesContainer,
  isMessagesNearBottom,
  scrollMessagesToBottom,
  scrollToUnreadBoundary,
} from "../../features/lib/chat/chat-room-scroll";
import {
  getUnreadAnchorFromSnapshot,
  getUnreadCount,
  shouldAnchorFirstReplayMessage,
  shouldAutoScrollForNonUserMessage,
  shouldAutoScrollForUserMessage,
} from "../../features/lib/chat/chat-room-unread";
import { ThemeController } from "../../utils/theme-controller";
import "./unread-divider";
import "./chat-room-header";
import "./chat-message-item";
import "./chat-room-composer";

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

  private themeCtrl = new ThemeController(this);

  @state()
  private unreadAnchorMessageId: string | null = null;

  @state()
  private hasUnseenMessages = false;

  @state()
  private pendingUnreadCount: number | null = null;

  private awaitingFirstReplayMessage = false;
  private pendingAutoScroll = false;
  private pendingScrollToAnchor = false;
  private isAutoScrolling = false;

  private readonly seenMessageIds = new Set<string>();
  private readonly controller: ChatRoomController;

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
          this.awaitingFirstReplayMessage = true;
        }
      },
      onReconnectChange: (isReconnecting) => (this.isReconnecting = isReconnecting),
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.updateControllerIdentity();
    this.controller.start();
    void this.loadUnreadCountSnapshot();
    ThemeController.set(this.themeCtrl.theme);
  }

  private async loadUnreadCountSnapshot() {
    try {
      this.pendingUnreadCount = await fetchUnreadCount(this.roomId, this.username);
    } catch {
      this.pendingUnreadCount = null;
    }
  }

  private toggleTheme(e?: CustomEvent) {
    const next = e?.detail?.theme ?? (this.themeCtrl.theme === "light" ? "dark" : "light");
    ThemeController.set(next);
  }

  disconnectedCallback(): void {
    this.controller.stop();
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has("roomId") || changedProperties.has("username")) {
      this.updateControllerIdentity();
    }

    if (changedProperties.has("messages")) {
      this.handleMessagesUpdated();
    }
  }

  private updateControllerIdentity() {
    this.controller.updateIdentity({ room: this.roomId, username: this.username });
  }

  private handleMessagesUpdated() {
    this.applyPendingScrollEffect();
    this.applyUnreadFallbackFromSnapshot();
  }

  private applyPendingScrollEffect() {
    const messagesEl = getMessagesContainer(this);
    if (
      messagesEl &&
      this.pendingAutoScroll &&
      !this.pendingScrollToAnchor
    ) {
      this.runBottomScroll(messagesEl);
      this.pendingAutoScroll = false;
      return;
    }

    if (this.pendingScrollToAnchor) {
      this.pendingScrollToAnchor = false;
      scrollToUnreadBoundary(this, "instant");
    }
  }

  private applyUnreadFallbackFromSnapshot() {
    if (
      this.isLoadingHistory ||
      this.unreadAnchorMessageId ||
      this.pendingUnreadCount === null ||
      this.pendingUnreadCount <= 0
    ) {
      return;
    }

    const anchorId = getUnreadAnchorFromSnapshot(
      this.messages,
      this.username,
      this.pendingUnreadCount,
    );
    if (anchorId) {
      this.markUnreadFromMessage(anchorId);
      this.pendingScrollToAnchor = true;
    }

    this.pendingUnreadCount = null;
  }

  private runBottomScroll(messagesEl: HTMLElement) {
    this.isAutoScrolling = true;
    scrollMessagesToBottom(messagesEl, () => {
      this.isAutoScrolling = false;
    });
  }

  private markUnreadFromMessage(messageId: string) {
    this.unreadAnchorMessageId = messageId;
    this.hasUnseenMessages = true;
  }

  private scheduleAutoScroll() {
    this.pendingAutoScroll = true;
  }

  private scheduleScrollToUnreadBoundary() {
    this.pendingScrollToAnchor = true;
  }

  private isPageActive(): boolean {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  private isMessagesNearBottom(): boolean {
    return isMessagesNearBottom(this, DEFAULT_NEAR_BOTTOM_THRESHOLD_PX);
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
      if (!this.trackIncomingUserMessage(msg, isNearBottom)) {
        return;
      }
    } else if (
      shouldAutoScrollForNonUserMessage({
        isLoadingHistory: this.isLoadingHistory,
        isPageActive: this.isPageActive(),
        isNearBottom,
        hasUnseenMessages: this.hasUnseenMessages,
      })
    ) {
      this.scheduleAutoScroll();
    }

    this.messages = [...this.messages, msg];
  }

  private trackIncomingUserMessage(message: UiMessage, isNearBottom: boolean): boolean {
    if (this.seenMessageIds.has(message.id)) {
      return false;
    }
    this.seenMessageIds.add(message.id);

    const isOwnMessage = message.username === this.username;

    if (
      shouldAnchorFirstReplayMessage({
        waitingForFirstReplayMessage: this.awaitingFirstReplayMessage,
        unreadAnchorMessageId: this.unreadAnchorMessageId,
        isOwnMessage,
      })
    ) {
      this.markUnreadFromMessage(message.id);
      this.scheduleScrollToUnreadBoundary();
    }

    this.awaitingFirstReplayMessage = false;

    if (
      shouldAutoScrollForUserMessage({
        isOwnMessage,
        isLoadingHistory: this.isLoadingHistory,
        isPageActive: this.isPageActive(),
        isNearBottom,
        hasUnseenMessages: this.hasUnseenMessages,
      })
    ) {
      this.scheduleAutoScroll();
      return true;
    }

    if (!isNearBottom) {
      if (!this.unreadAnchorMessageId) {
        this.markUnreadFromMessage(message.id);
      } else {
        this.hasUnseenMessages = true;
      }
    }

    return true;
  }

  private scrollToLastSeen() {
    scrollToUnreadBoundary(this, "smooth");
  }

  private getUnreadCount(): number {
    return getUnreadCount(this.messages, this.unreadAnchorMessageId, this.username);
  }

  private handleMessageSubmit(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text.trim();
    if (!text) return;
    this.controller.send(text);
  }

  render() {
    const unreadCount = this.getUnreadCount();

    return html`
      <section class="chat-room ${this.themeCtrl.theme === 'dark' ? 'chat-room--dark' : 'chat-room--light'}">
        <chat-room-header
          .roomName=${this.roomName}
          .roomId=${this.roomId}
          .username=${this.username}
          .theme=${this.themeCtrl.theme}
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