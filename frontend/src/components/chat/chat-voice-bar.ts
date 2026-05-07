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

    const label = this.state === "active"
      ? `🎙 Live${this.participants.length > 1 ? ` · ${this.participants.length} in call` : ""} — click to end`
      : this.state === "calling"
        ? "Connecting…"
        : "⚠ Call failed";

    const btnLabel = this.state === "error" ? "Dismiss" : "End call";

    return html`
      <div class="voice-bar voice-bar--${this.state}">
        <span class="voice-bar__label">${label}</span>
        <button
          class="voice-bar__btn"
          type="button"
          @click=${() => this.dispatchEvent(
            new CustomEvent(
              this.state === "error" ? "voice-dismiss" : "voice-stop",
              { bubbles: true, composed: true }
            )
          )}
        >${btnLabel}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "chat-voice-bar": ChatVoiceBar; }
}
