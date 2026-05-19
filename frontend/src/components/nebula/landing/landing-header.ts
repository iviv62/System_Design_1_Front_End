import { LitElement, html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { handleLink } from "../../../utils/navigate";
import { sunIcon, moonIcon, logoIcon } from "./landing-icons";
import headerStylesRaw from "../../../styles/landing/landing-header.styles.scss?inline";

@customElement("landing-header")
export class LandingHeader extends LitElement {
  static styles = unsafeCSS(headerStylesRaw);

  @property({ type: String, reflect: true })
  theme: "dark" | "light" = "dark";

  private _onThemeToggle() {
    this.dispatchEvent(new CustomEvent("theme-toggle", { bubbles: true, composed: true }));
  }

  render() {
    const isDark = this.theme === "dark";
    return html`
      <header class="landing-header">
        <div class="logo">
          ${logoIcon}
          <span class="logo-text">Nebula Chat</span>
        </div>

        <nav class="nav-links">
          <a href="#" class="active">Features</a>
          <a href="#">Communities</a>
        </nav>

        <div class="header-actions">
          <button
            class="theme-toggle"
            @click=${this._onThemeToggle}
            aria-label=${isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            ${isDark ? sunIcon : moonIcon}
          </button>
          <a href="/login" class="login-btn" @click=${handleLink}>Login</a>
        </div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "landing-header": LandingHeader;
  }
}
