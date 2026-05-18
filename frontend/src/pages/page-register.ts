import { LitElement, html, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { navigate, handleLink } from "../utils/navigate";
import { register } from "../features/lib/auth/auth-api";
import pageRegisterStylesRaw from "../styles/page-register.styles.scss?inline";
import { ThemeController } from "../utils/theme-controller";

@customElement("page-register")
export class PageRegister extends LitElement {
  @state() private errorMsg = "";
  @state() private loading = false;

  static styles = unsafeCSS(pageRegisterStylesRaw);

  private theme = new ThemeController(this);

  constructor() {
    super();
    this.setAttribute("data-theme", ThemeController.get());
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    this.errorMsg = "";
    this.loading = true;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
      await register({
        username: String(formData.get("username") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      navigate("/login");
    } catch (err) {
      this.errorMsg = err instanceof Error ? err.message : "Registration failed.";
    } finally {
      this.loading = false;
    }
  }

  render() {
    return html`
      <div class="auth-container">
        <div class="auth-card">
          <h2>Create an Account</h2>
          <p class="subtitle">Join Chat System today</p>

          ${this.errorMsg ? html`<div class="error">${this.errorMsg}</div>` : ""}

          <form @submit=${this.handleSubmit}>
            <div class="form-group">
              <label for="username">Username</label>
              <input
                id="username"
                type="text"
                name="username"
                placeholder="Username"
                required
                autocomplete="username"
              />
            </div>
            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="Email Address"
                required
                autocomplete="email"
              />
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Password"
                required
                autocomplete="new-password"
              />
            </div>
            <button type="submit" ?disabled=${this.loading}>
              ${this.loading ? "Registering\u2026" : "Register"}
            </button>
          </form>

          <div class="links">
            Already have an account?
            <a href="/login" @click=${handleLink}>Log In</a>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-register": PageRegister;
  }
}
