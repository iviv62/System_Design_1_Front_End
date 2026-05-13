import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { UiMessage } from "../../types/message";
import { formatTime } from "../../utils/time";
import "./message-reaction-picker.ts";

@customElement("chat-message-item")
export class ChatMessageItem extends LitElement {
  @property({ attribute: false })
  message!: UiMessage;

  @property()
  username = "Guest";

  @property({ type: Boolean })
  showMeta = true;

  createRenderRoot() {
    return this;
  }

  private emitReaction(emoji: string) {
    this.dispatchEvent(
      new CustomEvent<{ messageId: string; emoji: string }>("message-reaction-toggle", {
        detail: {
          messageId: this.message.id,
          emoji,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleImageClick(url: string) {
    this.dispatchEvent(new CustomEvent<{ url: string }>("image-preview", {
      detail: { url },
      bubbles: true,
      composed: true,
    }));
  }

  private handleImageKeydown(e: KeyboardEvent, url: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.handleImageClick(url);
    }
  }

  private getReactionEntries() {
    return Object.entries(this.message.reactions)
      .map(([emoji, users]) => ({ emoji, users, count: users.length }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
  }

  private renderTextWithLinks(text: string) {
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const matches = Array.from(text.matchAll(urlPattern));
    if (matches.length === 0) return text;

    const fragments: Array<string | ReturnType<typeof html>> = [];
    let lastIndex = 0;

    for (const match of matches) {
      const url = match[0];
      const href = url.startsWith("http") ? url : `https://${url}`;
      const index = match.index ?? 0;

      if (index > lastIndex) {
        fragments.push(text.slice(lastIndex, index));
      }

      fragments.push(html`
        <a
          class="message__link"
          href=${href}
          target="_blank"
          rel="noopener noreferrer"
        >${url}</a>
      `);

      lastIndex = index + url.length;
    }

    if (lastIndex < text.length) {
      fragments.push(text.slice(lastIndex));
    }

    return fragments;
  }

  render() {
    if (this.message.kind === "system") {
      return html`<div class="message message--system" data-message-id=${this.message.id}>${this.message.text}</div>`;
    }

    const isOwnMessage = this.message.username === this.username;
    const reactions = this.getReactionEntries();

    return html`
      <article
        class="message message--user ${isOwnMessage ? "message--self" : ""} ${this.showMeta ? "" : "message--compact"}"
        data-message-id=${this.message.id}
      >
        ${!isOwnMessage && this.showMeta
          ? html`<div class="message__author">${this.message.username}</div>`
          : ""}
        <div class="message__body">
          ${this.message.imageUrl
            ? html`
                <img
                  class="message__image"
                  src=${this.message.imageUrl}
                  alt="Image from ${this.message.username}, click to expand"
                  loading="lazy"
                  style="cursor: pointer;"
                  role="button"
                  tabindex="0"
                  @click=${() => this.handleImageClick(this.message.imageUrl!)}
                  @keydown=${(e: KeyboardEvent) => this.handleImageKeydown(e, this.message.imageUrl!)}
                />
              `
            : ""}
          ${this.message.text
            ? html`<div class="message__text">${this.renderTextWithLinks(this.message.text)}</div>`
            : ""}
          ${this.showMeta
            ? html`<div class="message__time">${formatTime(this.message.createdAt)}</div>`
            : ""}
        </div>
        <div class="message__reactions ${isOwnMessage ? "message__reactions--self" : ""}" aria-label="Message reactions">
          <message-reaction-picker
            class="message__reaction-picker"
            @reaction-selected=${(e: CustomEvent<{ emoji: string }>) => this.emitReaction(e.detail.emoji)}
          ></message-reaction-picker>
          ${reactions.map(({ emoji, users, count }) => {
            const isSelected = users.includes(this.username);
            return html`
              <button
                type="button"
                class="message__reaction-chip ${isSelected ? "message__reaction-chip--active" : ""}"
                title=${isSelected ? "Remove your reaction" : "Add this reaction"}
                @click=${() => this.emitReaction(emoji)}
              >
                <span class="message__reaction-emoji">${emoji}</span>
                <span class="message__reaction-count">${count}</span>
              </button>
            `;
          })}
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-message-item": ChatMessageItem;
  }
}
