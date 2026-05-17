import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { logout } from "../../features/lib/auth/auth-api";
import { navigate } from "../../utils/navigate";
import "../ui/theme-button";

@customElement("lobby-header")
export class LobbyHeader extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property() theme: "light" | "dark" = "light";

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
      <div class="lobby__header">
        <h1 class="lobby__title">Chat Lobby</h1>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <theme-button .theme=${this.theme}></theme-button>
          <button class="lobby__btn lobby__btn--dark" @click=${this.handleLogout}>Logout</button>
        </div>
      </div>
    `;
  }
}
