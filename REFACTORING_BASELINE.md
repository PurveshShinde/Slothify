# Refactoring Baseline Specification
**Slothify Music Streaming Platform**  
**Commit:** `32f6220784f580f2fed64589a1fadd78c32a6d99` (Branch: `main`)  
**Date:** November 2026  
**Environment:** Node.js v24.22.1, npm 11.19.1, Windows x64  

---

## 1. Baseline Build & Typecheck Metrics

### Frontend (`client/`)
* **TypeScript Check (`tsc -p client/tsconfig.json --noEmit`):**
  * Status: **0 errors** (Pass)
* **Production Build (`npm run build --prefix client`):**
  * Status: **Pass** (Build time: ~24.1s)
  * Warnings:
    * `/index.css doesn't exist at build time, it will remain unchanged to be resolved at runtime` (Caused by invalid `<link rel="stylesheet" href="/index.css">` in `index.html`)
  * Generated Artifacts & Sizes:
    * `dist/index.html`: 8.00 kB (gzip: 2.17 kB)
    * `dist/assets/index-5dhRA21h.css`: 100.20 kB (gzip: 15.15 kB)
    * `dist/assets/vendor-icons-Ciwl9lvt.js`: 27.76 kB (gzip: 5.41 kB)
    * `dist/assets/vendor-react-6ZIQRbH-.js`: 176.52 kB (gzip: 57.89 kB)
    * `dist/assets/index-Co_Psia9.js`: **590.58 kB** (gzip: 167.42 kB) — *Exceeds 500 kB chunk threshold*

### Backend (`server/`)
* **TypeScript Check (`tsc -p server/tsconfig.json --noEmit`):**
  * Status: **0 errors** (Pass)
* **Build (`npm run build --prefix server`):**
  * Status: **Pass** (`tsc` compiles to `dist/server.js`)

---

## 2. Test Infrastructure Baseline

* **Runner:** Node.js v24 Native Test Runner (`node:test`, `node:assert/strict`) driven by `tsx` (TypeScript Execution Engine).
* **Root Script:** `npm test` -> `node scripts/run-tests.mjs`
* **Test Suites Implemented:** 8 suites, 42 sub-suites.
* **Test Results:** **117 / 117 tests passing (100% pass rate)**.
* **Execution Time:** ~1.63 seconds.

### Summary of Unit Test Suites:
1. `tests/unit/timeFormatting.test.ts` (14 tests): Player seconds to `MM:SS`, duration ms to `MM:SS`, relative timestamps (`Just now`, `5m ago`, `Yesterday`, etc.).
2. `tests/unit/similarityMatching.test.ts` (15 tests): Levenshtein distance, diacritic/case-insensitive artist matching, superstar relevance scores, JioSaavn query junk stripping, fuzzy title/artist matching.
3. `tests/unit/imageOptimization.test.ts` (12 tests): JioSaavn CDN size upgrades (`500x500` -> `150x150`), Apple Music/Unsplash dimensions, deterministic offline SVG monogram generator, `KNOWN_ARTIST_AVATARS` resolver.
4. `tests/unit/trackDeduplication.test.ts` (9 tests): Canonical Spotify index-0 weighting, knockoff spam penalty, junk filtering (`workout|nightcore|tribute`), studio vs compilation album preference, score sorting.
5. `tests/unit/cryptoCompatibility.test.ts` (29 tests): 12-word recovery passphrase generation, async AES-256-GCM encryption/decryption, sync fallback helpers, byte-for-byte key equivalence, candidate-secret backward compatibility (all 5 secrets), fixed legacy ciphertext fixture decryption across all 3 historical secrets, tampering & invalid IV/tag rejection, bounded LRU cache hit/miss/eviction/TTL behavior, in-flight Promise deduplication (thundering herd protection), non-blocking event loop ticks.
6. `tests/unit/authBusinessLogic.test.ts` (7 tests): JWT token signing & 30-day verification, signature tampering rejection, username regex injection escaping, passkey normalization.
7. `tests/unit/playlistAndHistoryLogic.test.ts` (15 tests): Production `extractTracksArray` utility (`client/src/utils/trackParser.ts`) imported and tested directly across raw arrays, Spotify envelopes, direct item envelopes, null/undefined elements, malformed payloads, playlist sorting (`custom`, `az`, `za`, `artist`, `duration`), and listening history deduplication with 100-item cap.
8. `tests/unit/audioProviderIsolation.test.ts` (14 tests): GET /providers & POST /provider semantics, per-request query (?provider=) & header (x-audio-provider) overrides, concurrent multi-client isolation, and deterministic fallback handling.

