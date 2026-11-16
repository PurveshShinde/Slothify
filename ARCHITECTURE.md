# Neko Music (Slothify) & Audio Services — System Architecture

This document provides a comprehensive technical overview of the **Neko Music** platform architecture, covering the core **Slothify** full-stack streaming application and the companion **Saavn Audio Services** edge microservice extension.

---

## 1. High-Level Ecosystem Architecture

The platform separates user interface presentation, metadata discovery, audio stream resolution, and media delivery into decoupled, resilient layers.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT APPLICATION LAYER                                │
│                          (React 18 • Vite 5 • Tailwind CSS)                           │
│                                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │   UI & Route Views    │  │ State & Cache Context │  │ Unified Audio Service      │  │
│  │  (14 Route Pages,     │  │ (ThemeContext, SWR,   │  │ (HTML5 Audio, byte-range   │  │
│  │   Shared Transitions) │  │  Local Browser Cache) │  │  seeking, queue & stream)  │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └─────────────┬──────────────┘  │
└──────────────┼──────────────────────────┼────────────────────────────┼─────────────────┘
               │                          │                            │
               │ REST / JSON (port 5000)  │                            │ Direct CDN stream
               ▼                          ▼                            │ playback (audio)
┌─────────────────────────────────────────────────────────┐            │
│                 BACKEND SERVICE LAYER                   │            │
│               (Node.js • Express • TypeScript)          │            │
│                                                         │            │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │            │
│  │ Express Routes   │  │  Zero-Knowledge Encryption  │  │            │
│  │ (/api, /audio,   │  │  (AES-256-GCM, Bounded LRU  │  │            │
│  │  /auth, /saavn)  │  │   Key Cache, in-flight dedup│  │            │
│  └────────┬─────────┘  └──────────────┬──────────────┘  │            │
│           │                           │                 │            │
│  ┌────────┴───────────────────────────┴──────────────┐  │            │
│  │             Plugin Registry Engine                │  │            │
│  │  ┌────────────────────────┐  ┌─────────────────┐  │  │            │
│  │  │ Metadata Plugins       │  │ Audio Plugins   │  │  │            │
│  │  │ (Spotify Scraper/GQL)  │  │ (JioSaavn / YT) │  │  │            │
│  │  └────────────────────────┘  └─────────────────┘  │  │            │
│  └───────────────────────────────────────────────────┘  │            │
└──────────────┬───────────────────────────────┬──────────┘            │
               │                               │                       │
      Metadata │ API queries          Media URL│ resolution            │
               ▼                               ▼                       ▼
┌─────────────────────────────┐  ┌───────────────────────────┐  ┌─────────────────────────┐
│     EXTERNAL METADATA       │  │   SAAVN AUDIO EXTENSION   │  │  PUBLIC MEDIA CDNs      │
│  - Spotify Web GQL/Embeds   │  │   (Cloudflare Worker)     │  │  - JioSaavn Akamai/     │
│  - Apple Music / iTunes RSS │  │  - Hono / Bun Edge Engine │  │    Cloudfront CDNs       │
│  - JioSaavn Search APIs     │  │  - DES-ECB URL Decryption │  │  - Google / YouTube      │
│  - InnerTube YouTube Search │  │  - 320 kbps Stream Extr.  │  │    Audio Streams         │
└─────────────────────────────┘  └───────────────────────────┘  └─────────────────────────┘
```

### 1.1 Multi-Platform Ecosystem
The Neko Music ecosystem spans three synchronized projects:
1. **Slothify Web & Server Platform** (`client/` and `server/`): Modern desktop and mobile browser streaming application with zero-knowledge library encryption.
2. **Saavn Audio Services Extension** (`saavn-extension-main/slothify-audio-services`): Cloudflare Workers edge microservice for high-speed DES-ECB stream decryption and direct CDN link resolution.
3. **Neko Music Android Client**: Dedicated native mobile streaming application ([https://github.com/PurveshShinde/Neko-Music](https://github.com/PurveshShinde/Neko-Music)).

---

## 2. Frontend Architecture (`client/`)

### 2.1 Core Technologies
- **UI Framework**: React 18 with TypeScript.
- **Build Tool**: Vite 5 with manual vendor chunk splitting (`vendor-react`, `vendor-icons`, `index`).
- **Styling**: Tailwind CSS with custom aesthetic typography (`Outfit`, `Plus Jakarta Sans`).
- **Animations**: GPU-accelerated spring physics and Shared Element Transitions via Framer Motion.
- **Local State & Cache**: React Context API + LocalStorage LRU caching (`CacheContext`).

### 2.2 Key Components (`client/src/components/`)
1. **`Player.tsx`**:
   - **Unified Player Engine**: Replaces fragmented multi-modal players with a single responsive player surface.
   - **Framer Motion Shared Element Transitions**: Binds the bottom media bar to the fullscreen view using `layoutId` transitions (`player-surface`, `player-shared-artwork`, `player-shared-title`).
   - **Normal vs. Vintage Mode**:
     - *Normal Mode*: Clean, modern square album cover artwork with rounded corners.
     - *Vintage Mode*: Skeuomorphic rotating vinyl platter with authentic groove reflections, static circular radial gradient depth shadows, and an animated HTML5 Canvas waveform.
   - **Mobile Touch Gestures**: Real-time vertical drag tracking with smooth swipe-down collapse into the floating bottom downbar.
   - **Byte-Range Seeking**: Direct seeking on progressive AAC/MP4 streams with HTTP 206 Partial Content support, eliminating seek snapping.
2. **`AudioWaveform.tsx`**: Real-time animated audio visualizer rendered on an HTML5 canvas.
3. **`VintageTurntable.tsx` & `VinylRecord.tsx`**: Precision skeuomorphic assets with pure radial-gradient drop shadows to eliminate rectangular GPU texture artifacts.
4. **`PlaylistCover.tsx`**: Automatic 4-tile album artwork collage for custom and imported playlists.
5. **`Sidebar.tsx` & `BottomNav.tsx`**: Responsive desktop sidebar and mobile bottom navigation with brand identity (`S L O T H I F Y`).
6. **`AuthModal.tsx`**: Minimalist modal for registration and login featuring the 12-word recovery passkey.

### 2.3 Route Structure (14 Pages)
| Path | Component | Description |
|:---|:---|:---|
| `/` | `Home.tsx` | Hero carousel, featured playlists, top charts, and personalized recommendations |
| `/albums` | `AlbumsPage.tsx` | Live album feed with Stale-While-Revalidate (SWR) caching and genre filters |
| `/album/:id` | `AlbumDetail.tsx` | Album tracklist, hero banner, play-all action, and poster URL consistency preservation |
| `/artists` | `ArtistsPage.tsx` | Top global artists with verified badges and follower counts |
| `/artist/:id` | `ArtistProfile.tsx` | Artist header portrait, monthly listeners, top tracks, and discography |
| `/playlists` | `PlaylistsPage.tsx` | Curated public collections and user-created playlists |
| `/playlist/:id` | `PlaylistDetail.tsx` | Playlist viewer, track reordering, custom sorting, and deletion |
| `/search` | `Search.tsx` | Instant multi-category search (Songs, Artists, Albums) with skeleton loading states |
| `/library` | `Library.tsx` | Personal library view (playlists, liked tracks, followed artists) with Grid/List toggles |
| `/history` | `History.tsx` | Reverse-chronological listening history with 100-item cap |
| `/settings` | `Settings.tsx` | Theme selector, audio engine preference, cache purger, and account controls |
| `/downloads` | `Downloads.tsx` | Offline storage placeholder |
| `/terms` | `Terms.tsx` | Terms of service and legal disclaimer |
| `/privacy` | `Privacy.tsx` | Zero-knowledge privacy policy and encryption transparency |

### 2.4 State Management & Contexts
- **`ThemeContext.tsx`**: Manages the dual-theme visual system:
  - **Ocean Breeze**: Cyan accents (`#38bdf8`), deep navy backgrounds (`#071329`), and cool ambient lighting.
  - **Autumn Ember**: Amber accents (`#f59e0b`), warm espresso backgrounds (`#140b07`), and terracotta highlights.
  - **Dual-Layer Persistent GPU Scenery**: Persistent GPU texture layers for `Autumn.jpg` and `Ocean.jpg` with coordinated directional scale transitions (`scale-100` to `scale-[1.08]`) to eliminate wallpaper flicker during rapid toggling.
- **`CacheContext.tsx`**: Browser `localStorage` cache (`v14`) storing home data, album details, artist profiles, and user playlists with automatic staleness invalidation.
- **`SpotifyContext.tsx`**: Handles client-side Spotify playlist and album imports via public embed scrapers.

---

## 3. Backend Architecture (`server/`)

### 3.1 Entry Point & Middleware
- **`server.ts`**: Express 4 application initializing CORS, JSON parsing, Redis connection, MongoDB Mongoose ODM, and route mounting under `/api`.
- **`middleware/auth.ts`**:
  - `requireAuth`: Strict JWT verification returning `401 Unauthorized` for protected user actions.
  - `optionalAuth`: Soft JWT parsing attaching `req.user` if valid, allowing seamless guest browsing without barriers.
- **`middleware/cache.ts`**: Redis caching middleware with automated fallback to an in-memory Map cache if Redis is offline.

### 3.2 Route Inventory
```
server/src/routes/
├── api.ts          # Playlists, albums, artists, recommendations, liked songs, user data
├── audio.ts        # Stateless audio provider resolution (/providers, /provider, /resolve)
├── auth.ts         # Zero-knowledge authentication, registration with 12-word passkey, login
├── saavn.ts        # JioSaavn search and media stream proxying
├── spotify.ts      # Spotify embed import and track metadata normalization
└── youtube.ts      # YouTube search and stream resolution via bundled yt-dlp
```

### 3.3 Database Models (`server/src/models/`)
1. **`User.ts`**:
   - Stores `username`, `passwordHash` (bcrypt), `recoveryKeyHash` (bcrypt hash of 12-word passkey), `createdAt`.
2. **`EncryptedPlaylist.ts`**:
   - Zero-knowledge encrypted user playlist: `userId`, `playlistId`, `ciphertext`, `iv`, `tag`, `updatedAt`.
3. **`EncryptedLikedTrack.ts`**:
   - Zero-knowledge encrypted liked song: `userId`, `trackId`, `ciphertext`, `iv`, `tag`, `addedAt`.
4. **`FollowedArtist.ts`**:
   - User artist follows: `userId`, `artistId`, `artistName`, `artistImage`, `followers`, `followedAt`.
5. **`ListeningHistory.ts`**:
   - User track plays: `userId`, `trackId`, `trackName`, `artistName`, `albumName`, `albumImage`, `duration_ms`, `playedAt`.
   - **Compound Index**: `{ userId: 1, playedAt: -1 }` provides indexed sorting for reverse-chronological history fetches and forward-chronological pruning, completely eliminating in-memory MongoDB sort operations.

---

## 4. Plugins & Audio Ingestion Engines

The backend utilizes a Plugin Registry pattern (`server/src/plugins/registry.ts`) to isolate metadata scraping from stream delivery.

### 4.1 Metadata Subsystem (`SpotifyScraperPlugin.ts`)
The metadata engine scrapes and normalizes global music catalogs without official API keys:
- **`spotubeAuth.ts`**: Generates RFC 6238 TOTP tokens with dynamic nuance secrets for the Spotify Web Player.
- **`spotifyGqlClient.ts`**: Dispatches Spotify Pathfinder GraphQL queries (`searchDesktop`, `queryArtistOverview`) for high-resolution 640x640 CDN artwork and verified artist metadata.
- **`playlistAlbumScraper.ts`**: Scrapes Spotify playlist and album embeds (`open.spotify.com/embed/...`) for comprehensive tracklists.
- **`albumSearch.ts`**: Multi-engine album search combining JioSaavn and Spotify with cross-provider deduplication.
- **`artistExploration.ts` & `artistResolution.ts`**: Superstart catalogs, follower count caching, and YouTube channel validation.
- **`trackRanking.ts`**: Piecewise popularity normalization, canonical index-0 weighting, knockoff spam suppression, and Rule 0/1 deduplication.

### 4.2 Audio Delivery Plugins
1. **`JioSaavnAudioPlugin.ts`**:
   - Queries JioSaavn media endpoints for 320 kbps AAC audio.
   - Decrypts DES-ECB media URLs using secret key `38346591`.
   - Upgrades lower-bitrate links (`_96.mp4`) to master studio grade (`_320.mp4`).
2. **`YouTubeAudioPlugin.ts`**:
   - Resolves direct progressive audio streams using bundled `yt-dlp.exe`.
   - Enforces `itag 140` (M4A container with AAC audio) for byte-range seeking compatibility.

---

## 5. Saavn Audio Services Extension (`slothify-audio-services`)

The companion extension repository (`saavn-extension-main/slothify-audio-services`) provides a dedicated edge microservice:

- **Framework**: [Hono](https://hono.dev/) compiled for **Cloudflare Workers** edge network.
- **Runtime**: [Bun](https://bun.sh/) for ultra-fast local development and testing.
- **Upstream Lineage**: Independently maintained fork derived from `sumitkolhe/jiosaavn-api`.
- **Media Decryption**: In-memory DES-ECB decryption of `encrypted_media_url` parameters via `node-forge`.
- **Edge Deployment**: Globally distributed across 300+ Cloudflare edge data centers with sub-50ms latency.
- **API Documentation**: Interactive Scalar OpenAPI documentation UI served at `/docs`.

---

## 6. Stateless Audio Resolution Lifecycle

When a client requests playback for a track, the following deterministic resolution sequence executes:

```
Client Requests Track Playback
      │
      ▼
GET /api/audio/resolve?q={title + artist}&provider={auto|jiosaavn|youtube}
      │
      ├── Explicit "jiosaavn" ──► Try JioSaavn ──(fail)──► Fallback to YouTube
      │
      ├── Explicit "youtube"  ──► Try YouTube  ──(fail)──► Fallback to JioSaavn
      │
      └── Default "auto"      ──► Try JioSaavn (320kbps CD Quality)
                                       │
                                    (fail)
                                       ▼
                                  Try YouTube (M4A itag 140)
                                       │
                                    (fail)
                                       ▼
                                  HTTP 500 JSON Error
```

**Key Architectural Rule**: Route handlers never mutate global server singleton state. Client preferences remain request-scoped, guaranteeing safe multi-tenant concurrency.

---

## 7. Zero-Knowledge Security Pipeline

```
User Password + Salt
      │
      ▼
crypto.scrypt (libuv threadpool) ──► 32-Byte Derived AES Key
                                            │
                                            ├── Cached in Bounded LRU Key Cache
                                            │   (max 500 entries, 1h TTL, HMAC key)
                                            ▼
                                  AES-256-GCM Cipher
                                 (12-byte IV, 16-byte Tag)
                                            │
                                            ▼
                       Stored in MongoDB: { ciphertext, iv, tag }
                       (Backend cannot decrypt without user key)
```

For complete details on security, candidate secret fallbacks, and recovery passphrases, see [`SECURITY.md`](SECURITY.md).

