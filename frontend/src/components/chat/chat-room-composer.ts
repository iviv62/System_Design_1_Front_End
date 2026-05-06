import { LitElement, html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { ThemeController } from "../../utils/theme-controller";
import "../ui/send-button";
import "../ui/emoji-picker";

@customElement("chat-room-composer")
export class ChatRoomComposer extends LitElement {
  @state()
  private inputValue = "";

  @state()
  private isComposing = false;

  @query(".chat-room__input")
  private textareaEl?: HTMLTextAreaElement;

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
    if (e.isComposing || this.isComposing) {
      return;
    }

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

  private handleEmojiSelected(e: CustomEvent<{ emoji: string }>) {
    const emoji = e.detail.emoji;
    const textarea = this.textareaEl;
    const current = this.inputValue;

    if (!textarea) {
      this.inputValue = `${current}${emoji}`;
      return;
    }

    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    this.inputValue = `${current.slice(0, start)}${emoji}${current.slice(end)}`;

    // Move caret right after inserted emoji.
    this.updateComplete.then(() => {
      const next = start + emoji.length;
      textarea.focus();
      textarea.setSelectionRange(next, next);
    });
  }

  render() {
    return html`
      <form class="chat-room__composer" @submit=${this.handleSubmit}>
        <div class="chat-room__composer-tools">
          <emoji-picker @emoji-selected=${this.handleEmojiSelected}></emoji-picker>
        </div>
        <textarea
          class="chat-room__input"
          placeholder="Type a message…"
          rows="1"
          .value=${this.inputValue}
          @compositionstart=${() => (this.isComposing = true)}
          @compositionend=${() => (this.isComposing = false)}
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
