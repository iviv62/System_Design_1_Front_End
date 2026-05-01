import { LitElement, html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import stylesRaw from "../../styles/unread-divider.styles.scss?inline";

@customElement("unread-divider")
export class UnreadDivider extends LitElement {
  static styles = unsafeCSS(stylesRaw);

  @property()
  label = "Last seen";

  render() {
    return html`<div class="divider">${this.label}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "unread-divider": UnreadDivider;
  }
}
