export interface ChatMessage {
  id: string;
  room: string;
  username: string;
  text: string;
  image_url?: string;
  created_at: string; // ISO 8601 timestamp
}

export type UiMessage = {
  id: string;
  kind: "user" | "system";
  username: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
};
