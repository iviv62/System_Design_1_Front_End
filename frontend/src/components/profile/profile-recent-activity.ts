import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("profile-recent-activity")
export class ProfileRecentActivity extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="profile__card" style="height: 100%;">
        <div class="profile__card-header-flex">
          <h2>Recent Activity</h2>
          <a href="#" class="view-all">View All</a>
        </div>

        <div class="profile__timeline">
          <div class="profile__timeline-item">
            <div class="profile__timeline-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="profile__activity-card">
              <div class="profile__activity-header">
                <span class="type">COMMENTED</span>
                <span class="time">2h ago</span>
              </div>
              <div class="profile__activity-content">
                <p>"I think the new layout grid looks incredible. The backdrop blur really adds that depth we were looking for."</p>
              </div>
              <div class="profile__activity-footer">
                in <strong>#design-system-v2</strong>
              </div>
            </div>
          </div>

          <div class="profile__timeline-item">
            <div class="profile__timeline-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </div>
            <div class="profile__activity-card">
              <div class="profile__activity-header">
                <span class="type">SHARED MEDIA</span>
                <span class="time">Yesterday</span>
              </div>
              <div class="profile__activity-media"></div>
              <div class="profile__activity-footer">
                in <strong>#ui-inspiration</strong>
              </div>
            </div>
          </div>

          <div class="profile__timeline-item">
            <div class="profile__timeline-icon green">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
            </div>
            <div class="profile__activity-card">
              <div class="profile__activity-header">
                <span class="type" style="color: var(--status-indicator);">JOINED SERVER</span>
                <span class="time">3 days ago</span>
              </div>
              <div class="profile__activity-content">
                <p>Joined <strong>Frontend Wizards</strong> community.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
