type SocketUrlParams = {
  configuredWsBase?: string;
  room: string;
  username: string;
  lastSeen?: string | null;
  pageProtocol: string;
};

export function getApiBaseUrl(
  apiBase?: string,
  wsBase?: string,
): string {
  if (apiBase?.trim()) {
    return apiBase.trim().replace(/\/$/, "");
  }

  if (wsBase?.trim()) {
    return wsBase
      .trim()
      .replace(/\/$/, "")
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:");
  }

  const host = window.location.hostname || "localhost";
  return `http://${host}:8000`;
}

export function getSocketUrl({
  configuredWsBase,
  room,
  username,
  lastSeen,
  pageProtocol,
}: SocketUrlParams): string {
  const host = window.location.hostname || "localhost";
  const base =
    configuredWsBase?.trim().replace(/\/$/, "") ||
    `${pageProtocol === "https:" ? "wss:" : "ws:"}//${host}:8000`;

  const url = new URL(`${base}/ws/${encodeURIComponent(room)}`);
  url.searchParams.set("username", username);

  if (lastSeen) {
    url.searchParams.set("last_seen", lastSeen);
  }

  return url.toString();
}