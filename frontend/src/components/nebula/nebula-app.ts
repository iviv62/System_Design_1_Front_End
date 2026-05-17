import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

import "../../styles/nebula.styles.scss";

import "./nebula-sidebar";
import "./nebula-topbar";
import "./nebula-welcome";
import "./nebula-active-servers";
import "./nebula-trending";
import "./nebula-quick-actions";
import "./nebula-live-activity";

@customElement("nebula-app")
export class NebulaApp extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="nebula-layout">
        <nebula-sidebar></nebula-sidebar>

        <main class="nebula-main">
          <nebula-topbar></nebula-topbar>

          <div class="nebula-content">
            <nebula-welcome></nebula-welcome>
            <nebula-active-servers></nebula-active-servers>
            <nebula-trending></nebula-trending>
          </div>
        </main>

        <aside class="nebula-right-sidebar">
          <nebula-quick-actions></nebula-quick-actions>
          <nebula-live-activity></nebula-live-activity>
        </aside>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-app": NebulaApp;
  }
}
