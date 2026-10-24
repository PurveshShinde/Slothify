<div align="center">

<img src="./client/public/favicon_sloth.png" alt="Slothify Mascot" width="128" />

# Slothify — Ad-Free Music Streaming Platform

![Version](https://img.shields.io/badge/Version-1.0.6-007ACC.svg?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)
![React 18](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

<p align="center">
  <b>A modern, ad-free, high-fidelity music streaming application with modular audio engine routing, real-time metadata discovery, zero-knowledge privacy, and dynamic visual theming.</b>
</p>

[Overview](#overview) • [Key Features](#key-features) • [Audio Engines](#audio-engines) • [Open Source Credits](#open-source-credits) • [Android Roadmap](#android-roadmap) • [Author](#author) • [Support](#support) • [License](#license)

</div>

---

## Overview

Slothify is a lightweight music streaming application designed to deliver direct audio playback without server-side transcoding bottlenecks. Combining direct stream resolution, Spotify Web Player catalog discovery, and client-encrypted library persistence, Slothify provides a responsive listening experience across desktop and mobile browsers.

---

## Key Features

- **Multi-Source Audio Routing**: Stream music via JioSaavn or YouTube with automated fallback resolution to ensure uninterrupted playback.
- **Catalog & Artist Discovery**: Search and explore global tracks, albums, and artist discographies powered by Spotify Web Player GQL and Apple iTunes APIs.
- **Dynamic Interface & Themes**: Switch between Ocean and Autumn visual themes, or toggle the interactive Vinyl Turntable player mode.
- **Skeleton Loading States**: Smooth shimmer skeleton placeholders across Home, Albums, and Artists views for fluid screen transitions.
- **Encrypted Library Storage**: User playlists and saved favorites are encrypted before cloud persistence.
- **Mobile-Optimized Experience**: Touch-friendly layout with gesture navigation, pull-to-refresh, and persistent player controls.
- **Zero-Friction Account Creation**: Sign up with just a **username and password** — no email, no Google, no OAuth required. Upon registration a unique **12-word recovery passphrase** is issued (since no email is linked) so you can always regain access. Your avatar is auto-generated from your username via DiceBear, and accounts work even in offline/local-fallback mode.
- **Listening-Driven Personalization**: Every track you play is recorded to your personal listening history (up to the 100 most recent plays). The recommendation engine cross-references your recent history and liked tracks to extract your top artists, then surfaces 25 artist-matched tracks weighted toward what you've been listening to lately. New accounts start with a global pop mix that evolves into a fully personalized feed the more you listen.

---

## Audio Engines

| Engine | Source Mechanism | Coverage |
| :--- | :--- | :--- |
| **JioSaavn API** | Direct media stream delivery from edge CDNs | Studio releases, albums, and regional catalogs |
| **YouTube (Piped & Invidious)** | Decentralized stream extraction across redundant instances | Global tracks, live performances, indie music, and covers |
| **Smart Fallback** | Automated priority routing across available sources | Seamless playback with high uptime |

---

## Open Source Credits

Slothify builds upon research, tools, and open-source implementations developed by the community:

- **[spotube-plugin-spotify](https://github.com/sonic-liberation/spotube-plugin-spotify)**: Reverse-engineered Spotify Web Player GQL discovery algorithms for clientless track and artist metadata.
- **[Piped](https://github.com/TeamPiped/Piped) & [Invidious](https://invidious.io/)**: Decentralized YouTube API stream extraction frameworks for ad-free audio delivery.
- **[Unofficial JioSaavn API](https://github.com/sumitkolhe/jiosaavn-api)**: Open-source research and media endpoint structures for direct streaming resolution.
- **[Apple iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html)**: High-resolution artwork enrichment and album lookup.

---

## Android Roadmap

Planned capabilities for the native mobile application:

- Background audio service and lock screen playback controls
- Encrypted local storage for offline playback
- Android Auto integration
- Bidirectional library and playlist cloud synchronization
- Dynamic dark theme with AMOLED support

---

## Author

<div align="center">

<a href="https://github.com/PurveshShinde">
  <img src="https://github.com/PurveshShinde.png" width="120" height="120" alt="Purvesh Shinde" style="border-radius: 50%; object-fit: cover; border: 3px solid #007ACC; box-shadow: 0 4px 18px rgba(0, 122, 204, 0.3);" />
</a>

### **[Purvesh Shinde](https://github.com/PurveshShinde)**
*Lead Developer*

[![GitHub](https://img.shields.io/badge/GitHub-PurveshShinde-181717?style=flat-square&logo=github)](https://github.com/PurveshShinde)

</div>

---

## Support

<div align="center">

If you find Slothify helpful, consider supporting its development.

<br />

<a href="https://buymeacoffee.com/purvesh.dev" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="170">
</a>

</div>

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more details.
