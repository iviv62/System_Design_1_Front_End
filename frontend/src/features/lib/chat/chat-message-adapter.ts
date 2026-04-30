import type { ChatMessage, UiMessage } from "../../../types/message";

export function toUiMessage(msg: ChatMessage): UiMessage {
  return {
    id: msg.id,
    kind: "user",
    username: msg.username,
    text: msg.text,
    createdAt: msg.created_at,
  };
}

export function toSystemMessage(text: string): UiMessage {
  return {
    id: `sys-${Date.now()}-${Math.random()}`,
    kind: "system",
    username: "",
    text,
    createdAt: new Date().toISOString(),
  };
}

function isChatMessage(payload: unknown): payload is ChatMessage {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as ChatMessage).id === "string" &&
    typeof (payload as ChatMessage).room === "string" &&
    typeof (payload as ChatMessage).username === "string" &&
    typeof (payload as ChatMessage).text === "string" &&
    typeof (payload as ChatMessage).created_at === "string"
  );
}

export function extractChatMessage(payload: unknown): ChatMessage | null {
  if (isChatMessage(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const wrapped = payload as {
    message?: unknown;
    data?: unknown;
    payload?: unknown;
  };

  if (isChatMessage(wrapped.message)) {
    return wrapped.message;
  }
  if (isChatMessage(wrapped.data)) {
    return wrapped.data;
  }
  if (isChatMessage(wrapped.payload)) {
    return wrapped.payload;
  }

  return null;
}

function isSystemEvent(payload: unknown): payload is { type: "system"; text: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { type?: unknown }).type === "system" &&
    typeof (payload as { text?: unknown }).text === "string"
  );
}

export function extractSystemText(payload: unknown): string | null {
  if (isSystemEvent(payload)) {
    return payload.text;
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const event = payload as {
    type?: unknown;
    event?: unknown;
    text?: unknown;
    reason?: unknown;
    code?: unknown;
    detail?: unknown;
    message?: unknown;
  };

  if (event.type !== "system") {
    return null;
  }

  if (typeof event.text === "string") {
    return event.text;
  }

  if (typeof event.message === "string") {
    return event.message;
  }

  const eventName = typeof event.event === "string" ? event.event : "event";
  const code = typeof event.code === "number" ? `, code=${event.code}` : "";
  const reason = typeof event.reason === "string" && event.reason
    ? `, reason=${event.reason}`
    : "";
  const detail = typeof event.detail === "string" && event.detail
    ? `, detail=${event.detail}`
    : "";

  return `${eventName}${code}${reason}${detail}`;
}
