import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { nebulaIcons } from "../../icons/icons";

@customElement("nebula-sidebar")
export class NebulaSidebar extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <aside class="nebula-sidebar">
        <div class="nebula-sidebar-header">
          <div class="logo-icon">${nebulaIcons.cloudLogo}</div>
          <div class="logo-text">
            <h1>Nebula Chat</h1>
            <p>Community Hub</p>
          </div>
        </div>

        <nav class="nebula-sidebar-nav">
          <a href="#" class="nav-item active">
            ${nebulaIcons.home}
            <span>Home</span>
          </a>
          <a href="#" class="nav-item">
            ${nebulaIcons.discover}
            <span>Discover</span>
          </a>
        </nav>

        <div class="nebula-sidebar-section">
          <div class="section-title">My Servers</div>
          <div class="nebula-server-list">
            <a href="#" class="server-item">
              <div class="server-icon">
                <img
                  src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=64&h=64&fit=crop&q=80"
                  alt="Gaming"
                />
              </div>
              <span>Gaming</span>
            </a>
            <a href="#" class="server-item">
              <div class="server-icon">${nebulaIcons.design}</div>
              <span>Design</span>
              <div class="server-indicator"></div>
            </a>
            <a href="#" class="server-item">
              <div class="server-icon">${nebulaIcons.development}</div>
              <span>Development</span>
            </a>
          </div>
          <button class="add-server-btn">
            ${nebulaIcons.plus}
            <span>Add Server</span>
          </button>
        </div>

        <div class="nebula-sidebar-footer">
          <a href="#" class="footer-item">
            ${nebulaIcons.messages}
            <span>Messages</span>
          </a>
          <a href="#" class="footer-item">
            ${nebulaIcons.settings}
            <span>Settings</span>
          </a>
        </div>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-sidebar": NebulaSidebar;
  }
}
