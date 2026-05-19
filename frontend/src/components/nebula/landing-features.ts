import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

/**
 * <landing-features>
 *
 * Stateless features grid: chat mockup + four feature cards.
 */
@customElement("landing-features")
export class LandingFeatures extends LitElement {
  static styles = css`
    :host { display: block; }
  `;

  render() {
    return html`
      <section class="features-grid">
        <div class="top-row">
          <div class="feature-card main-feature">
            <div class="card-header"><span class="hashtag">#</span> design-discussions</div>
            <div class="card-content image-mockup">
              <div class="mockup-window">
                <div class="mockup-sidebar"></div>
                <div class="mockup-main">
                  <div class="mockup-message"></div>
                  <div class="mockup-message"></div>
                  <div class="mockup-avatar-large">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none"
                      stroke="currentColor" stroke-width="1.5"
                      stroke-linecap="round" stroke-linejoin="round"
                      aria-hidden="true">
                      <circle cx="32" cy="32" r="28" opacity="0.25"></circle>
                      <path d="M44 48C44 41.3726 38.6274 36 32 36C25.3726 36 20 41.3726 20 48" opacity="0.5"></path>
                      <circle cx="32" cy="24" r="8" opacity="0.5"></circle>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-footer">
              <svg class="plus-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <span class="placeholder-text">Message #design-discussions...</span>
            </div>
          </div>

          <div class="side-features">
            <div class="feature-card">
              <div class="card-top">
                <div class="icon-wrapper">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    aria-hidden="true">
                    <path d="M12 2v20"></path>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <div class="live-badge"><span class="dot"></span> Live</div>
              </div>
              <h3>Spatial Audio</h3>
              <p>Crystal clear, low-latency voice channels that make you feel like you're in the same room.</p>
            </div>
            <div class="feature-card">
              <div class="icon-wrapper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  aria-hidden="true">
                  <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
                  <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
                  <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
                  <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.38 0 2.5-1.12 2.5-2.5
                    0-.61-.23-1.16-.61-1.58-.33-.35-.83-.88-.83-1.42 0-1.1.9-2 2-2h1.41
                    c3.09 0 5.59-2.5 5.59-5.59C22 7.58 17.52 2 12 2z"></path>
                </svg>
              </div>
              <h3>Deep Customization</h3>
              <p>Fully open source. Fork it, tweak the UI, or build custom plugins to make Nebula truly yours.</p>
            </div>
          </div>
        </div>

        <div class="bottom-row">
          <div class="feature-card">
            <div class="icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <h3>Lightning Fast</h3>
            <p>Built on a proprietary lightweight engine, Nebula stays fast even in communities with millions of members.</p>
          </div>
          <div class="feature-card">
            <div class="icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M9 12l2 2 4-4"></path>
              </svg>
            </div>
            <h3>100% Data Ownership</h3>
            <p>Host Nebula on your own hardware. Your community’s messages, voice data, and files stay entirely on your server—giving you absolute privacy and freedom from tech monopolies.</p>
          </div>
          <div class="feature-card">
            <div class="icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
            <h3>Rich Integrations</h3>
            <p>Connect your favorite tools directly into chat with our expansive App Directory and robust API.</p>
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "landing-features": LandingFeatures;
  }
}
