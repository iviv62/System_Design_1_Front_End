export const DEFAULT_NEAR_BOTTOM_THRESHOLD_PX = 24;

export function getMessagesContainer(host: HTMLElement): HTMLElement | null {
  return host.shadowRoot?.querySelector(".chat-room__messages") as HTMLElement | null;
}

export function getUnreadBoundaryScrollTarget(host: HTMLElement): HTMLElement | null {
  return host.shadowRoot?.querySelector("[data-unread-anchor]") as HTMLElement | null;
}

export function isMessagesNearBottom(
  host: HTMLElement,
  threshold = DEFAULT_NEAR_BOTTOM_THRESHOLD_PX,
): boolean {
  const messagesEl = getMessagesContainer(host);
  if (!messagesEl) return true;

  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <= threshold;
}

export function scrollMessagesToBottom(
  messagesEl: HTMLElement,
  onComplete?: () => void,
): void {
  const applyBottomScroll = () => {
    messagesEl.scrollTop = Math.max(messagesEl.scrollHeight - messagesEl.clientHeight, 0);
  };

  applyBottomScroll();
  requestAnimationFrame(() => {
    applyBottomScroll();
    onComplete?.();
  });
}

export function scrollToUnreadBoundary(
  host: HTMLElement,
  behavior: ScrollBehavior = "instant",
): void {
  const messagesEl = getMessagesContainer(host);
  if (!messagesEl) return;

  const dividerEl = getUnreadBoundaryScrollTarget(host);
  if (!dividerEl) return;

  const targetTop = Math.max(dividerEl.offsetTop - messagesEl.offsetTop, 0);
  messagesEl.scrollTo({ top: targetTop, behavior });
}
