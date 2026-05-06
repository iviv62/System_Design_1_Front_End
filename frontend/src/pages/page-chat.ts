import { LitElement, html, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { watch } from "zustand-lit";
import { fetchCurrentUser, tryRefreshSession } from "../features/lib/auth/auth-api";
import { fetchConnectedUsers } from "../features/lib/chat/chat-room-api";
import { authStore } from "../store/auth-store";
import type { AuthState } from "../store/auth-store";
import { navigate } from "../utils/navigate";
import pageChatStylesRaw from "../styles/page-chat.styles.scss?inline";
import "../components/chat/chat-room";
import "../components/chat/chat-room-users";

/**
 * Page wrapper for the dedicated chat room view.
 * Keeps app-root clean and gives each page a consistent mount point.
 */
@customElement("page-chat")
export class PageChat extends LitElement {
  @state() private authChecked = false;
  @state() private isAuthorized = false;
  @state() private username = "";
  @state() private activeUsers: string[] = [];
  @state() private activeUsersLoading = false;
  @state() private currentRoomId = "";

  // zustand-lit manages subscribe/unsubscribe and re-renders automatically.
  @watch(authStore)
  private authState?: AuthState;

  static styles = unsafeCSS(pageChatStylesRaw);

  async connectedCallback() {
    super.connectedCallback();
    this.currentRoomId = this.extractRoomIdFromUrl();

    if (!authStore.getState().accessToken) {
      const refreshed = await tryRefreshSession();
      if (!refreshed) {
        this.authChecked = true;
        this.isAuthorized = false;
        localStorage.setItem("redirect_after_login", window.location.pathname);
        navigate("/login");
        return;
      }
    }

    try {
      const me = await fetchCurrentUser();
      const resolvedUsername = me.username?.trim() ?? "";
      if (!resolvedUsername) {
        throw new Error("Authenticated user is missing a username.");
      }
      this.username = resolvedUsername;
      this.activeUsers = [resolvedUsername];
      if (this.currentRoomId) {
        void this.loadConnectedUsersSnapshot(this.currentRoomId);
      }
      this.isAuthorized = true;
    } catch {
      authStore.getState().logout();
      localStorage.setItem("redirect_after_login", window.location.pathname);
      this.isAuthorized = false;
      navigate("/login");
    } finally {
      this.authChecked = true;
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);

    if (this.authChecked && this.isAuthorized && !this.authState?.accessToken) {
      this.isAuthorized = false;
      localStorage.setItem("redirect_after_login", window.location.pathname);
      navigate("/login");
      return;
    }
  }

  private extractRoomIdFromUrl(): string {
    const prefix = "/chat/";
    const path = window.location.pathname;
    if (!path.startsWith(prefix)) return "";

    const encoded = path.slice(prefix.length);
    if (!encoded) return "";

    // Room IDs can be UUIDs or human-readable IDs.
    return decodeURIComponent(encoded.split("/")[0]);
  }

  private async loadConnectedUsersSnapshot(roomId: string) {
    if (!roomId) return;

    this.activeUsersLoading = true;
    try {
      const snapshot = await fetchConnectedUsers(roomId);
      this.activeUsers = snapshot.users;
    } catch {
      // Websocket snapshot events can still keep this state in sync.
    } finally {
      this.activeUsersLoading = false;
    }
  }

  private handleActiveUsersChange(e: CustomEvent<{ users: string[] }>) {
    this.activeUsers = e.detail.users;
  }

  private handleRoomConnected() {
    if (this.currentRoomId) {
      void this.loadConnectedUsersSnapshot(this.currentRoomId);
    }
  }

  render() {
    const currentRoomId = this.extractRoomIdFromUrl();
    if (currentRoomId !== this.currentRoomId) {
      this.currentRoomId = currentRoomId;
      if (this.isAuthorized && currentRoomId) {
        void this.loadConnectedUsersSnapshot(currentRoomId);
      }
    }

    if (!this.authChecked) {
      return html`<p style="padding: 1rem;">Checking session...</p>`;
    }

    if (!this.isAuthorized || !currentRoomId) {
      return html``;
    }

    return html`
      <div class="room-page">
        <button class="room-page__back" @click=${() => navigate("/chat")}>Back to Lobby</button>
        <div class="room-page__layout">
          <chat-room
            .username=${this.username}
            .roomId=${currentRoomId}
            .roomName=${currentRoomId}
            @room-connected=${this.handleRoomConnected}
            @active-users-change=${this.handleActiveUsersChange}
          ></chat-room>

          <chat-room-users
            .users=${this.activeUsers}
            .currentUsername=${this.username}
            .loading=${this.activeUsersLoading}
          ></chat-room-users>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-chat": PageChat;
  }
}
