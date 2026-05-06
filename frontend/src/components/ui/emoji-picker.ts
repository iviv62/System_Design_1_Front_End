import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

export const EMOJI_SECTIONS = [
  {
    title: "Smileys & Emotion",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "☺️", "😊", "😇",
      "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛",
      "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒",
      "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢",
      "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰",
      "😥", "😓", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧",
      "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧",
      "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻",
      "💀", "👽", "👾", "🤖",
    ],
  },
  {
    title: "Gestures & Body",
    emojis: [
      "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜",
      "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🧠",
    ],
  },
  {
    title: "Hearts & Symbols",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "✨", "⭐️", "🌟", "💫", "💥", "💢",
      "💦", "💨", "💤", "💯", "💬", "💭", "🗯", "🔥",
    ],
  },
  {
    title: "Activities & Objects",
    emojis: [
      "🎉", "🎊", "🎈", "🎂", "🎁", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖", "🎮",
      "🕹", "🎲", "🎯", "🚀", "🛸", "💻", "⌨️", "🖥", "🖨", "📱", "📲", "⌚️",
      "💡", "📚", "📝", "✏️", "☕️", "🍵", "🍻", "🥂", "🍷", "🍹", "🍸",
    ],
  },
];

@customElement("emoji-picker")
export class EmojiPicker extends LitElement {
  @state()
  private isOpen = false;

  createRenderRoot() {
    return this;
  }

  private togglePicker() {
    this.isOpen = !this.isOpen;
  }

  private handleSelect(emoji: string) {
    this.dispatchEvent(
      new CustomEvent<{ emoji: string }>("emoji-selected", {
        detail: { emoji },
        bubbles: true,
        composed: true,
      }),
    );
    this.isOpen = false;
  }

  render() {
    return html`
      <div class="chat-room__emoji-picker-container">
        <button
          class="chat-room__emoji-btn"
          type="button"
          title="Insert emoji"
          aria-label="Insert emoji"
          @click=${this.togglePicker}
        >
          ☺
        </button>

        ${this.isOpen
          ? html`
              <div class="chat-room__emoji-panel" role="menu" aria-label="Emoji picker">
                ${EMOJI_SECTIONS.map(
                  (section) => html`
                    <div class="chat-room__emoji-section" role="group" aria-label=${section.title}>
                      <div class="chat-room__emoji-section-title">${section.title}</div>
                      <div class="chat-room__emoji-grid">
                        ${section.emojis.map(
                          (emoji) => html`
                            <button
                              class="chat-room__emoji-item"
                              type="button"
                              role="menuitem"
                              @click=${() => this.handleSelect(emoji)}
                            >
                              ${emoji}
                            </button>
                          `,
                        )}
                      </div>
                    </div>
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
    "emoji-picker": EmojiPicker;
  }
}