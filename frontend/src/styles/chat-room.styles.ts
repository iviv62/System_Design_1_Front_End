import { css } from "lit";

export const chatRoomStyles = css`
  .messages {
    border: 1px solid #ccc;
    padding: 0.5rem;
    height: 300px;
    overflow-y: auto;
    margin-bottom: 0.5rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 0.9rem;
    background: #f9fafb;
    white-space: pre-wrap;
    color: #111827;
  }

  .system {
    color: #6b7280;
  }

  form {
    display: flex;
    gap: 0.5rem;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    border: 1px solid #ccc;
    color: white;
  }

  button {
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: none;
    background: #10b981;
    color: white;
    cursor: pointer;
  }

  button:hover {
    background: #059669;
  }

  .reconnecting-banner {
    background: #fef3c7;
    color: #92400e;
    text-align: center;
    padding: 0.3rem 0.5rem;
    font-size: 0.85rem;
    border-radius: 4px;
    margin-bottom: 0.4rem;
  }

  .loading {
    color: #6b7280;
    text-align: center;
    padding: 2rem 0;
    font-size: 0.9rem;
  }

  .empty-state {
    color: #9ca3af;
    text-align: center;
    padding: 2rem 0;
    font-size: 0.9rem;
    font-style: italic;
  }
`;
