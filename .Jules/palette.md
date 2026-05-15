## 2024-05-15 - ARIA Labels in Lit Components
**Learning:** In Lit components, dynamic properties for attributes like `aria-label` and `title` can safely be unquoted (e.g., `aria-label=${this.isMuted ? "Unmute" : "Mute"}`). Lit safely handles the data binding without causing rendering or XSS issues.
**Action:** When adding accessibility attributes to dynamic UI elements, use Lit's template bindings to toggle descriptive states (like "Mute" vs. "Unmute") based on the component's internal properties, ensuring screen readers receive accurate real-time context.
