import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { watch } from "zustand-lit";
import { fetchCurrentUser, tryRefreshSession } from "../features/lib/auth/auth-api";
import { authStore } from "../store/auth-store";
import type { AuthState } from "../store/auth-store";
import { navigate } from "../utils/navigate";
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

  // zustand-lit manages subscribe/unsubscribe and re-renders automatically.
  @watch(authStore)
  private authState?: AuthState;

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      box-sizing: border-box;
      min-height: 100vh;
    }

    .room-page {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 1120px;
      margin: 0 auto;
    }

    .room-page__layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 250px;
      gap: 0.85rem;
      align-items: stretch;
    }

    chat-room {
      width: 100%;
      max-width: none;
      margin: 0;
    }

    .room-page__back {
      align-self: flex-start;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #1e293b;
      border-radius: 8px;
      padding: 0.45rem 0.8rem;
      cursor: pointer;
      font-size: 0.9rem;
    }
  `;

  async connectedCallback() {
    super.connectedCallback();

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

  private handleActiveUsersChange(e: CustomEvent<{ users: string[] }>) {
    this.activeUsers = e.detail.users;
  }

  render() {
    const currentRoomId = this.extractRoomIdFromUrl();

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
            @active-users-change=${this.handleActiveUsersChange}
          ></chat-room>

          <chat-room-users
            .users=${this.activeUsers}
            .currentUsername=${this.username}
            .loading=${false}
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
