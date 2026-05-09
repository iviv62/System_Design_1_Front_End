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
  fetchVoiceParticipants,
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
import { VoiceCallController, type VoiceCallState } from "../../features/lib/chat/voice-call-controller";
import type { VoiceEvent } from "../../features/lib/chat/voice-call-adapter";
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
  
  @state() private _viewingActiveCall = false;
  
  @state() private _isMuted = false;

  @state() private _previewImageUrl: string | null = null;
  @state() private _typingUsers = new Set<string>();
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private themeCtrl = new ThemeController(this);

  @state()
  private unreadAnchorMessageId: string | null = null;

  @state()
  private hasUnseenMessages = false;

  @state()
  private pendingUnreadCount: number | null = null;

  @state()
  private isUploadingImage = false;

  private awaitingFirstReplayMessage = false;
  private pendingAutoScroll = false;
  private pendingScrollToAnchor = false;
  private isAutoScrolling = false;

  private readonly seenMessageIds = new Set<string>();
  private readonly controller: ChatRoomController;

  @state() private _voiceState: VoiceCallState = "idle";
  private readonly voiceController: VoiceCallController;

  @state() private _voiceParticipants: VoiceParticipant[] = [];
  @state() private _screenSharingUser: string | null = null;
  @state() private _screenShareStream: MediaStream | null = null;
  @state() private _isScreenSharing = false;
  private screenSharePendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();

    this.controller = new ChatRoomController({
      apiBase: import.meta.env.VITE_API_BASE_URL,
      wsBase: import.meta.env.VITE_WS_BASE_URL,
      pageProtocol: window.location.protocol,
      onMessage: (message) => this.addMessage(message),
      onConnected: () => this.emitRoomConnected(),
      onPresenceChange: (users) => this.emitActiveUsers(users),
      onReactionUpdate: (update) => this.applyReactionUpdate(update),
      onVoiceEvent: (event: VoiceEvent) => this.handleVoiceEvent(event),
      onTypingEvent: (event: TypingEvent) => this.handleTypingEvent(event),
      onLoadingChange: (isLoading) => this.handleLoadingChange(isLoading),
      onReconnectChange: (isReconnecting) => (this.isReconnecting = isReconnecting),
    });

    this.voiceController = new VoiceCallController({
      apiBase: import.meta.env.VITE_API_BASE_URL,
      wsBase: import.meta.env.VITE_WS_BASE_URL,
      room: this.roomId,
      username: this.username,
      onStateChange: (state) => {
        this._voiceState = state;
        if (state === "idle" || state === "error") {
          this.resetVoiceUiState();
        }
      },
      onIceCandidate: (candidate) => {
        this.controller.sendVoiceSignal({
          type: "voice",
          event: "ice_candidate",
          room: this.roomId,
          username: this.username,
          candidate,
        });
      },
      onParticipantsChange: (participants) => {
        this._voiceParticipants = participants;
      },
      onScreenShareTrack: (stream) => {
        if (this.screenSharePendingTimer) {
          clearTimeout(this.screenSharePendingTimer);
          this.screenSharePendingTimer = null;
        }
        this._screenShareStream = stream;
        this._isScreenSharing = Boolean(stream);
        if (stream && this.voiceController.isScreenSharing) {
          this._screenSharingUser = this.username;
        }
        if (!stream && this._screenSharingUser === this.username) {
          this._screenSharingUser = null;
        }
        this.requestUpdate();
      },
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.updateControllerIdentity();
    this.controller.start();
    void this.loadUnreadCountSnapshot();
    void this.loadVoiceParticipants();
    ThemeController.set(this.themeCtrl.theme);
  }

  private async loadVoiceParticipants() {
    try {
      this._voiceParticipants = await fetchVoiceParticipants(this.roomId);
    } catch {
      // ignore
    }
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
    void this.voiceController.stop();
    this.resetVoiceUiState();
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has("roomId") || changedProperties.has("username")) {
      this.updateControllerIdentity();
      if (changedProperties.has("roomId")) {
        void this.loadVoiceParticipants();
      }
    }

    if (changedProperties.has("messages")) {
      this.handleMessagesUpdated();
    }
  }

  @state() private _activeUsersCount = 0;

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
    this.dispatchEvent(
      new CustomEvent("room-connected", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private updateControllerIdentity() {
    this.controller.updateIdentity({ room: this.roomId, username: this.username });
    this.voiceController.updateIdentity(this.roomId, this.username);
  }

  private resetVoiceUiState() {
    this._voiceParticipants = [];
    this._screenSharingUser = null;
    this._screenShareStream = null;
    this._isScreenSharing = false;
    if (this.screenSharePendingTimer) {
      clearTimeout(this.screenSharePendingTimer);
      this.screenSharePendingTimer = null;
    }
  }

  private get inCall() {
    return this._voiceState === "active" || this._voiceState === "calling";
  }

  private get showCallView() {
    return this.inCall && this._viewingActiveCall;
  }

  private handleVoiceEvent(event: VoiceEvent) {
    if (event.kind === "ice_candidate") {
      void this.voiceController.handleRemoteIceCandidate(event.candidate);
      return;
    }

    if (event.kind === "screen_share_started") {
      if (event.username !== this.username) {
        this._screenSharingUser = event.username;
        if (this.screenSharePendingTimer) {
          clearTimeout(this.screenSharePendingTimer);
        }
        this.screenSharePendingTimer = setTimeout(() => {
          if (this._screenSharingUser === event.username && !this._screenShareStream) {
            this._screenSharingUser = null;
            this._isScreenSharing = false;
          }
          this.screenSharePendingTimer = null;
        }, 12000);
        this.requestUpdate();
      }
      this.addSystemNotice(`${event.username} started sharing their screen`);
      return;
    }

    if (event.kind === "screen_share_stopped") {
      const participants = this._voiceParticipants;
      this.resetVoiceUiState();
      this._voiceParticipants = participants;
      this.requestUpdate();
      this.addSystemNotice(`${event.username} stopped sharing their screen`);
      return;
    }

    // Optimistically update the participants array depending on the event
    if (event.kind === "peer_joined") {
      this._voiceParticipants = event.participants;
      this.addSystemNotice(`${event.username} joined the voice call`);
      return;
    }
    if (event.kind === "call_ended") {
      const participants = this._voiceParticipants.filter(u => u.username !== event.username);
      this.resetVoiceUiState();
      this._voiceParticipants = participants;
      this.addSystemNotice(`${event.username} left the voice call`);
      return;
    }
    if (event.kind === "call_started") {
      if (!this._voiceParticipants.some(u => u.username === event.username)) {
        this._voiceParticipants = [...this._voiceParticipants, { peer_id: event.peerId, username: event.username }];
      }
    }

    // As a fallback to ensure we are never out of sync, fetch the authoritative list
    if (event.kind === "call_started") {
      void this.loadVoiceParticipants();
    }

    const names = { call_started: "started", call_error: "had a call error" };
    this.addSystemNotice(`${event.username} ${names[event.kind as "call_started" | "call_error"]} a voice call`);
  }

  private handleTypingEvent(event: TypingEvent) {
    if (event.username === this.username) return;

    this._typingUsers.add(event.username);
    this._typingUsers = new Set(this._typingUsers); // trigger re-render
    this.emitTypingUsers();

    const existingTimer = this.typingTimers.get(event.username);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const newTimer = setTimeout(() => {
      this._typingUsers.delete(event.username);
      this._typingUsers = new Set(this._typingUsers); // trigger re-render
      this.emitTypingUsers();
      this.typingTimers.delete(event.username);
    }, 1500);

    this.typingTimers.set(event.username, newTimer);
  }

  private handleLoadingChange(isLoading: boolean) {
    this.isLoadingHistory = isLoading;
    // After history load completes, the first incoming user message from WS replay
    // is treated as the "last seen" boundary anchor.
    if (!isLoading) {
      this.awaitingFirstReplayMessage = true;
    }
  }

  private handleVoiceStart = () => {
    this._viewingActiveCall = true;
    this._isMuted = false;
    this.voiceController.setMuted(false);
    this.voiceController.start();
  };

  private handleVoiceStop = () => {
    this.voiceController.stop();
  };

  private handleActiveCallVoiceStop = () => {
    this._viewingActiveCall = false;
    this.voiceController.stop();
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
    this.voiceController.setMuted(this._isMuted);
  };

  private handleVolumeChange = (e: CustomEvent<{ volume: number }>) => {
    this.voiceController.setVolume(e.detail.volume);
  };

  private handleScreenShareToggleRequest = () => {
    void this.handleScreenShareToggle();
  };

  private handleUserTyping = () => {
    this.controller.sendTyping();
  };

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

  private handleImagePreview(e: CustomEvent<{ url: string }>) {
    this._previewImageUrl = e.detail.url;
  }

  private closePreview() {
    this._previewImageUrl = null;
  }

  private async handleScreenShareToggle() {
    try {
      if (this.voiceController.isScreenSharing) {
        await this.voiceController.stopScreenShare();
        this._isScreenSharing = this.voiceController.isScreenSharing;
        if (this._screenSharingUser === this.username) {
          this._screenSharingUser = null;
        }
        return;
      }

      await this.voiceController.startScreenShare();
      this._isScreenSharing = this.voiceController.isScreenSharing;
      if (!this._isScreenSharing && this._screenSharingUser === this.username) {
        this._screenSharingUser = null;
      }
    } catch (error) {
      console.error("[ChatRoom] screen share toggle failed", error);
      this.addSystemNotice("Screen sharing could not be updated.");
    }
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
    if (update.room && update.room !== this.roomId) {
      return;
    }

    this.messages = this.messages.map((message) => {
      if (message.id !== update.messageId || message.kind !== "user") {
        return message;
      }

      return {
        ...message,
        reactions: update.reactions,
      };
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
        const message = error instanceof Error
          ? error.message
          : "Image upload failed. Please try again.";
        this.addSystemNotice(message);
        return;
      } finally {
        this.isUploadingImage = false;
      }
    }

    const sent = this.controller.send({ text, imageUrl });
    if (!sent) {
      this.addSystemNotice("Message could not be sent because the connection is not ready.");
    }
  }

  private shouldShowMetaForMessage(index: number): boolean {
    const current = this.messages[index];
    const next = this.messages[index + 1];

    if (!current || current.kind !== "user") {
      return true;
    }

    if (!next || next.kind !== "user") {
      return true;
    }

    return current.username !== next.username;
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
          .onlineCount=${this._activeUsersCount}
          .voiceState=${this._voiceState}
          @theme-toggle=${this.toggleTheme}
          @voice-start=${this.handleVoiceStart}
          @voice-stop=${this.handleVoiceStop}
        ></chat-room-header>

        ${this.inCall ? (
          this.showCallView ? html`
            <chat-active-call
              .callState=${this._voiceState}
              .roomName=${this.roomName}
              .username=${this.username}
              .participants=${this._voiceParticipants}
              .isMuted=${this._isMuted}
              .isScreenSharing=${this._isScreenSharing}
              .screenSharingUser=${this._screenSharingUser}
              .screenShareStream=${this._screenShareStream}
              @voice-stop=${this.handleActiveCallVoiceStop}
              @return-to-chat=${this.handleReturnToChat}
              @voice-mute-toggle=${this.handleMuteToggle}
              @voice-volume-change=${this.handleVolumeChange}
              @screen-share-toggle=${this.handleScreenShareToggleRequest}
            ></chat-active-call>
          ` : html`
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
        ) : nothing}

        <div class="chat-room__messages" 
             @scroll=${this.handleMessagesScroll}
             @image-preview=${this.handleImagePreview}
             style="${this.showCallView ? 'display: none;' : ''}">
          ${this.isLoadingHistory
            ? html`<div class="message message--system">Loading history…</div>`
            : this.messages.length === 0
              ? html`<div class="message message--system">No messages yet. Say hello!</div>`
              : repeat(
                  this.messages,
                  (m) => m.id,
                  (m, index) =>
                    html`
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
            : nothing}
        </div>

        <chat-room-composer
          .submitting=${this.isUploadingImage}
          @message-submit=${this.handleMessageSubmit}
          @user-typing=${this.handleUserTyping}
          style="${this.showCallView ? 'display: none;' : ''}"
        ></chat-room-composer>

        ${this._previewImageUrl ? html`
          <chat-image-preview
            .imageUrl=${this._previewImageUrl}
            @close-preview=${this.closePreview}
          ></chat-image-preview>
        ` : nothing}
      </section>
    `;
  }
}