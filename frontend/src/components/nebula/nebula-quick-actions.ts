import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { nebulaIcons } from "../../icons/icons";

@customElement("nebula-quick-actions")
export class NebulaQuickActions extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="right-section">
        <h3>QUICK ACTIONS</h3>
        <div class="action-cards">
          <div class="action-card">
            <div class="action-icon">${nebulaIcons.joinCode}</div>
            <div class="action-details">
              <h4>Join via Code</h4>
              <p>Have an invite link?</p>
            </div>
          </div>

          <div class="action-card">
            <div class="action-icon" style="color: #10b981;">${nebulaIcons.publicGlobe}</div>
            <div class="action-details">
              <h4>Public Directory</h4>
              <p>Browse all open servers</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-quick-actions": NebulaQuickActions;
  }
}
