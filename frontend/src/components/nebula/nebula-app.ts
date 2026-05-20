import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { ThemeController } from "../../utils/theme-controller";

import "../../styles/nebula.styles.scss";

import "./nebula-sidebar";
import "./nebula-topbar";
import "./nebula-welcome";
import "./nebula-active-servers";
import "./nebula-trending";
import "./nebula-quick-actions";


@customElement("nebula-app")
export class NebulaApp extends LitElement {
  themeCtrl = new ThemeController(this);
  private _starsAnimId: number | null = null;
  private readonly boundResize = this.handleResize.bind(this);

  createRenderRoot() {
    return this;
  }

  firstUpdated() {
    this._initStarfield();
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("resize", this.boundResize);
    ThemeController.set(this.themeCtrl.theme);
  }

  disconnectedCallback(): void {
    window.removeEventListener("resize", this.boundResize);
    if (this._starsAnimId !== null) cancelAnimationFrame(this._starsAnimId);
    super.disconnectedCallback();
  }

  private handleResize() {
    this._initStarfield();
  }

  private _initStarfield() {
    const canvas = this.querySelector("#starsCanvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    if (this._starsAnimId !== null) cancelAnimationFrame(this._starsAnimId);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = this.themeCtrl.theme === "dark";
    const COUNT = isDark ? 130 : 60;

    interface Star {
      x: number; y: number;
      radius: number;
      alpha: number;
      speed: number;
      color: string;
    }

    const STAR_COLORS_DARK = ["#ffffff", "#c8d8ff", "#ffd6e0", "#d0f0ff"];
    const STAR_COLORS_LIGHT = ["#334155", "#475569", "#1e293b"];

    const stars: Star[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 0.4 + Math.random() * (isDark ? 1.3 : 0.8),
      alpha: Math.random(),
      speed: 0.004 + Math.random() * 0.012,
      color: isDark
        ? STAR_COLORS_DARK[Math.floor(Math.random() * STAR_COLORS_DARK.length)]
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

  render() {
    return html`
      <div class="nebula-layout-wrapper">
        <div class="chat-room__background">
          <canvas id="starsCanvas" class="stars-layer"></canvas>
          <div class="nebula nebula-1"></div>
          <div class="nebula nebula-2"></div>
          <div class="nebula nebula-3"></div>
          <div class="nebula nebula-4"></div>
        </div>

        <div class="nebula-layout">
          <nebula-sidebar></nebula-sidebar>

          <main class="nebula-main">
            <nebula-topbar></nebula-topbar>

            <div class="nebula-content">
              <nebula-welcome></nebula-welcome>
              <nebula-active-servers></nebula-active-servers>
              <nebula-quick-actions></nebula-quick-actions>
              <nebula-trending></nebula-trending>
            </div>
          </main>

        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-app": NebulaApp;
  }
}
