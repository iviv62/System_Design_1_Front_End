import { getBase } from "../http/api-base";
import { fetchWithAuth } from "../http/fetch-interceptor";
import { ApiError } from "../chat/chat-room-api";

export type RegisterNotificationTokenInput = {
  username: string;
  token: string;
  provider?: "fcm";
  userAgent?: string;
};

export async function registerNotificationToken(
  input: RegisterNotificationTokenInput,
): Promise<void> {
  const res = await fetchWithAuth(`${getBase()}/notifications/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: input.username,
      token: input.token,
      provider: input.provider ?? "fcm",
      user_agent: input.userAgent,
    }),
  });

  if (!res.ok) {
    throw new ApiError(
      res.status,
      `Failed to register notification token: ${res.statusText}`,
    );
  }
}
