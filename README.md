# 🦥 Slothify — Ultra High-Fidelity Music Streaming Platform

<div align="center">

![Version](https://img.shields.io/badge/Version-1.0.1-007ACC.svg?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite_5-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Audio Quality](https://img.shields.io/badge/Audio-320kbps_CD_Quality-blueviolet?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active_Development-brightgreen?style=for-the-badge)

<p align="center">
  <b>A modern, ad-free, high-fidelity music streaming application with modular audio engine routing, hybrid metadata search, zero-knowledge privacy, and dynamic visual theming.</b>
</p>

[Key Features](#-key-features) • [How It Works](#-how-it-works) • [Audio Engines](#-audio-engines) • [Search Engine](#-intelligent-hybrid-search) • [Android Roadmap](#-android-app-roadmap) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Architecture](#-modular-architecture)

</div>

---

## 📖 Overview

**Slothify** is an open-source, full-stack music streaming platform designed to break free from paywalled listening and intrusive ads. Unlike traditional wrappers that bottleneck your server with heavy audio transcoding, Slothify utilizes a **Decentralized Direct-Stream CDN Architecture**:

1. **JioSaavn 320kbps Master Engine**: Decrypts media links client/server-side using DES-ECB (`node-forge`) and streams crystal-clear 320kbps MP4/AAC directly from Akamai high-speed CDNs (`aac.saavncdn.com`) with **0 server bandwidth and 0 RAM transcode cost**.
2. **Piped (YouTube) Engine**: Direct GoogleVideo stream extraction using public high-availability Piped instances for expansive global coverage, live versions, and indie music.
3. **Smart Auto Fallback**: Tries JioSaavn 320kbps master quality first, seamlessly falling back to Piped without playback interruption.
4. **Intelligent Hybrid Search**: Parallel queries across JioSaavn + iTunes open metadata with natural language parsing (`"song by artist"`) and direct JioSaavn album/track URL resolution.
5. **Zero-Knowledge Encrypted Vault**: Your playlists, liked songs, and listening history are client-key encrypted (AES-256-GCM) before cloud storage.

---

## ⚡ How It Works

```mermaid
flowchart TD
    User([User in Slothify Client]) -->|1. Search Query / Album URL| SearchAPI[/api/search]
    SearchAPI -->|Parallel Query| SaavnMeta[JioSaavn Metadata API]
    SearchAPI -->|Parallel Query| iTunesMeta[iTunes Catalog API]
    SaavnMeta & iTunesMeta -->|Clean, Ranked & Deduplicated| TrackList[Clean Track List]
    TrackList --> User

    User -->|2. Selects Song to Play| Player[Audio Engine Dispatcher]
    
    Player -->|Mode: Smart Auto / JioSaavn| SaavnEngine[JioSaavn Audio Plugin]
    Player -->|Mode: Piped YouTube| PipedEngine[Piped YouTube Plugin]
    
    SaavnEngine -->|DES-ECB Decryption| SaavnCDN[Direct Akamai CDN: aac.saavncdn.com]
    SaavnCDN -->|320kbps Direct AAC Stream| HTML5Audio[HTML5 Audio Player]

    SaavnEngine -.->|If Unavailable / Fallback| PipedEngine
    PipedEngine -->|Direct googlevideo Stream| HTML5Audio
    
    HTML5Audio -->|Direct Browser Audio Playback| Listener([Pristine Sound Output])
```

---

## ✨ Key Features

- **🎧 Pristine 320kbps Audio Streaming**: Direct MP4/AAC streams delivered from global edge CDNs for studio-grade acoustic clarity.
- **🔄 Dual Engine + Smart Auto Fallback**: Switch effortlessly between **JioSaavn (320k)**, **Piped (YouTube)**, or **Smart Auto** directly in Settings.
- **🔎 Intelligent Hybrid Search**:
  - Automatically identifies natural phrases like `eyes dont lie by isabel larosa`.
  - Prioritizes original releases at `#1` instead of amateur covers.
  - Paste full JioSaavn URLs (e.g. `https://www.jiosaavn.com/album/eyes-dont-lie/...`) to instantly explore and play entire albums.
- **🎨 Dynamic Themes & Atmosphere**:
  - **Ocean Theme**: Deep oceanic navy, translucent glassmorphic components, and vibrant cyan neon accents.
  - **Autumn Theme**: Warm dark cedar backdrops, glowing amber accents, and peach `#f5d0b5` highlights.
- **📻 Vintage Turntable Mode**: Interactive vinyl turntable player with rotational physics, dynamic record sleeves, and animated tonearm controls.
- **🛡️ Zero-Knowledge Encrypted Cloud**:
  - Playlists and liked tracks are encrypted client-side using **AES-256-GCM** before syncing to MongoDB.
  - Full guest listening capability with zero mandatory sign-ins.
- **⚡ Non-Blocking Debounced Typing**:
  - Smooth 60fps search typing with automatic request cancellation (`AbortController`).
  - Safe URL synchronization that never floods browser history pages.
- **📱 Responsive PWA-Ready Design**: Tailored layouts for desktop, tablet, and mobile with bottom navigation bar and mini-player controls.

---

## 🎵 Audio Engines

| Engine | Bitrate / Quality | Delivery Mechanism | Best For |
| :--- | :--- | :--- | :--- |
| **JioSaavn** | **320kbps CD Quality** | Direct Akamai CDN (`aac.saavncdn.com`) via DES-ECB cipher | Studio albums, original master recordings, crisp acoustics |
| **Piped** | **160kbps WebM / Opus** | Direct GoogleVideo extraction via Piped API instances | Global catalog, indie tracks, acoustic live sessions, unreleased covers |
| **Smart Auto** | **Dynamic 320k ➔ 160k** | Intelligent automated priority resolution | Effortless listening with zero downtime |

---

## 🔎 Intelligent Hybrid Search

Slothify solves the age-old problem of search results showing obscure garage covers instead of the real song:

1. **JioSaavn High-Relevance Catalog**: Queries JioSaavn's Solr engine to surface the verified artist release at `#1`.
2. **iTunes Global Storefront**: Enriches results with Apple Music metadata and 600x600 high-res album artwork.
3. **Query Sanitization**: Strips disruptive characters (`"`, `'`, `&`) and natural phrasing (`by`, `audio`, `remastered`) before query execution.
4. **Direct URL Parsing**: Paste any JioSaavn track or album URL into the search bar for instant extraction.

---

## 🛠️ Tech Stack

### Frontend (`/client`)
- **Core**: React 18, Vite 5, TypeScript
- **Styling**: Tailwind CSS, Vanilla CSS animations, Glassmorphism
- **Routing**: React Router 6 (with debounced history handling)
- **Icons**: Lucide React
- **Audio Interface**: Custom HTML5 Web Audio Player with proactive next-track prefetching

### Backend (`/server`)
- **Core**: Node.js, Express.js (ES Modules), TypeScript
- **Cryptography**: `node-forge` (DES-ECB decryption for JioSaavn CDN audio URLs), `crypto` (AES-256-GCM for user playlists)
- **Metadata Sources**: JioSaavn API, Apple iTunes Search API, Deezer Open API
- **Audio Fallback**: Piped API, `yt-search`, optional `yt-dlp` binary
- **Database**: MongoDB with Mongoose (stores zero-knowledge encrypted payloads)

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas free tier)

### 1. Clone Repository
```bash
git clone https://github.com/PurveshShinde/Slothify.git
cd Slothify
```

### 2. Configure Environment

**Server (`server/.env`):**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/slothify
JWT_SECRET=your_super_secret_jwt_key_here
CLIENT_URL=http://localhost:3000

# Optional custom JioSaavn API wrapper (defaults to internal DES-ECB engine if omitted)
# JIOSAAVN_API_URL=https://your-jiosaavn-api.vercel.app

# Optional Cobalt API URL (if self-hosting Cobalt)
# COBALT_API_URL=https://api.cobalt.tools
```

**Client (`client/.env`):**
```env
# Leave blank for local proxying, or specify your hosted server URL
VITE_API_URL=http://localhost:5000
```

### 3. Install & Run Locally

**Run Server:**
```bash
cd server
npm install
npm run dev
```

**Run Client (in a separate terminal):**
```bash
cd client
npm install
npm run dev
```

Open your browser at **`http://localhost:3000`** to start listening!

---

## 📦 Modular Architecture

```
Slothify/
├── client/                     # Vite + React Frontend
│   ├── src/
│   │   ├── components/         # Player, Sidebar, Turntable, BrandLogo, BottomNav
│   │   ├── context/            # ThemeContext (Ocean/Autumn), CacheContext
│   │   ├── pages/              # Home, Search, Library, Playlists, Settings
│   │   └── types/              # TypeScript interface definitions
│   └── vite.config.ts
│
└── server/                     # Express + TypeScript Backend
    ├── src/
    │   ├── plugins/
    │   │   ├── audio/          # JioSaavnAudioPlugin.ts, YouTubeAudioPlugin.ts
    │   │   ├── metadata/       # SpotifyScraperPlugin.ts
    │   │   └── registry.ts     # Audio & Metadata Plugin Registry
    │   ├── routes/
    │   │   ├── api.ts          # Core search & catalog endpoints
    │   │   ├── audio.ts        # Smart Unified Audio Resolver (/api/audio/resolve)
    │   │   ├── saavn.ts        # JioSaavn stream & search routing
    │   │   ├── youtube.ts      # Piped YouTube stream & search routing
    │   │   └── auth.ts         # Zero-Knowledge user authentication
    │   └── server.ts           # Express server entry point
    └── tsconfig.json
```

---

## 📱 Android App Roadmap

We have active plans to bring **Slothify to Android** as a high-performance native / cross-platform mobile application!

### Planned Capabilities
- **🎧 Native Background Audio Service**: True lock screen playback controls, notification shade scrubber, Bluetooth headset events, and Android MediaSession integration.
- **⚡ Direct 320kbps CDN Streaming**: Ultra-fast, zero-transcode high-fidelity audio playback over 4G/5G and Wi-Fi networks.
- **📥 Encrypted Offline Mode**: Download tracks and complete playlists locally with AES encryption for offline listening.
- **🚗 Android Auto Support**: Seamless in-car dashboard streaming, voice search, and driver-friendly large interface controls.
- **🔐 Zero-Knowledge Cloud Sync**: Bidirectional encrypted synchronization with your existing desktop Slothify library, liked songs, and custom playlists.
- **🎨 Dynamic AMOLED Dark Theming**: Pure pitch-black OLED themes with dynamic Material You accent palettes.

---

## ☕ Support the Developer

If you love discovering and streaming music with Slothify, consider supporting its open-source development!

<a href="https://buymeacoffee.com/purvesh.dev" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180">
</a>

---

## 🤝 Contributing

Contributions are warmly welcomed! Feel free to report issues, suggest features, or submit pull requests.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more details.
