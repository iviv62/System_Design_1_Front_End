import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("lobby-create-room")
export class LobbyCreateRoom extends LitElement {
  createRenderRoot() { return this; }

  @property() error = "";
  @state() private newRoomName = "";

  private handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.newRoomName.trim()) return;
    this.dispatchEvent(new CustomEvent("create-room", {
      detail: this.newRoomName.trim(),
      bubbles: true, composed: true
    }));
    this.newRoomName = "";
  }

  render() {
    return html`
      <div class="lobby__card">
        <h3 class="lobby__card-title">Create a New Room</h3>
        <form @submit=${this.handleSubmit}>
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
    `;
  }
}
