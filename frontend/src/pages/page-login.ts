import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { navigate, handleLink } from "../utils/navigate";
import { login } from "../features/lib/auth/auth-api";
import { authStore } from "../store/auth-store";

@customElement("page-login")
export class PageLogin extends LitElement {
  @state() private errorMsg = "";
  @state() private loading = false;

  static styles = css`
    :host { display: block; padding: 2rem; max-width: 400px; margin: 0 auto; }
    .error { color: red; margin-bottom: 1rem; }
    form { display: flex; flex-direction: column; gap: 12px; }
    input, button { padding: 8px; font-size: 1rem; }
    .links { margin-top: 1rem; font-size: 0.9rem; text-align: center; }
  `;

  private async handleSubmit(e: Event) {
    e.preventDefault();
    this.errorMsg = "";
    this.loading = true;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
      const accessToken = await login({
        identifier: String(formData.get("identifier") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      authStore.getState().setAccessToken(accessToken);

      const redirect = localStorage.getItem("redirect_after_login") || "/chat";
      localStorage.removeItem("redirect_after_login");
      navigate(redirect);
    } catch (err) {
      this.errorMsg = err instanceof Error ? err.message : "Login failed.";
    } finally {
      this.loading = false;
    }
  }

  render() {
    return html`
      <h2>Log In</h2>
      ${this.errorMsg ? html`<div class="error">${this.errorMsg}</div>` : ""}
      <form @submit=${this.handleSubmit}>
        <input
          type="text"
          name="identifier"
          placeholder="Email or Username"
          required
          autocomplete="username"
        />
        <input type="password" name="password" placeholder="Password" required autocomplete="current-password" />
        <button type="submit" ?disabled=${this.loading}>
          ${this.loading ? "Logging in…" : "Log In"}
        </button>
      </form>
      <div class="links">
        Don't have an account?
        <a href="/register" @click=${handleLink}>Register here</a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-login": PageLogin;
  }
}
