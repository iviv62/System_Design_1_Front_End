import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { githubStarIcon, starIcon } from "./landing-icons";
import "../../ui/app-button";

/**
 * <landing-hero>
 *
 * Stateless hero section: version badge, headline, subtitle, CTA buttons.
 */
@customElement("landing-hero")
export class LandingHero extends LitElement {
  static styles = css`
    :host { display: block; }
  `;

  render() {
    return html`
      <section class="hero-section">
        <div class="version-badge"><span class="dot"></span> Nebula v2.0 is now live</div>
        <h1 class="hero-title">The Open-Source Discord Alternative</h1>
        <p class="hero-subtitle">
          The open-source, self-hostable community chat. Immersive spaces,
          spatial audio, and absolute control over your data—no ads, no tracking.
        </p>
        <div class="hero-actions">
          <a
            class="github-btn"
            href="https://github.com/iviv62/chat-system"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Star chat-system on GitHub"
          >
            ${githubStarIcon}
            <span>Star on GitHub</span>
            ${starIcon}
          </a>
          <app-button class="secondary-btn">Open in Browser</app-button>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "landing-hero": LandingHero;
  }
}
