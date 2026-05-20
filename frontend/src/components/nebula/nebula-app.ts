import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ThemeController } from "../../utils/theme-controller";
import { createRoom, ApiError } from "../../features/lib/chat/chat-room-api";
import { fetchCurrentUser } from "../../features/lib/auth/auth-api";
import { navigate } from "../../utils/navigate";

import "../../styles/nebula.styles.scss";

import "./nebula-sidebar";
import "./nebula-topbar";
import "./nebula-welcome";
import "./nebula-active-servers";
import "./nebula-trending";
import "../lobby/create-server-modal";


@customElement("nebula-app")
export class NebulaApp extends LitElement {
  themeCtrl = new ThemeController(this);
  private _starsAnimId: number | null = null;
  private readonly boundResize = this.handleResize.bind(this);

  @state() private error = "";
  @state() private username = "";
  @state() private searchQuery = "";

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

    fetchCurrentUser()
      .then((user) => {
        this.username = user.username || "";
      })
      .catch(() => {
        // Not logged in or error
      });
  }

  disconnectedCallback(): void {
    window.removeEventListener("resize", this.boundResize);
    if (this._starsAnimId !== null) cancelAnimationFrame(this._starsAnimId);
    super.disconnectedCallback();
  }

  private _lastTheme = this.themeCtrl.theme;

  protected updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);
    if (this._lastTheme !== this.themeCtrl.theme) {
      this._lastTheme = this.themeCtrl.theme;
      this._initStarfield();
    }
  }

  private handleResize() {
    this._initStarfield();
  }

  private handleThemeChanged(e: CustomEvent) {
    const next = e.detail.theme;
    ThemeController.set(next);
  }

  private handleSearchChange(e: CustomEvent) {
    this.searchQuery = e.detail.query;
  }

  private handleOpenCreateServerModal() {
    this.error = "";
    const modal = this.querySelector("#createServerModal") as any;
    if (modal) {
      modal.open();
    }
  }

  private async handleCreateRoom(e: CustomEvent) {
    const { name, status } = e.detail;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const room = await createRoom({
        name: trimmed,
        status: status,
        created_by: this.username || undefined,
      });
      this.error = "";
      navigate(`/chat/${encodeURIComponent(room.id)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        this.error = "A room with that name already exists. Pick a different name.";
      } else {
        this.error = "Failed to create room.";
      }
    }
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
      <div class="nebula-layout-wrapper" @open-create-server-modal=${this.handleOpenCreateServerModal}>
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
            <nebula-topbar
              .theme=${this.themeCtrl.theme}
              .username=${this.username}
              .searchQuery=${this.searchQuery}
              @theme-changed=${this.handleThemeChanged}
              @search-change=${this.handleSearchChange}
            ></nebula-topbar>

            <div class="nebula-content">
              <nebula-welcome></nebula-welcome>
              <nebula-active-servers
                .username=${this.username}
                .searchQuery=${this.searchQuery}
              ></nebula-active-servers>
              <nebula-trending></nebula-trending>
            </div>
          </main>

        </div>

        <create-server-modal
          id="createServerModal"
          .onlyModal=${true}
          .error=${this.error}
          @create-room=${this.handleCreateRoom}
        ></create-server-modal>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-app": NebulaApp;
  }
}
