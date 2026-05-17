import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("chat-image-preview")
export class ChatImagePreview extends LitElement {
  @property()
  imageUrl: string | null = null;

  static styles = css`
    .image-preview-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(6px);
      cursor: pointer;
      animation: fadeIn 0.15s ease;
    }

    .image-preview-overlay__img {
      max-width: min(90vw, 1200px);
      max-height: 90vh;
      object-fit: contain;
      border-radius: 8px;
      cursor: default;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    }

    .image-preview-overlay__close {
      position: absolute;
      top: 1.25rem;
      right: 1.25rem;
      width: 36px;
      height: 36px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .image-preview-overlay__close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;

  private closePreview() {
    this.dispatchEvent(new CustomEvent("close-preview", { bubbles: true, composed: true }));
  }

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this.closePreview();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
  }

  render() {
    if (!this.imageUrl) return nothing;

    return html`
      <div
        class="image-preview-overlay"
        @click=${this.closePreview}
        tabindex="0"
        role="dialog"
        aria-label="Image preview"
      >
        <button
          class="image-preview-overlay__close"
          @click=${this.closePreview}
          aria-label="Close preview"
        >
          ✕
        </button>
        <img
          class="image-preview-overlay__img"
          src=${this.imageUrl}
          alt="Full size preview"
          @click=${(e: Event) => e.stopPropagation()}
        />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-image-preview": ChatImagePreview;
  }
}
