import { LitElement, html, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { navigate, handleLink } from "../utils/navigate";
import { register } from "../features/lib/auth/auth-api";
import pageRegisterStylesRaw from "../styles/page-register.styles.scss?inline";

@customElement("page-register")
export class PageRegister extends LitElement {
  @state() private errorMsg = "";
  @state() private loading = false;

  static styles = unsafeCSS(pageRegisterStylesRaw);

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
      <h2>Create an Account</h2>
      ${this.errorMsg ? html`<div class="error">${this.errorMsg}</div>` : ""}
      <form @submit=${this.handleSubmit}>
        <input type="text" name="username" placeholder="Username" required autocomplete="username" />
        <input type="email" name="email" placeholder="Email Address" required autocomplete="email" />
        <input type="password" name="password" placeholder="Password" required autocomplete="new-password" />
        <button type="submit" ?disabled=${this.loading}>
          ${this.loading ? "Registering…" : "Register"}
        </button>
      </form>
      <div class="links">
        Already have an account?
        <a href="/login" @click=${handleLink}>Log In</a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-register": PageRegister;
  }
}
