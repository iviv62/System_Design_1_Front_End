import { LitElement, html, nothing, unsafeCSS } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import chatActiveCallStylesRaw from "../../styles/chat-active-call.styles.scss?inline";
import type { VoiceParticipant } from "../../features/lib/chat/chat-room-api";
import type { ConnectionMetrics } from "../../features/lib/chat/connection-monitor";
import {
  iconWaveform,
  iconChat,
  iconMaximize,
  iconVideoCameraOff,
  iconMonitor,
  iconMicOff,
  iconMic,
  iconPhoneOff,
  iconVolumeOff,
  iconVolume,
  iconSettings,
  iconExpand,
} from "./chat-icons";

@customElement("chat-active-call")
export class ChatActiveCall extends LitElement {
  static styles = unsafeCSS(chatActiveCallStylesRaw);

  @property() roomName = "";
  @property() username = "";
  @property({ type: Array }) participants: VoiceParticipant[] = [];
  @property() callState: string = "idle";
  @property({ type: Boolean }) isMuted = false;
  @property({ type: Boolean }) isScreenSharing = false;
  @property() screenSharingUser: string | null = null;
  @property({ attribute: false }) screenShareStream: MediaStream | null = null;
  @property({ type: Object }) connectionMetrics: ConnectionMetrics | null = null;

  @state() private timer = "00:00";
  @state() private showVolumeSlider = false;
  @state() private volume = 80;
  @state() private isScreenShareLoading = false;
  @query(".active-call__screen-video") private screenVideoEl?: HTMLVideoElement;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callStartTime = 0;

  connectedCallback() {
    super.connectedCallback();
    if (this.callState === "active") {
      this.startTimer();
    }
  }

  disconnectedCallback() {
    this.stopTimer();
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("callState")) {
      if (this.callState === "active") {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }

    if (changedProperties.has("screenShareStream") || changedProperties.has("screenSharingUser")) {
      this.isScreenShareLoading = Boolean(this.screenSharingUser && !this.screenShareStream);
      void this.bindScreenShareVideo();
    }
  }

  private async bindScreenShareVideo() {
    this.requestUpdate();
    await this.updateComplete;
    const video = this.screenVideoEl;
    if (!video) return;

    video.srcObject = this.screenShareStream ?? null;

    if (!this.screenShareStream) return;

    await video.play().catch(() => {
      // Autoplay can be blocked transiently by browser policies; user interaction will recover.
    });
    this.isScreenShareLoading = false;
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

  private handleEndCall() {
    this.dispatchEvent(new CustomEvent("voice-stop", { bubbles: true, composed: true }));
  }

  private handleVolumeChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.volume = Number(input.value);
    this.dispatchEvent(new CustomEvent("voice-volume-change", { detail: { volume: this.volume }, bubbles: true, composed: true }));
  }

  private handleScreenShareToggle() {
    this.dispatchEvent(new CustomEvent("screen-share-toggle", { bubbles: true, composed: true }));
  }

