import { LitElement, html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "../ui/emoji-picker";

@customElement("chat-room-composer")
export class ChatRoomComposer extends LitElement {
  @state()
  private inputValue = "";

  @state()
  private isComposing = false;

  @query(".chat-room__input")
  private textareaEl?: HTMLTextAreaElement;

  firstUpdated(): void {
    this.resizeTextarea();
  }

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
    this.resizeTextarea();
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

  private handleSendClick() {
    this.requestSubmit();
  }

  private requestSubmit() {
    const form = this.renderRoot.querySelector("form");
    if (form) form.requestSubmit();
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
    this.resizeTextarea();

    // Move caret right after inserted emoji.
    this.updateComplete.then(() => {
      const next = start + emoji.length;
      textarea.focus();
      textarea.setSelectionRange(next, next);
    });
  }

  private handleTextareaInput(e: Event) {
    this.inputValue = (e.target as HTMLTextAreaElement).value;
    this.resizeTextarea();
  }

  private resizeTextarea() {
    const textarea = this.textareaEl;
    if (!textarea) return;

    textarea.style.height = "auto";
    const maxHeight = 132;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  render() {
    return html`
      <form class="chat-room__composer" @submit=${this.handleSubmit}>
        <div class="chat-room__composer-inner">
          <div class="chat-room__composer-tools">
            <emoji-picker @emoji-selected=${this.handleEmojiSelected}></emoji-picker>
            <button class="chat-room__tool-btn" type="button" title="Attach" aria-label="Attach file">⎘</button>
          </div>
          <textarea
            class="chat-room__input"
            placeholder="Type a message..."
            rows="1"
            .value=${this.inputValue}
            @compositionstart=${() => (this.isComposing = true)}
            @compositionend=${() => (this.isComposing = false)}
            @keydown=${this.handleTextareaKeydown}
            @input=${this.handleTextareaInput}
          ></textarea>
          <button
            class="chat-room__send-icon"
            type="button"
            ?disabled=${!this.inputValue.trim()}
            @click=${this.handleSendClick}
            title="Send"
            aria-label="Send"
          >
            ➤
          </button>
        </div>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-room-composer": ChatRoomComposer;
  }
}
