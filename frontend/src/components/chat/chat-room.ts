import { LitElement, html, nothing, unsafeCSS } from "lit";
import type { PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import chatRoomStylesRaw from "../../styles/chat-room.styles.scss?inline";
import type { UiMessage } from "../../types/message";
import { ChatRoomController } from "../../features/lib/chat/chat-room-controller";
import type { TypingEvent } from "../../features/lib/chat/chat-message-adapter";
import {
  addMessageReaction,
  fetchUnreadCount,
  type VoiceParticipant,
  removeMessageReaction,
  uploadChatImage,
} from "../../features/lib/chat/chat-room-api";
import type { ReactionUpdate } from "../../features/lib/chat/chat-message-adapter";
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
import { WebRTCAdapter, type Participant } from "../../features/lib/chat/webrtc-adapter";
import type { ConnectionMetrics } from "../../features/lib/chat/connection-monitor";
import { authStore } from "../../store/auth-store";
import { settingsStore } from "../../store/settings-store";
import type { SettingsState } from "../../store/settings-store";
import { watch } from "zustand-lit";
import "./unread-divider";
import "./chat-room-header";
import "./chat-message-item";
import "./chat-room-composer";
import "./chat-voice-bar";
import "./chat-active-call";
import "./chat-image-preview";

@customElement("chat-room")
export class ChatRoom extends LitElement {
  static styles = unsafeCSS(chatRoomStylesRaw);

  @property() username = "Guest";
  @property() roomId = "general";
  @property() roomName = "general";

  @state() private messages: UiMessage[] = [];
  @state() private isLoadingHistory = true;
  @state() private isReconnecting = false;
  @state() private _viewingActiveCall = false;
  @state() private _isMuted = false;
  @state() private _previewImageUrl: string | null = null;
  @state() private _typingUsers = new Set<string>();
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private themeCtrl = new ThemeController(this);

  @state() private unreadAnchorMessageId: string | null = null;
  @state() private hasUnseenMessages = false;
  @state() private pendingUnreadCount: number | null = null;
  @state() private isUploadingImage = false;
  @state() private isScrolledUp = false;

  private awaitingFirstReplayMessage = false;
  private pendingAutoScroll = false;
  private pendingScrollToAnchor = false;
  private isAutoScrolling = false;
  private readonly seenMessageIds = new Set<string>();

  // Voice / WebRTC
  @state() private _voiceState: "idle" | "calling" | "active" | "error" = "idle";
  @state() private _voiceParticipants: VoiceParticipant[] = [];
  @state() private _isScreenSharing = false;
  @state() private _screenSharingUser: string | null = null;
  @state() private _screenShareStream: MediaStream | null = null;
  @state() private _connectionMetrics: ConnectionMetrics | null = null;

  @watch(settingsStore)
  private settingsState?: SettingsState;

  private readonly webrtc: WebRTCAdapter;
  private readonly controller: ChatRoomController;

  constructor() {
    super();

    this.webrtc = new WebRTCAdapter(
      {
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
        wsBase: import.meta.env.VITE_WS_BASE_URL ?? "",
        room: this.roomId,
        username: this.username,
      },
      {
        onCallStateChange: (state) => {
          this._voiceState = state;
          if (state === "idle" || state === "error") this.resetVoiceUiState();
        },
        onParticipantsChange: (participants: Participant[]) => {
          this._voiceParticipants = participants as VoiceParticipant[];
        },
        onScreenShareStarted: (stream, sharerName, isLocal) => {
          this._screenShareStream = stream;
          this._isScreenSharing = isLocal || this.webrtc.isScreenSharing;
          this._screenSharingUser = sharerName.replace(" (you)", "") || this.username;
          this.requestUpdate();
        },
        onScreenShareStopped: () => {
          this._screenShareStream = null;
          this._isScreenSharing = false;
          this._screenSharingUser = null;
          this.requestUpdate();
        },
        onSystemNotice: (text) => this.addSystemNotice(text),
        onVoiceSignal: (payload) => this.controller.sendRawSignal(payload),
        onConnectionMetrics: (metrics) => {
          this._connectionMetrics = metrics;
        },
      },
    );

    this.controller = new ChatRoomController({
      apiBase: import.meta.env.VITE_API_BASE_URL,
      wsBase: import.meta.env.VITE_WS_BASE_URL,
      pageProtocol: window.location.protocol,
      getToken: () => authStore.getState().accessToken,
      onMessage: (message) => this.addMessage(message),
      onConnected: () => this.emitRoomConnected(),
      onPresenceChange: (users) => this.emitActiveUsers(users),
      onReactionUpdate: (update) => this.applyReactionUpdate(update),
      onVoiceEvent: (msg) => this.webrtc.handleVoiceEvent(msg),
      onTypingEvent: (event: TypingEvent) => this.handleTypingEvent(event),
      onLoadingChange: (isLoading) => this.handleLoadingChange(isLoading),
      onReconnectChange: (isReconnecting) => (this.isReconnecting = isReconnecting),
      onMessageAck: (clientId, serverId) => {
        console.log(`[ChatRoom] onMessageAck — clientId=${clientId} serverId=${serverId}`);
        this.messages = this.messages.map((m) =>
          m.clientId === clientId
            ? { ...m, id: serverId, clientId: undefined, status: "sent" as const }
            : m,
        );
      },
      onMessageFailed: (clientId) => {
        this.messages = this.messages.map((m) =>
          m.clientId === clientId ? { ...m, status: "failed" as const } : m,
        );
      },
    });
  }

  private readonly boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("visibilitychange", this.boundHandleVisibilityChange);
    window.addEventListener("focus", this.boundHandleVisibilityChange);
    this.updateAdapterIdentity();
    this.controller.start();
    void this.loadUnreadCountSnapshot();
    ThemeController.set(this.themeCtrl.theme);
    // Sync the monitor with whatever the store already holds so we don't
    // depend solely on the `updated()` change-detection path, which can
    // miss the very first population of settingsState when it races with
    // joinCall() creating the RTCPeerConnection.
    const currentSettings = settingsStore.getState();
    this.webrtc.setMonitorEnabled(currentSettings.isConnectionMonitorEnabled);
  }

  disconnectedCallback(): void {
    window.removeEventListener("visibilitychange", this.boundHandleVisibilityChange);
    window.removeEventListener("focus", this.boundHandleVisibilityChange);
    this.controller.stop();
    this.webrtc.destroy();
    this.resetVoiceUiState();
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has("roomId") || changedProperties.has("username")) {
      this.updateAdapterIdentity();
    }
    if (changedProperties.has("messages")) this.handleMessagesUpdated();

    if (changedProperties.has("settingsState") && this.settingsState) {
      this.webrtc.setMonitorEnabled(this.settingsState.isConnectionMonitorEnabled);
      // Do NOT null out _connectionMetrics here — clearing it causes the
      // panel to stay blank until the next 1 s tick after re-enabling.
      // Visibility is now controlled by passing isConnectionMonitorEnabled
      // as a separate prop to <chat-active-call>.
    }
  }

  @state() private _activeUsersCount = 0;

  private updateAdapterIdentity(): void {
    this.controller.updateIdentity({ room: this.roomId, username: this.username });
    this.webrtc.updateIdentity(this.roomId, this.username);
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

  private emitActiveUsers(users: string[]) {
    this._activeUsersCount = users.length;
    this.dispatchEvent(
      new CustomEvent<{ users: string[] }>("active-users-change", {
        detail: { users },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitTypingUsers() {
    this.dispatchEvent(
      new CustomEvent<{ users: string[] }>("typing-users-change", {
        detail: { users: Array.from(this._typingUsers) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitRoomConnected() {
    this.dispatchEvent(new CustomEvent("room-connected", { bubbles: true, composed: true }));
  }

  private resetVoiceUiState() {
    this._voiceParticipants = [];
    this._screenSharingUser = null;
    this._screenShareStream = null;
    this._isScreenSharing = false;
  }

  private get inCall() {
    return this._voiceState === "active" || this._voiceState === "calling";
  }
  private get showCallView() {
    return this.inCall && this._viewingActiveCall;
  }

  private handleTypingEvent(event: TypingEvent) {
    if (event.username === this.username) return;

    const existingTimer = this.typingTimers.get(event.username);
    if (existingTimer) clearTimeout(existingTimer);

    if (event.event === "stopped") {
      this._typingUsers.delete(event.username);
      this._typingUsers = new Set(this._typingUsers);
      this.emitTypingUsers();
      this.typingTimers.delete(event.username);
      return;
    }

    this._typingUsers.add(event.username);
    this._typingUsers = new Set(this._typingUsers);
    this.emitTypingUsers();

    const newTimer = setTimeout(() => {
      this._typingUsers.delete(event.username);
      this._typingUsers = new Set(this._typingUsers);
      this.emitTypingUsers();
      this.typingTimers.delete(event.username);
    }, 5000);
    this.typingTimers.set(event.username, newTimer);
  }

  private handleLoadingChange(isLoading: boolean) {
    this.isLoadingHistory = isLoading;
    if (!isLoading) this.awaitingFirstReplayMessage = true;
  }

  // Voice call handlers
  private handleVoiceStart = () => {
    this._viewingActiveCall = true;
    this._isMuted = false;
    this.webrtc.setMuted(false);
    void this.webrtc.joinCall();
  };

  private handleVoiceStop = () => {
    this.webrtc.leaveCall();
  };
  private handleActiveCallVoiceStop = () => {
    this._viewingActiveCall = false;
    this.webrtc.leaveCall();
  };
  private handleReturnToChat = () => {
    this._viewingActiveCall = false;
  };
  private handleReturnToCall = () => {
    this._viewingActiveCall = true;
  };
  private handleVoiceDismiss = () => {
    this._voiceState = "idle";
  };

  private handleMuteToggle = (e: CustomEvent<{ muted: boolean }>) => {
    this._isMuted = e.detail.muted;
    this.webrtc.setMuted(this._isMuted);
  };

  private handleVolumeChange = (e: CustomEvent<{ volume: number }>) => {
    this.webrtc.setVolume(e.detail.volume);
  };

  private handleScreenShareToggleRequest = () => {
    void this.handleScreenShareToggle();
  };
  private handleUserTyping = () => {
    this.controller.sendTyping();
  };

  private async handleScreenShareToggle() {
    try {
      if (this._isScreenSharing) {
        this.webrtc.stopScreenShare();
      } else {
        await this.webrtc.startScreenShare();
      }
    } catch (error) {
      console.error("[ChatRoom] screen share toggle failed", error);
      this.addSystemNotice("Screen sharing could not be updated.");
    }
  }

  // Scroll helpers
  private handleMessagesUpdated() {
    this.applyPendingScrollEffect();
    this.applyUnreadFallbackFromSnapshot();
    this.checkAndClearUnreadMarker();
  }

  private handleVisibilityChange() {
    this.checkAndClearUnreadMarker();
  }

  private checkAndClearUnreadMarker() {
    if (this.hasUnseenMessages && this.isPageActive() && this.isMessagesNearBottom()) {
      this.clearUnreadMarker();
    }
  }

  private applyPendingScrollEffect() {
    const messagesEl = getMessagesContainer(this);
    if (messagesEl && this.pendingAutoScroll && !this.pendingScrollToAnchor) {
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
    )
      return;
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

  private handleImagePreview(e: CustomEvent<{ url: string }>) {
    this._previewImageUrl = e.detail.url;
  }
  private closePreview() {
    this._previewImageUrl = null;
  }

  private handleMessagesScroll() {
    if (this.isAutoScrolling) return;
    const nearBottom = this.isMessagesNearBottom();
    this.isScrolledUp = !nearBottom;
    if (nearBottom && this.hasUnseenMessages) this.clearUnreadMarker();
  }

  private forceScrollToBottom() {
    const messagesEl = getMessagesContainer(this);
    if (messagesEl) {
      this.isAutoScrolling = true;
      scrollMessagesToBottom(messagesEl, () => {
        this.isAutoScrolling = false;
        this.isScrolledUp = false;
      });
    }
  }

  private addMessage(msg: UiMessage) {
    console.log(`[ChatRoom] addMessage — id=${msg.id} kind=${msg.kind} from=${msg.username} status=${(msg as { status?: string }).status ?? 'n/a'}`);
    const isNearBottom = this.isMessagesNearBottom();
    if (msg.kind === "user") {
      if (!this.trackIncomingUserMessage(msg, isNearBottom)) return;
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
    console.log(`[ChatRoom] trackIncomingUserMessage — id=${message.id} seenAlready=${this.seenMessageIds.has(message.id)}`);
    if (this.seenMessageIds.has(message.id)) return false;
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
      if (!this.unreadAnchorMessageId) this.markUnreadFromMessage(message.id);
      else this.hasUnseenMessages = true;
    }
    return true;
  }

  private scrollToLastSeen() {
    scrollToUnreadBoundary(this, "smooth");
  }
  private getUnreadCount(): number {
    return getUnreadCount(this.messages, this.unreadAnchorMessageId, this.username);
  }

  private addSystemNotice(text: string) {
    this.addMessage({
      id: `sys-${Date.now()}-${Math.random()}`,
      kind: "system",
      username: "",
      text,
      createdAt: new Date().toISOString(),
      reactions: {},
    });
  }

  private applyReactionUpdate(update: ReactionUpdate) {
    if (update.room && update.room !== this.roomId) return;
    this.messages = this.messages.map((message) => {
      if (message.id !== update.messageId || message.kind !== "user") return message;
      return { ...message, reactions: update.reactions };
    });
  }

  private async handleMessageReactionToggle(e: CustomEvent<{ messageId: string; emoji: string }>) {
    const { messageId, emoji } = e.detail;
    if (!messageId || !emoji) return;
    const username = this.username.trim();
    if (!username) return;
    const message = this.messages.find((item) => item.id === messageId && item.kind === "user");
    if (!message) return;
    const alreadyReacted = (message.reactions[emoji] ?? []).includes(username);
    try {
      const response = alreadyReacted
        ? await removeMessageReaction(this.roomId, messageId, username, emoji)
        : await addMessageReaction(this.roomId, messageId, username, emoji);
      this.applyReactionUpdate({
        kind: "updated",
        room: this.roomId,
        messageId: response.message_id,
        reactions: response.reactions,
      });
    } catch {
      this.addSystemNotice("Could not update reaction. Please try again.");
    }
  }

  private async handleMessageSubmit(e: CustomEvent<{ text: string; imageFile?: File }>) {
    const text = e.detail.text.trim();
    const imageFile = e.detail.imageFile;
    if (!text && !imageFile) return;

    let imageUrl: string | undefined;
    if (imageFile) {
      this.isUploadingImage = true;
      try {
        const uploaded = await uploadChatImage(imageFile);
        imageUrl = uploaded.url;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Image upload failed. Please try again.";
        this.addSystemNotice(message);
        return;
      } finally {
        this.isUploadingImage = false;
      }
    }

    const clientMsgId = this.controller.send({ text, imageUrl });
    if (!clientMsgId) {
      this.addSystemNotice("Message could not be sent because the connection is not ready.");
      return;
    }

    const optimisticMsg: UiMessage = {
      id: clientMsgId,
      clientId: clientMsgId,
      kind: "user",
      username: this.username,
      text,
      imageUrl,
      createdAt: new Date().toISOString(),
      reactions: {},
      status: "pending",
    };
    console.log(`[ChatRoom] adding optimistic message — clientId=${clientMsgId}`);
    this.addMessage(optimisticMsg);
  }

  private shouldShowMetaForMessage(index: number): boolean {
    const current = this.messages[index];
    const next = this.messages[index + 1];
    if (!current || current.kind !== "user") return true;
    if (!next || next.kind !== "user") return true;
    return current.username !== next.username;
  }

  render() {
    const unreadCount = this.getUnreadCount();
    const monitorEnabled = this.settingsState?.isConnectionMonitorEnabled ?? false;
    return html`
      <section
        class="chat-room ${this.themeCtrl.theme === "dark"
          ? "chat-room--dark"
          : "chat-room--light"}"
      >
        <chat-room-header
          .roomName=${this.roomName}
          .roomId=${this.roomId}
          .username=${this.username}
          .theme=${this.themeCtrl.theme}
          .isReconnecting=${this.isReconnecting}
          .onlineCount=${this._activeUsersCount}
          .voiceState=${this._voiceState}
          @theme-toggle=${this.toggleTheme}
          @voice-start=${this.handleVoiceStart}
          @voice-stop=${this.handleVoiceStop}
        ></chat-room-header>

        ${this.inCall
          ? this.showCallView
            ? html`
                <chat-active-call
                  .callState=${this._voiceState}
                  .roomName=${this.roomName}
                  .username=${this.username}
                  .participants=${this._voiceParticipants}
                  .isMuted=${this._isMuted}
                  .isScreenSharing=${this._isScreenSharing}
                  .screenSharingUser=${this._screenSharingUser}
                  .screenShareStream=${this._screenShareStream}
                  .connectionMetrics=${
                    monitorEnabled ? this._connectionMetrics : null
                  }
                  @voice-stop=${this.handleActiveCallVoiceStop}
                  @return-to-chat=${this.handleReturnToChat}
                  @voice-mute-toggle=${this.handleMuteToggle}
                  @voice-volume-change=${this.handleVolumeChange}
                  @screen-share-toggle=${this.handleScreenShareToggleRequest}
                ></chat-active-call>
              `
            : html`
                <chat-voice-bar
                  .state=${this._voiceState}
                  .participants=${this._voiceParticipants}
                  .username=${this.username}
                  .isMuted=${this._isMuted}
                  @return-to-call=${this.handleReturnToCall}
                  @voice-stop=${this.handleVoiceStop}
                  @voice-dismiss=${this.handleVoiceDismiss}
                  @voice-mute-toggle=${this.handleMuteToggle}
                ></chat-voice-bar>
              `
          : nothing}

        <div
          class="chat-room__messages"
          @scroll=${this.handleMessagesScroll}
          @image-preview=${this.handleImagePreview}
          style="${this.showCallView ? "display: none;" : ""}"
        >
          ${this.isLoadingHistory
            ? html`<div class="message message--system">Loading history…</div>`
            : this.messages.length === 0
              ? html`<div class="message message--system">No messages yet. Say hello!</div>`
              : repeat(
                  this.messages,
                  (m) => m.id,
                  (m, index) => html`
                    ${this.unreadAnchorMessageId === m.id
                      ? html`<unread-divider data-unread-anchor></unread-divider>`
                      : nothing}
                    <chat-message-item
                      .message=${m}
                      .username=${this.username}
                      .showMeta=${this.shouldShowMetaForMessage(index)}
                      @message-reaction-toggle=${this.handleMessageReactionToggle}
                    ></chat-message-item>
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
            : this.isScrolledUp
              ? html`
                  <button
                    class="chat-room__jump-bottom"
                    @click=${this.forceScrollToBottom}
                    title="Jump to bottom"
                  >
                    Scroll to bottom ↓
                  </button>
                `
              : nothing}
        </div>

        <chat-room-composer
          .submitting=${this.isUploadingImage}
          @message-submit=${this.handleMessageSubmit}
          @user-typing=${this.handleUserTyping}
          style="${this.showCallView ? "display: none;" : ""}"
        ></chat-room-composer>

        ${this._previewImageUrl
          ? html`
              <chat-image-preview
                .imageUrl=${this._previewImageUrl}
                @close-preview=${this.closePreview}
              ></chat-image-preview>
            `
          : nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-room": ChatRoom;
  }
}
