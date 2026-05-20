import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { nebulaIcons } from "../../icons/icons";

@customElement("nebula-trending")
export class NebulaTrending extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <section>
        <div class="section-header">
          <h3>Trending Communities</h3>
        </div>
        <div class="trending-grid">
          <div class="trending-card">
            <div
              class="card-banner"
              style="background: url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=150&fit=crop&q=80') center/cover"
            >
              <div class="tags">
                <span class="tag">GAMING</span>
                <span class="tag">RETRO</span>
              </div>
              <div class="banner-icon">${nebulaIcons.gamepad}</div>
            </div>
            <div class="card-body">
              <h4>Arcade Legends</h4>
              <p>
                A place for enthusiasts of classic arcade games, speedrunning, and retro hardware.
              </p>
              <div class="card-footer">
                <span class="members">8.4k Members</span>
                <button
                  class="btn-join"
                  title="Join Arcade Legends"
                  aria-label="Join Arcade Legends"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          <div class="trending-card">
            <div
              class="card-banner"
              style="background: url('https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=400&h=150&fit=crop&q=80') center/cover"
            >
              <div class="tags">
                <span class="tag">ART</span>
              </div>
              <div
                class="banner-icon"
                style="background: url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=64&h=64&fit=crop&q=80') center/cover"
              ></div>
            </div>
            <div class="card-body">
              <h4>Pixel Art Collective</h4>
              <p>Share your sprites, get feedback on animations, and participate in weekly...</p>
              <div class="card-footer">
                <span class="members">12.1k Members</span>
                <button
                  class="btn-join"
                  title="Join Pixel Art Collective"
                  aria-label="Join Pixel Art Collective"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-trending": NebulaTrending;
  }
}
