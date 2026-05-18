import { LitElement, html, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { watch } from "zustand-lit";
import { fetchCurrentUser, tryRefreshSession } from "../features/lib/auth/auth-api";
import { fetchConnectedUsers } from "../features/lib/chat/chat-room-api";
import { authStore } from "../store/auth-store";
import type { AuthState } from "../store/auth-store";
import { navigate } from "../utils/navigate";
import { ThemeController } from "../utils/theme-controller";
import pageChatStylesRaw from "../styles/page-chat.styles.scss?inline";

import "../components/chat/chat-room";
import "../components/chat/chat-room-users";
import "../components/chat/chat-nav-sidebar";
import "../components/chat/chat-settings-modal";

/**
 * Page wrapper for the dedicated chat room view.
 * Keeps app-root clean and gives each page a consistent mount point.
 */
@customElement("page-chat")
export class PageChat extends LitElement {
  private themeCtrl = new ThemeController(this);

  @state() private authChecked = false;
  @state() private isAuthorized = false;
  @state() private username = "";
  @state() private currentRoomId = "";
  @state() private isSettingsOpen = false;

  // zustand-lit manages subscribe/unsubscribe and re-renders automatically.
  @watch(authStore)
  private authState?: AuthState;

  static styles = unsafeCSS(pageChatStylesRaw);

  async connectedCallback() {
    super.connectedCallback();
    this.currentRoomId = this.extractRoomIdFromUrl();

    try {
      if (!authStore.getState().accessToken) {
        const refreshed = await tryRefreshSession();
        if (!refreshed) {
          throw new Error("Session refresh failed");
        }
      }

      const me = await fetchCurrentUser();
      const resolvedUsername = me.username?.trim() ?? "";
      if (!resolvedUsername) {
        throw new Error("Authenticated user is missing a username.");
      }
      this.username = resolvedUsername;
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

  private handleRoomConnected() {
    // Left for potential extension
  }

  render() {
    const currentRoomId = this.extractRoomIdFromUrl();
    if (currentRoomId !== this.currentRoomId) {
      this.currentRoomId = currentRoomId;
    }

    if (!this.authChecked) {
      return html`<p style="padding: 1rem;">Checking session...</p>`;
    }

    if (!this.isAuthorized || !currentRoomId) {
      return html``;
    }

    return html`
      <div class="room-page">
        <chat-nav-sidebar
          .theme=${this.themeCtrl.theme}
          @open-settings=${() => {
            this.isSettingsOpen = true;
          }}
          @toggle-members=${() => {
            this.shadowRoot?.querySelector("chat-room")?.toggleMembers();
          }}
          .currentUsername=${this.username}
          .roomName=${currentRoomId}
        ></chat-nav-sidebar>

        <chat-room
          .username=${this.username}
          .roomId=${currentRoomId}
          .roomName=${currentRoomId}
          @room-connected=${this.handleRoomConnected}
          @open-settings=${() => {
            this.isSettingsOpen = true;
          }}
        ></chat-room>
      </div>

      <chat-settings-modal
        .open=${this.isSettingsOpen}
        @closed=${() => {
          this.isSettingsOpen = false;
        }}
      ></chat-settings-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-chat": PageChat;
  }
}
