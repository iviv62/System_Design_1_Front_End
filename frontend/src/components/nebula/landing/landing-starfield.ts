import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <landing-starfield>
 *
 * Self-contained animated star canvas.
 * - Uses ResizeObserver on the document root (no window.innerWidth).
 * - Accepts a `theme` property; changing it re-seeds the star pool.
 * - Cleans up the rAF handle and ResizeObserver on disconnect.
 */
@customElement("landing-starfield")
export class LandingStarfield extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }
    canvas {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `;

  @property({ type: String, reflect: true })
  theme: "dark" | "light" = "dark";

  private _animId: number | null = null;
  private _ro: ResizeObserver | null = null;

  override firstUpdated() {
    this._ro = new ResizeObserver(() => this._init());
    this._ro.observe(document.documentElement);
    this._init();
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("theme")) this._init();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this._animId !== null) cancelAnimationFrame(this._animId);
    this._ro?.disconnect();
    this._animId = null;
    this._ro = null;
  }

  private _init() {
    const canvas = this.shadowRoot?.querySelector("canvas");
    if (!canvas) return;
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = this.theme === "dark";
    const COUNT  = isDark ? 130 : 60;

    interface Star {
      x: number; y: number;
      radius: number; alpha: number; speed: number; color: string;
    }

    const DARK_COLORS  = ["#ffffff", "#c8d8ff", "#ffd6e0", "#d0f0ff"];
    const LIGHT_COLORS = ["#334155", "#475569", "#1e293b"];
    const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

    const stars: Star[] = Array.from({ length: COUNT }, () => ({
      x:      Math.random() * canvas.width,
      y:      Math.random() * canvas.height,
      radius: 0.4 + Math.random() * (isDark ? 1.3 : 0.8),
      alpha:  Math.random(),
      speed:  0.004 + Math.random() * 0.012,
      color:  palette[Math.floor(Math.random() * palette.length)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        s.alpha += s.speed;
        if (s.alpha > 1 || s.alpha < 0) s.speed = -s.speed;
        ctx.globalAlpha = Math.max(0.08, Math.min(1, s.alpha));
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      this._animId = requestAnimationFrame(draw);
    };
    draw();
  }

  render() {
    return html`<canvas aria-hidden="true"></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "landing-starfield": LandingStarfield;
  }
}
