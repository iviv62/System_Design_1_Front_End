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
  fetchVoiceStatus,
  type VoiceParticipant,
  removeMessageReaction,
  uploadChatImage,
  fetchConnectedUsers,
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
import "./chat-room-users";

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
  @state() private _showMembers = true;
  @state() private _activeUsers: string[] = [];

  private _starsAnimId: number | null = null;
  private readonly boundResize = this.handleResize.bind(this);

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
  /** Unix epoch seconds from backend — seeds both the active-call and voice-bar timers. */
  @state() private _callStartTime: number | null = null;

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
          if (state === "idle" || state === "error") {
            this.resetVoiceUiState();
          }
        },
        onParticipantsChange: (participants: Participant[]) => {
          this._voiceParticipants = participants as VoiceParticipant[];
        },
        onScreenShareStarted: (stream, sharerName, isLocal) => {
          // stream may be null on the initial WS notification (before the
          // WebRTC offer/track has arrived). We still set _screenSharingUser
          // so the viewer mounts immediately and shows the loading state.
          // A second call from ontrack will pass the real MediaStream.
          this._screenSharingUser = sharerName.replace(" (you)", "") || this.username;
          if (stream !== null) {
            this._screenShareStream = stream;
          }
          this._isScreenSharing = isLocal || this.webrtc.isScreenSharing;
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

  firstUpdated() {
    this._initStarfield();
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("visibilitychange", this.boundHandleVisibilityChange);
    window.addEventListener("focus", this.boundHandleVisibilityChange);
    window.addEventListener("resize", this.boundResize);
    this.updateAdapterIdentity();
    this.controller.start();
    void this.loadUnreadCountSnapshot();
    void this.loadActiveUsersSnapshot();
    ThemeController.set(this.themeCtrl.theme);
  }

  disconnectedCallback(): void {
    window.removeEventListener("visibilitychange", this.boundHandleVisibilityChange);
    window.removeEventListener("focus", this.boundHandleVisibilityChange);
    window.removeEventListener("resize", this.boundResize);
    if (this._starsAnimId !== null) cancelAnimationFrame(this._starsAnimId);
    this.controller.stop();
    this.webrtc.destroy();
    this.resetVoiceUiState();
    super.disconnectedCallback();
  }

  private handleResize() {
    this._initStarfield();
  }

  private _initStarfield() {
    const canvas = this.shadowRoot?.getElementById("starsCanvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    if (this._starsAnimId !== null) cancelAnimationFrame(this._starsAnimId);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = this.themeCtrl.theme === "dark";
    const COUNT = isDark ? 130 : 60;

    interface Star {
      x: number; y: number;
      radius: number;
      alpha: number;
      speed: number;
      color: string;
    }

    const STAR_COLORS_DARK = ["#ffffff", "#c8d8ff", "#ffd6e0", "#d0f0ff"];
    const STAR_COLORS_LIGHT = ["#334155", "#475569", "#1e293b"];

    const stars: Star[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 0.4 + Math.random() * (isDark ? 1.3 : 0.8),
      alpha: Math.random(),
      speed: 0.004 + Math.random() * 0.012,
      color: isDark
        ? STAR_COLORS_DARK[Math.floor(Math.random() * STAR_COLORS_DARK.length)]
        : STAR_COLORS_LIGHT[Math.floor(Math.random() * STAR_COLORS_LIGHT.length)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const star of stars) {
        star.alpha += star.speed;
        if (star.alpha > 1 || star.alpha < 0) star.speed = -star.speed;
        ctx.globalAlpha = Math.max(0.08, Math.min(1, star.alpha));
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      this._starsAnimId = requestAnimationFrame(draw);
    };

    draw();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has("roomId") || changedProperties.has("username")) {
      this.updateAdapterIdentity();
      void this.loadActiveUsersSnapshot();
    }
    if (changedProperties.has("messages")) this.handleMessagesUpdated();

    if (changedProperties.has("settingsState") && this.settingsState) {
      this.webrtc.setMonitorEnabled(this.settingsState.isConnectionMonitorEnabled);
      if (!this.settingsState.isConnectionMonitorEnabled) {
        this._connectionMetrics = null;
      }
    }
  }

  @state() private _activeUsersCount = 0;

  private updateAdapterIdentity(): void {
    this.controller.updateIdentity({ room: this.roomId, username: this.username });
    this.webrtc.updateIdentity(this.roomId, this.username);
  }

  private async loadActiveUsersSnapshot() {
    if (!this.roomId) return;
    try {
      const snapshot = await fetchConnectedUsers(this.roomId);
      this._activeUsers = snapshot.users;
      this._activeUsersCount = snapshot.users.length;
    } catch {
      // Ignored
    }
  }

  private async loadUnreadCountSnapshot() {
    try {
      this.pendingUnreadCount = await fetchUnreadCount(this.roomId, this.username);
    } catch {
      this.pendingUnreadCount = null;
    }
  }

  public toggleMembers() {
    this._showMembers = !this._showMembers;
  }

  private toggleTheme(e?: CustomEvent) {
    const next = e?.detail?.theme ?? (this.themeCtrl.theme === "light" ? "dark" : "light");
    ThemeController.set(next);
  }

  private emitActiveUsers(users: string[]) {
    this._activeUsersCount = users.length;
    this._activeUsers = users;
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
    void this.loadActiveUsersSnapshot();
    this.dispatchEvent(new CustomEvent("room-connected", { bubbles: true, composed: true }));
  }

  private handleToggleMembers() {
    this._showMembers = !this._showMembers;
  }

  private resetVoiceUiState() {
    this._voiceParticipants = [];
    this._screenSharingUser = null;
    this._screenShareStream = null;
    this._isScreenSharing = false;
    this._callStartTime = null;
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
    // Fetch the authoritative call start time from the backend so both the
    // active-call view and the voice-bar ribbon show the same elapsed duration.
    void this.loadCallStartTime();
  };

  private async loadCallStartTime(): Promise<void> {
    try {
      const status = await fetchVoiceStatus(this.roomId);
      this._callStartTime = status.call_start_time;
    } catch {
      // Non-critical: both components fall back to Date.now()
      this._callStartTime = null;
    }
  }

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
      if (this.webrtc.isScreenSharing) {
        this.webrtc.stopScreenShare();
      } else {
        await this.webrtc.startScreenShare();
      }
    } catch (err) {
      console.error("[ChatRoom] screen share toggle failed", err);
    }
  }
