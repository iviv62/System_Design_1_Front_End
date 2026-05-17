import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import "../components/nebula/nebula-app";

@customElement("page-nebula")
export class PageNebula extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`<nebula-app></nebula-app>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-nebula": PageNebula;
  }
}
