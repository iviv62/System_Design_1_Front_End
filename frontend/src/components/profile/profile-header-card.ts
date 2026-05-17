import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("profile-header-card")
export class ProfileHeaderCard extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property() username = "";

  render() {
    return html`
      <div class="profile__banner-container"></div>
      <div class="profile__main-card">
        <div class="profile__user-info-row">
          <div class="profile__avatar-wrapper">
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=3087&auto=format&fit=crop" alt="Profile Picture" />
            <div class="profile__status-dot"></div>
          </div>

          <div class="profile__details">
            <h1>${this.username}</h1>
            <p>@${this.username.toLowerCase().replace(/\s+/g, '')} • Lead UI Engineer</p>
          </div>
        </div>

        <div class="profile__actions">
          <button class="profile__btn profile__btn--primary">Message</button>
          <button class="profile__btn profile__btn--icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          </button>
        </div>
      </div>
    `;
  }
}
