import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("nebula-live-activity")
export class NebulaLiveActivity extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="right-section">
        <h3>LIVE ACTIVITY</h3>
        <div class="activity-feed">
          <div class="online-indicator"></div>

          <div class="activity-list">
            <div class="activity-item active">
              <div class="activity-context">
                Nebula Central &middot; <span class="channel">#announcements</span>
              </div>
              <div class="activity-content">
                New server rules have been posted. Please review them before continuing.
              </div>
              <div class="activity-time">2 mins ago</div>
            </div>

            <div class="activity-item">
              <div class="activity-context">
                The Dev Hive &middot; <span class="channel">#help</span>
              </div>
              <div class="activity-content">
                @sarah replied to your thread about the CSS grid layout issue.
              </div>
              <div class="activity-time">15 mins ago</div>
            </div>

            <div class="activity-item">
              <div class="activity-context">Pixel Art Collective</div>
              <div class="activity-content">
                Weekly challenge "Cyberpunk Cityscape" is now open for submissions!
              </div>
              <div class="activity-time">1 hour ago</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-live-activity": NebulaLiveActivity;
  }
}
