import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

@customElement("message-reaction-picker")
export class MessageReactionPicker extends LitElement {
  @state()
  private isOpen = false;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
  }

  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
    super.disconnectedCallback();
  }

  createRenderRoot() {
    return this;
  }

  private toggleOpen() {
    this.isOpen = !this.isOpen;
  }

  private handleDocumentPointerDown = (event: PointerEvent) => {
    if (!this.isOpen) return;
    const path = event.composedPath();
    if (!path.includes(this)) {
      this.isOpen = false;
    }
  };

  private selectReaction(emoji: string) {
    this.dispatchEvent(
      new CustomEvent<{ emoji: string }>("reaction-selected", {
        detail: { emoji },
        bubbles: true,
        composed: true,
      }),
    );
    this.isOpen = false;
  }

  render() {
    return html`
      <div class="message-reaction-picker">
        <button
          type="button"
          class="message-reaction-picker__toggle"
          title="Add reaction"
          aria-label="Add reaction"
          @click=${this.toggleOpen}
        >
          ☺
        </button>

        ${this.isOpen
          ? html`
              <div class="message-reaction-picker__panel" role="menu" aria-label="Choose reaction emoji">
                ${DEFAULT_REACTIONS.map(
                  (emoji) => html`
                    <button
                      type="button"
                      class="message-reaction-picker__emoji"
                      @click=${() => this.selectReaction(emoji)}
                    >
                      ${emoji}
                    </button>
                  `,
                )}
              </div>
            `
          : ""}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "message-reaction-picker": MessageReactionPicker;
  }
}
