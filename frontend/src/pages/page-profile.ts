import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { fetchCurrentUser, tryRefreshSession } from "../features/lib/auth/auth-api";
import { watch } from "zustand-lit";
import { authStore } from "../store/auth-store";
import type { AuthState } from "../store/auth-store";
import { navigate } from "../utils/navigate";
import { ThemeController } from "../utils/theme-controller";
import "../components/profile/user-profile";

/**
 * Page wrapper for the user profile.
 */
@customElement("page-profile")
export class PageProfile extends LitElement {
  @state() private authChecked = false;
  @state() private isAuthorized = false;
  @state() private username = "";

  private themeCtrl = new ThemeController(this);

  @watch(authStore)
  private authState?: AuthState;

  // Opt out of Shadow DOM
  createRenderRoot() {
    return this;
  }

  async connectedCallback() {
    super.connectedCallback();

    ThemeController.set(this.themeCtrl.theme);

    try {
      if (!authStore.getState().accessToken) {
        const refreshed = await tryRefreshSession();
        if (!refreshed) {
          throw new Error("Session refresh failed");
        }
      }

      const me = await fetchCurrentUser();
      const resolvedUsername = me.username?.trim() ?? "";
      if (!resolvedUsername) {
        throw new Error("Authenticated user is missing a username.");
      }
      this.username = resolvedUsername;
      this.isAuthorized = true;
    } catch {
      authStore.getState().logout();
      localStorage.setItem("redirect_after_login", "/profile");
      this.isAuthorized = false;
      navigate("/login");
    } finally {
      this.authChecked = true;
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);

    if (this.authChecked && this.isAuthorized && !this.authState?.accessToken) {
      this.isAuthorized = false;
      localStorage.setItem("redirect_after_login", "/profile");
      navigate("/login");
    }
  }

  render() {
    if (!this.authChecked) {
      return html`<p style="padding: 1rem;">Checking session...</p>`;
    }

    if (!this.isAuthorized) {
      return html``;
    }

    return html`<user-profile .username=${this.username}></user-profile>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-profile": PageProfile;
  }
}
