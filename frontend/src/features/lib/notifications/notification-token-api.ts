import { getApiBaseUrl } from "../chat/chat-config";
import { ApiError } from "../chat/chat-room-api";

export type RegisterNotificationTokenInput = {
  username: string;
  token: string;
  provider?: "fcm";
  userAgent?: string;
};

function getBase(): string {
  return getApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_WS_BASE_URL,
  );
}

export async function registerNotificationToken(
  input: RegisterNotificationTokenInput,
): Promise<void> {
  const res = await fetch(`${getBase()}/notifications/tokens`, {
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
