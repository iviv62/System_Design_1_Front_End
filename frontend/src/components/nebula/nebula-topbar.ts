import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { nebulaIcons } from "../../icons/icons";

@customElement("nebula-topbar")
export class NebulaTopbar extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <header class="nebula-topbar">
        <h2 class="topbar-title">Home</h2>

        <div class="topbar-actions">
          <div class="search-box">
            ${nebulaIcons.search}
            <input
              type="text"
              placeholder="Find servers, users, or messages..."
              aria-label="Search"
            />
          </div>

          <button class="icon-btn" aria-label="Notifications">
            ${nebulaIcons.bell}
            <span class="badge"></span>
          </button>

          <div class="user-profile">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=64&h=64&fit=crop&q=80"
              alt="User Profile"
            />
            <span>User</span>
            ${nebulaIcons.chevronDown}
          </div>
        </div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-topbar": NebulaTopbar;
  }
}
