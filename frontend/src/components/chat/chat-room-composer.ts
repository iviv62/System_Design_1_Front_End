import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ThemeController } from "../../utils/theme-controller";
import "../ui/send-button";

@customElement("chat-room-composer")
export class ChatRoomComposer extends LitElement {
  @state()
  private inputValue = "";

  private themeCtrl = new ThemeController(this);

  createRenderRoot() {
    return this;
  }

  private handleSubmit(e: Event) {
    e.preventDefault();
    const text = this.inputValue.trim();
    if (!text) return;

    this.dispatchEvent(
      new CustomEvent<{ text: string }>("message-submit", {
        detail: { text },
        bubbles: true,
        composed: true,
      }),
    );

    this.inputValue = "";
  }

  private handleTextareaKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = (e.currentTarget as HTMLTextAreaElement).form;
      if (form) {
        form.requestSubmit();
      }
    }
  }

  private handleSendClick(e: Event) {
    const form = (e.currentTarget as HTMLElement).closest("form");
    if (form) {
      form.requestSubmit();
    }
  }

  render() {
    return html`
      <form class="chat-room__composer" @submit=${this.handleSubmit}>
        <textarea
          class="chat-room__input"
          placeholder="Type a message…"
          rows="1"
          .value=${this.inputValue}
          @keydown=${this.handleTextareaKeydown}
          @input=${(e: Event) =>
            (this.inputValue = (e.target as HTMLTextAreaElement).value)}
        ></textarea>
        <send-button
          .theme=${this.themeCtrl.theme}
          ?disabled=${!this.inputValue.trim()}
          @click=${this.handleSendClick}
        >
          Send
        </send-button>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-room-composer": ChatRoomComposer;
  }
}