  private async handleScreenShareFullscreen() {
    const video = this.screenVideoEl;
    if (!video) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await video.requestFullscreen();
    } catch {
      // No-op: fullscreen can fail on unsupported browsers or policy restrictions.
    }
  }

  render() {
    if (this.callState === "idle" || this.callState === "error") return nothing;

    const uniqueParticipants = new Map<string, VoiceParticipant>();
    uniqueParticipants.set(this.username, { peer_id: "self", username: this.username });
    for (const p of this.participants) {
      if (p.username !== this.username) {
        uniqueParticipants.set(p.username, p);
      }
    }

    return html`
      <div class="active-call">

        <!-- Header -->
        <div class="active-call__header">
          <div class="active-call__header-left">
            ${iconWaveform}
            <span class="active-call__header-title">
              VOICE ${this.callState === "calling" ? "CONNECTING..." : "CONNECTED"} / ${this.roomName.toUpperCase()}
            </span>
          </div>
          <div class="active-call__header-right">
            <span class="active-call__timer">${this.timer}</span>
            <button class="active-call__icon-btn" title="View Chat" aria-label="View Chat" @click=${() => this.dispatchEvent(new CustomEvent("return-to-chat", { bubbles: true, composed: true }))}>
              ${iconChat}
            </button>
          </div>
        </div>

        ${this.connectionMetrics ? html`
          <div class="active-call__metrics">
            <div class="active-call__metrics-title">Connection</div>
            <div>Ping: ${this.connectionMetrics.latencyMs} ms</div>
            <div>Loss: ${this.connectionMetrics.packetLossPct}%</div>
            <div>BW: ${this.connectionMetrics.bandwidthMbps} Mbps</div>
            <div>FPS: ${this.connectionMetrics.fps}</div>
          </div>
        ` : nothing}

        <!-- Grid -->
        <div class="active-call__grid">
          ${Array.from(uniqueParticipants.values()).map(p => {
            const isSelf = p.username === this.username;
            const color = this.getColorForUser(p.username);
            const initials = this.getInitials(p.username);

            return html`
              <div class="active-call__card" id=${p.peer_id}>
                <div class="active-call__avatar-wrap">
                  <div class="active-call__avatar" style="background-color: ${color}">
                    ${initials}
                  </div>
                </div>
                <div class="active-call__card-controls">
                  <div class="active-call__badge">
                    ${p.username} ${isSelf ? html`<span class="active-call__badge-you">YOU</span>` : ""}
                  </div>
                </div>
              </div>
            `;
          })}
        </div>

        ${this.screenShareStream || this.screenSharingUser ? html`
          <div class="active-call__screen-share">
            <div class="active-call__screen-share-header">
              <p class="active-call__screen-share-label">
                ${this.screenSharingUser
                  ? `${this.screenSharingUser} is sharing their screen`
                  : "Screen share is live"}
              </p>
              <button
                type="button"
                class="active-call__screen-fullscreen-btn"
                @click=${this.handleScreenShareFullscreen}
                ?disabled=${!this.screenShareStream}
                title="Fullscreen"
                aria-label="Fullscreen screen share"
              >
                ${iconMaximize}
              </button>
            </div>
            ${this.isScreenShareLoading ? html`
              <div class="active-call__screen-loading" role="status" aria-live="polite">
                <span class="active-call__screen-spinner"></span>
                <span>Establishing screen share...</span>
              </div>
            ` : nothing}
            <video class="active-call__screen-video" autoplay playsinline muted></video>
          </div>
        ` : nothing}

        <!-- Toolbar -->
        <div class="active-call__toolbar">
          <div class="active-call__toolbar-center">
            <button class="active-call__toolbar-btn" title="Toggle video" aria-label="Toggle video">
              ${iconVideoCameraOff}
            </button>
            <button
              class="active-call__toolbar-btn ${this.isScreenSharing ? "active-call__toolbar-btn--active" : ""}"
              title=${this.isScreenSharing ? "Stop sharing screen" : "Share screen"}
              aria-label=${this.isScreenSharing ? "Stop sharing screen" : "Share screen"}
              @click=${this.handleScreenShareToggle}
            >
              ${iconMonitor}
            </button>
            <div class="active-call__toolbar-divider"></div>
            <button
              class="active-call__toolbar-btn"
              style="${this.isMuted ? 'background-color: #ef4444; color: white; border-color: #ef4444;' : ''}"
              title=${this.isMuted ? "Unmute microphone" : "Mute microphone"}
              aria-label=${this.isMuted ? "Unmute microphone" : "Mute microphone"}
              @click=${() => this.dispatchEvent(new CustomEvent("voice-mute-toggle", { detail: { muted: !this.isMuted }, bubbles: true, composed: true }))}
            >
              ${this.isMuted ? iconMicOff : iconMic}
            </button>
            <button class="active-call__toolbar-btn active-call__toolbar-btn--end" title="End call" aria-label="End call" @click=${this.handleEndCall}>
              ${iconPhoneOff}
            </button>
          </div>
          <div class="active-call__toolbar-right">
            <div style="position: relative; display: inline-block;">
              ${this.showVolumeSlider ? html`
                <div style="position: fixed; inset: 0; z-index: 99;" @click=${() => this.showVolumeSlider = false}></div>
                <div class="active-call__volume-popup" style="position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; background-color: #1f2937; border-radius: 8px; padding: 12px 6px; display: flex; flex-direction: column; justify-content: center; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 100;">
                  <span style="color: #9ca3af; font-size: 12px; font-weight: bold; margin-bottom: 8px;">${this.volume}%</span>
                  <style>
                    .popup-slider::-webkit-slider-thumb {
                      appearance: none;
                      width: 14px;
                      height: 14px;
                      background: #f59e0b;
                      border-radius: 50%;
                      cursor: pointer;
                    }
                    .popup-slider::-moz-range-thumb {
                      width: 14px;
                      height: 14px;
                      background: #f59e0b;
                      border-radius: 50%;
                      cursor: pointer;
                    }
                  </style>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    .value=${String(this.volume)}
                    @input=${this.handleVolumeChange}
                    class="popup-slider"
                    style="appearance: none; width: 100px; height: 6px; background: #374151; accent-color: #f59e0b; border-radius: 3px; outline: none; margin: 0; transform: rotate(-90deg); transform-origin: center; margin-top: 40px; margin-bottom: 40px; cursor: pointer;"
                  />
                </div>
              ` : nothing}
              <button class="active-call__icon-btn" title=${this.volume === 0 ? "Unmute volume" : "Mute volume"} aria-label=${this.volume === 0 ? "Unmute volume" : "Mute volume"} @click=${() => this.showVolumeSlider = !this.showVolumeSlider}>
                ${this.volume === 0 ? iconVolumeOff : iconVolume}
              </button>
            </div>
            <button class="active-call__icon-btn" title="Settings" aria-label="Settings" @click=${() => this.dispatchEvent(new CustomEvent("open-settings", { bubbles: true, composed: true }))}>
              ${iconSettings}
            </button>
            <button class="active-call__icon-btn" title="Expand view" aria-label="Expand view">
              ${iconExpand}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-active-call": ChatActiveCall;
  }
}
