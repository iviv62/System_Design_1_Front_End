import { LitElement, html, nothing, unsafeCSS } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import chatActiveCallStylesRaw from "../../styles/chat-active-call.styles.scss?inline";
import { iconMaximize } from "./chat-icons";

/**
 * Owns the screen-share video element: stream binding, loading state,
 * and fullscreen requests. Exposes `requestVideoFullscreen()` so that
 * parent components don't need a @query into this shadow DOM.
 */
@customElement("chat-screen-share-viewer")
export class ChatScreenShareViewer extends LitElement {
  static styles = unsafeCSS(chatActiveCallStylesRaw);

  @property() sharingUser: string | null = null;
  @property({ attribute: false }) stream: MediaStream | null = null;
  @property({ type: Boolean }) isLoading = false;

  @query(".active-call__screen-video") private videoEl?: HTMLVideoElement;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("stream")) {
      void this.bindStream();
    }
  }

  private async bindStream() {
    await this.updateComplete;
    const video = this.videoEl;
    if (!video) return;

    // Pause and release the previous resource before assigning a new srcObject.
    video.pause();
    video.srcObject = this.stream ?? null;
    if (!this.stream) return;

    await video.play().catch(() => {
      // Autoplay can be blocked transiently by browser policies;
      // user interaction will recover it.
    });
  }

  /** Called by the parent toolbar button to toggle native fullscreen. */
  async requestVideoFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await this.videoEl?.requestFullscreen();
      }
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn("[chat-screen-share-viewer] Fullscreen request failed:", err);
      }
    }
  }

  render() {
    return html`
      <div class="active-call__screen-share">
        <div class="active-call__screen-share-header">
          <p class="active-call__screen-share-label">
            ${this.sharingUser
              ? `${this.sharingUser} is sharing their screen`
              : "Screen share is live"}
          </p>
          <button
            type="button"
            class="active-call__screen-fullscreen-btn"
            @click=${this.requestVideoFullscreen}
            ?disabled=${!this.stream}
            title="Fullscreen"
            aria-label="Fullscreen screen share"
          >
            ${iconMaximize}
          </button>
        </div>

        ${this.isLoading
          ? html`
              <div class="active-call__screen-loading" role="status" aria-live="polite">
                <span class="active-call__screen-spinner"></span>
                <span>Establishing screen share...</span>
              </div>
            `
          : nothing}

        <video class="active-call__screen-video" autoplay playsinline muted></video>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-screen-share-viewer": ChatScreenShareViewer;
  }
}
