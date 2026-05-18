import { ThemeController } from "../../utils/theme-controller";
import { LitElement, html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import chatNavSidebarStylesRaw from "../../styles/chat-nav-sidebar.styles.scss?inline";
import { navigate } from "../../utils/navigate";
import { logout } from "../../features/lib/auth/auth-api";
import { iconHash, iconUsers, iconSearch, iconSettingsNav, iconLogout, iconHome } from "./chat-icons";

@customElement("chat-nav-sidebar")
export class ChatNavSidebar extends LitElement {
  themeCtrl = new ThemeController(this);
  @property()
  currentUsername = "";

  @property()
  roomName = "";

  @property()
  theme = "dark";

  static styles = unsafeCSS(chatNavSidebarStylesRaw);

  private getInitials(user: string): string {
    const parts = user.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  private async handleLogout() {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      navigate("/login");
    }
  }

  render() {
    return html`
      <nav class="nav-sidebar" aria-label="Navigation sidebar">
        <!-- Active room icon -->
        <div class="nav-sidebar__top">
          <button
            class="nav-sidebar__room-icon nav-sidebar__room-icon--active"
            title=${this.roomName || "Current room"}
            aria-label="Current room"
          >
            ${iconHash}
          </button>
        </div>

        <!-- Navigation icons -->
        <div class="nav-sidebar__nav">
          <button
            class="nav-sidebar__icon-btn"
            title="Lobby"
            aria-label="Back to lobby"
            @click=${() => navigate("/chat")}
          >
            ${iconHome}
          </button>

          <button
            class="nav-sidebar__icon-btn"
            title="Members"
            aria-label="Toggle members"
            @click=${() => {
              this.dispatchEvent(
                new CustomEvent("toggle-members", { bubbles: true, composed: true }),
              );
            }}
          >
            ${iconUsers}
          </button>

          <button class="nav-sidebar__icon-btn" title="Search" aria-label="Search">
            ${iconSearch}
          </button>

          <button
            class="nav-sidebar__icon-btn"
            title="Settings"
            aria-label="Settings"
            @click=${() => {
              this.dispatchEvent(
                new CustomEvent("open-settings", { bubbles: true, composed: true }),
              );
            }}
          >
            ${iconSettingsNav}
          </button>
        </div>

        <div
          class="nav-sidebar__bottom"
          style="margin-top: auto; display: flex; flex-direction: column; gap: 1rem; align-items: center;"
        >
          <button
            class="nav-sidebar__icon-btn"
            title="Logout"
            aria-label="Logout"
            @click=${this.handleLogout}
          >
            ${iconLogout}
          </button>

          <button
            class="nav-sidebar__avatar"
            title=${this.currentUsername}
            aria-label="Your profile"
          >
            ${this.getInitials(this.currentUsername)}
          </button>
        </div>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-nav-sidebar": ChatNavSidebar;
  }
}