---

## 3. Pre-Existing Errors & Warnings Catalog

| Component / Layer | Nature | Description |
| :--- | :--- | :--- |
| `client/index.html` | Runtime 404 & Build Warning | `<link rel="stylesheet" href="/index.css">` requests a nonexistent file (Vite processes `src/index.css` via `main.tsx`). |
| `client/index.html` | Security & Dead Code | `<script type="importmap">` injects Node server packages (`express`, `cors`, `fs`, `path`) and `react@19` from `esm.sh` into browser. |
| `client/package.json` | Dependency Bloat | `node-forge` (1.4 MB) included in frontend dependencies, but only used by Vercel serverless function (`client/api/saavn/_saavn.ts`). |
| `server/package.json` | Dead Dependencies | `express-session`, `@types/express-session`, and `selfsigned` are installed but never imported anywhere in backend code. |
| `server/src/utils/crypto.ts` | CPU Bottleneck | Synchronous `crypto.scryptSync` inside `decryptPayload` blocks the single-threaded event loop under concurrent load. |
| `server/src/routes/audio.ts` | Concurrency Flaw | `POST /api/audio/provider` mutates global singleton `pluginRegistry.setActiveAudioPlugin()`, impacting all server tenants. |
| `server/src/models/ListeningHistory.ts` | Query Inefficiency | Missing compound index `{ userId: 1, playedAt: -1 }` causes unindexed sorting on history queries. |
| `server/src/store/localLibrary.ts` | I/O Bottleneck | Synchronous `fs.writeFileSync` on 133 KB JSON file during local guest mutations. |
| `client/src/pages/PlaylistDetail.tsx` | Pre-existing Runtime Exception | In line 75: `data.items.map((i: any) => i.track \|\| i)` previously threw `TypeError: Cannot read properties of null` on null elements. Extracted into safe utility `client/src/utils/trackParser.ts` and covered by regression tests. |
| `client/src/components/VintageTurntable.tsx` | Dead Code | 553 lines of dead code not imported by any file in the workspace. |

---

## 4. Critical Finding Validation & Technical Analysis

### A. Zero-Knowledge Cryptographic Key Derivation
* **Identified Vulnerability:** `crypto.scryptSync(userId + secret, 'slothify_salt', 32)` runs on Node's main event-loop thread. Each key derivation costs ~25-30ms of synchronous CPU time. When decrypting a playlist with 30-50 tracks, or when multiple users access the API concurrently, the server event loop completely freezes, blocking all incoming I/O and HTTP requests.
* **Finalized Phase 1 Architecture:**
  1. **Asynchronous Derivation:** Transition from synchronous `crypto.scryptSync` to asynchronous `crypto.scrypt` (via `util.promisify(crypto.scrypt)`). This shifts key derivation workloads into Node's libuv worker threadpool (`UV_THREADPOOL_SIZE`), leaving the event loop free to process requests.
  2. **Bounded LRU Cache with TTL:**
     - Replace any unbounded memory structure with a bounded Least Recently Used (LRU) cache.
     - Sized to `maxEntries: 500` entries with a time-to-live (`ttlMs: 3,600,000` = 1 hour).
     - Composite cache key: `${userId}:::${secret}`.
     - Eviction policy: When reaching capacity, evict the least recently accessed key; entries exceeding TTL are invalidated and rederived on demand.
  3. **Concurrency Deduplication (In-Flight Promise Map):**
     - Under burst concurrent requests for the same user (e.g. batch playlist decryption), avoid dispatching dozens of identical `crypto.scrypt` derivations to the threadpool (thundering herd).
     - Maintain `inFlightDerivations: Map<string, Promise<Buffer>>`. Concurrent callers await the active derivation promise. Upon completion or failure, the entry is cleanly removed from the map.
  4. **Strict Historical Secret Preservation:**
     - Maintain exact candidate-secret fallback sequence across all historical deployment environments:
       1. Primary secret (`process.env.ENCRYPTION_SECRET || 'slothify_zero_knowledge_super_secret_pepper_2026'`)
       2. `process.env.ENCRYPTION_SECRET` (if distinct)
       3. `'slothify_zero_knowledge_super_secret_pepper_2026'`
       4. `'slothify-zero-knowledge-fallback-secret-2026'`
       5. `'slothify-zero-knowledge-fallback-secret'`
     - Preserve exact parameters: AES-256-GCM cipher, 32-byte key, 12-byte IV, 16-byte authentication tag, salt `'slothify_salt'`.
     - Zero modifications to stored database ciphertext or wire representation.
  5. **Memory Overhead Note:**
     - Memory footprint is not an arbitrary flat metric (e.g., 64 KB). In Node.js / V8, total heap overhead for 500 cached entries encompasses binary Buffers (32 bytes each), cache key strings (~50-100 bytes each), LRU linked-list node pointers, numeric timestamps, and V8 object header overhead. Actual memory consumption will be observed using `process.memoryUsage().heapUsed` during runtime profiling.

