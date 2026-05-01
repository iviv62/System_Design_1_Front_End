export function getUnreadBoundaryScrollTarget(host: HTMLElement): HTMLElement | null {
  return host.shadowRoot?.querySelector("[data-unread-anchor]") as HTMLElement | null;
}
