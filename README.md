# Nyx - Full Stack Music Player

## Structure
This project has been refactored into a full-stack structure:

- **/frontend** (Vite + React + TypeScript)
  - Source: `src/`
  - Runs on: `http://localhost:3000`
  - Tailwind CSS configured.

- **/backend** (Node + Express + TypeScript)
  - Source: `src/server.ts`, `src/routes/`, `src/services/`
  - Runs on: `http://localhost:5000`
  - Handles Spotify Auth & Metadata Proxy.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    cd frontend && npm install
    cd ../backend && npm install
    ```

2.  **Run Development Servers**:
    - Terminal 1:
      ```bash
      cd frontend
      npm run dev
      ```
    - Terminal 2:
      ```bash
      cd backend
      npm run dev
      ```

## Environment
- `.env` file in root contains shared env vars (if any) or secrets.
- **Frontend** runs on `https://localhost:3000` and proxies `/api` and `/auth` requests to `https://localhost:5000`.
- **Spotify Callback**: `https://localhost:5000/api/auth/callback`

## HTTPS & Certificates
- Self-signed certificates generated in `backend/certs`.
- **Important**: You must visit **BOTH** `https://localhost:3000` AND `https://localhost:5000` in your browser and accept the warning (Advanced -> Proceed to localhost) for the app to work.

## Features
- Spotify Login & Library Sync
- YouTube Music Playback (Ad-free) via `/api/youtube`
- Modern UI with Tailwind CSS
