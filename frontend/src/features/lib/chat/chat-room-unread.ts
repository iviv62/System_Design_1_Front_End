import type { UiMessage } from "../../../types/message";

type UserAutoScrollArgs = {
  isOwnMessage: boolean;
  isLoadingHistory: boolean;
  isPageActive: boolean;
  isNearBottom: boolean;
  hasUnseenMessages: boolean;
};

type NonUserAutoScrollArgs = {
  isLoadingHistory: boolean;
  isPageActive: boolean;
  isNearBottom: boolean;
  hasUnseenMessages: boolean;
};

type FirstReplayAnchorArgs = {
  waitingForFirstReplayMessage: boolean;
  unreadAnchorMessageId: string | null;
  isOwnMessage: boolean;
};

export function getOtherUserMessages(
  messages: UiMessage[],
  username: string,
): UiMessage[] {
  return messages.filter((message) => {
    return message.kind === "user" && message.username !== username;
  });
}

export function getUnreadAnchorFromSnapshot(
  messages: UiMessage[],
  username: string,
  pendingUnreadCount: number,
): string | null {
  const otherUserMessages = getOtherUserMessages(messages, username);
  if (otherUserMessages.length === 0) {
    return null;
  }

  const anchorIndex = Math.max(otherUserMessages.length - pendingUnreadCount, 0);
  return otherUserMessages[anchorIndex]?.id ?? null;
}

export function shouldAnchorFirstReplayMessage({
  waitingForFirstReplayMessage,
  unreadAnchorMessageId,
  isOwnMessage,
}: FirstReplayAnchorArgs): boolean {
  return waitingForFirstReplayMessage && !unreadAnchorMessageId && !isOwnMessage;
}

export function shouldAutoScrollForUserMessage({
  isOwnMessage,
  isLoadingHistory,
  isPageActive,
  isNearBottom,
  hasUnseenMessages,
}: UserAutoScrollArgs): boolean {
  return (
    isOwnMessage ||
    isLoadingHistory ||
    (isPageActive && isNearBottom && !hasUnseenMessages)
  );
}

export function shouldAutoScrollForNonUserMessage({
  isLoadingHistory,
  isPageActive,
  isNearBottom,
  hasUnseenMessages,
}: NonUserAutoScrollArgs): boolean {
  return isPageActive && (isNearBottom || isLoadingHistory) && !hasUnseenMessages;
}

export function getUnreadCount(
  messages: UiMessage[],
  unreadAnchorMessageId: string | null,
  username: string,
): number {
  if (!unreadAnchorMessageId) {
    return 0;
  }

  const anchorIndex = messages.findIndex((message) => message.id === unreadAnchorMessageId);
  if (anchorIndex < 0) {
    return 0;
  }

  return messages
    .slice(anchorIndex)
    .filter((message) => message.kind === "user" && message.username !== username).length;
}
