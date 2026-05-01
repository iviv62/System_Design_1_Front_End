export interface ConversationSummary {
  room: string;
  participants: string[];
  last_message_at?: string;
  last_message_text?: string;
  last_message_username?: string;
}
