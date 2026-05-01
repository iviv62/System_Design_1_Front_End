import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("chat-room-header")
export class ChatRoomHeader extends LitElement {
  @property()
  roomName = "";

  @property()
  roomId = "";

  @property()
  username = "Guest";

  @property()
  theme: "light" | "dark" = "light";

  @property({ type: Boolean })
  isReconnecting = false;

  createRenderRoot() {
    return this;
  }

  private handleToggleTheme() {
    this.dispatchEvent(
      new CustomEvent("theme-toggle", { bubbles: true, composed: true }),
    );
  }

  render() {
    return html`
      <header class="chat-room__header">
        <div class="chat-room__header-left">
          <h2 class="chat-room__title">${this.roomName || this.roomId}</h2>
          <p class="chat-room__meta">Logged in as <strong>${this.username}</strong></p>
        </div>
        <div class="chat-room__header-right">
          <button class="chat-room__icon-btn" @click=${this.handleToggleTheme} title="Toggle theme">
            ${this.theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </header>

      ${this.isReconnecting
        ? html`<div class="chat-room__banner">Reconnecting…</div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-room-header": ChatRoomHeader;
  }
}
