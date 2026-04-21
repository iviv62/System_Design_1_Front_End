import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { chatRoomStyles } from "../styles/chat-room.styles";

@customElement("chat-room")
export class ChatRoom extends LitElement {
  static styles = chatRoomStyles;

  @property()
  username = "Guest";

  @property()
  room = "general";

  @state()
  private messages: string[] = [];

  @state()
  private inputValue = "";

  private socket: WebSocket | null = null;

  private getSocketUrl(): string {
    const configuredBase = import.meta.env.VITE_WS_BASE_URL?.trim();
    if (configuredBase) {
      const normalizedBase = configuredBase.replace(/\/$/, "");
      return `${normalizedBase}/ws/${encodeURIComponent(this.room)}?username=${encodeURIComponent(this.username)}`;
    }

  
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//127.0.0.1:8000/ws/${encodeURIComponent(this.room)}?username=${encodeURIComponent(this.username)}`;
  }

  connectedCallback(): void {
    super.connectedCallback();

    const url = this.getSocketUrl();

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.addSystemMessage(
        `Connected as ${this.username} to room "${this.room}"`,
      );
    };

    this.socket.onmessage = (event: MessageEvent) => {
      this.addMessage(event.data);
    };

    this.socket.onclose = (event: CloseEvent) => {
      const details = event.reason
        ? `code=${event.code}, reason=${event.reason}`
        : `code=${event.code}`;
      this.addSystemMessage(`Disconnected from server (${details})`);
    };

    this.socket.onerror = () => {
      this.addSystemMessage(`WebSocket error while connecting to ${url}`);
    };
  }

  disconnectedCallback(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    super.disconnectedCallback();
  }

  private addMessage(msg: string) {
    this.messages = [...this.messages, msg];
  }

  private addSystemMessage(msg: string) {
    this.addMessage(`[system] ${msg}`);
  }

  private handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const trimmed = this.inputValue.trim();
    if (!trimmed) return;

    this.socket.send(trimmed);
    this.inputValue = "";
  }

  render() {
    return html`
      <div class="messages">
        ${this.messages.map((m) =>
          m.startsWith("[system]")
            ? html`<div class="system">${m}</div>`
            : html`<div>${m}</div>`,
        )}
      </div>
      <form @submit=${this.handleSubmit}>
        <input
          type="text"
          placeholder="Type a message…"
          .value=${this.inputValue}
          @input=${(e: Event) =>
            (this.inputValue = (e.target as HTMLInputElement).value)}
        />
        <button type="submit">Send</button>
      </form>
    `;
  }
}