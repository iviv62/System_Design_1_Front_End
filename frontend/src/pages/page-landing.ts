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
  private _starsAnimId: number | null = null;


  constructor() {
    super();
    this.setAttribute("data-theme", ThemeController.get());
  }


  private _toggleTheme() {
    const next = this.theme.theme === "dark" ? "light" : "dark";
    ThemeController.set(next);
  }


  override firstUpdated() {
    this._initStarfield();
    window.addEventListener("resize", this._onResize);
  }


  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this._starsAnimId !== null) cancelAnimationFrame(this._starsAnimId);
    window.removeEventListener("resize", this._onResize);
  }


  private _onResize = () => this._initStarfield();


  private _initStarfield() {
    const canvas = this.shadowRoot?.getElementById("starsCanvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    if (this._starsAnimId !== null) cancelAnimationFrame(this._starsAnimId);


    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;


    const isDark = this.theme.theme === "dark";
    const COUNT  = isDark ? 130 : 60;


    interface Star {
      x: number; y: number;
      radius: number;
      alpha: number;
      speed: number;
      color: string;
    }


    const STAR_COLORS_DARK  = ["#ffffff", "#c8d8ff", "#ffd6e0", "#d0f0ff"];
    const STAR_COLORS_LIGHT = ["#334155", "#475569", "#1e293b"];


    const stars: Star[] = Array.from({ length: COUNT }, () => ({
      x:      Math.random() * canvas.width,
      y:      Math.random() * canvas.height,
      radius: 0.4 + Math.random() * (isDark ? 1.3 : 0.8),
      alpha:  Math.random(),
      speed:  0.004 + Math.random() * 0.012,
      color:  isDark
        ? STAR_COLORS_DARK [Math.floor(Math.random() * STAR_COLORS_DARK.length)]
        : STAR_COLORS_LIGHT[Math.floor(Math.random() * STAR_COLORS_LIGHT.length)],
    }));


    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const star of stars) {
        star.alpha += star.speed;
        if (star.alpha > 1 || star.alpha < 0) star.speed = -star.speed;
        ctx.globalAlpha = Math.max(0.08, Math.min(1, star.alpha));
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      this._starsAnimId = requestAnimationFrame(draw);
    };
    draw();
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


  private _githubStarIcon() {
    return html`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>`;
  }


  private _starIcon() {
    return html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>`;
  }


  /** Renders the orbit visualization with dummy user avatars */
  private _renderOrbitSection() {
    // Orbit users: { initials, label (mutual servers), orbitClass, posClass, online? }
    const orbitUsers = [
      { initials: "AK", label: "1", orbitClass: "orbit-far",    posClass: "pos-top",         online: false },
      { initials: "SL", label: "2", orbitClass: "orbit-mid",    posClass: "pos-top-left",    online: false },
      { initials: "MR", label: "2", orbitClass: "orbit-mid",    posClass: "pos-left",        online: false },
      { initials: "JT", label: "1", orbitClass: "orbit-far",    posClass: "pos-bottom-left", online: false },
      { initials: "EV", label: "3", orbitClass: "orbit-near",   posClass: "pos-right",       online: true  },
      { initials: "NB", label: "2", orbitClass: "orbit-mid",    posClass: "pos-bottom",      online: false },
    ];

    return html`
      <section class="orbits-section" aria-labelledby="orbits-title">
        <div class="orbits-header">
          <h2 id="orbits-title" class="orbits-title">Discover Your Common Orbits</h2>
          <p class="orbits-subtitle">
            See who shares your spaces. The closer the orbit, the more mutual servers you
            have in common. Click on any profile to connect!
          </p>
        </div>

        <div class="orbit-stage" role="img" aria-label="Orbit diagram showing users in shared servers">
          <!-- Dashed orbit rings -->
          <div class="orbit-ring orbit-ring--far"  aria-hidden="true"><span class="orbit-label">1 SERVER</span></div>
          <div class="orbit-ring orbit-ring--mid"  aria-hidden="true"></div>
          <div class="orbit-ring orbit-ring--near" aria-hidden="true"><span class="orbit-label orbit-label--near">3+ SERVERS</span></div>

          <!-- Centre avatar (you) -->
          <div class="orbit-center" aria-label="Your profile">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span class="orbit-center__dot"></span>
          </div>

          <!-- Orbiting users -->
          ${orbitUsers.map(
            (u) => html`
              <button
                class="orbit-avatar ${u.orbitClass} ${u.posClass}"
                aria-label="${u.initials} — ${u.label} mutual server${u.label !== '1' ? 's' : ''}"
              >
                <span class="orbit-avatar__initials">${u.initials}</span>
                <span class="orbit-avatar__badge">${u.label}</span>
                ${u.online ? html`<span class="orbit-avatar__online" aria-hidden="true"></span>` : ""}
              </button>
            `
          )}
        </div>
      </section>
    `;
  }


  render() {
    const isDark = this.theme.theme === "dark";


    // Re-init starfield whenever theme changes so star count/color adapts.
    this.updateComplete.then(() => this._initStarfield());


    return html`
      <div class="landing-container">


        <!-- ── Space background (fixed, behind everything) ── -->
        <div class="space-bg" aria-hidden="true">
          <canvas id="starsCanvas" class="stars-canvas"></canvas>
          <div class="nebula nebula-1"></div>
          <div class="nebula nebula-2"></div>
          <div class="nebula nebula-3"></div>
          <div class="nebula nebula-4"></div>
        </div>


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
                ${this._githubStarIcon()}
                <span>Star on GitHub</span>
                ${this._starIcon()}
              </a>
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
                  <p>Fully open source. Fork it, tweak the UI, or build custom plugins to make Nebula truly yours.</p>
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
                    <path d="M9 12l2 2 4-4"></path>
                  </svg>
                </div>
                <h3>100% Data Ownership</h3>
                <p>Host Nebula on your own hardware. Your community's messages, voice data, and files stay entirely on your server—giving you absolute privacy and freedom from tech monopolies.</p>
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


          <!-- ── Common Orbits section ── -->
          ${this._renderOrbitSection()}
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
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    "page-landing": PageLanding;
  }
}
