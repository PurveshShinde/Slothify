<div align="center">

<img src="./client/public/favicon_sloth.png" alt="Neko Music / Slothify Mascot" width="128" />

# Neko Music (Slothify)

### *High-Fidelity, Ad-Free Music Streaming Platform & Edge Audio Services*

[![Version](https://img.shields.io/badge/Version-1.1.0-007ACC.svg?style=for-the-badge)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![React 18](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)

<p align="center">
  <b>A modern, ad-free music streaming platform combining multi-engine audio routing, real-time Spotify Web Player discovery, zero-knowledge library encryption, aesthetic themes, and an edge-accelerated audio microservice.</b>
</p>

[Documentation](#documentation-index) • [Key Features](#key-features) • [Audio Engines](#audio-engines) • [Android Roadmap](#android-roadmap) • [Quick Start](#quick-start) • [Legal Disclaimer](#legal-disclaimer) • [Credits](#open-source-credits) • [License](#license)

</div>

---

## Documentation Index

This repository uses a structured, modular documentation architecture. Please refer to the dedicated guides below for technical specifications, developer onboarding, security, and contribution protocols:

| Document | Focus & Contents |
|:---|:---|
| **[`ARCHITECTURE.md`](ARCHITECTURE.md)** | System overview, frontend component structure, route map, database schemas, audio plugin system, and Cloudflare Worker microservice design. |
| **[`SETUP.md`](SETUP.md)** | Step-by-step developer onboarding, environment variable reference, build commands, Docker instructions, and production cloud deployment. |
| **[`SECURITY.md`](SECURITY.md)** | Vulnerability disclosure policy (48h SLA), zero-knowledge AES-256-GCM encryption architecture, 12-word passkey recovery, and privacy policy. |
| **[`CONTRIBUTING.md`](CONTRIBUTING.md)** | Pull request submission guidelines, branch naming conventions, issue reporting checklists, code standards, and licensing rules. |
| **[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)** | Contributor Covenant (v2.1) community behavioral standards, pledge, and moderation enforcement guidelines. |
| **[`AGENTS.md`](AGENTS.md)** | Directives, architectural invariants, troubleshooting matrices, and task recipes for AI coding assistants (Gemini, Claude, GPT, Cursor, etc.). |
| **[`LICENSE`](LICENSE)** | Full text of the MIT License with copyright attribution to **Purvesh Shinde**. |

---

## Key Features

- **Multi-Source Audio Routing**: Resolves high-fidelity media streams via JioSaavn (up to 320 kbps AAC) or YouTube (M4A container with AAC audio) with automated fallback priority for uninterrupted playback.
- **Real-Time Catalog Discovery**: Instant search across global songs, albums, and artist discographies powered by Spotify Web Player Pathfinder GraphQL (authenticated via Spotube TOTP), JioSaavn, and Apple Music RSS.
- **Aesthetic Human-Crafted Interface**:
  - **Dual Visual Themes**: Seamless switching between **Ocean Breeze** (deep cyan/navy) and **Autumn Ember** (warm amber/espresso) backed by persistent dual-layer GPU wallpaper cross-fading.
  - **Unified Media Player**: Single responsive player engine featuring Framer Motion Shared Element Transitions (`layoutId`), mobile swipe-down collapse gestures, and byte-range seeking.
  - **Vintage Vinyl Mode**: Interactive skeuomorphic turntable with authentic groove reflections, static circular radial depth shadows, and an animated audio visualizer waveform.
- **Zero-Knowledge Encrypted Privacy**: User playlists and liked songs are encrypted with AES-256-GCM before cloud persistence in MongoDB. The backend cannot decrypt user data without the user's password-derived key.
- **Zero-Friction Account Registration**: Sign up with just a **username and password** — no email, Google account, or OAuth required. Account recovery is handled via a client-generated **12-word recovery passphrase**.
- **Personalized Recommendations**: Track plays are recorded to an indexed listening history (capped at 100 entries). The recommendation engine cross-references your top played artists to deliver a dynamic, personalized feed.
- **Edge Audio Extension**: Includes the companion **Saavn Audio Services** microservice (`saavn-extension-main/slothify-audio-services`) compiled for Cloudflare Workers for sub-50ms DES-ECB media URL decryption.

---

## Audio Engines

| Engine | Source Mechanism | Coverage & Quality |
|:---|:---|:---|
| **JioSaavn** | Direct media stream resolution via companion Cloudflare Worker microservice ([`slothify-audio-services`](../saavn-extension-main/slothify-audio-services)) | Studio masters, regional albums, and Bollywood catalogs (up to **320 kbps AAC**) |
| **YouTube** | Progressive stream extraction via bundled `yt-dlp` and Piped instances | Global catalog, live concerts, indie tracks, and remixes (M4A container / `itag 140`) |
| **Smart Fallback** | Deterministic, request-scoped fallback routing | Automatic zero-downtime failover between providers |

---

## Android Roadmap

The native Android mobile application for **Neko Music** is currently under active development.

Planned capabilities for the native application include:
- Background audio service and lock screen playback controls
- Encrypted local storage for offline playback
- Android Auto integration
- Bidirectional library and playlist cloud synchronization
- Dynamic dark theme with AMOLED support

Source code, development milestones, and release tracking are available at the dedicated repository:  
**[https://github.com/PurveshShinde/Neko-Music](https://github.com/PurveshShinde/Neko-Music)**

---

## Quick Start

### 1. Prerequisites
- **Node.js** `>= 20.10.0` (Recommended: `v24+`) and **npm** `>= 10.0.0`
- **Bun** `>= 1.0.29` (for Saavn Audio Services)
- **MongoDB** (Local instance or MongoDB Atlas cluster)

### 2. Install & Start Slothify
```bash
# Clone the repository
git clone https://github.com/PurveshShinde/Slothify.git
cd Slothify

# Install dependencies
npm install --prefix server
npm install --prefix client

# Start Backend (Terminal 1 - http://localhost:5000)
npm run dev --prefix server

# Start Frontend (Terminal 2 - http://localhost:5173)
npm run dev --prefix client
```

### 3. Run Test Suite
```bash
npm test
```
*Executes all unit tests using the Node.js native test runner and tsx.*

For full environment variable configuration and deployment options, see [`SETUP.md`](SETUP.md).

---

## Legal Disclaimer

1. **100% Free, Open-Source & Non-Commercial**: Neko Music / Slothify is an educational proof-of-concept created for personal use. It contains no advertisements, no premium subscriptions, and no monetization.
2. **Custom Content-Filtering Browser**: The application acts strictly as a specialized web client that parses publicly available content and media endpoints from YouTube, Spotify, and JioSaavn. Its functionality is fundamentally equivalent to viewing these platforms in a browser equipped with an ad-blocking extension.
3. **No Hosting of Copyrighted Material**: Neither Slothify nor the Saavn Audio Services extension hosts, uploads, or stores copyrighted audio or video files. All audio streams are delivered directly from source CDNs (Google/YouTube and JioSaavn) to the user's browser.
4. **Support Content Creators**: We strongly urge all users to support musicians, artists, and creators by purchasing official subscriptions to [YouTube Premium](https://www.youtube.com/premium), [Spotify Premium](https://www.spotify.com/premium), and [JioSaavn Pro](https://www.jiosaavn.com/pro).

---

## Open Source Credits

Neko Music & Slothify build upon research and open-source tools created by the community:

- **[sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api)**: Architectural foundation for media endpoint structures and DES media decryption algorithms utilized in our companion edge audio services.
- **[spotube-plugin-spotify](https://github.com/sonic-liberation/spotube-plugin-spotify)**: Reverse-engineered Spotify Web Player TOTP authentication algorithms for clientless metadata discovery.
- **[Piped](https://github.com/TeamPiped/Piped)**: Decentralized YouTube stream extraction framework.

---

## Maintainer & Contributors

<div align="center">

<a href="https://github.com/PurveshShinde">
  <img src="https://wsrv.nl/?url=github.com/PurveshShinde.png&w=240&h=240&mask=circle&fit=cover" width="120" height="120" alt="Purvesh Shinde" />
</a>

### **[Purvesh Shinde](https://github.com/PurveshShinde)**
*Lead Developer & Maintainer*

<br />

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/purvesh.dev)

</div>

---

## License

This project is open-source software licensed under the **[MIT License](LICENSE)**:

```
Copyright (c) 2026 Purvesh Shinde
```

See [`LICENSE`](LICENSE) for the complete legal text.