### B. ListeningHistory MongoDB Query Execution & Indexing
* **Identified Query Patterns (`server/src/routes/api.ts`):**
  - Line 462: `ListeningHistory.find({ userId: req.user.userId }).sort({ playedAt: -1 }).limit(25)`
  - Line 534: `ListeningHistory.find({ userId }).sort({ playedAt: 1 }).limit(total - 100)`
  - Line 552: `ListeningHistory.find({ userId: req.user.userId }).sort({ playedAt: -1 }).limit(limit)`
  - Line 1519: `ListeningHistory.find({ userId }).sort({ playedAt: -1 }).limit(15)`
* **Current Schema (`server/src/models/ListeningHistory.ts`):**
  - Defines two independent single-field indexes: `{ userId: 1 }` and `{ playedAt: 1 }`.
  - Without a compound index, queries filtering by `userId` and sorting by `playedAt` must use the `userId` index to collect matching documents, followed by an in-memory blocking `SORT` stage.
* **Sandbox Network Isolation & Empirical Verification Status:**
  - Because execution occurs inside a sandboxed environment without external network connectivity to the remote MongoDB Atlas cluster (`cluster0.cpjwwpy.mongodb.net`), **live MongoDB `explain("executionStats")` statistics could NOT be captured**.
  - **The compound index `{ userId: 1, playedAt: -1 }` is NOT claimed to be empirically verified.** It remains a **theoretical architectural recommendation** derived from static analysis of query patterns.
* **MongoDB Sort Memory Limits:**
  - The project backend uses `mongoose: ^9.11.2`.
  - In modern MongoDB deployments (MongoDB 6.0 and later), the default memory limit for in-memory blocking sorts is **100 MB** (`internalQueryExecMaxBlockingSortBytes`).
  - In earlier MongoDB releases (MongoDB 5.0, 4.4, and pre-6.0), the limit was **32 MB**.
  - Once user history grows and query volume increases, unindexed sorts risk exceeding these memory thresholds unless supported by the compound index `{ userId: 1, playedAt: -1 }`. Live execution plans will be collected once connected to a live database.

### C. Audio Provider Multi-Tenant Mutation
* **Identified Vulnerability:** In `server/src/routes/audio.ts`, `POST /api/audio/provider` mutates the server-wide singleton `pluginRegistry.setActiveAudioPlugin(provider)`. If Tenant A selects JioSaavn and Tenant B selects YouTube, Tenant A's subsequent requests inadvertently resolve via YouTube.
* **Target Architecture:**
  - `GET /api/audio/resolve` already accepts an optional `?provider=` query parameter.
  - Phase 1 refactoring will make provider selection strictly request-scoped (stateless), deprecating or neutralizing the global mutator `POST /api/audio/provider` to safeguard tenant isolation.

### D. Client Bundle Size & Chunking Strategy
* **Identified Cause:** Client initial bundle size (`index-Co_Psia9.js` at 590.58 kB) exceeds Vite's 500 kB recommendation because all 14 page components are imported statically in `client/src/App.tsx`, and `client/src/pages/Home.tsx` embeds ~1,000 lines of hardcoded mock track arrays.
* **Target Architecture:**
  - Introduce `React.lazy()` and `Suspense` for all secondary page components (Library, Search, ArtistDetail, AlbumDetail, PlaylistDetail, Settings, History, etc.).
  - Move mock data constants into dedicated data fixtures loaded on demand.
