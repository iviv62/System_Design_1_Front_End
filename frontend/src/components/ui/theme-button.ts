import { customElement } from 'lit/decorators.js';
import { AppButton } from './app-button';

@customElement('theme-button')
export class ThemeButton extends AppButton {
  constructor() {
    super();
    // Default starting theme (can be overridden by the user)
    this.theme = 'light';
    
    // Add a click listener to toggle the theme automatically
    this.addEventListener('click', this._toggleTheme);
  }

  private _toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    
    // Emit an event so the rest of the app can update its theme
    this.dispatchEvent(new CustomEvent('theme-changed', {
      detail: { theme: this.theme },
      bubbles: true, // Allow the event to bubble up the DOM
      composed: true // Allow the event to cross the shadow DOM boundary
    }));
  }
}
