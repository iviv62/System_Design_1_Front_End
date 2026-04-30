import { getApiBaseUrl } from "./chat-config";
import type { Room } from "../../../types/room";

function getBase(): string {
  return getApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_WS_BASE_URL
  );
}

export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch(`${getBase()}/rooms`);
  if (!res.ok) {
    throw new Error(`Failed to fetch rooms: ${res.statusText}`);
  }
  return res.json();
}

export async function createRoom(name: string): Promise<Room> {
  const res = await fetch(`${getBase()}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create room: ${res.statusText}`);
  }
  return res.json();
}