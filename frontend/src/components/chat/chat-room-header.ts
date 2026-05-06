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
    const next = this.theme === "light" ? "dark" : "light";
    this.dispatchEvent(
      new CustomEvent("theme-toggle", { detail: { theme: next }, bubbles: true, composed: true }),
    );
  }

  render() {
    return html`
      <header class="chat-room__header">
        <div class="chat-room__header-left">
          <h2 class="chat-room__title">${this.roomName || this.roomId}</h2>
          <p class="chat-room__meta">Logged in as <strong>${this.username}</strong> • <span class="chat-room__online">Online</span></p>
        </div>
        <div class="chat-room__header-right">
          <button class="chat-room__header-action" type="button" title="Search" aria-label="Search">⌕</button>
          <button
            class="chat-room__header-action chat-room__header-action--theme"
            type="button"
            title="Toggle theme"
            aria-label="Toggle theme"
            @click=${this.handleToggleTheme}
          >
            ${this.theme === "light" ? "☾" : "☀"}
          </button>
          <button class="chat-room__header-action" type="button" title="Menu" aria-label="Menu">⋮</button>
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
