import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("chat-room-users")
export class ChatRoomUsers extends LitElement {
  @property({ type: Array })
  users: string[] = [];

  @property()
  currentUsername = "";

  @property({ type: Boolean })
  loading = false;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .chat-room__users {
      height: 100%;
      border: 1px solid var(--cr-border, #374151);
      background: var(--cr-header-bg, #111827);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .chat-room__users-header {
      padding: 0.75rem 0.9rem;
      border-bottom: 1px solid var(--cr-border, #374151);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .chat-room__users-title {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--cr-title-color, #f3f4f6);
      letter-spacing: 0.01em;
    }

    .chat-room__users-count {
      min-width: 1.6rem;
      height: 1.6rem;
      border-radius: 999px;
      border: 1px solid var(--cr-border, #374151);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--cr-meta-color, #9ca3af);
      background: var(--cr-bg, #1f2937);
    }

    .chat-room__users-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .chat-room__users-list::-webkit-scrollbar {
      width: 6px;
    }

    .chat-room__users-list::-webkit-scrollbar-thumb {
      background-color: var(--cr-scrollbar, #4b5563);
      border-radius: 999px;
    }

    .chat-room__user-item {
      display: grid;
      grid-template-columns: 10px 1fr auto;
      align-items: center;
      gap: 0.45rem;
      padding: 0.42rem 0.5rem;
      border-radius: 7px;
      border: 1px solid var(--cr-border, #374151);
      background: var(--cr-bg, #1f2937);
    }

    .chat-room__user-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #10b981;
    }

    .chat-room__user-name {
      font-size: 0.83rem;
      line-height: 1.2;
      color: var(--cr-title-color, #f3f4f6);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chat-room__user-self {
      font-size: 0.68rem;
      padding: 0.12rem 0.35rem;
      border-radius: 999px;
      border: 1px solid var(--cr-border, #374151);
      color: var(--cr-meta-color, #9ca3af);
    }

    .chat-room__users-empty {
      margin: 0;
      padding: 0.6rem;
      color: var(--cr-meta-color, #9ca3af);
      font-size: 0.8rem;
      text-align: center;
    }
  `;

  private getDisplayUsers(): string[] {
    const normalizedCurrent = this.currentUsername.trim();
    const deduped = Array.from(new Set(this.users.map((u) => u.trim()).filter(Boolean)));

    if (!normalizedCurrent) {
      return deduped;
    }

    const others = deduped.filter((u) => u !== normalizedCurrent).sort((a, b) => a.localeCompare(b));
    return [normalizedCurrent, ...others];
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
                      <span class="chat-room__user-dot" aria-hidden="true"></span>
                      <span class="chat-room__user-name">${user}</span>
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
