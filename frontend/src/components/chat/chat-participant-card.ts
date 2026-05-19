import { LitElement, html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import chatActiveCallStylesRaw from "../../styles/chat-active-call.styles.scss?inline";

/**
 * Renders a single participant tile inside the active-call grid.
 * Intentionally stateless — all data flows in via properties.
 */
@customElement("chat-participant-card")
export class ChatParticipantCard extends LitElement {
  static styles = unsafeCSS(chatActiveCallStylesRaw);

  @property() username = "";
  @property({ type: Boolean }) isSelf = false;
  @property() color = "";
  @property() initials = "";

  render() {
    return html`
      <div class="active-call__avatar-wrap">
        <div class="active-call__avatar" style="background-color: ${this.color}">
          ${this.initials}
        </div>
      </div>
      <div class="active-call__card-controls">
        <div class="active-call__badge">
          ${this.username}
          ${this.isSelf ? html`<span class="active-call__badge-you">YOU</span>` : ""}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-participant-card": ChatParticipantCard;
  }
}
