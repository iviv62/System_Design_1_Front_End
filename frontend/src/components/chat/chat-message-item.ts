import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { UiMessage } from "../../types/message";
import { formatTime } from "../../utils/time";

@customElement("chat-message-item")
export class ChatMessageItem extends LitElement {
  @property({ attribute: false })
  message!: UiMessage;

  @property()
  username = "Guest";

  createRenderRoot() {
    return this;
  }

  render() {
    if (this.message.kind === "system") {
      return html`<div class="message message--system" data-message-id=${this.message.id}>${this.message.text}</div>`;
    }

    const isOwnMessage = this.message.username === this.username;

    return html`
      <article
        class="message message--user ${isOwnMessage ? "message--self" : ""}"
        data-message-id=${this.message.id}
      >
        <div class="message__author">${this.message.username}</div>
        <div class="message__body">${this.message.text}</div>
        <div class="message__time">${formatTime(this.message.createdAt)}</div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-message-item": ChatMessageItem;
  }
}
