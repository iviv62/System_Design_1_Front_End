import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("profile-stats")
export class ProfileStats extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="profile__card">
        <div class="profile__stats-grid">
          <div class="profile__stat-box">
            <div class="num">248</div>
            <div class="label">Friends</div>
          </div>
          <div class="profile__stat-box">
            <div class="num">15</div>
            <div class="label">Servers</div>
          </div>
        </div>
      </div>
    `;
  }
}
