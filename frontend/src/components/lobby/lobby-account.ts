import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("lobby-account")
export class LobbyAccount extends LitElement {
  createRenderRoot() { return this; }

  @property() username = "";

  private handleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent("username-change", { detail: value, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="lobby__card">
        <h3 class="lobby__card-title">Account Setup</h3>
        <label class="lobby__label">Username</label>
        <input
          class="lobby__input"
          type="text"
          placeholder="Enter username..."
          .value=${this.username}
          @input=${this.handleInput}
        />
      </div>
    `;
  }
}
