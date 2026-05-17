import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { nebulaIcons } from "../../icons/icons";

@customElement("nebula-welcome")
export class NebulaWelcome extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="nebula-welcome">
        <h2>Welcome back to the Lobby</h2>
        <p>
          Discover new communities, join ongoing discussions, or create your own space to gather
          your people.
        </p>
        <div class="welcome-actions">
          <button class="btn-primary">${nebulaIcons.plus} Create New Server</button>
          <button class="btn-secondary">${nebulaIcons.browse} Browse Directory</button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-welcome": NebulaWelcome;
  }
}
