import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../styles/chat-app.styles.scss"; // Standard Vite import (compiles to global CSS)
import "./chat-room";

@customElement("chat-app")
export class ChatApp extends LitElement {
  // Opt out of Shadow DOM so the compiled CSS applies directly to this component
  createRenderRoot() {
    return this;
  }

  @state()
  private username = "";

  @state()
  private room = "general";

  @state()
  private joined = false;

  private handleJoin(e: Event) {
    e.preventDefault();
    if (!this.username.trim() || !this.room.trim()) {
      return;
    }
    this.joined = true;
  }

  render() {
    if (!this.joined) {
      return html`
        <h1>Chat (Stage 2)</h1>
        <form @submit=${this.handleJoin}>
          <input
            type="text"
            placeholder="Username"
            .value=${this.username}
            @input=${(e: Event) =>
              (this.username = (e.target as HTMLInputElement).value)}
          />
          <input
            type="text"
            placeholder="Room"
            .value=${this.room}
            @input=${(e: Event) =>
              (this.room = (e.target as HTMLInputElement).value)}
          />
          <button type="submit">Join</button>
        </form>
      `;
    }

    return html`
      <chat-room .username=${this.username} .room=${this.room}></chat-room>
    `;
  }
}