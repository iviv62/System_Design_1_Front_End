import { LitElement, html, unsafeCSS, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ThemeController } from "../../utils/theme-controller";
import chatSettingsModalStylesRaw from "../../styles/chat-settings-modal.styles.scss?inline";
import { settingsStore } from "../../store/settings-store";
import type { SettingsState } from "../../store/settings-store";
import { watch } from "zustand-lit";
import { troubleshootMediaDevices, type MediaTroubleshootResult } from "../../features/lib/chat/media-device-diagnostics";

@customElement("chat-settings-modal")
export class ChatSettingsModal extends LitElement {
  @property({ type: Boolean })
  open = false;

  @state() private diagnosticsResult: MediaTroubleshootResult | null = null;
  @state() private isRunningDiagnostics = false;

  @watch(settingsStore)
  private settingsState?: SettingsState;

  private themeCtrl = new ThemeController(this);

  static styles = unsafeCSS(chatSettingsModalStylesRaw);

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }));
  }

  private toggleTheme() {
    const newTheme = this.themeCtrl.theme === 'light' ? 'dark' : 'light';
    ThemeController.set(newTheme);
  }

  private toggleConnectionMonitor() {
    const current = settingsStore.getState().isConnectionMonitorEnabled;
    settingsStore.getState().setConnectionMonitorEnabled(!current);
  }

  private async runDiagnostics() {
    this.isRunningDiagnostics = true;
    this.diagnosticsResult = null;

    this.diagnosticsResult = await troubleshootMediaDevices();

    // Stop tracks immediately after diagnostic test to release camera/mic
    if (this.diagnosticsResult && this.diagnosticsResult.success) {
      this.diagnosticsResult.stream.getTracks().forEach(t => t.stop());
    }

    this.isRunningDiagnostics = false;
  }

  render() {
    if (!this.open) return null;

    // Apply the theme class to a wrapper so styles can define variables using it
    const themeClass = this.themeCtrl.theme === 'dark' ? 'modal-theme--dark' : 'modal-theme--light';

    return html`
      <div class="overlay ${themeClass}" @click=${this.close}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <h2>Settings</h2>
            <button class="close-btn" @click=${this.close} aria-label="Close settings">&times;</button>
          </div>
          <div class="body">
            <div class="setting-row">
              <span class="setting-label">Theme</span>
              <div class="setting-control">
                <button @click=${this.toggleTheme}>
                  ${this.themeCtrl.theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
                </button>
              </div>
            </div>

            <div class="setting-row">
              <span class="setting-label">Connection Monitor</span>
              <div class="setting-control">
                <button @click=${this.toggleConnectionMonitor}>
                  ${this.settingsState?.isConnectionMonitorEnabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>

            <div class="setting-row diagnostics-row">
              <div class="diagnostics-header">
                <span class="setting-label">Media Diagnostics</span>
                <div class="setting-control">
                  <button @click=${this.runDiagnostics} ?disabled=${this.isRunningDiagnostics}>
                    ${this.isRunningDiagnostics ? "Running..." : "Run Diagnostics"}
                  </button>
                </div>
              </div>

              ${this.diagnosticsResult ? html`
                <div class="diagnostics-result-box">
                  ${this.diagnosticsResult.success ? html`
                    <div class="diagnostics-success-title">✅ Devices Working Properly</div>
                    <ul class="diagnostics-list">
                      ${this.diagnosticsResult.devices.map(d => html`
                        <li>${d.label || d.kind} (${d.kind})</li>
                      `)}
                    </ul>
                  ` : html`
                    <div class="diagnostics-error-title">❌ Diagnostics Failed</div>
                    <p class="diagnostics-error-message">${this.diagnosticsResult.error}</p>
                  `}
                </div>
              ` : nothing}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-settings-modal": ChatSettingsModal;
  }
}
