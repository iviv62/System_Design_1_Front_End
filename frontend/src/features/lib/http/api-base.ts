import { getApiBaseUrl } from "../chat/chat-config";

/**
 * Resolves the backend API base URL from Vite environment variables.
 */
export function getBase(): string {
  return getApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_WS_BASE_URL,
  );
}
