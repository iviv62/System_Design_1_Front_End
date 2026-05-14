export interface ChatMessage {
  id: string;
  room: string;
  username: string;
  text: string;
  image_url?: string;
  created_at: string; // ISO 8601 timestamp
  reactions?: MessageReactions;
}

export type MessageReactions = Record<string, string[]>;

/** Status of a message sent by the local user. */
export type MessageStatus = 'pending' | 'sent' | 'failed';

export type UiMessage = {
  id: string;
  /** clientId is set only for locally-sent optimistic messages before ack arrives. */
  clientId?: string;
  kind: "user" | "system";
  username: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
  reactions: MessageReactions;
  /** Delivery status — only present on messages sent by the local user. */
  status?: MessageStatus;
};
