import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { VoiceCallState } from "../../features/lib/chat/voice-call-controller";
import type { VoiceParticipant } from "../../features/lib/chat/chat-room-api";

@customElement("chat-voice-bar")
export class ChatVoiceBar extends LitElement {
  @property() state: VoiceCallState = "idle";
  @property({ type: Array }) participants: VoiceParticipant[] = [];

  createRenderRoot() { return this; }

  render() {
    if (this.state === "idle") return nothing;

    return html`
      <div class="voice-bar voice-bar--${this.state}">
        <span class="voice-bar__label">
          ${this.state === "calling" ? "Connecting…" : this.state === "error" ? "⚠ Call failed" : "🎙 Live"}
        </span>

        ${this.participants.length > 0 ? html`
          <ul class="voice-bar__participants" style="display: flex; gap: 8px; list-style: none; margin: 0; padding: 0; align-items: center; font-size: 0.875rem;">
            ${this.participants.map(
              (p) => html`<li class="voice-bar__participant">${p.username}</li>`
            )}
          </ul>
        ` : nothing}

        <button
          class="voice-bar__btn"
          type="button"
          @click=${() => this.dispatchEvent(
            new CustomEvent(
              this.state === "error" ? "voice-dismiss" : "voice-stop",
              { bubbles: true, composed: true }
            )
          )}
        >
          ${this.state === "error" ? "Dismiss" : "End call"}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "chat-voice-bar": ChatVoiceBar; }
}
