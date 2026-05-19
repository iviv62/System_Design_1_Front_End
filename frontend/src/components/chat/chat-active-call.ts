import { LitElement, html, nothing, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import chatActiveCallStylesRaw from "../../styles/chat-active-call.styles.scss?inline";
import type { VoiceParticipant } from "../../features/lib/chat/chat-room-api";
import type { ConnectionMetrics } from "../../features/lib/chat/connection-monitor";
import { getInitials, getColorForUser } from "./chat-call-utils";
import "./chat-participant-card";
import "./chat-screen-share-viewer";
import {
  iconWaveform,
  iconChat,
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

/**
 * Orchestration shell for the active voice-call overlay.
 * Responsible for: call state, timer, participant dedup, volume, and toolbar events.
 * Sub-component responsibilities:
 *   - <chat-participant-card>     → individual participant tile rendering
 *   - <chat-screen-share-viewer> → video stream binding, loading state, fullscreen
 *   - chat-call-utils.ts         → pure avatar helpers (getInitials, getColorForUser)
 */
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
  /**
   * Unix epoch (seconds) at which the call started, as returned by the backend
   * GET /voice/{room}/status `call_start_time` field.
   * When provided, the timer is seeded from this value so all participants
   * (including late joiners) see the same elapsed duration.
   * Falls back to Date.now() if null.
   */
  @property({ type: Number }) backendCallStartTime: number | null = null;

  @state() private timer = "00:00";
  @state() private showVolumeSlider = false;
  @state() private volume = 80;
  @state() private isScreenShareLoading = false;
  /**
   * Cached, deduped participant list. Recomputed in updated() only when
   * `participants` or `username` changes — NOT on every timer tick.
   * This prevents a Map + Array.from() allocation every second.
   */
  @state() private _uniqueParticipants: VoiceParticipant[] = [];

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callStartTime = 0;

  private rebuildUniqueParticipants() {
    const map = new Map<string, VoiceParticipant>();
    map.set(this.username, { peer_id: "self", username: this.username });
    for (const p of this.participants) {
      if (p.username !== this.username) {
        map.set(p.username, p);
      }
    }
    this._uniqueParticipants = Array.from(map.values());
  }

  disconnectedCallback() {
    // Only stop the interval; do NOT reset the display here.
    // The timer display resets when callState transitions away from "active".
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string, unknown>) {
    // Rebuild the deduped participant list only when the source data changes,
    // not on every timer tick.
    if (changedProperties.has("participants") || changedProperties.has("username")) {
      this.rebuildUniqueParticipants();
    }

    if (changedProperties.has("callState")) {
      if (this.callState === "active") {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }

    // If the backend start time arrives after callState is already active
    // (e.g. status fetch resolves after the WS join event), restart the timer
    // so the elapsed offset is applied immediately — but only if the value
    // actually changed to avoid a flicker on parent re-renders.
    if (
      changedProperties.has("backendCallStartTime") &&
      this.callState === "active" &&
      this.backendCallStartTime != null &&
      this.backendCallStartTime !== this.callStartTime / 1000
    ) {
      this.stopTimer();
      this.startTimer();
    }

    if (changedProperties.has("screenShareStream") || changedProperties.has("screenSharingUser")) {
      this.isScreenShareLoading = Boolean(this.screenSharingUser && !this.screenShareStream);
    }
  }

  private startTimer() {
    if (this.intervalId) return;
    // Seed from backend timestamp (Unix seconds → ms) when available so that
    // all participants — including late joiners — see the same elapsed duration.
    // Falls back to Date.now() when no backend value is present.
    this.callStartTime =
      this.backendCallStartTime != null
        ? this.backendCallStartTime * 1000
        : Date.now();

    // Render the first tick synchronously to avoid a 1-second blank flash.
    this.tickTimer();
    this.intervalId = setInterval(() => this.tickTimer(), 1000);
  }

  private tickTimer() {
    const diff = Math.max(0, Math.floor((Date.now() - this.callStartTime) / 1000));
    const minutes = String(Math.floor(diff / 60)).padStart(2, "0");
    const seconds = String(diff % 60).padStart(2, "0");
    this.timer = `${minutes}:${seconds}`;
  }

  private stopTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.timer = "00:00";
  }

  private handleEndCall() {
    this.dispatchEvent(new CustomEvent("voice-stop", { bubbles: true, composed: true }));
  }

  private handleVolumeChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.volume = Number(input.value);
    this.dispatchEvent(
      new CustomEvent("voice-volume-change", {
        detail: { volume: this.volume },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleScreenShareToggle() {
    this.dispatchEvent(new CustomEvent("screen-share-toggle", { bubbles: true, composed: true }));
  }

  render() {
    if (this.callState === "idle" || this.callState === "error") return nothing;

    return html`
      <div class="active-call">
        <!-- Header -->
        <div class="active-call__header">
          <div class="active-call__header-left">
            ${iconWaveform}
            <span class="active-call__header-title">
              VOICE ${this.callState === "calling" ? "CONNECTING..." : "CONNECTED"} /
              ${this.roomName.toUpperCase()}
            </span>
          </div>
          <div class="active-call__header-right">
            <span class="active-call__timer">${this.timer}</span>
            <button
              class="active-call__icon-btn"
              title="View Chat"
              aria-label="View Chat"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent("return-to-chat", { bubbles: true, composed: true }),
                )}
            >
              ${iconChat}
            </button>
          </div>
        </div>

        ${this.connectionMetrics
          ? html`
              <div class="active-call__metrics">
                <div class="active-call__metrics-title">Connection</div>
                <div>Ping: ${this.connectionMetrics.latencyMs} ms</div>
                <div>Loss: ${this.connectionMetrics.packetLossPct}%</div>
                <div>BW: ${this.connectionMetrics.bandwidthMbps} Mbps</div>
                <div>FPS: ${this.connectionMetrics.fps}</div>
              </div>
            `
          : nothing}

        <!-- Participant Grid -->
        <div class="active-call__grid">
          ${this._uniqueParticipants.map(
            (p) => html`
              <chat-participant-card
                class="active-call__card"
                id=${p.peer_id}
                .username=${p.username}
                .isSelf=${p.username === this.username}
                .color=${getColorForUser(p.username)}
                .initials=${getInitials(p.username)}
              ></chat-participant-card>
            `,
          )}
        </div>

        <!-- Screen Share -->
        ${this.screenShareStream || this.screenSharingUser
          ? html`
              <chat-screen-share-viewer
                .sharingUser=${this.screenSharingUser}
                .stream=${this.screenShareStream}
                .isLoading=${this.isScreenShareLoading}
              ></chat-screen-share-viewer>
            `
          : nothing}

        <!-- Toolbar -->
        <div class="active-call__toolbar">
          <div class="active-call__toolbar-center">
            <button class="active-call__toolbar-btn" title="Toggle video" aria-label="Toggle video">
              ${iconVideoCameraOff}
            </button>
            <button
              class="active-call__toolbar-btn ${this.isScreenSharing
                ? "active-call__toolbar-btn--active"
                : ""}"
              title=${this.isScreenSharing ? "Stop sharing screen" : "Share screen"}
              aria-label=${this.isScreenSharing ? "Stop sharing screen" : "Share screen"}
              @click=${this.handleScreenShareToggle}
            >
              ${iconMonitor}
            </button>
            <div class="active-call__toolbar-divider"></div>
            <button
              class="active-call__toolbar-btn ${this.isMuted
                ? "active-call__toolbar-btn--muted"
                : ""}"
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
              ${this.isMuted ? iconMicOff : iconMic}
            </button>
            <button
              class="active-call__toolbar-btn active-call__toolbar-btn--end"
              title="End call"
              aria-label="End call"
              @click=${this.handleEndCall}
            >
              ${iconPhoneOff}
            </button>
          </div>
          <div class="active-call__toolbar-right">
            <div style="position: relative; display: inline-block;">
              ${this.showVolumeSlider
                ? html`
                    <div
                      style="position: fixed; inset: 0; z-index: 99;"
                      @click=${() => (this.showVolumeSlider = false)}
                    ></div>
                    <div class="active-call__volume-popup">
                      <span class="active-call__volume-label">${this.volume}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        aria-label="Volume slider"
                        .value=${String(this.volume)}
                        @input=${this.handleVolumeChange}
                        class="active-call__volume-slider"
                      />
                    </div>
                  `
                : nothing}
              <button
                class="active-call__icon-btn"
                title=${this.volume === 0 ? "Unmute volume" : "Mute volume"}
                aria-label=${this.volume === 0 ? "Unmute volume" : "Mute volume"}
                @click=${() => (this.showVolumeSlider = !this.showVolumeSlider)}
              >
                ${this.volume === 0 ? iconVolumeOff : iconVolume}
              </button>
            </div>
            <button
              class="active-call__icon-btn"
              title="Settings"
              aria-label="Settings"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent("open-settings", { bubbles: true, composed: true }),
                )}
            >
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
