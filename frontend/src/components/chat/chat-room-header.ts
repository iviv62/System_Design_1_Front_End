import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { VoiceCallState } from "../../features/lib/chat/voice-call-controller";

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

  @property()
  voiceState: VoiceCallState = "idle";

  createRenderRoot() {
    return this;
  }

  private handleToggleTheme() {
    const next = this.theme === "light" ? "dark" : "light";
    this.dispatchEvent(
      new CustomEvent("theme-toggle", { detail: { theme: next }, bubbles: true, composed: true }),
    );
  }

  private handleVoiceClick() {
    const event = this.voiceState === "active" || this.voiceState === "calling"
      ? "voice-stop" : "voice-start";
    this.dispatchEvent(
      new CustomEvent(event, { bubbles: true, composed: true })
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
          <div class="chat-room__header-call-group">
            <button
              class="chat-room__header-action ${this.voiceState === 'active' ? 'chat-room__header-action--active' : ''}"
              type="button"
              title=${this.voiceState === "active" ? "End call" : "Start voice call"}
              aria-label=${this.voiceState === "active" ? "End call" : "Start voice call"}
              @click=${this.handleVoiceClick}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </button>
            <button class="chat-room__header-action" type="button" title="Video call" aria-label="Video call">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            </button>
          </div>
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
