import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import "../styles/chat-app.styles.scss"; // Standard Vite import (compiles to global CSS)
import "./chat/chat-room";
import "./lobby/lobby-header";
import "./lobby/lobby-create-room";
import {
  fetchRooms,
  createRoom,
  deleteRoom,
  fetchConversationSummary,
  fetchUnreadCount,
  ApiError,
} from "../features/lib/chat/chat-room-api";
import {
  getCurrentPushToken,
  initFirebasePushAndRegister,
} from "../features/lib/notifications/firebase-messaging";
import { subscribeToRoomNotifications } from "../features/lib/notifications/notification-room-subscription-api";
import { ThemeController } from "../utils/theme-controller";
import type { Room } from "../types/room";
import type { ConversationSummary } from "../types/conversation-summary";

@customElement("chat-app")
export class ChatApp extends LitElement {
  // Opt out of Shadow DOM so the compiled CSS applies directly to this component
  createRenderRoot() {
    return this;
  }

  @property() username = "";
  @state() private selectedRoomId = "";
  @state() private selectedRoomName = "";
  @state() private joined = false;

  @state() private rooms: Room[] = [];
  @state() private conversationByRoom: Record<string, ConversationSummary> = {};
  @state() private unreadByRoom: Record<string, number> = {};
  // newRoomName state moved to <lobby-create-room>
  @state() private searchQuery = "";
  @state() private isLoadingRooms = true;
  @state() private error = "";

  private themeCtrl = new ThemeController(this);

  private unreadLoadRequestId = 0;
  private notificationRegistrationByUser: Record<string, boolean> = {};
  private subscribedRooms = new Set<string>();

  async connectedCallback() {
    super.connectedCallback();

    ThemeController.set(this.themeCtrl.theme);

    await this.loadRooms();
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);

    if (changedProperties.has("username")) {
      void this.loadUnreadCountsForUser(this.username);
      this.subscribedRooms.clear();
    }
  }

  private toggleTheme(e?: CustomEvent) {
    const next = e?.detail?.theme ?? (this.themeCtrl.theme === "light" ? "dark" : "light");
    ThemeController.set(next);
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

  private async registerPushForUser(username: string) {
    const trimmed = username.trim();
    if (!trimmed || this.notificationRegistrationByUser[trimmed]) return;

    try {
      await initFirebasePushAndRegister(trimmed);
      this.notificationRegistrationByUser[trimmed] = true;
    } catch (error) {
      console.error("Failed to register push token", error);
    }
  }

  private async syncRoomNotificationSubscription(roomId: string) {
    const username = this.username.trim();
    const targetRoomId = roomId.trim();
    if (!username || !targetRoomId) return;

    // Already subscribed to this room — backend handles dedup but avoid extra calls.
    const key = `${username}:${targetRoomId}`;
    if (this.subscribedRooms.has(key)) return;

    await this.registerPushForUser(username);
    const token = getCurrentPushToken();
    if (!token) return;

    try {
      await subscribeToRoomNotifications({ username, roomId: targetRoomId, token, provider: "fcm" });
      this.subscribedRooms.add(key);
    } catch (error) {
      console.error("Failed to subscribe to room notifications", error);
    }
  }


  private renderUnreadBadge(roomId: string) {
    const unread = this.unreadByRoom[roomId] ?? 0;
    if (!this.username.trim() || unread <= 0) return null;
    return html`<span class="lobby__unread-badge">${unread}</span>`;
  }


  private async handleCreateRoomFromChild(roomName: string) {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    try {
      const room = await createRoom({ name: trimmed, created_by: this.username.trim() || undefined });
      await this.loadRooms();
      this.selectedRoomId = room.id;
      this.selectedRoomName = room.name;
      this.joined = true;
      this.error = "";
      void this.syncRoomNotificationSubscription(room.id);
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
    void this.syncRoomNotificationSubscription(room.id);
  }

  private async handleDeleteRoom(room: Room, e: Event) {
    e.stopPropagation();
    if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return;
    try {
      await deleteRoom(room.id, this.username.trim());
      if (this.selectedRoomId === room.id) {
        this.joined = false;
        this.selectedRoomId = "";
        this.selectedRoomName = "";
      }
      await this.loadRooms();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        this.error = "Only the room creator can delete this room.";
      } else if (error instanceof ApiError && error.status === 404) {
        this.error = "Room not found. It may have already been deleted.";
        await this.loadRooms();
      } else {
        this.error = "Failed to delete room.";
      }
    }
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
          <lobby-header .theme=${this.themeCtrl.theme} @toggle-theme=${this.toggleTheme}></lobby-header>

          <!-- Three-column layout -->
          <div class="lobby__layout">

            <!-- Column 1: Signed-In User + Recent Rooms -->
            <div class="lobby__col">
              <div class="lobby__card">
                <h3 class="lobby__card-title">Signed In User</h3>
                <div class="lobby__label">Username</div>
                <div class="lobby__room-card-name">${this.username || "-"}</div>
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
                            ${r.created_by ? html`<div class="lobby__room-card-creator">by ${r.created_by}</div>` : ""}
                          </div>
                        `
                      )}
                </div>
              </div>

              ${this.username.trim() ? (() => {
                const myRooms = this.rooms.filter(r => r.created_by === this.username.trim());
                return html`
                  <div class="lobby__card">
                    <h3 class="lobby__card-title">My Rooms</h3>
                    <div class="lobby__room-cards">
                      ${myRooms.length === 0
                        ? html`<p class="lobby__empty">You haven't created any rooms yet</p>`
                        : repeat(
                            myRooms,
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
                                <div class="lobby__room-card-actions">
                                  <button
                                    class="lobby__btn lobby__btn--delete lobby__btn--delete-sm"
                                    @click=${(e: Event) => this.handleDeleteRoom(r, e)}
                                  >Delete</button>
                                </div>
                              </div>
                            `
                          )}
                    </div>
                  </div>
                `;
              })() : ""}
            </div>

            <!-- Column 2: Create Room + Room Finder -->
            <div class="lobby__col">
              <lobby-create-room 
                .error=${this.error}
                @create-room=${(e: CustomEvent) => this.handleCreateRoomFromChild(e.detail)}>
              </lobby-create-room>

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
                                  ${r.created_by ? html`<div class="lobby__room-creator">by ${r.created_by}</div>` : ""}
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
                                  ${r.created_by && r.created_by === this.username.trim()
                                    ? html`<button
                                        class="lobby__btn lobby__btn--delete"
                                        @click=${(e: Event) => this.handleDeleteRoom(r, e)}
                                      >Delete</button>`
                                    : ""}
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