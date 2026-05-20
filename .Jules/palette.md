## 2024-05-15 - ARIA Labels in Lit Components
**Learning:** In Lit components, dynamic properties for attributes like `aria-label` and `title` can safely be unquoted (e.g., `aria-label=${this.isMuted ? "Unmute" : "Mute"}`). Lit safely handles the data binding without causing rendering or XSS issues.
**Action:** When adding accessibility attributes to dynamic UI elements, use Lit's template bindings to toggle descriptive states (like "Mute" vs. "Unmute") based on the component's internal properties, ensuring screen readers receive accurate real-time context.

## 2024-05-18 - Theming System (Light/Dark)
**Learning:** The project uses a global theming system by applying a `data-theme` attribute to the `body` tag (`body[data-theme="dark"]` and `body[data-theme="light"]`). Lit components encapsulate their styles in Shadow DOM, meaning global CSS variables defined on `:root` or `body` won't automatically propagate unless used correctly, and selectors inside shadow DOM can't natively target the body attribute directly without `:host-context`.

**Action:** When creating or modifying styles for components, ensure compatibility with both light and dark themes. Use `:host-context(body[data-theme="dark"])` to scope dark-theme specific overrides inside the component's SCSS. Always define default (light theme) CSS variables and colors on the `:host`, and override them within the `:host-context` block.
## 2024-05-16 - Contextual Tooltips for Disabled States
**Learning:** Found a pattern where disabled buttons lacked context for screen readers and sighted users. A static `title="Send"` on a disabled send button is confusing.
**Action:** When conditionally disabling action buttons, dynamically update both title and aria-label attributes to explain *why* the button is disabled (e.g., title=${isSubmitting ? "Sending..." : (canSubmit ? "Send" : "Cannot send empty message")}), rather than just showing it as unresponsive.

## 2024-05-16 - Standalone Input Accessibility
**Learning:** Several custom inputs (search bars, range sliders, compose textareas) across the app were missing `aria-label` attributes because they didn't have visual `<label>` elements, making them opaque to screen readers.
**Action:** Always add an explicit `aria-label` to any `<input>` or `<textarea>` that acts as a standalone control without an associated `<label>` element.

## 2024-05-20 - Contextual Labels for Repeated Actions
**Learning:** Found a pattern where multiple cards in lists (like trending rooms or my rooms) have identical buttons like "Join" or "Delete". A screen reader user navigating through interactive elements would just hear "Join button", "Join button", "Join button" without knowing *what* they are joining.
**Action:** When mapping over items to render action buttons, always interpolate the item specific name or context into the `aria-label` and `title` (e.g. `aria-label="Delete room ${room.name}"` instead of just "Delete").
