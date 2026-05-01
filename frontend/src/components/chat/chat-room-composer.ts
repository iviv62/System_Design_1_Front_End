import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

@customElement("chat-room-composer")
export class ChatRoomComposer extends LitElement {
  @state()
  private inputValue = "";

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

  render() {
    return html`
      <form class="chat-room__composer" @submit=${this.handleSubmit}>
        <input
          class="chat-room__input"
          type="text"
          placeholder="Type a message…"
          .value=${this.inputValue}
          @input=${(e: Event) =>
            (this.inputValue = (e.target as HTMLInputElement).value)}
        />
        <button class="chat-room__send" type="submit" ?disabled=${!this.inputValue.trim()}>
          Send
        </button>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-room-composer": ChatRoomComposer;
  }
}
