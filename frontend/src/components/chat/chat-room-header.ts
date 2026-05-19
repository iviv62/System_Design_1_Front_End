import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { VoiceCallState } from "../../features/lib/chat/webrtc-adapter";
import { iconPhone, iconVideo } from "./chat-icons";

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

  @property({ type: Number })
  onlineCount = 0;

  @property()
  voiceState: VoiceCallState = "idle";

  @property({ type: Boolean })
  showMembers = true;

  createRenderRoot() {
    return this;
  }

  private handleVoiceClick() {
    const event =
      this.voiceState === "active" || this.voiceState === "calling" ? "voice-stop" : "voice-start";
    this.dispatchEvent(new CustomEvent(event, { bubbles: true, composed: true }));
  }


  render() {
    return html`
      <header class="chat-room__header">
        <div class="chat-room__header-left">
          <h2 class="chat-room__title">${this.roomName || this.roomId}</h2>
          <p class="chat-room__meta">
            <span class="chat-room__online">${this.onlineCount} members online</span>
          </p>
        </div>
        <div class="chat-room__header-right" style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="chat-room__header-call-group">
            <button
              class="chat-room__header-action ${this.voiceState === "active"
                ? "chat-room__header-action--active"
                : ""}"
              type="button"
              title=${this.voiceState === "active" ? "End call" : "Start voice call"}
              aria-label=${this.voiceState === "active" ? "End call" : "Start voice call"}
              @click=${this.handleVoiceClick}
            >
              ${iconPhone}
            </button>
            <button
              class="chat-room__header-action"
              type="button"
              title="Video call"
              aria-label="Video call"
            >
              ${iconVideo}
            </button>

          </div>
        </div>
      </header>

      ${this.isReconnecting ? html`<div class="chat-room__banner">Reconnecting…</div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-room-header": ChatRoomHeader;
  }
}
