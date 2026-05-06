import { html, LitElement, unsafeCSS } from "lit";
import { customElement, property } from 'lit/decorators.js';
import appButtonStylesRaw from "../../styles/app-button.styles.scss?inline";

@customElement('app-button')
export class AppButton extends LitElement {
  static styles = unsafeCSS(appButtonStylesRaw);

  @property({ type: String })
  theme: 'light' | 'dark' = 'light';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: String })
  type: 'button' | 'submit' | 'reset' = 'button';

  render() {
    return html`
      <button class="${this.theme}" ?disabled=${this.disabled} type=${this.type}>
        <slot></slot>
      </button>
    `;
  }
}
