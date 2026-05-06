# Chat System Frontend

[![Chat System CI](https://github.com/iviv62/System_Design_1_Front_End/actions/workflows/chat-system-ci.yml/badge.svg)](https://github.com/iviv62/System_Design_1_Front_End/actions/workflows/chat-system-ci.yml)

This is the frontend (the part users see in the browser) for a real-time chat app.

It lets people sign in, join chat rooms, send messages, upload images, and react to messages with emojis.
The app talks to a backend service:

- WebSocket: for instant live updates (new messages, reactions, online users).
- HTTP API: for loading data and performing actions (rooms, history, uploads, notifications).

## What This Project Does

In simple terms, this project solves the main chat app problems:

- Keep the screen updated in real time when something happens.
- Load past data (rooms, older messages) when needed.
- Organize code into clear components so it is easier to maintain.
- Run automatic checks in CI before changes are merged.

## User Journey (How A Person Uses It)

1. Open the app and log in.
2. See available chat rooms in the lobby.
3. Enter a room and read recent messages.
4. Write and send a message.
5. Optionally attach an image.
6. React to messages with emojis.
7. See who is currently active in the room.

Everything above updates live without refreshing the page.

## Current Features

- Authentication pages and auth state management.
- Room lobby and room creation.
- Real-time room chat.
- Message history loading.
- Unread marker and unread count.
- Image upload in chat.
- Message reactions:
  - Emoji picker per message.
  - Save/remove reaction through API.
  - Live reaction updates for everyone in the room.
- Presence updates (who is online in a room).
- Theme toggle (light and dark modes).
- Firebase web push integration.

## UI Terms (Quick Glossary)

- Chat room: A conversation space (for example, `general` or `random`).
- Lobby: The page where users browse and choose rooms.
- Message list: The scrolling area that shows chat messages.
- Chat composer: The message input area at the bottom where you type text, add emoji, attach an image, and press send.
- Reactions: Emoji responses attached to a message (for example, 👍, ❤️).
- Presence: Information about which users are currently connected.

## Tech Stack

- TypeScript
- Lit Web Components
- Vite
- ESLint + Prettier
- GitHub Actions for CI

## Repository Structure

- frontend: application source, build config, and tooling.
- .github/workflows: CI pipeline definitions.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
cd frontend
npm install
```

### Run in Development

```bash
npm run dev
```

Then open the local URL shown in terminal (usually `http://localhost:5173`).

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Format Source

```bash
npm run format
```

## Environment Variables

Create frontend/.env from frontend/.env.example and fill values for backend URLs and Firebase settings.

Examples:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

## CI

GitHub Actions workflow: Chat System CI

- Triggered on pushes to main.
- Triggered on pull requests targeting main.
- Runs in frontend directory:
  - npm ci
  - npm run lint
  - npx tsc --noEmit

Workflow file: .github/workflows/chat-system-ci.yml

## Notes on Formatting and Line Endings

This repository is configured to use LF line endings for consistency:

- Root .gitattributes normalizes text files to LF.
- frontend/.prettierrc.cjs enforces endOfLine: "lf".