import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  iconImageUpload,
  iconCategoryGaming,
  iconCategoryLearning,
  iconCategoryMusic,
  iconCategorySocial,
  iconCheckCircle,
  iconPrivacyPublic,
  iconPrivacyPrivate,
} from "./lobby-icons.js";

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
            <div class="create-server-modal-overlay">
              <div class="create-server-modal">
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
                        ${iconImageUpload}
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
                            <div class="category-icon">${this._categoryIcon(cat)}</div>
                            <div class="category-name">${cat}</div>
                            ${this.selectedCategory === cat
                              ? html`<div class="check-icon">${iconCheckCircle}</div>`
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
                        <div class="privacy-icon">${iconPrivacyPublic}</div>
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
                        <div class="privacy-icon">${iconPrivacyPrivate}</div>
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

  private _categoryIcon(cat: string) {
    switch (cat) {
      case "Gaming":   return iconCategoryGaming;
      case "Learning": return iconCategoryLearning;
      case "Music":    return iconCategoryMusic;
      case "Social":   return iconCategorySocial;
      default:         return html``;
    }
  }
}
