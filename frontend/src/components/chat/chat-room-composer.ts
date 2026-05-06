import { LitElement, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import "../ui/emoji-picker";

@customElement("chat-room-composer")
export class ChatRoomComposer extends LitElement {
  @state()
  private inputValue = "";

  @state()
  private selectedImage: File | null = null;

  @state()
  private selectedImagePreviewUrl = "";

  @state()
  private imageError = "";

  @property({ type: Boolean })
  submitting = false;

  @state()
  private isComposing = false;

  @query(".chat-room__input")
  private textareaEl?: HTMLTextAreaElement;

  @query(".chat-room__file-input")
  private fileInputEl?: HTMLInputElement;

  firstUpdated(): void {
    this.resizeTextarea();
  }

  createRenderRoot() {
    return this;
  }

  disconnectedCallback(): void {
    if (this.selectedImagePreviewUrl) {
      URL.revokeObjectURL(this.selectedImagePreviewUrl);
    }
    super.disconnectedCallback();
  }

  private handleSubmit(e: Event) {
    e.preventDefault();
    const text = this.inputValue.trim();
    if (!text && !this.selectedImage) return;

    this.dispatchEvent(
      new CustomEvent<{ text: string; imageFile?: File }>("message-submit", {
        detail: {
          text,
          imageFile: this.selectedImage ?? undefined,
        },
        bubbles: true,
        composed: true,
      }),
    );

    this.inputValue = "";
    this.clearSelectedImage();
    this.imageError = "";
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

  private openImagePicker() {
    this.fileInputEl?.click();
  }

  private handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const maxBytes = 10 * 1024 * 1024;

    if (!allowed.has(file.type)) {
      this.imageError = "Only JPEG, PNG, WebP, and GIF images are supported.";
      input.value = "";
      return;
    }

    if (file.size > maxBytes) {
      this.imageError = "Image is too large. Maximum allowed size is 10 MB.";
      input.value = "";
      return;
    }

    this.imageError = "";
    this.setSelectedImage(file);
    input.value = "";
  }

  private setSelectedImage(file: File) {
    if (this.selectedImagePreviewUrl) {
      URL.revokeObjectURL(this.selectedImagePreviewUrl);
    }

    this.selectedImage = file;
    this.selectedImagePreviewUrl = URL.createObjectURL(file);
  }

  private clearSelectedImage() {
    this.selectedImage = null;
    if (this.selectedImagePreviewUrl) {
      URL.revokeObjectURL(this.selectedImagePreviewUrl);
      this.selectedImagePreviewUrl = "";
    }
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
    const canSubmit = (!this.submitting) && (Boolean(this.inputValue.trim()) || Boolean(this.selectedImage));

    return html`
      <form class="chat-room__composer" @submit=${this.handleSubmit}>
        <input
          class="chat-room__file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          @change=${this.handleFileInput}
          hidden
        />

        ${this.selectedImage && this.selectedImagePreviewUrl
          ? html`
              <div class="chat-room__composer-preview" role="status" aria-live="polite">
                <img
                  class="chat-room__composer-preview-image"
                  src=${this.selectedImagePreviewUrl}
                  alt="Selected image preview"
                />
                <div class="chat-room__composer-preview-meta">
                  <span class="chat-room__composer-preview-name">${this.selectedImage.name}</span>
                  <button
                    class="chat-room__composer-preview-remove"
                    type="button"
                    @click=${this.clearSelectedImage}
                    aria-label="Remove selected image"
                  >
                    Remove
                  </button>
                </div>
              </div>
            `
          : null}

        ${this.imageError
          ? html`<p class="chat-room__composer-error" role="alert">${this.imageError}</p>`
          : null}

        <div class="chat-room__composer-inner">
          <div class="chat-room__composer-tools">
            <emoji-picker @emoji-selected=${this.handleEmojiSelected}></emoji-picker>
            <button
              class="chat-room__tool-btn"
              type="button"
              title="Attach image"
              aria-label="Attach image"
              @click=${this.openImagePicker}
            >
              ⎘
            </button>
          </div>
          <textarea
            class="chat-room__input"
            placeholder="Type a message..."
            rows="1"
            .value=${this.inputValue}
            ?disabled=${this.submitting}
            @compositionstart=${() => (this.isComposing = true)}
            @compositionend=${() => (this.isComposing = false)}
            @keydown=${this.handleTextareaKeydown}
            @input=${this.handleTextareaInput}
          ></textarea>
          <button
            class="chat-room__send-icon"
            type="button"
            ?disabled=${!canSubmit}
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
