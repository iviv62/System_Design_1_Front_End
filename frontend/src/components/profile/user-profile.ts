import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../../styles/user-profile.styles.scss"; // Compile styling into global css
import { navigate } from "../../utils/navigate";

// Import new sub-components
import "./profile-header-card";
import "./profile-about";
import "./profile-stats";
import "./profile-mutual-servers";
import "./profile-recent-activity";

@customElement("user-profile")
export class UserProfile extends LitElement {
  // Opt out of shadow DOM to allow global CSS
  createRenderRoot() {
    return this;
  }

  @property() username = "Jane Smith";

  render() {
    return html`
      <div class="profile">
        <div class="profile__header">
          <button class="profile__btn-back" @click=${() => navigate("/chat")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back to Lobby
          </button>
        </div>

        <profile-header-card .username=${this.username}></profile-header-card>

        <div class="profile__layout">
          <div class="profile__sidebar">
            <profile-about></profile-about>
            <profile-stats></profile-stats>
            <profile-mutual-servers></profile-mutual-servers>
          </div>

          <div class="profile__main-content">
            <profile-recent-activity></profile-recent-activity>
          </div>
        </div>
      </div>
    `;
  }
}
