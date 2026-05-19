import { LitElement, html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import chatRoomStylesRaw from "../../styles/chat-room.styles.scss?inline";

/**
 * Pure, stateless starfield canvas component.
 *
 * Owns:
 *  - The HTMLCanvasElement and its 2D context
 *  - The requestAnimationFrame animation loop
 *  - A ResizeObserver that keeps the canvas sized to the viewport
 *
 * Accepts a single `theme` property. Any change to `theme` tears down
 * the current animation loop and reinitialises with the correct star
 * count and colour palette for the new theme.
 *
 * Usage:
 *   <chat-starfield .theme=${this.themeCtrl.theme}></chat-starfield>
 */
@customElement("chat-starfield")
export class ChatStarfield extends LitElement {
  static styles = unsafeCSS(chatRoomStylesRaw);

  @property() theme: "dark" | "light" = "dark";

  private _animId: number | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _canvas: HTMLCanvasElement | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  firstUpdated() {
    this._canvas = this.shadowRoot?.querySelector("canvas") ?? null;
    this._attachResizeObserver();
    this._init();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("theme")) {
      this._init();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stop();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _attachResizeObserver() {
    this._resizeObserver = new ResizeObserver(() => this._init());
    this._resizeObserver.observe(document.documentElement);
  }

  private _stop() {
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  private _init() {
    const canvas = this._canvas;
    if (!canvas) return;

    this._stop();

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = this.theme === "dark";
    const COUNT = isDark ? 130 : 60;

    interface Star {
      x: number;
      y: number;
      radius: number;
      alpha: number;
      speed: number;
      color: string;
    }

    const DARK_COLORS = ["#ffffff", "#c8d8ff", "#ffd6e0", "#d0f0ff"];
    const LIGHT_COLORS = ["#334155", "#475569", "#1e293b"];
    const palette = isDark ? DARK_COLORS : LIGHT_COLORS;

    const stars: Star[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 0.4 + Math.random() * (isDark ? 1.3 : 0.8),
      alpha: Math.random(),
      speed: 0.004 + Math.random() * 0.012,
      color: palette[Math.floor(Math.random() * palette.length)],
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
      this._animId = requestAnimationFrame(draw);
    };

    draw();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    return html`<canvas class="stars-layer"></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-starfield": ChatStarfield;
  }
}
