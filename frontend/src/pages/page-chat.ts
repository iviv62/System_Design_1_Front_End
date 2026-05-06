import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import "../components/chat-app";

/**
 * Page wrapper for the chat lobby + room view.
 * Keeps app-root clean and gives each page a consistent mount point.
 */
@customElement("page-chat")
export class PageChat extends LitElement {
  // Opt out of Shadow DOM so chat-app's global styles still apply.
  createRenderRoot() {
    return this;
  }

  render() {
    return html`<chat-app></chat-app>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-chat": PageChat;
  }
}
