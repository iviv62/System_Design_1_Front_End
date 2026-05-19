import { LitElement, html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { logoIconSm } from "./landing-icons";
import footerStylesRaw from "../../../styles/landing/landing-footer.styles.scss?inline";

@customElement("landing-footer")
export class LandingFooter extends LitElement {
  static styles = unsafeCSS(footerStylesRaw);

  render() {
    return html`
      <footer class="landing-footer">
        <div class="footer-left">
          <div class="logo">
            ${logoIconSm}
            <span class="logo-text">Nebula Chat</span>
          </div>
          <div class="copyright">© 2026 Nebula Chat. All rights reserved.</div>
        </div>
        <div class="footer-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Security</a>
          <a href="#">Status</a>
          <a href="#">Twitter</a>
          <a href="#">GitHub</a>
        </div>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "landing-footer": LandingFooter;
  }
}
