import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { VoiceCallState } from "../../features/lib/chat/webrtc-adapter";
import type { VoiceParticipant } from "../../features/lib/chat/chat-room-api";
import { iconMicOffSm, iconMicSm, iconReturnToCall } from "./chat-icons";

@customElement("chat-voice-bar")
export class ChatVoiceBar extends LitElement {
  @property() state: VoiceCallState = "idle";
  @property({ type: Array }) participants: VoiceParticipant[] = [];
  @property() username = "";
  @property({ type: Boolean }) isMuted = false;

  @state() private timer = "00:00";
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callStartTime = 0;

  connectedCallback() {
    super.connectedCallback();
    if (this.state === "active") {
      this.startTimer();
    }
  }

  disconnectedCallback() {
    this.stopTimer();
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("state")) {
      if (this.state === "active") {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }
  }

  private startTimer() {
    if (this.intervalId) return;
    this.callStartTime = Date.now();
    this.intervalId = setInterval(() => {
      const diff = Math.floor((Date.now() - this.callStartTime) / 1000);
      const minutes = String(Math.floor(diff / 60)).padStart(2, "0");
      const seconds = String(diff % 60).padStart(2, "0");
      this.timer = `${minutes}:${seconds}`;
    }, 1000);
  }

  private stopTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.timer = "00:00";
  }

  private getInitials(name: string) {
    return name ? name.substring(0, 2).toUpperCase() : "?";
  }

  private getColorForUser(name: string) {
    const colors = ["#f59e0b", "#3b82f6", "#a855f7", "#ec4899", "#10b981", "#ef4444"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  createRenderRoot() {
    return this;
  }

  render() {
    if (this.state === "idle") return nothing;

    const uniqueParticipants = new Map<string, VoiceParticipant>();
    uniqueParticipants.set(this.username, { peer_id: "self", username: this.username });
    for (const p of this.participants) {
      if (p.username !== this.username) {
        uniqueParticipants.set(p.username, p);
      }
    }
    const partsArray = Array.from(uniqueParticipants.values());

    return html`
      <div
        class="voice-bar voice-bar--${this.state}"
        style="display: flex; align-items: center; background-color: #10b981; color: white; padding: 12px 16px; justify-content: space-between;"
      >
        <div style="display: flex; align-items: center; gap: 16px;">
          <!-- Avatars -->
          <div style="display: flex; align-items: center;">
            ${partsArray
              .slice(0, 3)
              .map(
                (p, i) => html`
                  <div
                    style="width: 32px; height: 32px; border-radius: 50%; background-color: ${this.getColorForUser(
                      p.username,
                    )}; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 2px solid #10b981; margin-left: ${i >
                    0
                      ? "-12px"
                      : "0"}; z-index: ${3 - i};"
                  >
                    ${this.getInitials(p.username).charAt(0)}
                  </div>
                `,
              )}
            ${partsArray.length > 3
              ? html`
                  <div
                    style="width: 32px; height: 32px; border-radius: 50%; background-color: rgba(255,255,255,0.2); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid #10b981; margin-left: -12px; z-index: 0;"
                  >
                    +${partsArray.length - 3}
                  </div>
                `
              : nothing}
          </div>

          <span
            class="voice-bar__label"
            style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px;"
          >
            ${this.state === "calling"
              ? "VOICE CONNECTING..."
              : this.state === "error"
                ? "⚠ CALL FAILED"
                : html`VOICE CONNECTED / ${this.timer}`}
            ${this.state === "active"
              ? html`
                  <button
                    style="background: ${this.isMuted
                      ? "#ef4444"
                      : "transparent"}; border: none; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 2px;"
                    title=${this.isMuted ? "Unmute microphone" : "Mute microphone"}
                    aria-label=${this.isMuted ? "Unmute microphone" : "Mute microphone"}
                    @click=${() =>
                      this.dispatchEvent(
                        new CustomEvent("voice-mute-toggle", {
                          detail: { muted: !this.isMuted },
                          bubbles: true,
                          composed: true,
                        }),
                      )}
                  >
                    ${this.isMuted ? iconMicOffSm : iconMicSm}
                  </button>
                `
              : nothing}
          </span>
        </div>

        <button
          class="voice-bar__btn"
          type="button"
          style="background-color: rgba(0,0,0,0.1); border: none; color: white; padding: 6px 12px; border-radius: 4px; font-weight: bold; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background-color 0.2s;"
          onmouseover="this.style.backgroundColor='rgba(0,0,0,0.2)'"
          onmouseout="this.style.backgroundColor='rgba(0,0,0,0.1)'"
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent(this.state === "error" ? "voice-dismiss" : "return-to-call", {
                bubbles: true,
                composed: true,
              }),
            )}
        >
          ${this.state === "error" ? "DISMISS" : html`RETURN TO CALL ${iconReturnToCall}`}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-voice-bar": ChatVoiceBar;
  }
}
