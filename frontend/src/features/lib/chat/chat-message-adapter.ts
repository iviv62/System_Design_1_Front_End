import type { ChatMessage, UiMessage } from "../../../types/message";
import { getApiBaseUrl } from "./chat-config";

export type PresenceUpdate = {
  kind: "snapshot";
  room: string;
  users: string[];
  total: number;
};

export type ReactionUpdate = {
  kind: "updated";
  room: string;
  messageId: string;
  reactions: Record<string, string[]>;
};

function normalizeReactions(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const result: Record<string, string[]> = {};
  for (const [emoji, users] of Object.entries(value as Record<string, unknown>)) {
    if (!emoji) continue;
    if (!Array.isArray(users)) continue;

    const normalizedUsers = users
      .filter((user): user is string => typeof user === "string")
      .map((user) => user.trim())
      .filter(Boolean);

    if (normalizedUsers.length > 0) {
      result[emoji] = normalizedUsers;
    }
  }

  return result;
}

// ==========================================
// UI Converters
// ==========================================

export function toUiMessage(msg: ChatMessage): UiMessage {
  return {
    id: msg.id,
    kind: "user",
    username: msg.username,
    text: msg.text,
    imageUrl: resolveImageUrl(msg.image_url),
    createdAt: msg.created_at,
    reactions: normalizeReactions(msg.reactions),
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
    reactions: {},
  };
}

// ==========================================
// Extractors & Normalizers
// ==========================================

export function extractChatMessage(payload: any): ChatMessage | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  // 1. Unwrap the payload if the backend nested it inside a common key
  const data = payload.message || payload.data || payload.payload || payload;

  if (typeof data !== "object" || data === null) {
    return null;
  }

  // 2. Extract fields with fallbacks for different backend naming conventions
  const username = data.username || data.sender;
  const text = data.text || data.content || data.message || "";
  const createdAt = data.created_at || data.sent_at || data.timestamp;
  const imageUrl = data.image_url || data.imageUrl;
  const reactions = normalizeReactions(data.reactions);

  // 3. Ensure we have the minimum required fields
  if (!username || !createdAt || (!text && !imageUrl)) {
    return null;
  }

  const room = data.room || "";
  const id = data.id || `${room}:${username}:${createdAt}:${text || imageUrl}`;

  return {
    id: String(id),
    room: String(room),
    username: String(username),
    text: String(text),
    image_url: imageUrl ? String(imageUrl) : undefined,
    created_at: String(createdAt),
    reactions,
  };
}

export function extractSystemText(payload: any): string | null {
  if (typeof payload !== "object" || payload === null || payload.type !== "system") {
    return null;
  }

  // Return direct text or message if available
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.message === "string") return payload.message;

  // Fallback to building a string from the event details
  const eventName = payload.event || "event";
  const code = payload.code !== undefined ? `, code=${payload.code}` : "";
  const reason = payload.reason ? `, reason=${payload.reason}` : "";
  const detail = payload.detail ? `, detail=${payload.detail}` : "";

  return `${eventName}${code}${reason}${detail}`;
}

export function extractPresenceUpdate(payload: any): PresenceUpdate | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  if (payload.type !== "presence" || payload.event !== "snapshot") {
    return null;
  }

  // Safely extract users array
  const users = Array.isArray(payload.users)
    ? payload.users.filter((u: any) => typeof u === "string").map((u: string) => u.trim()).filter(Boolean)
    : [];

  return {
    kind: "snapshot",
    room: String(payload.room || ""),
    users,
    total: typeof payload.total === "number" ? payload.total : users.length,
  };
}

export function extractReactionUpdate(payload: any): ReactionUpdate | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  if (payload.type !== "reaction" || payload.event !== "updated") {
    return null;
  }

  if (typeof payload.message_id !== "string" || !payload.message_id.trim()) {
    return null;
  }

  return {
    kind: "updated",
    room: typeof payload.room === "string" ? payload.room : "",
    messageId: payload.message_id,
    reactions: normalizeReactions(payload.reactions),
  };
}