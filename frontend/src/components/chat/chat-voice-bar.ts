import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { VoiceCallState } from "../../features/lib/chat/voice-call-controller";

@customElement("chat-voice-bar")
export class ChatVoiceBar extends LitElement {
  @property() state: VoiceCallState = "idle";

  createRenderRoot() { return this; }

  render() {
    if (this.state === "idle") return nothing;

    const label = {
      calling: "Connecting…",
      active: "🎙 Live — click to end",
      error: "⚠ Call failed",
    }[this.state];

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
