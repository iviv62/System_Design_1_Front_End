import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { ThemeController } from '../../features/lib/theme/theme-controller.js'
import { Router } from '@vaadin/router'
import { registerUser } from '../../features/lib/auth/auth-service.js'

@customElement('page-register')
export class PageRegister extends LitElement {
  constructor() {
    super()
    void new ThemeController(this)
  }

  @state() private username = ''
  @state() private email = ''
  @state() private password = ''
  @state() private confirmPassword = ''
  @state() private error = ''
  @state() private loading = false

  static styles = css`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: var(--color-bg);
    }
  `

  private async handleSubmit(e: Event) {
    e.preventDefault()
    this.error = ''
    this.loading = true
    try {
      await registerUser(this.username, this.email, this.password)
      Router.go('/login')
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Registration failed'
    } finally {
      this.loading = false
    }
  }

  render() {
    return html`placeholder`
  }
}
