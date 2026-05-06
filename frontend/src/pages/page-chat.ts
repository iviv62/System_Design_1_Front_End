import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { fetchCurrentUser } from "../features/lib/auth/auth-api";
import { watch } from "zustand-lit";
import { authStore } from "../store/auth-store";
import type { AuthState } from "../store/auth-store";
import { navigate } from "../utils/navigate";
import "../components/chat-app";

/**
 * Page wrapper for the chat lobby + room view.
 * Keeps app-root clean and gives each page a consistent mount point.
 */
@customElement("page-chat")
export class PageChat extends LitElement {
  @state() private authChecked = false;
  @state() private isAuthorized = false;

  // zustand-lit manages subscribe/unsubscribe and re-renders automatically.
  @watch(authStore)
  private authState?: AuthState;

  // Opt out of Shadow DOM so chat-app's global styles still apply.
  createRenderRoot() {
    return this;
  }

  async connectedCallback() {
    super.connectedCallback();

    if (!authStore.getState().accessToken) {
      this.authChecked = true;
      this.isAuthorized = false;
      localStorage.setItem("redirect_after_login", "/chat");
      navigate("/login");
      return;
    }

    try {
      await fetchCurrentUser();
      this.isAuthorized = true;
    } catch {
      authStore.getState().logout();
      localStorage.setItem("redirect_after_login", "/chat");
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
      localStorage.setItem("redirect_after_login", "/chat");
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

    return html`<chat-app></chat-app>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-chat": PageChat;
  }
}
