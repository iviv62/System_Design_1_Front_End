## 2024-05-15 - ARIA Labels in Lit Components
**Learning:** In Lit components, dynamic properties for attributes like `aria-label` and `title` can safely be unquoted (e.g., `aria-label=${this.isMuted ? "Unmute" : "Mute"}`). Lit safely handles the data binding without causing rendering or XSS issues.
**Action:** When adding accessibility attributes to dynamic UI elements, use Lit's template bindings to toggle descriptive states (like "Mute" vs. "Unmute") based on the component's internal properties, ensuring screen readers receive accurate real-time context.

## 2024-05-18 - Theming System (Light/Dark)
**Learning:** The project uses a global theming system by applying a `data-theme` attribute to the `body` tag (`body[data-theme="dark"]` and `body[data-theme="light"]`). Lit components encapsulate their styles in Shadow DOM, meaning global CSS variables defined on `:root` or `body` won't automatically propagate unless used correctly, and selectors inside shadow DOM can't natively target the body attribute directly without `:host-context`.

**Action:** When creating or modifying styles for components, ensure compatibility with both light and dark themes. Use `:host-context(body[data-theme="dark"])` to scope dark-theme specific overrides inside the component's SCSS. Always define default (light theme) CSS variables and colors on the `:host`, and override them within the `:host-context` block.
