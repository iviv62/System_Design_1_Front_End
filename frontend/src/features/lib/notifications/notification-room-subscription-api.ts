import { getBase } from "../http/api-base";
import { fetchWithAuth } from "../http/fetch-interceptor";
import { ApiError } from "../chat/chat-room-api";

type RoomSubscriptionInput = {
  username: string;
  roomId: string;
  token: string;
  provider?: "fcm";
};

export async function subscribeToRoomNotifications(
  input: RoomSubscriptionInput,
): Promise<void> {
  const res = await fetchWithAuth(`${getBase()}/notifications/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: input.username,
      room_id: input.roomId,
      token: input.token,
      provider: input.provider ?? "fcm",
    }),
  });

  if (!res.ok) {
    throw new ApiError(
      res.status,
      `Failed to subscribe to room notifications: ${res.statusText}`,
    );
  }
}

export async function unsubscribeFromRoomNotifications(
  input: RoomSubscriptionInput,
): Promise<void> {
  const res = await fetchWithAuth(`${getBase()}/notifications/subscriptions`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: input.username,
      room_id: input.roomId,
      token: input.token,
      provider: input.provider ?? "fcm",
    }),
  });

  if (!res.ok) {
    throw new ApiError(
      res.status,
      `Failed to unsubscribe from room notifications: ${res.statusText}`,
    );
  }
}
