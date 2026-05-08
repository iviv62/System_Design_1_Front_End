import { LitElement, html, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ThemeController } from "../../utils/theme-controller";
import chatSettingsModalStylesRaw from "../../styles/chat-settings-modal.styles.scss?inline";

@customElement("chat-settings-modal")
export class ChatSettingsModal extends LitElement {
  @property({ type: Boolean })
  open = false;

  private themeCtrl = new ThemeController(this);

  static styles = unsafeCSS(chatSettingsModalStylesRaw);

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }));
  }

  private toggleTheme() {
    const newTheme = this.themeCtrl.theme === 'light' ? 'dark' : 'light';
    ThemeController.set(newTheme);
  }

  render() {
    if (!this.open) return null;

    // Apply the theme class to a wrapper so styles can define variables using it
    const themeClass = this.themeCtrl.theme === 'dark' ? 'modal-theme--dark' : 'modal-theme--light';

    return html`
      <div class="overlay ${themeClass}" @click=${this.close}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <h2>Settings</h2>
            <button class="close-btn" @click=${this.close} aria-label="Close settings">&times;</button>
          </div>
          <div class="body">
            <div class="setting-row">
              <span class="setting-label">Theme</span>
              <div class="setting-control">
                <button @click=${this.toggleTheme}>
                  ${this.themeCtrl.theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
                </button>
              </div>
            </div>
            <!-- Add more settings here in the future -->
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-settings-modal": ChatSettingsModal;
  }
}
