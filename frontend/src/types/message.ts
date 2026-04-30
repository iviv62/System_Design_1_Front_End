export interface ChatMessage {
  id: string;
  room: string;
  username: string;
  text: string;
  created_at: string; // ISO 8601 timestamp
}
