import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { nebulaIcons } from "../../icons/icons";
import "../ui/theme-button";

@customElement("nebula-topbar")
export class NebulaTopbar extends LitElement {
  @property() theme: "light" | "dark" = "dark";
  @property() username = "";
  @property() searchQuery = "";

  createRenderRoot() {
    return this;
  }

  private handleSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.searchQuery = value;
    this.dispatchEvent(
      new CustomEvent("search-change", {
        detail: { query: value },
        bubbles: true,
        composed: true,
      })
    );
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
              .value=${this.searchQuery}
              @input=${this.handleSearchInput}
            />
          </div>

          <theme-button .theme=${this.theme}></theme-button>

          <div class="user-profile">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=64&h=64&fit=crop&q=80"
              alt="User Profile"
            />
            <span>${this.username || "User"}</span>
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
