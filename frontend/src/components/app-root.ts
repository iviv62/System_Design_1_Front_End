import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { Router } from "@lit-labs/router";
import { routes } from "../router/routes";

/**
 * Application shell. Owns the router and renders the current page into
 * its outlet. Add global chrome (nav-bar, toasts, etc.) here.
 */
@customElement("app-root")
export class AppRoot extends LitElement {
  // Opt out of Shadow DOM so page-level global styles keep working.
  createRenderRoot() {
    return this;
  }

  // Router (extends Routes) handles initial goto() and popstate automatically.
  private readonly router = new Router(this, routes);

  render() {
    return html`${this.router.outlet()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-root": AppRoot;
  }
}
