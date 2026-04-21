# Frontend – Real‑Time Chat (Lit + WebSockets)

## Overview

This frontend is the browser client for a **real‑time chat application** with planned **offline message history** and **notifications** driven by pub/sub. It is built with **Lit Web Components** and connects to a FastAPI backend via **WebSockets** (for live chat) and **HTTP** (for history and, later, notifications).

The goal is to learn frontend aspects of **system design**: how the UI talks to backend components, how data flows through WebSockets and HTTP, and how to keep the UI modular and composable.

## High‑Level Goals (Frontend Perspective)

- Provide a **chat UI** that can:
  - Join a room with a username.
  - Send and receive messages in real time over WebSockets.
- Later:
  - Fetch **message history** from the backend once persistence is added.
  - Display **offline messages** that were missed while disconnected.
  - Show **notifications** (e.g., “new message in another room”) triggered by the backend’s notification service.

The frontend is intentionally developed in stages to match the backend stages.

## Architecture (Frontend Side)

Main Lit components (planned):

- **`<chat-app>`**
  - Top‑level component that manages:
    - Username input.
    - Room selection.
    - Routing between “join” and “chat” views.
  - Passes `username` and `room` down to `<chat-room>`.

- **`<chat-room>`**
  - Manages the **WebSocket connection** to the backend:
    - `ws://<backend-host>:8000/ws/{room}?username=<username>`
  - Holds the in‑memory `messages` state.
  - Renders `<message-list>` and `<message-input>`.
  - Listens for:
    - Incoming messages from the server (WebSocket `message` event).
    - User input events from `<message-input>`.

- **`<message-list>`**
  - Pure presentational component.
  - Receives a `messages` array as a property.
  - Renders messages with sender, time, and content.

- **`<message-input>`**
  - Input field + send button.
  - Emits a custom event (e.g. `message-submit`) when the user sends a message.

Later, the frontend will also:

- Call HTTP endpoints to fetch **room message history** and **offline messages**.
- Listen to “notification” WebSocket messages (different `type` field) to show in‑app notifications.

## Staged Development Plan (Frontend)

### Stage 1: Minimal WebSocket Chat

- Implement:
  - `<chat-app>` with a simple form for username + room and a `<chat-room>` view.
  - `<chat-room>` that:
    - Opens a WebSocket connection on `connectedCallback` / `firstUpdated`.
    - Handles `open`, `message`, `close` events.
    - Keeps an array of messages in a reactive property.
    - Renders a basic list and input.
- Message format in Stage 1 (simple):
  - Send: plain text strings to the backend.
  - Receive: plain text strings (formatted by backend as `"username@room: message"`).

**Focus:** WebSocket lifecycle and Lit state updates (how messages flow from socket → component state → DOM).

### Stage 2: History & Offline Messages

- Add HTTP calls from the frontend to:
  - Fetch **recent messages** for the current room when entering it.
  - Fetch messages **after a “last seen” cursor** to load missed messages.
- Evolve message format to **JSON**:
  - Example structure:
    ```json
    {
      "type": "chat",
      "room": "general",
      "sender": "alice",
      "content": "Hello",
      "sent_at": "2026-04-21T16:00:00Z"
    }
    ```
- Update `<message-list>` to render richer message metadata.

**Focus:** Combining HTTP (history) + WebSocket (live) in one UI and handling offline/online transitions.

### Stage 3: Notifications UI

- Add support for **notification messages** over WebSocket:
  - The backend’s notification service sends events like:
    ```json
    {
      "type": "notification",
      "room": "random",
      "message": "New message in #random",
      "unread_count": 3
    }
    ```
- `<chat-app>` or a dedicated `<notification-center>` component:
  - Subscribes to these events.
  - Shows badges/toasts (e.g., unread indicators in a room list).
- Optionally add:
  - “Mark as read” interactions.
  - UI to reflect user notification preferences.

**Focus:** Representing backend notification logic in the UI and handling multiple event types cleanly.

## Tech Stack (Frontend)

- **Language:** TypeScript (or JavaScript, if preferred initially).
- **UI Library:** [Lit](https://lit.dev/) – Web Components with reactive properties and templating.
- **Transport:**
  - WebSockets for real‑time messages.
  - HTTP (fetch or similar) for history and other REST endpoints.
- **Build tooling:** Vite / esbuild / simple bundler (to be chosen); development server for hot reload.

## How to Run the Frontend

> Exact commands depend on the chosen toolchain (e.g. Vite + npm). Example below assumes a Vite + Lit setup in a `frontend/` folder.

### Prerequisites

- Node.js (LTS) and npm (or pnpm/yarn).

### Install dependencies

From `frontend/`:

```bash
npm install
# or
pnpm install
# or
yarn
```

### Run in development mode

From `frontend/`:

```bash
npm run dev
```

The dev server (e.g. Vite) will show a URL, typically `http://localhost:5173`. The frontend should be configured to connect to the backend at:

- `ws://localhost:8000/ws/{room}?username={username}`
- `http://localhost:8000/...` for REST endpoints (when Stage 2+ is ready)

### Build for production

From `frontend/`:

```bash
npm run build
```

This produces a static bundle you can serve via any HTTP server or integrate into the backend later.

## Why This Frontend Design

- Mirrors system‑design ideas: separate concerns (connection management, UI presentation, notifications).
- Makes it easy to reason about:
  - How a WebSocket connection affects UI state.
  - How HTTP and WebSockets interact.
  - How to extend the UI when the backend grows (persistence, notifications, multiple rooms).

---

If you describe how your `frontend/` is currently structured (Vite? plain `index.html`+Rollup? something else), a next step can be to add a “Quick Start (this repo)” section with the exact `npm` commands you’ll actually use.