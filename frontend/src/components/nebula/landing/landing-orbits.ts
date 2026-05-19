import { LitElement, html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { ORBIT_USERS } from "./landing-orbit-data";
import { userIcon } from "./landing-icons";
import orbitsStylesRaw from "../../../styles/landing/landing-orbits.styles.scss?inline";

@customElement("landing-orbits")
export class LandingOrbits extends LitElement {
  static styles = unsafeCSS(orbitsStylesRaw);

  render() {
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
          <div class="orbit-ring orbit-ring--far"  aria-hidden="true"></div>
          <div class="orbit-ring orbit-ring--mid"  aria-hidden="true"></div>
          <div class="orbit-ring orbit-ring--near" aria-hidden="true"></div>

          <div class="orbit-legend" aria-hidden="true">
            <div class="orbit-legend-item orbit-legend-item--far">
              <span class="orbit-legend-dot orbit-legend-dot--far"></span>
              <span class="orbit-legend-text">1 SERVER</span>
            </div>
            <div class="orbit-legend-item orbit-legend-item--mid">
              <span class="orbit-legend-dot orbit-legend-dot--mid"></span>
              <span class="orbit-legend-text">2 SERVERS</span>
            </div>
            <div class="orbit-legend-item orbit-legend-item--near">
              <span class="orbit-legend-dot orbit-legend-dot--near"></span>
              <span class="orbit-legend-text">3+ SERVERS</span>
            </div>
          </div>

          <div class="orbit-center" aria-label="Your profile">
            ${userIcon}
            <span class="orbit-center__dot"></span>
          </div>

          ${ORBIT_USERS.map(
            (u) => html`
              <div
                class="orbit-wrap"
                style="--orbit-r:${u.radius};--orbit-speed:${u.speed};--orbit-delay:${u.delay}"
              >
                <div class="orbit-spoke"></div>
                <button
                  class="orbit-avatar"
                  aria-label="${u.name} — ${u.label} mutual server${u.label !== "1" ? "s" : ""}"
                >
                  <img
                    class="orbit-avatar__photo"
                    src=${u.avatar}
                    alt=${u.name}
                    width="52"
                    height="52"
                    loading="lazy"
                    draggable="false"
                  />
                  <span class="orbit-avatar__badge">${u.label}</span>
                  ${u.online
                    ? html`<span class="orbit-avatar__online" aria-hidden="true"></span>`
                    : ""}
                </button>
              </div>
            `
          )}
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "landing-orbits": LandingOrbits;
  }
}
