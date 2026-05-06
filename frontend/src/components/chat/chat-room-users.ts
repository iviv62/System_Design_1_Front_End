import { LitElement, html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import chatRoomUsersStylesRaw from "../../styles/chat-room-users.styles.scss?inline";

@customElement("chat-room-users")
export class ChatRoomUsers extends LitElement {
  @property({ type: Array })
  users: string[] = [];

  @property()
  currentUsername = "";

  @property({ type: Boolean })
  loading = false;

  static styles = unsafeCSS(chatRoomUsersStylesRaw);

  private getInitials(user: string): string {
    const parts = user.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  private getDisplayUsers(): string[] {
    const normalizedCurrent = this.currentUsername.trim();
    const deduped = Array.from(new Set(this.users.map((u) => u.trim()).filter(Boolean)));

    if (!normalizedCurrent) {
      return deduped;
    }

    const others = deduped.filter((u) => u !== normalizedCurrent).sort((a, b) => a.localeCompare(b));
    return [normalizedCurrent, ...others];
  }

  private getAvatarToneClass(user: string): string {
    let hash = 0;
    for (let i = 0; i < user.length; i += 1) {
      hash = (hash * 31 + user.charCodeAt(i)) >>> 0;
    }
    return `chat-room__user-avatar--tone-${hash % 4}`;
  }

  render() {
    const displayUsers = this.getDisplayUsers();

    return html`
      <aside class="chat-room__users" aria-label="Connected users">
        <div class="chat-room__users-header">
          <h3 class="chat-room__users-title">Connected</h3>
          <span class="chat-room__users-count">${displayUsers.length}</span>
        </div>

        <div class="chat-room__users-list">
          ${this.loading
            ? html`<p class="chat-room__users-empty">Loading users...</p>`
            : displayUsers.length === 0
              ? html`<p class="chat-room__users-empty">No active users yet</p>`
              : displayUsers.map(
                  (user) => html`
                    <div class="chat-room__user-item">
                      <div class="chat-room__user-avatar-wrap">
                        <span class="chat-room__user-avatar ${this.getAvatarToneClass(user)}" aria-hidden="true">${this.getInitials(user)}</span>
                        <span class="chat-room__user-presence-dot chat-room__user-presence-dot--online" aria-hidden="true"></span>
                      </div>

                      <div class="chat-room__user-main">
                        <div class="chat-room__user-name">${user}</div>
                        <div class="chat-room__user-status">Online</div>
                      </div>

                      ${user === this.currentUsername.trim()
                        ? html`<span class="chat-room__user-self">You</span>`
                        : ""}
                    </div>
                  `,
                )}
        </div>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-room-users": ChatRoomUsers;
  }
}
