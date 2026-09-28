# 🦥 Slothify - Full Stack Music Player

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)

Slothify is a modern, ad-free music player that combines Spotify library sync with YouTube Music playback. 

## 🏗️ Project Structure

This project follows a decoupled full-stack architecture:

- **`/client`** (Vite + React + TypeScript)
  - Source code resides in `src/`.
  - Styled with Tailwind CSS and Lucide React icons.

- **`/server`** (Node.js + Express + TypeScript)
  - Source code resides in `src/`.
  - Main entry point is `src/server.ts`.
  - Handles Spotify Authentication, Metadata Proxy, and YouTube Music extraction via `yt-search` and `yt-dlp`.

## ✨ Features

- **Spotify Login & Library Sync**: Seamlessly bring in your playlists and liked songs from Spotify.
- **Ad-free YouTube Music Playback**: High-quality audio playback leveraging YouTube's catalog via a custom API proxy.
- **Modern UI**: Clean and responsive interface powered by React and Tailwind CSS.
- **Secure HTTPS**: Local development leverages self-signed certificates for secure communication.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm or yarn

### 1. Install Dependencies

You'll need to install dependencies for both the frontend and backend separately.

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### 2. Run Development Servers

To start the application, you need to run both the frontend and backend servers.

**Terminal 1 (Client):**
```bash
cd client
npm run dev
```

**Terminal 2 (Server):**
```bash
cd server
npm run dev
```

## ⚙️ Environment Configuration

- Place a `.env` file in the root or respective directories for any shared environment variables (like Spotify Client IDs, Secrets, etc.).
- The **frontend** proxies API requests to the backend server.
- **Spotify Callback URI**: `https://localhost:5000/api/auth/callback`

## 🔒 HTTPS & Certificates

For features like Spotify Auth to work properly locally, HTTPS is required.

- Self-signed certificates are located in `server/certs`.
- **Important**: You must visit **BOTH** the frontend AND the backend in your browser and accept the security warning (Advanced -> Proceed to localhost) for the application to function correctly.

## 🤝 Contributing

This project is fully **Open Source** and we welcome contributions from anyone! Whether it's fixing a bug, adding a feature, or improving documentation, your help is appreciated.

To contribute:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<a href="https://github.com/PurveshShinde/Slothify/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=PurveshShinde/Slothify" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.
