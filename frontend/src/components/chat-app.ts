import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import "../styles/chat-app.styles.scss"; // Standard Vite import (compiles to global CSS)
import "./chat-room";
import {
  fetchRooms,
  createRoom,
  fetchConversationSummary,
  fetchUnreadCount,
  ApiError,
} from "../features/lib/chat/chat-room-api";
import { getTheme, setTheme } from "../utils/theme";
import type { Room } from "../types/room";
import type { ConversationSummary } from "../types/conversation-summary";

@customElement("chat-app")
export class ChatApp extends LitElement {
  // Opt out of Shadow DOM so the compiled CSS applies directly to this component
  createRenderRoot() {
    return this;
  }

  @state() private username = "";
  @state() private selectedRoomId = "";
  @state() private selectedRoomName = "";
  @state() private joined = false;

  @state() private rooms: Room[] = [];
  @state() private conversationByRoom: Record<string, ConversationSummary> = {};
  @state() private unreadByRoom: Record<string, number> = {};
  @state() private newRoomName = "";
  @state() private searchQuery = "";
  @state() private isLoadingRooms = true;
  @state() private error = "";

  @state() private theme: "light" | "dark" = "light";

  private unreadLoadRequestId = 0;

  async connectedCallback() {
    super.connectedCallback();

    this.theme = getTheme();
    setTheme(this.theme);

    await this.loadRooms();
  }

