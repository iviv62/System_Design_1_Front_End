import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("nebula-active-servers")
export class NebulaActiveServers extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <section>
        <div class="section-header">
          <h3>Your Active Servers</h3>
          <a href="#" class="view-all">View All &rarr;</a>
        </div>
        <div class="active-servers-grid">
          <div class="server-card">
            <div class="card-header">
              <div class="server-info">
                <div
                  class="server-icon"
                  style="background: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=64&h=64&fit=crop&q=80') center/cover"
                ></div>
                <div class="server-details">
                  <h4>Nebula Central</h4>
                  <div class="online-count"><span class="dot"></span> 1,204 Online</div>
                </div>
              </div>
            </div>
            <div class="card-content">
              <div class="participants">
                <img
                  class="avatar"
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32&h=32&fit=crop&q=80"
                  alt="Avatar"
                />
                <img
                  class="avatar"
                  src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=32&h=32&fit=crop&q=80"
                  alt="Avatar"
                />
                <img
                  class="avatar"
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&q=80"
                  alt="Avatar"
                />
                <div class="more">+42</div>
              </div>
              <p class="recent-message"><strong>@alex:</strong> Has anyone checked out the ne...</p>
            </div>
          </div>

          <div class="server-card">
            <div class="card-header">
              <div class="server-info">
                <div class="server-icon" style="background: #1e293b; color: #f8fafc;">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </div>
                <div class="server-details">
                  <h4>The Dev Hive</h4>
                  <div class="online-count"><span class="dot"></span> 342 Online</div>
                </div>
              </div>
              <span class="notification-badge">3</span>
            </div>
            <div class="card-content">
              <div class="participants">
                <img
                  class="avatar"
                  src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=32&h=32&fit=crop&q=80"
                  alt="Avatar"
                />
                <img
                  class="avatar"
                  src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=32&h=32&fit=crop&q=80"
                  alt="Avatar"
                />
              </div>
              <p class="recent-message">
                <span style="color:#60a5fa">#general</span> Let's review the PR...
              </p>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-active-servers": NebulaActiveServers;
  }
}
