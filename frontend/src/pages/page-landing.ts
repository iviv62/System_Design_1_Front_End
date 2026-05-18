import { LitElement, html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { handleLink } from "../utils/navigate";
import pageLandingStylesRaw from "../styles/page-landing.styles.scss?inline";
import "../components/ui/app-button";
import { ThemeController } from "../utils/theme-controller";

@customElement("page-landing")
export class PageLanding extends LitElement {
  static styles = unsafeCSS(pageLandingStylesRaw);

  private theme = new ThemeController(this);

  constructor() {
    super();
    // Apply data-theme synchronously before first render to avoid FOUC.
    // ThemeController.hostConnected() does this too, but fires after the first
    // paint — setting it here ensures the correct :host([data-theme]) vars are
    // used from frame 0.
    this.setAttribute("data-theme", ThemeController.get());
  }

  private _toggleTheme() {
    const next = this.theme.theme === "dark" ? "light" : "dark";
    ThemeController.set(next);
  }

  private _sunIcon() {
    return html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>`;
  }

  private _moonIcon() {
    return html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`;
  }

  render() {
    const isDark = this.theme.theme === "dark";

    return html`
      <div class="landing-container">
        <header class="landing-header">
          <div class="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span class="logo-text">Nebula Chat</span>
          </div>

          <nav class="nav-links">
            <a href="#" class="active">Features</a>
            <a href="#">Communities</a>
            <a href="#">Download</a>
          </nav>

          <div class="header-actions">
            <button
              class="theme-toggle"
              @click=${this._toggleTheme}
              aria-label=${isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              ${isDark ? this._sunIcon() : this._moonIcon()}
            </button>
            <a href="/login" class="login-btn" @click=${handleLink}>Login</a>
          </div>
        </header>

        <main class="landing-main">
          <section class="hero-section">
            <div class="version-badge"><span class="dot"></span> Nebula v2.0 is now live</div>
            <h1 class="hero-title">Your Digital Home,<br />Reimagined.</h1>
            <p class="hero-subtitle">
              Experience the next evolution of community chat. Immersive spaces,
              crystal-clear voice, and tools built for the modern power user.
            </p>
            <div class="hero-actions">
              <app-button class="primary-btn">Download for Windows</app-button>
              <app-button class="secondary-btn">Open in Browser</app-button>
            </div>
          </section>

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
                          stroke-linecap="round" stroke-linejoin="round">
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
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
                      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
                      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
                      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.16-.61-1.58-.33-.35-.83-.88-.83-1.42 0-1.1.9-2 2-2h1.41c3.09 0 5.59-2.5 5.59-5.59C22 7.58 17.52 2 12 2z"></path>
                    </svg>
                  </div>
                  <h3>Deep Customization</h3>
                  <p>Tailor your workspace with advanced themes, layout toggles, and custom keybinds.</p>
                </div>
              </div>
            </div>

            <div class="bottom-row">
              <div class="feature-card">
                <div class="icon-wrapper">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                </div>
                <h3>Lightning Fast</h3>
                <p>Built on a proprietary lightweight engine, Nebula stays fast even in communities with millions of members.</p>
              </div>
              <div class="feature-card">
                <div class="icon-wrapper">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <rect x="11" y="9" width="2" height="6" rx="1"></rect>
                  </svg>
                </div>
                <h3>Enterprise Security</h3>
                <p>End-to-end encryption for DMs and robust moderation tools to keep your community safe and sound.</p>
              </div>
              <div class="feature-card">
                <div class="icon-wrapper">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        </main>

        <footer class="landing-footer">
          <div class="footer-left">
            <div class="logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span class="logo-text">Nebula Chat</span>
            </div>
            <div class="copyright">© 2024 Nebula Chat. All rights reserved.</div>
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
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-landing": PageLanding;
  }
}
