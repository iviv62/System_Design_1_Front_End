import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./chat-room";

@customElement("chat-app")
export class ChatApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      padding: 1rem;
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      font-size: 1.4rem;
      margin-bottom: 1rem;
    }

    form {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    input {
      flex: 1;
      min-width: 0;
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
      border: 1px solid #ccc;
    }

    button {
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      border: none;
      background: #2563eb;
      color: white;
      cursor: pointer;
    }

    button:hover {
      background: #1d4ed8;
    }
  `;

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
        <h1>Chat (Stage 1)</h1>
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
      <h1>Room: ${this.room}</h1>
      <chat-room .username=${this.username} .room=${this.room}></chat-room>
    `;
  }
}