  private toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
    setTheme(this.theme);
  }

  private async loadRooms() {
    this.isLoadingRooms = true;
    this.error = "";
    try {
      const rooms = await fetchRooms();
      this.rooms = rooms;

      const summaryResults = await Promise.allSettled(
        rooms.map(async (room) => {
          const summary = await fetchConversationSummary(room.id);
          return [room.id, summary] as const;
        }),
      );

      const byRoom: Record<string, ConversationSummary> = {};
      for (const result of summaryResults) {
        if (result.status === "fulfilled") {
          const [roomId, summary] = result.value;
          byRoom[roomId] = summary;
        }
      }
      this.conversationByRoom = byRoom;

      await this.loadUnreadCountsForUser(this.username);

      // Auto-select the first room if available and none selected yet
      if (this.rooms.length > 0 && !this.selectedRoomId) {
        this.selectedRoomId = this.rooms[0].id;
        this.selectedRoomName = this.rooms[0].name;
      }
    } catch {
      this.error = "Failed to load rooms. Ensure the backend is running.";
    } finally {
      this.isLoadingRooms = false;
    }
  }

  private async loadUnreadCountsForUser(username: string) {
    const trimmed = username.trim();
    if (!trimmed || this.rooms.length === 0) {
      this.unreadByRoom = {};
      return;
    }

    const requestId = ++this.unreadLoadRequestId;

    const unreadResults = await Promise.allSettled(
      this.rooms.map(async (room) => {
        const unread = await fetchUnreadCount(room.id, trimmed);
        return [room.id, unread] as const;
      }),
    );

    if (requestId !== this.unreadLoadRequestId) {
      return;
    }

    const byRoom: Record<string, number> = {};
    for (const result of unreadResults) {
      if (result.status === "fulfilled") {
        const [roomId, unread] = result.value;
        byRoom[roomId] = unread;
      }
    }
    this.unreadByRoom = byRoom;
  }

  private handleUsernameInput(e: Event) {
    this.username = (e.target as HTMLInputElement).value;
    void this.loadUnreadCountsForUser(this.username);
  }

  private renderUnreadBadge(roomId: string) {
    const unread = this.unreadByRoom[roomId] ?? 0;
    if (!this.username.trim() || unread <= 0) return null;
    return html`<span class="lobby__unread-badge">${unread}</span>`;
  }

  private async handleCreateRoom(e: Event) {
    e.preventDefault();
    const trimmed = this.newRoomName.trim();
    if (!trimmed) return;

    try {
      const room = await createRoom({ name: trimmed });
      this.newRoomName = "";
      await this.loadRooms();
      this.selectedRoomId = room.id;
      this.selectedRoomName = room.name;
      // Auto-join the freshly created room using backend id.
      this.joined = true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        this.error = "A room with that name already exists. Pick a different name.";
      } else {
        this.error = "Failed to create room.";
      }
    }
  }

  private joinRoom(room: Room) {
    if (!this.username.trim()) return;
    this.selectedRoomId = room.id;
    this.selectedRoomName = room.name;
    this.joined = true;
  }

  private renderLastMessagePreview(roomId: string): string {
    const summary = this.conversationByRoom[roomId];
    if (!summary?.last_message_text) return "No messages yet";
    if (!summary.last_message_username) return summary.last_message_text;
    return `${summary.last_message_username}: ${summary.last_message_text}`;
  }

  render() {
    if (!this.joined) {
      const filteredRooms = this.rooms.filter((r) =>
        r.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      );

      return html`
        <div class="lobby">
          <!-- Top Header Bar -->
          <div class="lobby__header">
            <h1 class="lobby__title">💬 Chat Lobby</h1>
            <button class="lobby__theme-btn" @click=${this.toggleTheme}>
              ${this.theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>

          <!-- Three-column layout -->
          <div class="lobby__layout">

            <!-- Column 1: Account Setup + Recent Rooms -->
            <div class="lobby__col">
              <div class="lobby__card">
                <h3 class="lobby__card-title">Account Setup</h3>
                <label class="lobby__label">Username</label>
                <input
                  class="lobby__input"
                  type="text"
                  placeholder="Enter username..."
                  .value=${this.username}
                  @input=${this.handleUsernameInput}
                />
              </div>

              <div class="lobby__card">
                <h3 class="lobby__card-title">Recent Rooms</h3>
                <div class="lobby__room-cards">
                  ${this.rooms.length === 0 && !this.isLoadingRooms
                    ? html`<p class="lobby__empty">No rooms yet</p>`
                    : repeat(
                        this.rooms.slice(0, 5),
                        (r) => r.id,
                        (r) => html`
                          <div
                            class="lobby__room-card ${this.selectedRoomId === r.id ? "lobby__room-card--selected" : ""}"
                            @click=${() => {
                              this.selectedRoomId = r.id;
                              this.selectedRoomName = r.name;
                            }}
                          >
                            <div class="lobby__room-card-head">
                              <div class="lobby__room-card-name">${r.name}</div>
                              ${this.renderUnreadBadge(r.id)}
                            </div>
                            <div class="lobby__room-card-preview">${this.renderLastMessagePreview(r.id)}</div>
                          </div>
                        `
                      )}
                </div>
              </div>
            </div>

            <!-- Column 2: Create Room + Room Finder -->
            <div class="lobby__col">
              <div class="lobby__card">
                <h3 class="lobby__card-title">Create a New Room</h3>
                <form @submit=${this.handleCreateRoom}>
                  <input
                    class="lobby__input"
                    type="text"
                    placeholder="New Chat Room 1"
                    .value=${this.newRoomName}
                    @input=${(e: Event) => (this.newRoomName = (e.target as HTMLInputElement).value)}
                  />
                  <button
                    class="lobby__btn lobby__btn--dark lobby__btn--full"
                    type="submit"
                    ?disabled=${!this.newRoomName.trim()}
                  >
                    + Create Room
                  </button>
                  ${this.error ? html`<div class="lobby__error">${this.error}</div>` : ""}
                </form>
              </div>

              <div class="lobby__card">
                <div class="lobby__finder-header">
                  <h3 class="lobby__card-title" style="margin-bottom: 0;">Room Finder</h3>
                  <button
                    class="lobby__refresh-btn"
                    @click=${this.loadRooms}
                    ?disabled=${this.isLoadingRooms}
                  >
                    ${this.isLoadingRooms ? "⏳" : "↻ Refresh"}
                  </button>
                </div>

                <input
                  class="lobby__input lobby__search-input"
                  type="text"
                  placeholder="🔍 Search..."
                  .value=${this.searchQuery}
                  @input=${(e: Event) => (this.searchQuery = (e.target as HTMLInputElement).value)}
                />

                <div class="lobby__table-wrapper">
                  <table class="lobby__table">
                    <thead>
                      <tr>
                        <th>Room Name</th>
                        <th>Participants</th>
                        <th>Status</th>
                        <th>Join Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this.isLoadingRooms
                        ? html`<tr><td colspan="4" class="lobby__table-empty">Loading rooms...</td></tr>`
                        : filteredRooms.length === 0
                        ? html`<tr><td colspan="4" class="lobby__table-empty">No rooms found.</td></tr>`
                        : repeat(
                            filteredRooms,
                            (r) => r.id,
                            (r) => html`
                              <tr class="${this.selectedRoomId === r.id ? "selected" : ""}" @click=${() => {
                                this.selectedRoomId = r.id;
                                this.selectedRoomName = r.name;
                              }}>
                                <td>
                                  <div class="lobby__room-main-head">
                                    <div class="lobby__room-main">${r.name}</div>
                                    ${this.renderUnreadBadge(r.id)}
                                  </div>
                                  <div class="lobby__room-preview">${this.renderLastMessagePreview(r.id)}</div>
                                </td>
                                <td>👥 ${r.participants?.label || "0/50"}</td>
                                <td>
                                  ${r.status === "password"
                                    ? html`🔒 Password`
                                    : html`🌐 Public`}
                                </td>
                                <td>
                                  <button
                                    class="lobby__btn lobby__btn--join"
                                    ?disabled=${!this.username.trim()}
                                    @click=${(e: Event) => { e.stopPropagation(); this.joinRoom(r); }}
                                  >Join</button>
                                </td>
                              </tr>
                            `
                          )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Column 3: Reserved / Future use -->
            <div class="lobby__col lobby__col--aside"></div>

          </div>
        </div>
      `;
    }

    return html`
      <chat-room .username=${this.username} .roomId=${this.selectedRoomId} .roomName=${this.selectedRoomName}></chat-room>
    `;
  }
}