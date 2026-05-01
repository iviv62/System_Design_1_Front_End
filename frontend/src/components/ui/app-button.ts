import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('app-button')
export class AppButton extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }
    button {
      padding: 0.5em 1.5em;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }
    button.light {
      background: #fff;
      color: #222;
      border: 1px solid #ccc;
    }
    button.dark {
      background: #222;
      color: #fff;
      border: 1px solid #444;
    }
  `;

  @property({ type: String })
  theme: 'light' | 'dark' = 'light';

  render() {
    return html`
      <button class="${this.theme}"><slot></slot></button>
    `;
  }
}
