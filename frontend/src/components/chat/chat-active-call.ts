import { LitElement, html, nothing, unsafeCSS } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import chatActiveCallStylesRaw from "../../styles/chat-active-call.styles.scss?inline";
import type { VoiceParticipant } from "../../features/lib/chat/chat-room-api";

@customElement("chat-active-call")
export class ChatActiveCall extends LitElement {
  static styles = unsafeCSS(chatActiveCallStylesRaw);

  @property() roomName = "";
  @property() username = "";
  @property({ type: Array }) participants: VoiceParticipant[] = [];
  @property() callState: string = "idle"; // "idle", "calling", "active", "error"
  @property({ type: Boolean }) isMuted = false;
  @property({ type: Boolean }) isScreenSharing = false;
  @property() screenSharingUser: string | null = null;
  @property({ attribute: false }) screenShareStream: MediaStream | null = null;

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
      const video = this.renderRoot.querySelector<HTMLVideoElement>(".active-call__screen-video");
      if (video) {
        video.srcObject = this.screenShareStream ?? null;
      }
      void this.bindScreenShareVideo();
    }
  }

  private async bindScreenShareVideo() {
    await this.updateComplete;
    const video = this.screenVideoEl;
    if (!video) return;

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
    // Simple mock colors logic based on length/chars
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

    // Build the grid of participants (always include self)
    // Create a map to deduplicate by username, prioritizing our explicit self entry
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-8"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path></svg>
            <span class="active-call__header-title">
              VOICE ${this.callState === "calling" ? "CONNECTING..." : "CONNECTED"} / ${this.roomName.toUpperCase()}
            </span>
          </div>
          <div class="active-call__header-right">
            <span class="active-call__timer">${this.timer}</span>
            <button class="active-call__icon-btn" title="View Chat" @click=${() => this.dispatchEvent(new CustomEvent("return-to-chat", { bubbles: true, composed: true }))}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </button>
          </div>
        </div>

        <!-- Grid -->
        <div class="active-call__grid">
          ${Array.from(uniqueParticipants.values()).map(p => {
            const isSelf = p.username === this.username;
            // mock random states for demo purposes - normally would come from properties
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
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
            <button class="active-call__toolbar-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>
            <button
              class="active-call__toolbar-btn ${this.isScreenSharing ? "active-call__toolbar-btn--active" : ""}"
              title=${this.isScreenSharing ? "Stop sharing screen" : "Share screen"}
              aria-label=${this.isScreenSharing ? "Stop sharing screen" : "Share screen"}
              @click=${this.handleScreenShareToggle}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            </button>
            <div class="active-call__toolbar-divider"></div>
            <button class="active-call__toolbar-btn" style="${this.isMuted ? 'background-color: #ef4444; color: white; border-color: #ef4444;' : ''}" @click=${() => this.dispatchEvent(new CustomEvent("voice-mute-toggle", { detail: { muted: !this.isMuted }, bubbles: true, composed: true }))}>
              ${this.isMuted ? html`
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              ` : html`
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              `}
            </button>
            <button class="active-call__toolbar-btn active-call__toolbar-btn--end" @click=${this.handleEndCall}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
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
                  <input type="range" min="0" max="100" .value=${String(this.volume)} @input=${this.handleVolumeChange} class="popup-slider" style="appearance: none; width: 100px; height: 6px; background: #374151; accent-color: #f59e0b; border-radius: 3px; outline: none; margin: 0; transform: rotate(-90deg); transform-origin: center; margin-top: 40px; margin-bottom: 40px; cursor: pointer;"/>
                </div>
              ` : nothing}
              <button class="active-call__icon-btn" @click=${() => this.showVolumeSlider = !this.showVolumeSlider}>
                ${this.volume === 0 ? html`
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                ` : html`
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                `}
              </button>
            </div>
            <button class="active-call__icon-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="15" y1="3" x2="21" y2="3"></line><line x1="21" y1="3" x2="21" y2="9"></line><line x1="9" y1="21" x2="3" y2="21"></line><line x1="3" y1="21" x2="3" y2="15"></line><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
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
