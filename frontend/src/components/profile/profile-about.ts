import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("profile-about")
export class ProfileAbout extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="profile__card">
        <h2 class="profile__card-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          About Me
        </h2>
        <p class="profile__about-text">
          Obsessed with creating seamless digital experiences. Currently exploring the intersection of spatial computing and glassmorphism. Always up for a chat about design systems or sci-fi novels.
        </p>
        <div class="profile__tags">
          <span class="profile__tag">FIGMA</span>
          <span class="profile__tag">REACT</span>
          <span class="profile__tag">CSS</span>
        </div>
      </div>
    `;
  }
}
