import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("lobby-create-room")
export class LobbyCreateRoom extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property() error = "";

  @state() private isModalOpen = false;
  @state() private newRoomName = "";
  @state() private selectedCategory = "Gaming";
  @state() private selectedPrivacy = "public";

  private handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.newRoomName.trim()) return;
    this.dispatchEvent(
      new CustomEvent("create-room", {
        detail: {
          name: this.newRoomName.trim(),
          status: this.selectedPrivacy,
        },
        bubbles: true,
        composed: true,
      }),
    );
    this.newRoomName = "";
    this.isModalOpen = false;
  }

  private openModal() {
    this.isModalOpen = true;
    this.newRoomName = "";
    this.selectedCategory = "Gaming";
    this.selectedPrivacy = "public";
  }

  private closeModal() {
    this.isModalOpen = false;
  }

  render() {
    return html`
      <div class="lobby__card">
        <h3 class="lobby__card-title">Create a New Server</h3>
        <button class="lobby__btn lobby__btn--dark lobby__btn--full" @click=${this.openModal}>
          + Create Server
        </button>
      </div>

      ${this.isModalOpen
        ? html`
            <div class="create-server-modal-overlay" @click=${this.closeModal}>
              <div class="create-server-modal" role="dialog" aria-modal="true" @click=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                  <div class="modal-header-titles">
                    <h2>Create a Server</h2>
                    <p>Your new community hub starts here.</p>
                  </div>
                  <button class="modal-close" @click=${this.closeModal}>&times;</button>
                </div>

                <div class="modal-body">
                  <div class="modal-section">
                    <div class="modal-section-title">1. IDENTITY</div>
                    <div class="identity-content">
                      <div class="upload-avatar">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span>UPLOAD</span>
                      </div>
                      <div class="server-name-input">
                        <label>Server Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Neon Riders Guild"
                          .value=${this.newRoomName}
                          @input=${(e: Event) =>
                            (this.newRoomName = (e.target as HTMLInputElement).value)}
                          @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.handleSubmit(e)}
                        />
                      </div>
                    </div>
                  </div>

                  <div class="modal-section">
                    <div class="modal-section-title">2. CATEGORY</div>
                    <div class="category-cards">
                      ${["Gaming", "Learning", "Music", "Social"].map(
                        (cat) => html`
                          <div
                            class="category-card ${this.selectedCategory === cat ? "selected" : ""}"
                            @click=${() => (this.selectedCategory = cat)}
                          >
                            <div class="category-icon">${this.renderCategoryIcon(cat)}</div>
                            <div class="category-name">${cat}</div>
                            ${this.selectedCategory === cat
                              ? html`
                                  <div class="check-icon">
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    >
                                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                    </svg>
                                  </div>
                                `
                              : ""}
                          </div>
                        `,
                      )}
                    </div>
                  </div>

                  <div class="modal-section">
                    <div class="modal-section-title">3. PRIVACY SETTINGS</div>
                    <div class="privacy-cards">
                      <div
                        class="privacy-card ${this.selectedPrivacy === "public" ? "selected" : ""}"
                        @click=${() => (this.selectedPrivacy = "public")}
                      >
                        <div class="privacy-icon">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path
                              d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                            ></path>
                          </svg>
                        </div>
                        <div class="privacy-info">
                          <div class="privacy-title">Public</div>
                          <div class="privacy-desc">Anyone can discover and join.</div>
                        </div>
                        <div class="radio-circle">
                          ${this.selectedPrivacy === "public"
                            ? html`<div class="radio-inner"></div>`
                            : ""}
                        </div>
                      </div>

                      <div
                        class="privacy-card ${this.selectedPrivacy === "password"
                          ? "selected"
                          : ""}"
                        @click=${() => (this.selectedPrivacy = "password")}
                      >
                        <div class="privacy-icon">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                        </div>
                        <div class="privacy-info">
                          <div class="privacy-title">Private</div>
                          <div class="privacy-desc">Invite-only access.</div>
                        </div>
                        <div class="radio-circle">
                          ${this.selectedPrivacy === "password"
                            ? html`<div class="radio-inner"></div>`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  ${this.error ? html`<div class="modal-error">${this.error}</div>` : ""}
                </div>

                <div class="modal-footer">
                  <button class="btn-back" @click=${this.closeModal}>Back</button>
                  <button
                    class="btn-create"
                    @click=${this.handleSubmit}
                    ?disabled=${!this.newRoomName.trim()}
                  >
                    Create Server &rarr;
                  </button>
                </div>
              </div>
            </div>
          `
        : ""}
    `;
  }

  private renderCategoryIcon(cat: string) {
    switch (cat) {
      case "Gaming":
        return html`<svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="6" y1="12" x2="10" y2="12"></line>
          <line x1="8" y1="10" x2="8" y2="14"></line>
          <line x1="15" y1="13" x2="15.01" y2="13"></line>
          <line x1="18" y1="11" x2="18.01" y2="11"></line>
          <path
            d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"
          ></path>
        </svg>`;
      case "Learning":
        return html`<svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>`;
      case "Music":
        return html`<svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>`;
      case "Social":
        return html`<svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>`;
      default:
        return html``;
    }
  }
}
