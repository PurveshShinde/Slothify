<div align="center">

<img src="./client/public/favicon_sloth.png" alt="Slothify Mascot" width="128" />

# Slothify — Ad-Free Music Streaming Platform

![Version](https://img.shields.io/badge/Version-1.1.0-007ACC.svg?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)
![React 18](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

<p align="center">
  <b>A modern, ad-free, high-fidelity music streaming application with modular audio engine routing, real-time metadata discovery, zero-knowledge privacy, and dynamic visual theming.</b>
</p>

[Overview](#overview) • [Key Features](#key-features) • [Audio Engines](#audio-engines) • [Open Source Credits](#open-source-credits) • [Legal Disclaimer & Terms of Use](#legal-disclaimer--terms-of-use) • [Android Roadmap](#android-roadmap) • [Contributors](#contributors) • [Support](#support) • [License](#license)

</div>

---

## Overview

Slothify is a lightweight music streaming application designed to deliver direct audio playback without server-side transcoding bottlenecks. Combining direct stream resolution, Spotify Web Player catalog discovery, and client-encrypted library persistence, Slothify provides a responsive listening experience across desktop and mobile browsers.

---

## Key Features

- **Multi-Source Audio Routing**: Stream music via JioSaavn or YouTube with automated fallback resolution to ensure uninterrupted playback.
- **Catalog & Artist Discovery**: Search and explore global tracks, albums, and artist discographies powered by Spotify Web Player GQL and JioSaavn APIs.
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
| **JioSaavn** | Direct media stream delivery via dedicated, personally hosted Cloudflare Worker ([sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api)) | Studio releases, albums, and regional catalogs (up to 320 kbps) |
| **YouTube (Piped)** | Decentralized stream extraction across redundant Piped instances | Global tracks, live performances, indie music, and covers |
| **Smart Fallback** | Automated priority routing across available sources | Seamless playback with high uptime |

---

## Open Source Credits

Slothify builds upon research, tools, and open-source implementations developed by the community:

- **[sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api)**: Open-source JioSaavn API framework and media endpoint architecture. Slothify uses this repository as the base architectural engine for its personally hosted, private Cloudflare Worker audio streaming service (eliminating dependency on third-party public instances).
- **[spotube-plugin-spotify](https://github.com/sonic-liberation/spotube-plugin-spotify)**: Reverse-engineered Spotify Web Player GQL discovery algorithms for clientless track and artist metadata.
- **[Piped](https://github.com/TeamPiped/Piped)**: Decentralized YouTube API stream extraction framework for ad-free audio delivery.

---

## Legal Disclaimer & Terms of Use

### 1. 100% Free, Open-Source & Strictly Non-Commercial
Slothify is a fully open-source project (FOSS) created purely for educational purposes and personal use. We do not sell this application, nor do we monetize it in any way. There are no advertisements, no premium features, no subscriptions, and no hidden fees within the app. This project has absolutely no commercial value or financial intent.

### 2. A Custom Browser with Content Filtering
Slothify acts strictly as a specialized, third-party web browser and client. It simply parses the publicly available website content and APIs of YouTube, YouTube Music, Spotify, and JioSaavn, rendering them in a custom user interface. The ad-free experience it provides is fundamentally no different from using a standard web browser (like Chrome, Firefox, or Brave) equipped with a common ad-blocking extension (such as uBlock Origin).

### 3. Support Content Creators
We deeply respect the hard work of artists, musicians, and content creators. We strongly encourage all users to subscribe to official streaming services such as [YouTube Premium](https://www.youtube.com/premium), [Spotify Premium](https://www.spotify.com/premium), and [JioSaavn Pro](https://www.jiosaavn.com/pro). Purchasing official subscriptions is the best way to financially support the creators you listen to and ensure the continued growth of the music industry. Slothify is built as an educational proof-of-concept for developers and enthusiasts, not to harm creators' revenues.

### 4. No Hosting of Copyrighted Material
We do not host, upload, distribute, or store any audio, video, or copyrighted media files on our own servers. All content accessed through this application is stored entirely on third-party servers (such as Google/YouTube and JioSaavn CDNs) and remains the property of their respective copyright owners. The app merely acts as a conduit to stream publicly accessible links directly from their source CDNs to the client's browser.

### 5. User Responsibility & Legal Contact
The software is provided "AS IS", without warranty of any kind. The developers of Slothify do not encourage or condone piracy. Users are solely responsible for ensuring their usage of this app complies with their local copyright laws and the Terms of Service of the platforms they access.

---

## Android Roadmap

Planned capabilities for the native mobile application:

- Background audio service and lock screen playback controls
- Encrypted local storage for offline playback
- Android Auto integration
- Bidirectional library and playlist cloud synchronization
- Dynamic dark theme with AMOLED support

---

## Contributors

<div align="center">

<a href="https://github.com/PurveshShinde">
  <img src="https://avatars.githubusercontent.com/PurveshShinde?s=120" width="120" height="120" alt="Purvesh Shinde" style="border-radius: 50%;" />
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
