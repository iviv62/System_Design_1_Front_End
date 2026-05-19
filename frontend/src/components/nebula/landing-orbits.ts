import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { ORBIT_USERS } from "./landing-orbit-data";
import { userIcon } from "./landing-icons";

/**
 * <landing-orbits>
 *
 * Renders the "Discover Your Common Orbits" section.
 * All orbit-specific CSS variables (--orbit-r, --orbit-speed, --orbit-delay)
 * are scoped inside this component's shadow DOM.
 */
@customElement("landing-orbits")
export class LandingOrbits extends LitElement {
  static styles = css`
    :host { display: block; }

    /* ── Orbit stage layout ───────────────────────────────────────────── */
    .orbit-wrap {
      position: absolute;
      inset: 0;
      margin: auto;
      width: 0;
      height: 0;
      animation: orbit-spin var(--orbit-speed, 60s) linear infinite;
      animation-delay: var(--orbit-delay, 0s);
    }

    @keyframes orbit-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    .orbit-spoke {
      position: absolute;
      top: 50%;
      left: 50%;
      width: var(--orbit-r, 156px);
      height: 1px;
      transform-origin: 0 0;
      background: repeating-linear-gradient(
        90deg,
        transparent 0,
        transparent 4px,
        color-mix(in srgb, currentColor 25%, transparent) 4px,
        color-mix(in srgb, currentColor 25%, transparent) 8px
      );
      pointer-events: none;
    }

    .orbit-avatar {
      position: absolute;
      top: 50%;
      left: var(--orbit-r, 156px);
      transform: translateY(-50%) rotate(calc(-1 * var(--orbit-speed, 60s) * 0deg));
      animation: orbit-counter var(--orbit-speed, 60s) linear infinite;
      animation-delay: var(--orbit-delay, 0s);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid var(--color-border, #334155);
      background: var(--color-surface, #1c1b19);
      padding: 0;
      cursor: pointer;
    }

    @keyframes orbit-counter {
      from { transform: translateY(-50%) rotate(0deg); }
      to   { transform: translateY(-50%) rotate(-360deg); }
    }

    .orbit-avatar__photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .orbit-avatar__badge {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--color-primary, #01696f);
      color: #fff;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      border: 1px solid var(--color-bg, #171614);
    }

    .orbit-avatar__online {
      position: absolute;
      top: 0;
      right: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-success, #437a22);
      border: 2px solid var(--color-bg, #171614);
    }
  `;

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
          <!-- Dashed orbit rings -->
          <div class="orbit-ring orbit-ring--far"  aria-hidden="true"></div>
          <div class="orbit-ring orbit-ring--mid"  aria-hidden="true"></div>
          <div class="orbit-ring orbit-ring--near" aria-hidden="true"></div>

          <!-- Vertical legend -->
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

          <!-- Centre avatar (you) -->
          <div class="orbit-center" aria-label="Your profile">
            ${userIcon}
            <span class="orbit-center__dot"></span>
          </div>

          <!-- Orbiting users -->
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
                    width="40"
                    height="40"
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
