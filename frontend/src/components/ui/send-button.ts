import { customElement } from "lit/decorators.js";
import { AppButton } from "./app-button";

@customElement("send-button")
export class SendButton extends AppButton {
  constructor() {
    super();
    this.type = "submit";
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "send-button": SendButton;
  }
}
