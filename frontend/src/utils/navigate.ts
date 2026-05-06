/**
 * Programmatic SPA navigation. Pushes a new history entry and fires a
 * `popstate` event so @lit-labs/router re-evaluates the current route.
 */
export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Click-handler factory for anchor tags. Prevents full-page reload and
 * delegates to navigate().
 *
 * Usage in Lit templates:
 *   <a href="/chat" @click=${handleLink}>Chat</a>
 */
export function handleLink(e: Event) {
  e.preventDefault();
  const anchor = e.currentTarget as HTMLAnchorElement;
  navigate(new URL(anchor.href).pathname);
}
