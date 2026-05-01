import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./ui/theme-button";

@customElement("lobby-header")
export class LobbyHeader extends LitElement {
  createRenderRoot() { return this; }

  @property() theme: "light" | "dark" = "light";

  render() {
    return html`
      <div class="lobby__header">
        <h1 class="lobby__title">Chat Lobby</h1>
        <theme-button .theme=${this.theme} @theme-changed=${(e: CustomEvent) => this.dispatchEvent(new CustomEvent("toggle-theme", { detail: e.detail, bubbles: true, composed: true }))}>
          ${this.theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </theme-button>
      </div>
    `;
  }
}
