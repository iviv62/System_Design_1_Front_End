import { getBase } from "../http/api-base";
import { fetchWithAuth } from "../http/fetch-interceptor";
import type { Room } from "../../../types/room";
import type { ConversationSummary } from "../../../types/conversation-summary";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type CreateRoomInput = {
  name: string;
  id?: string;
  created_by?: string;
  status?: string;
  max_participants?: number;
};

export type ConnectedUsersSnapshot = {
  room: string;
  users: string[];
  total: number;
};

export async function fetchRooms(): Promise<Room[]> {
  const res = await fetchWithAuth(`${getBase()}/rooms`);
  if (!res.ok) {
    throw new ApiError(res.status, `Failed to fetch rooms: ${res.statusText}`);
  }
  return res.json();
}

export async function createRoom(input: string | CreateRoomInput): Promise<Room> {
  const payload = typeof input === "string" ? { name: input } : input;

  const res = await fetchWithAuth(`${getBase()}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `Failed to create room: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteRoom(roomId: string, username: string): Promise<void> {
  const url = new URL(`${getBase()}/rooms/${encodeURIComponent(roomId)}`);
  url.searchParams.set("username", username);

  const res = await fetchWithAuth(url.toString(), { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, `Failed to delete room: ${res.statusText}`);
  }
}

export async function fetchConversationSummary(
  room: string,
): Promise<ConversationSummary> {
  const res = await fetchWithAuth(
    `${getBase()}/conversations/${encodeURIComponent(room)}`,
  );
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `Failed to fetch conversation summary: ${res.statusText}`,
    );
  }
  return res.json();
}

export async function fetchConnectedUsers(room: string): Promise<ConnectedUsersSnapshot> {
  const res = await fetchWithAuth(
    `${getBase()}/rooms/${encodeURIComponent(room)}/connected-users`,
  );
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `Failed to fetch connected users: ${res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    room?: unknown;
    users?: unknown;
    total?: unknown;
  };

  const users = Array.isArray(data.users)
    ? data.users.filter((u): u is string => typeof u === "string")
    : [];

  return {
    room: typeof data.room === "string" ? data.room : room,
    users,
    total: typeof data.total === "number" ? data.total : users.length,
  };
}

export async function updateConversationLastSeen(
  room: string,
  username: string,
  lastSeen: string,
): Promise<void> {
  const res = await fetchWithAuth(
    `${getBase()}/conversations/${encodeURIComponent(room)}/last-seen`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        last_seen: lastSeen,
      }),
    },
  );

  if (!res.ok) {
    throw new ApiError(res.status, `Failed to update last seen: ${res.statusText}`);
  }
}

export async function fetchUnreadCount(
  room: string,
  username: string,
): Promise<number> {
  const url = new URL(
    `${getBase()}/conversations/${encodeURIComponent(room)}/unread-count`,
  );
  url.searchParams.set("username", username);

  const res = await fetchWithAuth(url.toString());
  if (!res.ok) {
    throw new ApiError(res.status, `Failed to fetch unread count: ${res.statusText}`);
  }

  const data = (await res.json()) as { unread_count?: number; count?: number };
  return data.unread_count ?? data.count ?? 0;
}