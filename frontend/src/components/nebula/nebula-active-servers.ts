import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
  fetchRooms,
  deleteRoom,
  fetchConversationSummary,
  fetchUnreadCount,
  ApiError,
} from "../../features/lib/chat/chat-room-api";
import { navigate } from "../../utils/navigate";
import type { Room } from "../../types/room";
import type { ConversationSummary } from "../../types/conversation-summary";

@customElement("nebula-active-servers")
export class NebulaActiveServers extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property() username = "";
  @property() searchQuery = "";

  @state() private rooms: Room[] = [];
  @state() private conversationByRoom: Record<string, ConversationSummary> = {};
  @state() private unreadByRoom: Record<string, number> = {};
  @state() private isLoading = true;
  @state() private error = "";
  @state() private currentPage = 1;
  @state() private itemsPerPage = 6;

  private unreadLoadRequestId = 0;

  async connectedCallback() {
    super.connectedCallback();
    await this.loadRooms();
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has("username")) {
      void this.loadUnreadCountsForUser(this.username);
    }
    if (changedProperties.has("searchQuery")) {
      this.currentPage = 1;
    }
  }

  private async loadRooms() {
    this.isLoading = true;
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
    } catch {
      this.error = "Failed to load rooms. Ensure the backend is running.";
    } finally {
      this.isLoading = false;
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

  private joinRoom(room: Room) {
    if (!this.username.trim()) return;
    navigate(`/chat/${encodeURIComponent(room.id)}`);
  }

  private async handleDeleteRoom(room: Room, e: Event) {
    e.stopPropagation();
    if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return;
    try {
      await deleteRoom(room.id, this.username.trim());
      await this.loadRooms();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        alert("Only the room creator can delete this room.");
      } else if (error instanceof ApiError && error.status === 404) {
        alert("Room not found. It may have already been deleted.");
        await this.loadRooms();
      } else {
        alert("Failed to delete room.");
      }
    }
  }

  private getRoomGradient(name: string): string {
    const gradients = [
      "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
      "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
      "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
      "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
      "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }

  private getRoomInitials(name: string): string {
    const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, "");
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return name.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  private getAvatarBgColor(name: string): string {
    const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  private renderUnreadBadge(roomId: string) {
    const unread = this.unreadByRoom[roomId] ?? 0;
    if (!this.username.trim() || unread <= 0) return null;
    return html`<span class="notification-badge">${unread}</span>`;
  }

  private renderLastMessagePreview(roomId: string) {
    const summary = this.conversationByRoom[roomId];
    if (!summary?.last_message_text) return html`<em>No messages yet</em>`;
    if (!summary.last_message_username) return html`${summary.last_message_text}`;
    return html`<strong>@${summary.last_message_username}:</strong> ${summary.last_message_text}`;
  }

  render() {
    const filteredRooms = this.rooms.filter((r) =>
      r.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filteredRooms.length / this.itemsPerPage));
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const paginatedRooms = filteredRooms.slice(startIndex, startIndex + this.itemsPerPage);

    return html`
      <section>
        <div class="section-header">
          <h3>Your Active Servers</h3>
          <div class="section-header-actions" style="display: flex; gap: 1rem; align-items: center;">
            ${this.isLoading ? html`<span class="loading-indicator" style="font-size: 0.85rem; color: var(--color-text-muted);">Loading...</span>` : ""}
            ${this.error ? html`<span class="error-msg" style="font-size: 0.85rem; color: var(--color-status-error-text);">${this.error}</span>` : ""}
          </div>
        </div>

        ${filteredRooms.length === 0 && !this.isLoading
          ? html`<div class="empty-rooms-state" style="padding: 3rem; text-align: center; background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: 12px; color: var(--color-text-muted);">No servers found matching "${this.searchQuery}"</div>`
          : html`
              <div class="active-servers-grid">
                ${repeat(
                  paginatedRooms,
                  (r) => r.id,
                  (r) => {
                    const summary = this.conversationByRoom[r.id];
                    const participants = summary?.participants || [];
                    const isCreator = r.created_by && r.created_by === this.username.trim();

                    return html`
                      <div class="server-card" @click=${() => this.joinRoom(r)}>
                        <div class="card-header">
                          <div class="server-info">
                            <div
                              class="server-icon"
                              style="background: ${this.getRoomGradient(r.name)}; color: #ffffff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; text-shadow: 0 1px 2px rgba(0,0,0,0.2);"
                            >
                              ${this.getRoomInitials(r.name)}
                            </div>
                            <div class="server-details">
                              <h4>${r.name}</h4>
                              <div class="online-count">
                                <span class="dot"></span>
                                ${r.participants?.label || "0/50"}
                                &bull;
                                ${r.status === "password" ? "🔒 Password" : "🌐 Public"}
                              </div>
                            </div>
                          </div>
                          <div class="header-badges" style="display: flex; align-items: center; gap: 0.5rem;">
                            ${this.renderUnreadBadge(r.id)}
                            ${isCreator
                              ? html`
                                  <button
                                    class="delete-card-btn"
                                    title="Delete Server"
                                    @click=${(e: Event) => this.handleDeleteRoom(r, e)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                  </button>
                                `
                              : ""}
                          </div>
                        </div>
                        <div class="card-content">
                          <div class="participants">
                            ${participants.slice(0, 3).map(
                              (p) => html`
                                <div
                                  class="avatar"
                                  style="background: ${this.getAvatarBgColor(p)}; color: #ffffff; font-size: 0.7rem; font-weight: 600; display: flex; align-items: center; justify-content: center; text-transform: uppercase; border: 2px solid var(--color-surface);"
                                  title="${p}"
                                >
                                  ${p[0]}
                                </div>
                              `
                            )}
                            ${participants.length > 3
                              ? html`<div class="more">+${participants.length - 3}</div>`
                              : participants.length === 0
                              ? html`<div class="more" style="font-size: 0.6rem;">0</div>`
                              : ""}
                          </div>
                          <p class="recent-message">
                            ${this.renderLastMessagePreview(r.id)}
                          </p>
                        </div>
                      </div>
                    `;
                  }
                )}
              </div>

              ${totalPages > 1
                ? html`
                    <div class="pagination">
                      <button
                        class="page-btn"
                        ?disabled=${this.currentPage === 1}
                        @click=${() => this.currentPage--}
                      >
                        &larr; Prev
                      </button>
                      ${Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (p) => html`
                          <button
                            class="page-btn ${this.currentPage === p ? "active" : ""}"
                            @click=${() => (this.currentPage = p)}
                          >
                            ${p}
                          </button>
                        `
                      )}
                      <button
                        class="page-btn"
                        ?disabled=${this.currentPage === totalPages}
                        @click=${() => this.currentPage++}
                      >
                        Next &rarr;
                      </button>
                    </div>
                  `
                : ""}
            `}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nebula-active-servers": NebulaActiveServers;
  }
}
