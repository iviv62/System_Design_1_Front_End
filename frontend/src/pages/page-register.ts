import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { navigate, handleLink } from "../utils/navigate";

@customElement("page-register")
export class PageRegister extends LitElement {
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
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });

      if (!res.ok) {
        const data = (await res.json()) as { detail?: string };
        throw new Error(data.detail ?? "Registration failed.");
      }

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
