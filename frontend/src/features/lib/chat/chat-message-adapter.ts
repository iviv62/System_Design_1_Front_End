import type { ChatMessage, UiMessage } from "../../../types/message";
import { getApiBaseUrl } from "./chat-config";

export type PresenceUpdate =
  | { kind: "snapshot"; room: string; users: string[]; total: number };

export function toUiMessage(msg: ChatMessage): UiMessage {
  return {
    id: msg.id,
    kind: "user",
    username: msg.username,
    text: msg.text,
    imageUrl: resolveImageUrl(msg.image_url),
    createdAt: msg.created_at,
  };
}

function resolveImageUrl(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    return new URL(url).toString();
  } catch {
    const apiBase = getApiBaseUrl(import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_WS_BASE_URL);
    return new URL(url, `${apiBase}/`).toString();
  }
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
  const candidate = payload as ChatMessage;
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof candidate.id === "string" &&
    typeof candidate.room === "string" &&
    typeof candidate.username === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.created_at === "string" &&
    (typeof candidate.image_url === "undefined" || typeof candidate.image_url === "string")
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

export function extractPresenceUpdate(payload: unknown): PresenceUpdate | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const event = payload as {
    type?: unknown;
    event?: unknown;
    room?: unknown;
    users?: unknown;
    total?: unknown;
  };

  if (event.type !== "presence" || event.event !== "snapshot") {
    return null;
  }

  const users = Array.isArray(event.users)
    ? event.users.filter((v): v is string => typeof v === "string").map((u) => u.trim()).filter(Boolean)
    : [];

  const room = typeof event.room === "string" ? event.room : "";
  const total = typeof event.total === "number" ? event.total : users.length;

  return { kind: "snapshot", room, users, total };
}
