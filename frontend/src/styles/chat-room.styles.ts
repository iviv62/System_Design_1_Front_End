import { css } from "lit";

export const chatRoomStyles = css`
  :host {
    display: block;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .chat-room {
    display: flex;
    flex-direction: column;
    background: #1f2937;
    border-radius: 12px;
    border: 1px solid #374151;
    overflow: hidden;
    height: 700px;
    max-height: 90vh;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
  }

  .chat-room__header {
    background: #111827;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #374151;
  }

  .chat-room__title {
    margin: 0 0 0.25rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #f3f4f6;
  }

  .chat-room__meta {
    margin: 0;
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .chat-room__banner {
    background: #fbbf24;
    color: #92400e;
    text-align: center;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-bottom: 1px solid #f59e0b;
  }

  .chat-room__messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: #1f2937;
  }

  /* Custom scrollbar for webkit */
  .chat-room__messages::-webkit-scrollbar {
    width: 8px;
  }
  .chat-room__messages::-webkit-scrollbar-track {
    background: transparent;
  }
  .chat-room__messages::-webkit-scrollbar-thumb {
    background-color: #4b5563;
    border-radius: 4px;
  }

  .chat-room__composer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: #111827;
    border-top: 1px solid #374151;
  }

  .chat-room__input {
    flex: 1;
    min-width: 0;
    height: 48px;
    padding: 0 1rem;
    border-radius: 8px;
    border: 1px solid #4b5563;
    background: #374151;
    color: #f3f4f6;
    font-size: 1rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .chat-room__input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
  }

  .chat-room__input::placeholder {
    color: #9ca3af;
  }

  .chat-room__send {
    height: 48px;
    padding: 0 1.5rem;
    border-radius: 8px;
    border: none;
    background: #3b82f6;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s, opacity 0.2s;
  }

  .chat-room__send:hover:not(:disabled) {
    background: #2563eb;
  }

  .chat-room__send:disabled {
    background: #4b5563;
    color: #9ca3af;
    cursor: not-allowed;
    opacity: 0.7;
  }

  /* Messages base and variants */
  .message {
    display: flex;
    flex-direction: column;
    max-width: 80%;
  }

  .message__author {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-bottom: 0.25rem;
    margin-left: 0.25rem;
    font-weight: 500;
  }

  .message__body {
    background: #374151;
    color: #f3f4f6;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    font-size: 0.9375rem;
    line-height: 1.4;
    word-break: break-word;
  }

  .message--user {
    align-self: flex-start;
  }
  
  .message--user.message--self {
    align-self: flex-end;
  }

  .message--user.message--self .message__author {
    display: none; /* Often hide author for own messages, or align right */
  }

  .message--user.message--self .message__body {
    background: #3b82f6; /* Distinct color for own messages */
    color: #ffffff;
    border-bottom-right-radius: 4px;
  }

  .message--user:not(.message--self) .message__body {
    border-bottom-left-radius: 4px;
    background: #4b5563; /* Make other user messages stand out from input */
  }

  .message--system {
    align-self: center;
    background: #374151;
    color: #9ca3af;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-style: italic;
    max-width: 90%;
    text-align: center;
    margin: 0.5rem 0;
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .chat-room {
      border-radius: 0;
      border-left: none;
      border-right: none;
      height: 100dvh;
      max-height: none;
    }

    .chat-room__header {
      padding: 0.75rem 1rem;
    }

    .chat-room__messages {
      padding: 1rem;
    }

    .chat-room__composer {
      padding: 0.75rem 1rem;
    }

    .chat-room__input {
      height: 44px;
    }

    .chat-room__send {
      height: 44px;
      padding: 0 1.25rem;
    }
  }
`;
