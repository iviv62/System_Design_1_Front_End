import { LitElement, html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import pageLandingStylesRaw from "../styles/page-landing.styles.scss?inline";
import { ThemeController } from "../utils/theme-controller";

// Register sub-components
import "../components/nebula/landing/landing-starfield";
import "../components/nebula/landing/landing-header";
import "../components/nebula/landing/landing-hero";
import "../components/nebula/landing/landing-features";
import "../components/nebula/landing/landing-orbits";
import "../components/nebula/landing/landing-footer";

@customElement("page-landing")
export class PageLanding extends LitElement {
  static styles = unsafeCSS(pageLandingStylesRaw);

  constructor() {
    super();
    void new ThemeController(this);
    this.setAttribute("data-theme", ThemeController.get());
  }

  private _toggleTheme() {
    const next = ThemeController.get() === "dark" ? "light" : "dark";
    ThemeController.set(next);
    this.requestUpdate();
  }

  render() {
    const theme = ThemeController.get() as "dark" | "light";

    return html`
      <div class="landing-container">

        <!-- ── Space background (fixed, behind everything) ── -->
        <div class="space-bg" aria-hidden="true">
          <landing-starfield .theme=${theme}></landing-starfield>
          <div class="nebula nebula-1"></div>
          <div class="nebula nebula-2"></div>
          <div class="nebula nebula-3"></div>
          <div class="nebula nebula-4"></div>
        </div>

        <landing-header
          .theme=${theme}
          @theme-toggle=${this._toggleTheme}
        ></landing-header>

        <main class="landing-main">
          <landing-hero></landing-hero>
          <landing-features></landing-features>
          <landing-orbits></landing-orbits>
        </main>

        <landing-footer></landing-footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-landing": PageLanding;
  }
}
