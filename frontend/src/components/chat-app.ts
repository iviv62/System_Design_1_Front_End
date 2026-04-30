import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import "../styles/chat-app.styles.scss"; // Standard Vite import (compiles to global CSS)
import "./chat-room";
import { fetchRooms, createRoom } from "../features/lib/chat/chat-room-api";
import type { Room } from "../types/room";

@customElement("chat-app")
export class ChatApp extends LitElement {
  // Opt out of Shadow DOM so the compiled CSS applies directly to this component
  createRenderRoot() {
    return this;
  }

  @state() private username = "";
  @state() private selectedRoom = "";
  @state() private joined = false;

  @state() private rooms: Room[] = [];
  @state() private newRoomName = "";
  @state() private searchQuery = "";
  @state() private isLoadingRooms = true;
  @state() private error = "";

  @state() private theme: "light" | "dark" = "light";

  async connectedCallback() {
    super.connectedCallback();
    
    // Check local storage or system preference for theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      this.theme = savedTheme;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      this.theme = "dark";
    }
    this.applyTheme(this.theme);

    await this.loadRooms();
  }

  private toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", this.theme);
    this.applyTheme(this.theme);
  }

  private applyTheme(theme: "light" | "dark") {
    if (theme === "dark") {
      document.body.setAttribute("data-theme", "dark");
    } else {
      document.body.setAttribute("data-theme", "light");
    }
  }

  private async loadRooms() {
    this.isLoadingRooms = true;
    this.error = "";
    try {
      this.rooms = await fetchRooms();
      // Auto-select the first room if available and none selected yet
      if (this.rooms.length > 0 && !this.selectedRoom) {
        this.selectedRoom = this.rooms[0].name;
      }
    } catch {
      this.error = "Failed to load rooms. Ensure the backend is running.";
    } finally {
      this.isLoadingRooms = false;
    }
  }

  private async handleCreateRoom(e: Event) {
    e.preventDefault();
    const trimmed = this.newRoomName.trim();
    if (!trimmed) return;

    try {
      const room = await createRoom(trimmed);
      this.newRoomName = "";
      await this.loadRooms();
      this.selectedRoom = room.name; // Auto-select the freshly created room
    } catch {
      this.error = "Failed to create room.";
    }
  }

  private handleJoin(e: Event) {
    e.preventDefault();
    if (!this.username.trim() || !this.selectedRoom.trim()) {
      return;
    }
    this.joined = true;
  }

  render() {
    if (!this.joined) {
      const filteredRooms = this.rooms.filter((r) =>
        r.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      );

      return html`
        <div class="lobby">
          <div class="lobby__header">
            <h1>💬 Chat Lobby</h1>
            <button class="lobby__theme-btn" @click=${this.toggleTheme}>
              ${this.theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
            </button>
          </div>

          <div class="lobby__layout">
            <!-- Left Column: Account Setup -->
            <div class="lobby__sidebar">
              <div>
                <h3 class="lobby__section-title">Account Setup</h3>
                <div class="lobby__input-group">
                  <label class="lobby__label">Username</label>
                  <input
                    class="lobby__input"
                    type="text"
                    placeholder="Enter username..."
                    .value=${this.username}
                    @input=${(e: Event) => (this.username = (e.target as HTMLInputElement).value)}
                  />
                </div>
              </div>

              <div>
                <h3 class="lobby__section-title" style="margin-bottom: 0.5rem;">Recent Rooms</h3>
                <div class="lobby__room-cards">
                  ${this.rooms.length === 0 && !this.isLoadingRooms
                    ? html`<div class="lobby__label" style="text-align:center;">No rooms yet</div>`
                    : repeat(
                        this.rooms.slice(0, 5), // Only show a few as "Recent" or prominent
                        (r) => r.id || r.name,
                        (r) => html`
                          <div
                            class="lobby__room-card ${this.selectedRoom === r.name ? "lobby__room-card--selected" : ""}"
                            @click=${() => (this.selectedRoom = r.name)}
                          >
                            ${r.name}
                          </div>
                        `
                      )}
                </div>
              </div>
            </div>

            <!-- Right Column: Room Finder -->
            <div class="lobby__main">
              <div class="lobby__finder-header">
                <h3 class="lobby__section-title">Room Finder 🔴</h3>
              </div>
              
              <div class="lobby__search">
                <input
                  class="lobby__input"
                  type="text"
                  placeholder="🔍 Search..."
                  .value=${this.searchQuery}
                  @input=${(e: Event) => (this.searchQuery = (e.target as HTMLInputElement).value)}
                />
              </div>

              ${this.error ? html`<div class="lobby__error">${this.error}</div>` : ""}
              
              <div class="lobby__table-wrapper">
                <table class="lobby__table">
                  <thead>
                    <tr>
                      <th>Room Name</th>
                      <th>Participants</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.isLoadingRooms
                      ? html`<tr><td colspan="3" style="text-align:center; padding: 2rem;">Loading rooms...</td></tr>`
                      : filteredRooms.length === 0
                      ? html`<tr><td colspan="3" style="text-align:center; padding: 2rem;">No rooms found.</td></tr>`
                      : repeat(
                          filteredRooms,
                          (r) => r.id || r.name,
                          (r) => html`
                            <tr
                              class="${this.selectedRoom === r.name ? "selected" : ""}"
                              @click=${() => (this.selectedRoom = r.name)}
                            >
                              <td>${r.name}</td>
                              <td>15/50</td>
                              <td>Public</td>
                            </tr>
                          `
                        )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="lobby__bottom">
            <div class="lobby__create">
              <label class="lobby__label">Create a New Room</label>
              <form class="lobby__create-row" @submit=${this.handleCreateRoom}>
                <input
                  class="lobby__input"
                  style="flex: 1;"
                  type="text"
                  placeholder="New Chat Room 1"
                  .value=${this.newRoomName}
                  @input=${(e: Event) => (this.newRoomName = (e.target as HTMLInputElement).value)}
                />
                <button
                  class="lobby__btn lobby__btn--dark"
                  type="submit"
                  ?disabled=${!this.newRoomName.trim()}
                >
                  + Create Room
                </button>
              </form>
            </div>
            
            <button 
              class="lobby__btn lobby__btn--primary lobby__btn--large" 
              @click=${this.handleJoin}
              ?disabled=${!this.username.trim() || !this.selectedRoom.trim()}
            >
              Join Selected: ${this.selectedRoom || "None"}
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <chat-room .username=${this.username} .room=${this.selectedRoom}></chat-room>
    `;
  }
}