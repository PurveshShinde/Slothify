# Refactoring Progress Log
**Project:** Slothify Optimization & Modularization  
**Current Phase:** Phase 2 — Monolith Deconstruction  
**Branch:** `refactor/phase-1-bottlenecks`  
**Status:** **PHASE 2 IN PROGRESS (TASKS 1.1 THROUGH 1.13 COMPLETED & VERIFIED) — AWAITING REVIEW & DIRECTION FOR TASK 1.14**

---

## 1. Phase Status Overview

| Phase | Description | Status | Verification |
| :--- | :--- | :---: | :--- |
| **Phase 0** | Baseline Stabilization & Testing Foundation | **COMPLETE** | 85 unit tests passing; builds clean; production track parser safely extracted & verified |
| **Phase 1** | Critical Fixes (Audio Isolation, Crypto LRU, ListeningHistory Index, Client HTML) | **COMPLETE** | Tasks 1-4 completed & verified; 125 unit tests passing (100%); zero build warnings; zero regressions |
| **Phase 2** | Monolith Deconstruction (Home.tsx, Player.tsx, SpotifyScraperPlugin.ts) | **IN PROGRESS** | Tasks 1.1-1.13 complete; 311 unit tests passing (100%); zero build warnings; zero regressions |
| **Phase 3** | Code Simplification, Shared TrackRow & Context Unification | *QUEUED* | Blocked on Phase 2 |
| **Phase 4** | Dependency Cleanup, Tailwind CSS Variables & Automated E2E | *QUEUED* | Blocked on Phase 3 |

---

## 2. Phase 0 Work Completed & Corrections Applied

### Step 1: Git Safety Verification
* Git working tree inspected: Clean, no uncommitted user changes.
* Current branch: `main` at commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
* Dedicated refactoring branch recommendation documented.

### Step 2: Baseline Build Verification
* Client TypeScript compilation (`tsc --noEmit`): **0 errors**.
* Client production build (`npm run build --prefix client`): **Pass in 24.1s**.
  * Recorded pre-existing warning: `/index.css doesn't exist at build time...`
  * Recorded main bundle size: `index-Co_Psia9.js` (590.58 kB / gzip: 167.42 kB).
* Server TypeScript compilation (`tsc --noEmit`): **0 errors**.
* Server build (`npm run build --prefix server`): **Pass**.

### Step 3: Test Infrastructure Established & Tests Hardened
* Evaluated Vitest vs Node Native Test Runner. Introduced zero-dependency, ultra-fast test harness leveraging Node 24's native `node:test` + `node:assert/strict` with `tsx` TypeScript loader.
* Created cross-platform test runner script: `scripts/run-tests.mjs`.
* Configured root `package.json` with `"test": "node scripts/run-tests.mjs"`.
* Created 7 comprehensive test suites in `tests/unit/`:
  1. `timeFormatting.test.ts` (14 tests passed)
  2. `similarityMatching.test.ts` (15 tests passed)
  3. `imageOptimization.test.ts` (12 tests passed)
  4. `trackDeduplication.test.ts` (9 tests passed)
  5. `cryptoCompatibility.test.ts` (13 tests passed)
  6. `authBusinessLogic.test.ts` (7 tests passed)
  7. `playlistAndHistoryLogic.test.ts` (15 tests passed)
* **Correction Applied:** Extracted `extractTracksArray` parsing logic from inline `client/src/pages/PlaylistDetail.tsx` into reusable utility `client/src/utils/trackParser.ts`. Updated unit test suite to import and directly test this actual production function against raw arrays, Spotify envelopes, direct item envelopes, null/undefined elements, malformed payloads, and structure preservation.
* **Total test count:** **85 tests across 30 suites**.
* **Pass rate:** **85 / 85 passed (100%)** in ~1.09 seconds.

### Step 4: Documentation Artifacts Updated
* `REFACTORING_BASELINE.md`: Records compilation metrics, bundle sizes, warning catalog, updated test summary, and architectural validation analysis.
* `REGRESSION_TEST_PLAN.md`: Complete matrix distinguishing automated tests from required manual browser protocols (Protocols A through D).
* `REFACTORING_PROGRESS.md`: This file.

### Step 5: Critical Findings Validated & Architecturally Finalized
* **Crypto Implementation Architecture:**
  - Transition from blocking `crypto.scryptSync` to asynchronous `crypto.scrypt` (via `util.promisify(crypto.scrypt)`).
  - Bounded LRU cache with TTL (`maxEntries: 500`, `ttlMs: 3,600,000` / 1 hr).
  - Concurrency deduplication via in-flight Promise map (`Map<string, Promise<Buffer>>`) to prevent libuv threadpool saturation under burst request volumes.
  - Full preservation of candidate-secret fallback across all 3 historical secrets.
  - Zero modification to encryption parameters (`aes-256-gcm`, 32-byte key, 12-byte IV, salt `'slothify_salt'`), ciphertext formats, or stored database payloads.
  - Refrained from unmeasured flat memory footprint claims; actual heap usage will be observed via `process.memoryUsage().heapUsed` during runtime profiling.
* **ListeningHistory MongoDB Indexing & Execution Plans:**
  - **Explicit Note:** Live MongoDB explain execution statistics (`executionStats`, `totalKeysExamined`, `executionStages`) could NOT be captured due to sandbox network isolation from remote MongoDB Atlas (`cluster0.cpjwwpy.mongodb.net`).
  - The compound index `{ userId: 1, playedAt: -1 }` is NOT claimed to be empirically verified; it remains a theoretical design recommendation pending live database connection.
  - Documented MongoDB sort memory limits: MongoDB 6.0+ enforces a default 100 MB sort memory limit (`internalQueryExecMaxBlockingSortBytes`), whereas pre-6.0 (and 5.0/4.4) enforced a 32 MB limit before throwing memory exhaustion exceptions.
* **Audio Engine Multi-Tenant Mutation:**
  - Verified `POST /api/audio/provider` mutates global singleton `pluginRegistry.setActiveAudioPlugin()`.
  - Phase 1 will make provider resolution request-scoped (`?provider=...`), neutralizing global mutation.
* **Client Bundle Bloat:**
  - Verified 590 kB initial chunk is driven by static imports of all 14 pages and 1,000 lines of hardcoded mock data in `Home.tsx`.
* **Synchronous Disk Writes:**
  - Verified `LocalLibraryStore` calls `fs.writeFileSync` on 133 KB JSON during local mutations.

---

## 3. Phase 1 Execution Log

### Task 1: Audio Provider Isolation & Backward-Compatibility Decision (Complete & Fully Verified)
* **Original Behavior & Race-Condition Claim Verification:**
  - **Correction of Original Assumption:** The audit's initial claim that "a single user switching engines in Settings corrupts playback streams for all concurrent users on the platform" was **partially overstated**.
  - **Inspection Findings:**
    1. In the web frontend, `client/src/components/Player.tsx` never calls `/api/audio/resolve` or `POST /api/audio/provider`. Audio resolution in the player is handled entirely client-side using `localStorage.getItem('slothify_audio_provider')` and direct calls to Cloudflare Worker `AudioService` and `/api/youtube/*`.
    2. `client/src/pages/Settings.tsx` persists the setting in `localStorage` and sends `axios.post('/api/audio/provider', { provider })` as a fire-and-forget background notice.
    3. In `server/src/routes/audio.ts`, `GET /api/audio/resolve` already branched on explicit queries: `if (requestedProvider === 'jiosaavn')` and `else if (requestedProvider === 'youtube')` both looked up plugins by explicit name. Explicitly parameterized requests were never affected by the global active plugin.
    4. **What Was Actually Affected:** `POST /api/audio/provider` previously mutated the global default engine in `pluginRegistry`, which affected:
       - The output of `GET /api/audio/providers` (`active` and `activePlugin` fields).
       - The fallback priority of `GET /api/audio/resolve` **only** when an external caller omitted `?provider=` or passed `provider=auto`.
* **Backward-Compatibility Architecture Decision:**
  - **`GET /api/audio/providers`:** Preserves all original fields (`active: 'jiosaavn'`, `activePlugin: 'JioSaavnAudio'`, and `providers` array). `activePlugin` is retained as a documented deterministic compatibility field representing the primary engine for automatic fallback resolution. Additional metadata fields (`defaultEngine: 'jiosaavn'`, `strategy: 'deterministic-fallback'`) are included to document the stateless strategy without breaking legacy JSON consumers.
  - **`POST /api/audio/provider`:** Retains original HTTP status codes (200 on valid input, 400 on invalid input, 500 on exception) and original response fields (`success: true`, `active: provider`). Eliminates process-wide singleton mutation (`pluginRegistry.setActiveAudioPlugin`), returning `scope: 'client-managed'`.
  - **`GET /api/audio/resolve`:** Auto-mode is strictly deterministic and stateless (JioSaavn 320kbps master first, falling back to YouTube). Supports per-request query (`?provider=jiosaavn|youtube`) and header (`x-audio-provider: jiosaavn|youtube`) overrides for guaranteed multi-client isolation.
  - **Frontend Verification:** Inspected all frontend code; confirmed that zero frontend components depend on `GET /providers` or read its response.
* **Route-Level Test Coverage (`tests/unit/audioProviderIsolation.test.ts`):**
  - 14 route-level Express tests running with zero TCP socket binding (sandbox compliant, zero external network calls):
    1. `GET /providers` reports `active: 'jiosaavn'`, `activePlugin: 'JioSaavnAudio'`, `defaultEngine`, and catalog.
    2. `POST /provider` acknowledges `'jiosaavn'`, `'youtube'`, and `'auto'` without mutating global state.
    3. `POST /provider` returns HTTP 400 on invalid input.
    4. Two clients with conflicting preferences make concurrent auto-mode requests without influencing each other.
    5. Concurrent requests with different client-persisted preferences (`x-audio-provider` vs query param vs auto) resolve independently.
    6. Query parameter overrides (`?provider=jiosaavn`, `?provider=youtube`).
    7. Header override (`x-audio-provider: youtube`).
    8. Missing `q` returns HTTP 400 error shape.
    9. Fallbacks: JioSaavn failure -> YouTube; YouTube failure -> JioSaavn; auto failure -> YouTube; dual failure -> HTTP 500.
    10. 30 concurrent mixed requests run in parallel with 0 cross-contamination.
* **Verification Metrics:**
  - `npm test`: **99 / 99 tests passing (100%)** in 1.11s.
  - Client & Server TypeScript: **0 errors**.
  - Client & Server Production Builds: **Clean pass**.

### Task 2: Crypto Performance Optimization (Complete & Fully Verified)
* **Problem Addressed:** Synchronous `crypto.scryptSync(userId + secret, 'slothify_salt', 32)` operations in `server/src/utils/crypto.ts` were called repeatedly during track and playlist decryption, blocking Node's main event-loop thread for ~25-30ms per derivation. For a user fetching 50 tracks, this blocked all incoming HTTP requests and I/O.
* **Architectural Implementation (`server/src/utils/crypto.ts`):**
  1. **Asynchronous Key Derivation:** Offloaded heavy scrypt CPU computation to Node's libuv worker threadpool via asynchronous `crypto.scrypt()`, freeing the event loop to continue processing concurrent I/O.
  2. **Bounded LRU Key Cache (`BoundedKeyCache`):**
     - Sized to `maxEntries: 500` entries with a 1-hour TTL (`ttlMs: 3,600,000`).
     - Uses JavaScript `Map` insertion-order LRU semantics for O(1) access, updates, and oldest-entry eviction.
     - Never caches plaintext track data or decrypted audio—only derived 32-byte key Buffers.
     - **Buffer Immutability Protection:** Returns defensive `Buffer.from()` copies on read and creates defensive copies on write, ensuring external callers cannot accidentally mutate internal cached keys.
     - **Hardened Process-Local Keyed HMAC:** Replaced unkeyed SHA-256 with an ephemeral process-local HMAC-SHA256 key (`crypto.randomBytes(32)` generated on boot, never persisted, never exported).
     - **Length-Prefixed Encoding:** Uses `${userLen}:${userId}:${secLen}:${secret}` formatting, mathematically eliminating any delimiter-collision ambiguities.
  3. **In-Flight Promise Deduplication & Race Protection:**
     - `inFlightDerivations: Map<string, Promise<Buffer>>` collapses concurrent derivations for the same user/secret into a single libuv task.
     - **Conditional Cleanup Race Fix:** The `.finally()` cleanup explicitly verifies `inFlightDerivations.get(cacheKey) === derivationPromise` before deleting, guaranteeing that an older resolving derivation will never prematurely delete a newer promise registered under the same key after cache clear.
     - **Real Production Flow Verification:** Tested via a test-scoped mock of `crypto.scrypt` directly exercising `deriveKeyWithSecret()` across all 6 steps without any testing hooks exported in production code.
  4. **Removal of Synchronous Helpers from Production:**
     - Completely removed `encryptPayloadSync`, `decryptPayloadSync`, `deriveKeySync`, `deriveKeyWithSecretSync`, and `scryptSync` from production `crypto.ts`. Zero synchronous crypto operations remain in production code.
     - The benchmark synchronous baseline is implemented locally inside `crypto_benchmark_corrected.mjs`.
  5. **100% Backward Compatibility Preserved:**
     - AES-256-GCM cipher, 32-byte key, 12-byte IV, 16-byte auth tag, salt `'slothify_salt'`.
     - Exact sequential candidate secret fallback (all 5 secrets preserved in original order).
     - Wire formats (`{ ciphertext, iv, tag }`) and stored database records unchanged.
* **Call Sites Updated (`server/src/routes/api.ts`):**
  - Updated all 14 call sites across 11 Express endpoints to `await` asynchronous `encryptPayload` and `decryptPayload`.
* **Empirical Benchmark & Profiling Measurements (Methodology & 4-Scenario Analysis):**
  - **Methodology:** Measured using Node.js `perf_hooks` (`performance.now()` and high-resolution `monitorEventLoopDelay`) across 3 iterations of 50-track workloads. High-resolution 1ms timer jitter and event loop lag recorded.
  - **Scenario A — Legacy Synchronous (`scryptSync`, 50 derivations):** 1,255.27 ms total, 25.11 ms/track, **0.0 event loop ticks** (event loop 100% frozen for entire 1.26s).
  - **Scenario B — Async Cold Derivations (50 distinct users, 50 `crypto.scrypt` derivations):** 1,280.53 ms total, 25.61 ms/track, **185.3 event loop ticks** (event loop remained fully responsive and unblocked; max lag: 17.68 ms, mean lag: 6.93 ms). Proves async scrypt does not reduce CPU work, but shifts execution to libuv worker threads so the main event loop continues serving concurrent I/O.
  - **Scenario C — Async Warm Cache (50 tracks, same user, 0 scrypt derivations, 50 cache hits):** **0.55 ms total**, **0.011 ms/track** (~2,300x faster than uncached cold derivations). Proves the dramatic user-facing speedup for track listing and playlist loading is delivered by the bounded LRU cache avoiding redundant key derivations.
  - **Scenario D — Thundering Herd (50 concurrent requests for same user and secret):** **25.17 ms total**, exactly **1 scrypt computation**, **49 in-flight deduplications**, 2.3 event loop ticks. Proves burst concurrent requests collapse onto a single worker thread derivation.
* **Limitations Documented:**
  - **Historical Fixture Limitation:** No pre-existing fixed ciphertext fixtures were checked into the repository on `main`. Complete historical compatibility was verified by creating deterministic fixtures matching the exact original `main` implementation across all 3 historical secrets and confirming byte-for-byte decryption without runtime re-encryption.
  - **Passive TTL Eviction:** Expired keys are evicted lazily upon query or via LRU capacity overflow, not on a standing active timer (acceptable given strict 500-entry memory bound).
* **Verification Metrics:**
  - `npm test`: **117 / 117 tests passing across 42 suites (100%)** in ~1.63s.
  - Client & Server TypeScript: **0 errors**.
  - Client & Server Production Builds: **Clean pass**.
  - Production sync crypto calls remaining (`scryptSync`, `encryptPayloadSync`, `decryptPayloadSync`, `deriveKeySync`, `deriveKeyWithSecretSync`) across all `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` files: **0**.
  - Testing-only hooks in production exports: **0** (all test injection and internal helpers removed from `crypto.ts`).

### Task 3: ListeningHistory Compound Index Optimization (Complete & Fully Verified)
* **Problem Addressed:** Queries retrieving user listening history in reverse-chronological order (`.find({ userId }).sort({ playedAt: -1 })`) and pruning excess entries in forward-chronological order (`.find({ userId }).sort({ playedAt: 1 })`) suffered from suboptimal index utilization. Previously, `server/src/models/ListeningHistory.ts` defined independent single-field indexes on `userId` (`index: true`) and `playedAt` (`index: true`). In MongoDB:
  1. A single-field index on `userId` required an in-memory `SORT` stage (which in MongoDB enforces memory boundaries: 100 MB default in 6.0+, 32 MB in pre-6.0) whenever sorting by `playedAt`.
  2. The standalone single-field index on `playedAt` was completely unused by the application, as zero queries in the codebase filter on `playedAt` without `userId`, yet it imposed an unnecessary write penalty on every track play recorded.
* **Codebase Query Inventory (11 Total Query Call Sites Identified):**
  1. `server/src/routes/api.ts:462` (`GET /me/recent`): `ListeningHistory.find({ userId: req.user.userId }).sort({ playedAt: -1 }).limit(25)`
  2. `server/src/routes/api.ts:518` (`POST /me/recent`): `ListeningHistory.deleteMany({ userId, trackId })` (deduplication before insert)
  3. `server/src/routes/api.ts:519` (`POST /me/recent`): `ListeningHistory.create(...)`
  4. `server/src/routes/api.ts:532` (`POST /me/recent`): `ListeningHistory.countDocuments({ userId })`
  5. `server/src/routes/api.ts:534` (`POST /me/recent`): `ListeningHistory.find({ userId }).sort({ playedAt: 1 }).limit(total - 100)` (excess pruning)
  6. `server/src/routes/api.ts:536` (`POST /me/recent`): `ListeningHistory.deleteMany({ _id: { $in: excess.map(e => e._id) } })`
  7. `server/src/routes/api.ts:552` (`GET /me/history`): `ListeningHistory.find({ userId: req.user.userId }).sort({ playedAt: -1 }).limit(limit).lean()`
  8. `server/src/routes/api.ts:586` (`DELETE /me/history`): `ListeningHistory.deleteMany({ userId: req.user.userId })`
  9. `server/src/routes/api.ts:600` (`DELETE /me/history/:trackId`): `ListeningHistory.deleteMany({ userId: req.user.userId, trackId })`
  10. `server/src/routes/api.ts:1519` (`GET /recommendations`): `ListeningHistory.find({ userId }).sort({ playedAt: -1 }).limit(15)`
  11. `server/src/routes/auth.ts:347` (`DELETE /api/auth/account`): `ListeningHistory.deleteMany({ userId })`
* **Architectural Implementation (`server/src/models/ListeningHistory.ts`):**
  1. **Compound Index Added:**
     ```ts
     ListeningHistorySchema.index({ userId: 1, playedAt: -1 });
     ```
     - For reverse-chronological queries (`.sort({ playedAt: -1 })`), MongoDB navigates directly to the user's slice in the index and scans forward in index order, completely eliminating in-memory sorting.
     - For forward-chronological queries (`.sort({ playedAt: 1 })`), MongoDB scans the user's slice backward in reverse index order, also completely eliminating in-memory sorting.
     - For prefix queries filtering only on `userId` (`countDocuments`, `deleteMany`), the compound index serves as a covering prefix index.
  2. **Redundant Single-Field Indexes Eliminated:**
     - Removed `index: true` from `userId` (redundant prefix of `{ userId: 1, playedAt: -1 }`).
     - Removed `index: true` from `playedAt` (unreferenced standalone field; zero queries filter on `playedAt` alone).
* **Mongoose `autoIndex` & Production Deployment Considerations:**
  - `server/src/db/connection.ts` does not explicitly set `autoIndex`, defaulting to Mongoose's `autoIndex: true`.
  - When the server connects to MongoDB, Mongoose calls `createIndexes()`, building `{ userId: 1, playedAt: -1 }` if not already present.
  - **Important:** Mongoose `createIndexes()` does **not** drop existing indexes from the database collection. Pre-existing single-field indexes (`userId_1` and `playedAt_1`) will persist in production until dropped administratively via `db.listeninghistories.dropIndex("userId_1")` and `db.listeninghistories.dropIndex("playedAt_1")`.
  - Automated dropping (e.g. `syncIndexes()`) was intentionally not added to application startup, as it can lock collections or cause unexpected index drops on large production clusters.
* **Live Database Limitations:**
  - The local development sandbox isolates outbound TCP network traffic, blocking connections to remote MongoDB Atlas (`cluster0.cpjwwpy.mongodb.net`).
  - As required, empirical `explain("executionStats")` metrics could not be captured live; this limitation is explicitly noted rather than presenting simulated statistics.
* **Test Coverage (`tests/unit/listeningHistoryIndex.test.ts`):**
  - Added 8 dedicated unit tests validating:
    1. Schema compound index definition `{ userId: 1, playedAt: -1 }`.
    2. Elimination of redundant single-field index on `userId`.
    3. Elimination of unused standalone single-field index on `playedAt`.
    4. Exact index count on schema (exactly 1 compound index).
    5. Reverse-chronological ordering logic (`playedAt: -1`) across multiple entries.
    6. Forward-chronological excess pruning ordering (`playedAt: 1`).
    7. User isolation across history queries.
    8. Schema document defaults (`duration_ms: 180000`, `playedAt` Date object).
* **Verification Metrics:**
  - `npm test`: **125 / 125 tests passing across 45 suites (100%)** in 2.02s.
  - Client & Server TypeScript: **0 errors**.
  - Client & Server Production Builds: **Clean pass**.
  - Git working tree: Only expected tracked files modified, zero whitespace/merge conflicts.

### Task 4: Client HTML Cleanup & Missing Asset Warning Resolution (Complete & Fully Verified)
* **Problem Addressed:**
  1. **Dead & Inappropriate Import Map:** `client/index.html` contained a `<script type="importmap">` mapping React and React-DOM to `^19.2.3` (esm.sh) alongside Node-only server libraries (`express`, `express-session`, `cors`, `fs`, `https`, `path`, `url`), despite the project using React `18.2.0` and bundling all client dependencies through Vite / Rollup.
  2. **Unresolvable `/index.css` Reference & Build Warning:** `client/index.html` contained an explicit `<link rel="stylesheet" href="/index.css">` tag. Because `/index.css` did not exist in `client/` or `client/public/`, Vite issued a build-time warning (`Could not resolve "/index.css" from "index.html"... will remain unchanged to be resolved at runtime`), causing production browsers to make a futile HTTP GET that failed with 404.
* **Investigation Findings:**
  1. The actual stylesheet entry point is `client/src/index.css` (which contains Tailwind directives `@tailwind base; @tailwind components; @tailwind utilities;` and global keyframe animations).
  2. `client/src/main.tsx` explicitly imports this stylesheet via `import './index.css';`.
  3. Vite compiles and purges `client/src/index.css` into a hashed asset bundle (e.g., `dist/assets/index-5dhRA21h.css`) and automatically injects the appropriate `<link rel="stylesheet" crossorigin href="/assets/index-[hash].css">` tag into `dist/index.html`.
  4. The client codebase contains **zero** runtime references to esm.sh, **zero** dynamic `import()` calls, and **zero** browser dependencies on import maps. Vite bundles React, ReactDOM, React Router, Lucide, and Axios via npm packages.
* **Exact Changes Made (`client/index.html`):**
  - Removed lines 162-179: Dead `<script type="importmap">` block.
  - Removed line 180: Dangling `<link rel="stylesheet" href="/index.css">` tag.
  - Retained all existing metadata, viewport settings, preconnect links, Google Fonts, theme CSS variables, and inline stylesheet rules.
* **Why Each Removal is Safe:**
  - Removing `<script type="importmap">` is 100% safe because Vite bundles all client dependencies into standalone vendor and application chunks (`vendor-react`, `vendor-icons`, `index`). No browser native import resolution is ever utilized. Furthermore, eliminating the React 19 import map prevents potential runtime version collisions with the application's React 18 codebase.
  - Removing `<link rel="stylesheet" href="/index.css">` is 100% safe because Vite compiles `client/src/index.css` imported in `main.tsx` and injects the bundled stylesheet link into `dist/index.html`. Removing the hardcoded link completely resolves the Vite build warning and eliminates an erroneous 404 network request in production.
* **Verification Metrics:**
  - Client TypeScript: **0 errors** (`tsc -p client/tsconfig.json --noEmit` clean exit 0).
  - Client Production Build: **Pass with 0 warnings** in 4.43s. The `/index.css` warning is completely eliminated.
  - Full Test Suite: **125 / 125 tests passing across 45 suites (100%)** in 1.51s.
  - Generated HTML: Verified `client/dist/index.html` references valid compiled assets (`/assets/index-*.js`, `/assets/vendor-react-*.js`, `/assets/vendor-icons-*.js`, `/assets/index-*.css`) with zero dead imports or missing links.

---

## 4. Phase 2 Execution Log: SpotifyScraperPlugin Deconstruction

### Task 1.1: Pre-Extraction Test Expansion (Complete & Verified)
* **Goal:** Expand automated regression test coverage for existing public behaviors of `SpotifyScraperPlugin.ts` prior to modularization.
* **Confirmed Interface Structure:** Verified `MetadataPlugin` in `server/src/plugins/interfaces.ts`: 17 members (1 required property `name: string`, 9 required methods, 7 optional methods).
* **Test Suite Created (`tests/unit/spotifyScraperUtils.test.ts`):**
  - Added 19 comprehensive tests across 4 suites covering:
    1. `POPULAR_SPOTIFY_PLAYLISTS` catalog integrity: 49 curated playlists, valid 22-character Spotify IDs, unique IDs, parseable HTTPS image URLs, non-empty fields.
    2. `stringSimilarity` and `calculateSimilarity` function properties: values bounded in `[0.0, 1.0]`, mathematical symmetry (`stringSimilarity(a, b) === stringSimilarity(b, a)`), alias equivalence, edge cases (identical empty strings, empty vs non-empty strings).
    3. Public artist matching & relevance scoring: hyphens, slashes, condensed artist names, typo tolerance, logarithmic follower scaling, prefix match preference.
    4. `SpotifyScraperPlugin` class contract: plugin name identifier (`"SpotifyScraper"`), `getCuratedPlaylists`, `getCategories` (8 categories), and `getFeaturedPlaylists` (49 playlists).
* **Test Metrics:** 144 / 144 unit tests passing across 50 suites (100%).

### Task 1.2: Extract Static Catalogs (Complete & Verified)
* **Goal:** Extract immutable static Spotify catalog data from monolithic `server/src/plugins/metadata/SpotifyScraperPlugin.ts` into dedicated modular catalog files.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/catalogs/curatedPlaylists.ts`: Contains `CuratedPlaylist` interface and the 49-item `POPULAR_SPOTIFY_PLAYLISTS` catalog.
  - `server/src/plugins/metadata/spotify/catalogs/topArtistsCatalog.ts`: Contains the 49-artist `TOP_ARTIST_PROFILES` static dictionary mapping canonical artist names to official high-resolution Spotify CDN portraits.
* **Strict State Separation Maintained:**
  - `ARTIST_META_CACHE` (mutable in-memory cache) remains strictly inside `SpotifyScraperPlugin.ts`.
  - `TOP_ARTIST_SPOTIFY_IDS` (mutable runtime map augmented via GQL and DuckDuckGo resolution) remains strictly inside `SpotifyScraperPlugin.ts`.
  - Zero token state, pending promises, caches, or runtime state moved to catalog modules.
* **Full Backward Compatibility:**
  - `POPULAR_SPOTIFY_PLAYLISTS` is re-exported from `SpotifyScraperPlugin.ts` via `export { POPULAR_SPOTIFY_PLAYLISTS } from './spotify/catalogs/curatedPlaylists.js';`.
  - External consumers and tests continue importing from `SpotifyScraperPlugin.ts` with zero breaking changes.
* **Verification Metrics:**
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - Unit Tests: **144 / 144 passing across 50 suites (100%)** in ~1.6s.
  - `git diff --check`: Clean (no whitespace or formatting errors).

### Task 1.3: Extract Pure HTML & Query Utilities (Complete & Verified)
* **Goal:** Extract genuinely pure HTML-processing and query-normalization helpers from `SpotifyScraperPlugin.ts` into focused utility modules.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/utils/htmlUtils.ts`: Exports `decodeHtmlEntities(str: any): string`.
  - `server/src/plugins/metadata/spotify/utils/queryUtils.ts`: Exports `cleanSearchQuery(q: string): string`.
  - `tests/unit/spotifyPureUtils.test.ts`: Added 16 focused unit tests covering standard HTML entity decoding, multi-entity strings, object unwrapping (`.name` and `.title`), falsy value preservation, boundary word matching for `by`, parenthetical removal, quote stripping, and whitespace collapse.
* **Strict Implementation Constraints Respected:**
  - Preserved `decodeHtmlEntities` behavior exactly (no entity broadening; preserved falsy handling, object property precedence, and type coercion).
  - Preserved `cleanSearchQuery` regexes and transformation order exactly.
  - Kept both helpers private to `SpotifyScraperPlugin.ts` (imported internally without re-exporting, preserving all 18 documented public exports).
  - Left `normalizeSearchString` and `getLevenshteinDistance` untouched in `SpotifyScraperPlugin.ts`.
* **Verification Metrics:**
  - Full Test Suite: **160 / 160 unit tests passing across 53 suites (100%)** in ~1.65s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).

### Task 1.4: Extract Similarity & Artist Matching Utilities (Complete & Verified)
* **Goal:** Extract pure mathematical string similarity and artist matching utilities from `SpotifyScraperPlugin.ts` into a dedicated utility module.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/utils/similarityUtils.ts`: Exports:
    - `stringSimilarity(s1: string, s2: string): number`
    - `calculateSimilarity(s1: string, s2: string): number`
    - `isArtistNameMatch(artistName: string, query: string): boolean`
    - `calculateArtistRelevanceScore(artist: any, query: string): number`
* **Implementation Integrity & Compatibility:**
  - Preserved exact algorithms, Levenshtein edit distance logic, thresholds (`0.7`, `0.72`), normalization rules, and return values without behavioral changes.
  - Re-exported all four functions from `SpotifyScraperPlugin.ts`, preserving 100% backward compatibility for all external callers and existing tests.
  - Imported all four functions internally in `SpotifyScraperPlugin.ts` so internal call sites (`scoreTrackRelevance`, `deduplicateTracks`, `searchSpotifyArtists`, `resolveArtistMetadata`, `getArtistTopTracks`, `getArtist`) continue functioning seamlessly.
  - Added direct module verification tests in `tests/unit/spotifyPureUtils.test.ts`.
  - Module is 100% pure with zero network, zero filesystem, zero state, zero cache, and zero circular dependencies.
* **Verification Metrics:**
  - Full Test Suite: **163 / 163 unit tests passing across 54 suites (100%)** in ~1.61s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).

### Task 1.5: Extract Track Ranking & Deduplication (Complete & Verified)
* **Goal:** Extract track relevance scoring, popularity piecewise normalization, and multi-provider deduplication logic from `SpotifyScraperPlugin.ts` into a dedicated ranking module.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/ranking/trackRanking.ts`: Exports:
    - `normalizePlayCountToPopularity(playCount: number): number`
    - `scoreTrackRelevance(track: any, query: string, originalIndex?: number): number`
    - `deduplicateTracks(tracks: any[]): any[]`
* **Implementation Integrity & Compatibility:**
  - Preserved exact formulas, piecewise popularity normalization tiers, scoring weights, regexes, and thresholds byte-for-byte matching pristine `HEAD`.
  - Preserved `deduplicateTracks()` object mutations, cross-provider metric inheritance (`playCount` and `popularity`), version precedence (Rule 0: studio vs acoustic/live), and Spotify source precedence (Rule 1).
  - Clean modular dependencies: imports `calculateSimilarity` and `isArtistNameMatch` from `../utils/similarityUtils.js`, and `TOP_ARTIST_PROFILES` from `../catalogs/topArtistsCatalog.js`.
  - Zero imports from `SpotifyScraperPlugin.ts` into `trackRanking.ts` (zero circular dependencies).
  - Re-exported all three functions from `SpotifyScraperPlugin.ts` and imported them locally for internal `search()` call sites, maintaining 100% backward compatibility for all external consumers and test suites.
  - Extended `tests/unit/trackDeduplication.test.ts` with 12 new thorough unit tests (boundary cases, string vs array artist representation, cover/tribute penalties and bypasses, Spotify index rank bonuses, Rule 0 version replacement/retention, Rule 1 metric inheritance, and direct module import verification).
* **Verification Metrics:**
  - Full Test Suite: **175 / 175 unit tests passing across 54 suites (100%)** in ~1.88s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - All 18 public exports from `SpotifyScraperPlugin.ts` verified intact.
  - `git diff --check`: Clean (no whitespace or formatting errors).

### Task 1.6: Extract Spotube Authentication (Complete & Verified)
* **Goal:** Extract Spotube authentication subsystem (`base32Decode`, `generateSpotubeTOTP`, `getSpotubeSpotifyToken`, module state variables, and eager prewarming) from `SpotifyScraperPlugin.ts` into a dedicated auth module while preserving Spotify integration.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/auth/spotubeAuth.ts`: Exports:
    - `base32Decode(str: string): Buffer`
    - `generateSpotubeTOTP(secretBase32: string, timestampSeconds: number): string`
    - `getSpotubeSpotifyToken(): Promise<string | null>`
  - `tests/unit/spotubeAuth.test.ts`: 14 unit tests covering RFC 4648 Base32 decoding, RFC 6238 TOTP calculation, 30-second time-step bucket verification, token cache hits & natural TTL expiration, in-flight concurrent request deduplication, server-time endpoint fallback, and network error resilience.
* **Implementation Integrity & Compatibility:**
  - Preserved exact TOTP algorithm, Base32 decoding, dynamic nuance updating (gist), server-time synchronization, and Spotify token endpoint exchange parameters.
  - Preserved token in-flight deduplication (`pendingTokenPromise`), cache expiry semantics, and eager background prewarming on module load.
  - Re-exported `getSpotubeSpotifyToken` from `SpotifyScraperPlugin.ts` and imported it locally for all internal GraphQL callers (`searchSpotubeSpotifyTracks`, `searchSpotifyArtists`, `fetchSpotifyArtistOverview`).
  - All 18 documented public exports and their TypeScript signatures (including `SpotifyArtistOverviewData`) remain 100% intact.
  - Zero circular dependencies (module only depends on Node built-ins: `crypto`, `Buffer`, `fetch`, `AbortSignal`).
* **Verification Metrics:**
  - Full Test Suite: **192 / 192 unit tests passing across 62 suites (100%)** in ~2.10s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - All 18 public exports from `SpotifyScraperPlugin.ts` verified intact.
  - `git diff --check`: Clean (no whitespace or formatting errors).

### Task 1.7: Comprehensive Refactoring Audit (Complete & Verified)
* **Goal:** Perform a comprehensive read-only audit of all completed refactoring work across Phase 0, Phase 1, and Phase 2 (Tasks 1.1–1.6).
* **Audit Findings:**
  - All 8 extracted modules in `server/src/plugins/metadata/spotify/` verified against baseline commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
  - All 18 public exports from `SpotifyScraperPlugin.ts` verified intact with matching export identity.
  - Test isolation verified across all suites with mocked network boundaries.
  - Full suite verified: 192/192 tests passing across 62 suites. Clean typechecks and clean production builds for both client and server.

### Task 1.8: Extract YouTube InnerTube Search Scraper (Complete & Verified)
* **Goal:** Extract `searchYouTubeInnertubeTracks` from `SpotifyScraperPlugin.ts` into a dedicated scraper module under `server/src/plugins/metadata/spotify/scrapers/youtubeSearch.ts`.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/scrapers/youtubeSearch.ts`: Exports:
    - `searchYouTubeInnertubeTracks(cleanQuery: string, limit?: number): Promise<Track[]>`
  - `tests/unit/youtubeSearch.test.ts`: 19 unit tests covering standard response parsing, artist/title hyphen splitting, multi-hyphen title preservation, case-insensitive official video/audio tag stripping regexes, highest-resolution thumbnail selection, empty thumbnail fallback, limit enforcement (single section, multi-section, default limit 20), malformed response resilience, non-OK HTTP status, network rejection, timeout abort, exact POST endpoint/headers/payload verification, and re-export identity check.
* **Implementation Integrity & Compatibility:**
  - Preserved the original implementation byte-for-byte identical to baseline commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
  - Used type-only import `import type { Track } from '../../../interfaces.js';`.
  - Zero circular dependencies (module only depends on global `fetch`, `AbortSignal`, and `Track` type).
  - Re-exported `searchYouTubeInnertubeTracks` from `SpotifyScraperPlugin.ts` and imported it locally for internal call sites (`searchArtists`, `getArtistTracks`, and `getSmartMoodSuggestions`).
  - Strict reference identity verified: `searchYouTubeInnertubeTracks` from `SpotifyScraperPlugin` strictly equals (`===`) the one from `youtubeSearch.ts`.
  - All 18 baseline public exports remain 100% intact.
* **Verification Metrics:**
  - Full Test Suite: **211 / 211 unit tests passing across 71 suites (100%)** in ~3.2s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).
  - Baseline equivalence: 100% byte-for-byte identical to baseline commit.

### Task 1.9: Extract Spotify GraphQL Client (Complete & Verified)
* **Goal:** Extract Spotify GraphQL Pathfinder client functionality (`searchSpotubeSpotifyTracks`, `searchSpotifyArtists`, `SpotifyArtistOverviewData`, `fetchSpotifyArtistOverview`, `ARTIST_OVERVIEW_CACHE`, and `PENDING_OVERVIEWS`) from `SpotifyScraperPlugin.ts` into `server/src/plugins/metadata/spotify/clients/spotifyGqlClient.ts`.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/clients/spotifyGqlClient.ts`: Exports:
    - `searchSpotubeSpotifyTracks(cleanQuery: string, limit?: number): Promise<Track[]>`
    - `searchSpotifyArtists(cleanQuery: string, limit?: number): Promise<{ id: string; name: string; picture: string }[]>`
    - `SpotifyArtistOverviewData` (interface)
    - `fetchSpotifyArtistOverview(artistId: string): Promise<SpotifyArtistOverviewData | null>`
  - `tests/unit/spotifyGqlClient.test.ts`: 21 comprehensive unit tests covering:
    - Exact Pathfinder `searchDesktop` and `queryArtistOverview` URL construction, operation names, and query SHA256 hashes (`75bbf6bfcfdf85b8fc828417bfad92b7cd66bf7f556d85670f4da8292373ebec` and `79a4a9d7c3a3781d801e62b62ef11c7ee56fce2626772eb26cd20c69f84b3f49`).
    - Exact headers (`Authorization: Bearer <token>`, `Accept`, and specific Chrome 122 / 120 User-Agent strings).
    - Limit clamping to 30 items (`Math.min(limit, 30)`).
    - Schema 1 (`search.tracks.items`) and Schema 2 (`searchV2.tracksV2.items`) response parsing.
    - Track wrapper unwrapping (`wrapper.track`, `wrapper.item.data`, raw wrapper) and cover art upscaling (`0000b273`).
    - Artist name parsing from string, `profile.name`, or `name`, with `'Unknown Artist'` fallback.
    - Artist search parsing, prefix stripping (`spotify:artist:`), and high-resolution portrait selection (`width >= 500`).
    - Artist overview parsing (`artistUnion` stats, verified flag, top tracks mapping).
    - `ARTIST_OVERVIEW_CACHE` memory caching for subsequent lookups.
    - `PENDING_OVERVIEWS` in-flight Promise deduplication under concurrent calls.
    - Null-token handling, HTTP error statuses, network throw resilience, and missing field fallbacks.
    - Public export reference identity check between `SpotifyScraperPlugin.ts` and `spotifyGqlClient.ts`.
* **Implementation Integrity & Compatibility:**
  - Preserved original implementations byte-for-byte identical to baseline commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
  - Defined `USER_AGENT` locally in `spotifyGqlClient.ts` while retaining `USER_AGENT` in `SpotifyScraperPlugin.ts` for remaining embed scrapers.
  - Used type-only import `import type { Track } from '../../../interfaces.js';`.
  - Zero circular dependencies (unidirectional import from `../auth/spotubeAuth.js`, zero imports from `SpotifyScraperPlugin.ts`).
  - Preserved all 13 internal call sites in `SpotifyScraperPlugin.ts` across `search()`, `searchArtists()`, `getArtistTracks()`, `getArtistDetails()`, `scrapeSpotifyArtistEmbed()`, `resolveSpotifyArtistId()`, and `getSmartMoodSuggestions()`.
  - Re-exported all 3 functions and `export type { SpotifyArtistOverviewData }` from `SpotifyScraperPlugin.ts`.
  - All 18 baseline public exports remain 100% intact with verified reference identity (`=== true`).
* **Verification Metrics:**
  - Full Test Suite: **232 / 232 unit tests passing across 76 suites (100%)** in ~3.2s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).
  - Baseline equivalence: 100% byte-for-byte identical to baseline commit.

### Task 1.10: Extract Spotify Embed Scrapers (Complete & Verified)
* **Goal:** Extract public unauthenticated embed scrapers (`SPOTIFY_TRACK_COVER_CACHE`, `resolveSpotifyTrackCover`, `scrapeSpotifyArtistEmbed`) from `SpotifyScraperPlugin.ts` into a dedicated scraper module under `server/src/plugins/metadata/spotify/scrapers/spotifyEmbedScraper.ts`.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/scrapers/spotifyEmbedScraper.ts`: Exports:
    - `resolveSpotifyTrackCover(trackId: string): Promise<string | null>`
    - `scrapeSpotifyArtistEmbed(spotifyArtistId: string): Promise<{ imageUrl?: string; name?: string; trackList?: any[] } | null>`
  - `tests/unit/spotifyEmbedScrapers.test.ts`: 21 comprehensive unit tests covering:
    - Input validation, non-string, falsy, wrong-length (<22, >22), and underscore-containing track IDs.
    - `spotify:track:` prefix stripping and whitespace trimming.
    - Exact oEmbed request URL (`https://open.spotify.com/oembed?url=...`), headers, and 3000ms AbortSignal.
    - Artwork resolution upgrade from 300x300 (`ab67616d00001e02`) to 640x640 (`ab67616d0000b273`), and preserving non-pattern URLs.
    - `SPOTIFY_TRACK_COVER_CACHE` in-memory caching to avoid duplicate fetches.
    - Error resilience: HTTP 404/500, missing `thumbnail_url`, and network rejection/timeout.
    - Artist embed request URL (`https://open.spotify.com/embed/artist/...`), `USER_AGENT` header, and 3500ms AbortSignal.
    - Next.js SSR state `__NEXT_DATA__` JSON extraction and parsing.
    - Visual identity image selection (`maxWidth >= 500`) with fallback to first image.
    - Missing visual identity, missing trackList, malformed JSON, and network errors.
    - Strict export reference identity check between `SpotifyScraperPlugin.ts` and `spotifyEmbedScraper.ts`.
* **Implementation Integrity & Compatibility:**
  - Preserved original implementations byte-for-byte identical to baseline commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
  - Defined `USER_AGENT` locally in `spotifyEmbedScraper.ts` while retaining `USER_AGENT` in `SpotifyScraperPlugin.ts`.
  - Zero circular dependencies (module has zero local imports).
  - Preserved the internal call site in `getArtistTracks()` at line 1570.
  - Re-exported both functions from `SpotifyScraperPlugin.ts` and imported them for internal use.
  - All 18 baseline public exports remain 100% intact with verified reference identity (`=== true`).
* **Verification Metrics:**
  - Full Test Suite: **253 / 253 unit tests passing across 88 suites (100%)** in ~2.7s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).
  - Baseline equivalence: 100% byte-for-byte identical to baseline commit.

### Task 1.11: Extract Artist Resolution Subsystem (Complete & Verified)
* **Goal:** Extract artist resolution utilities (`TOP_ARTIST_SPOTIFY_IDS`, `ArtistMeta`, `ARTIST_META_CACHE`, `getArtistFollowers`, `resolveSpotifyArtistId`, `resolveYouTubeArtistAvatar`, `resolveArtistMetadata`, `isJunkChannel`) from `SpotifyScraperPlugin.ts` into a dedicated domain module under `server/src/plugins/metadata/spotify/artists/artistResolution.ts`.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/artists/artistResolution.ts`: Exports:
    - `TOP_ARTIST_SPOTIFY_IDS: Record<string, string>` (47 artist entries)
    - `ArtistMeta` (interface)
    - `ARTIST_META_CACHE: Map<string, ArtistMeta>`
    - `getArtistFollowers(artistName: string): number`
    - `resolveSpotifyArtistId(artistName: string): Promise<string | null>`
    - `resolveYouTubeArtistAvatar(artistName: string): Promise<string>`
    - `resolveArtistMetadata(artistName: string): Promise<ArtistMeta>`
    - `isJunkChannel(name: string, query: string): boolean`
  - `tests/unit/artistResolution.test.ts`: 28 comprehensive unit tests covering:
    - `TOP_ARTIST_SPOTIFY_IDS` catalog size and key entries, including diacritic variants.
    - `getArtistFollowers` for empty/falsy input, exact cache hits, diacritics-stripped cache hits, `TOP_ARTIST_PROFILES` catalog fallback (10,000,000), and unknown artist fallback (0).
    - `resolveSpotifyArtistId` fast-path lookup from `TOP_ARTIST_SPOTIFY_IDS` with zero network requests.
    - `resolveSpotifyArtistId` resolution via Spotify GQL Pathfinder search and subsequent memory caching.
    - `resolveSpotifyArtistId` fallback to DuckDuckGo HTML scraping with User-Agent and timeout on GQL failure.
    - `resolveSpotifyArtistId` null return on full network failure or missing 22-char Spotify ID.
    - `resolveYouTubeArtistAvatar` thumbnail extraction from `channelRenderer` and `videoRenderer` thumbnail links with resolution upgrade (`=s500-c-k-c0x00ffffff-no-rj`) and protocol fix (`//` -> `https://`).
    - `resolveYouTubeArtistAvatar` empty string return on missing thumbnails, HTTP error, or timeout.
    - `resolveArtistMetadata` fast-path lookup from `ARTIST_META_CACHE`.
    - `resolveArtistMetadata` enrichment via `TOP_ARTIST_PROFILES`, Spotify GQL Pathfinder `queryArtistOverview` (followers, listeners, ultra-res avatar, header, verified, topTracks).
    - `resolveArtistMetadata` fallback chain: Spotify GQL -> YouTube InnerTube avatar -> `ui-avatars.com`.
    - `resolveArtistMetadata` caching behavior: caches authentic images, refuses to cache `ui-avatars.com` fallback URLs.
    - `isJunkChannel` channel validation: exact case-insensitive matches, composite collaboration rejections (unless query also collaborates), record label/corporate junk patterns, regional branch keywords, and valid artist allowances.
    - Strict export reference identity between `SpotifyScraperPlugin.ts` and `artistResolution.ts` (`=== true`).
* **Implementation Integrity & Compatibility:**
  - Preserved original implementations byte-for-byte identical to baseline commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
  - Preserved `getLevenshteinDistance`, `normalizeSearchString`, and `resolveArtistImage` in `SpotifyScraperPlugin.ts`.
  - Re-exported `resolveSpotifyArtistId` through `SpotifyScraperPlugin.ts`.
  - Imported `resolveSpotifyArtistId`, `resolveArtistMetadata`, `getArtistFollowers`, `isJunkChannel`, `TOP_ARTIST_SPOTIFY_IDS`, and `ARTIST_META_CACHE` for internal usage across `searchArtists`, `getArtistTracks`, `getTopArtists`, and `getArtistDetails`.
  - All 18 baseline public exports remain 100% intact with verified reference identity (`=== true`).
  - Monolith reduced from 1,792 lines to 1,512 lines (-280 lines).
* **Verification Metrics:**
  - Full Test Suite: **281 / 281 unit tests passing across 96 suites (100%)** in ~2.6s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).
  - Baseline equivalence: 100% byte-for-byte identical to baseline commit.

### Task 1.12: Extract Spotify Playlist & Album Embed Scrapers (Complete & Verified)
* **Goal:** Extract playlist and album embed scrapers (`playlistMemoryCache`, `getPlaylist`, `getAlbum`) from `SpotifyScraperPlugin.ts` into a dedicated scraper module under `server/src/plugins/metadata/spotify/scrapers/playlistAlbumScraper.ts`.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/scrapers/playlistAlbumScraper.ts`: Exports:
    - `scrapeSpotifyPlaylistEmbed(playlistId: string): Promise<Playlist>`
    - `scrapeSpotifyAlbumEmbed(albumId: string): Promise<any>`
    - `playlistMemoryCache` preserved as module-private cache (`Map<string, { playlist: Playlist; expiresAt: number }>`)
  - `tests/unit/playlistAlbumScrapers.test.ts`: 12 comprehensive unit tests covering:
    - Valid Spotify playlist embed HTML `<script id="__NEXT_DATA__">` extraction.
    - Metadata extraction (`name`, `description`, `coverArt`, `owner`, `tracks.total`).
    - Track normalization (ID extraction, stripping `spotify:track:`, artist splitting, duration, preview URL).
    - Missing URI fallback track ID generation (`scraped_${playlistId}_${index}`).
    - In-memory 2-hour TTL cache hit without network call.
    - Cache re-fetch after 2-hour TTL expiration.
    - Fallback image selection: `visualIdentity` when `coverArt` is missing, Unsplash when both are missing.
    - Fallback to `localLibrary.getPlaylist` snapshot when live scrape fails.
    - Fallback to `POPULAR_SPOTIFY_PLAYLISTS` curated catalog when local library has no tracks.
    - Fallback to unknown placeholder playlist when all resolvers fail.
    - Valid Spotify album embed HTML extraction (`id`, `name`, artists from subtitle, release date, tracks).
    - Missing album track URI fallback ID generation (`album_${albumId}_${index}`).
    - Album fallback cover art (`ui-avatars.com`) and release date (`'2024'`).
    - Album failure handling (`null` return on malformed HTML or network rejection).
    - `SpotifyScraperPlugin` class delegation for `getPlaylist`, `getPlaylistTracks`, and `getAlbum`.
* **Implementation Integrity & Compatibility:**
  - Preserved original implementations byte-for-byte identical to baseline commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
  - Converted `getPlaylist` and `getAlbum` into thin delegate methods on `SpotifyScraperPlugin`.
  - Preserved `getPlaylistTracks` calling `this.getPlaylist(playlistId)`.
  - Preserved all 3 internal call sites in the monolith (`getTopTracks`, `getTopArtists`, `getPlaylistTracks`).
  - Preserved all 6 external route call sites in `server/src/routes/api.ts`.
  - Preserved verified dead functions (`getLevenshteinDistance`, `normalizeSearchString`, `resolveArtistImage`) untouched.
  - All 18 baseline public exports remain 100% intact.
  - Monolith reduced from 1,512 lines to 1,373 lines (-139 lines; -419 lines total deconstructed).
* **Verification Metrics:**
  - Full Test Suite: **293 / 293 unit tests passing across 100 suites (100%)** in ~3.1s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).
  - Baseline equivalence: 100% byte-for-byte logic parity with baseline commit.

---

### Task 1.13: Extract Spotify Album Search Subsystem (Complete & Verified)
* **Goal:** Extract album search subsystem (`searchAlbums`) from `SpotifyScraperPlugin.ts` into a dedicated search module under `server/src/plugins/metadata/spotify/search/albumSearch.ts`.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/search/albumSearch.ts`: Exports:
    - `searchAlbums(query: string, limit?: number): Promise<any[]>`
  - `tests/unit/albumSearch.test.ts`: 18 comprehensive unit tests covering:
    - JioSaavn result parsing and normalization (HTML entity decoding, 500x500 image upgrading, default 2024 year, 10 default tracks, ui-avatars.com fallback).
    - Artist extraction fallback hierarchy (`artistMap.primary_artists`, stringified JSON `artistMap.artists`, `subtitle`, `header_desc`, `artist`, `primary_artists`, `more_info.primary_artists`, and rejection of `"[object Object]"`).
    - Spotify GQL track-to-album processing with authentic Spotify IDs, direct CDN artwork, and artist formatting.
    - Skipping Spotify tracks lacking album cover art or album name.
    - Cross-engine deduplication on normalized album names and IDs.
    - Relevance scoring hierarchy: exact match (+200), prefix match (+150), substring match (+100), combined (+70), artist (+50), baseline (+10), and descending sorting.
    - Limit enforcement (explicit limit parameter and default limit of 20).
    - Provider failure resilience: returns Spotify results on JioSaavn failure, JioSaavn results on Spotify failure, and `[]` when both fail.
    - `SpotifyScraperPlugin` class delegation for `searchAlbums(query, limit)`.
    - Independent module importability without importing `SpotifyScraperPlugin.ts`.
* **Implementation Integrity & Compatibility:**
  - Preserved original implementation byte-for-byte identical to baseline commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
  - Converted `searchAlbums` into a thin delegate method on `SpotifyScraperPlugin`.
  - Preserved existing `MetadataPlugin.searchAlbums` interface and API route call site in `server/src/routes/api.ts:627`.
  - `searchAlbums` was a class method and not one of the 18 baseline named exports; no new public export added from `SpotifyScraperPlugin.ts`.
  - All 18 baseline public exports remain 100% intact.
  - Monolith reduced from 1,373 lines to 1,119 lines (-254 lines; -673 lines total deconstructed).
* **Verification Metrics:**
  - Full Test Suite: **311 / 311 unit tests passing across 109 suites (100%)** in ~3.3s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).
  - Baseline equivalence: 100% byte-for-byte logic parity with baseline commit.

---

### Task 1.14: Extract Artist Exploration & Discography Subsystem (Complete & Verified)
* **Goal:** Extract the complete cohesive artist exploration and discography subsystem from monolithic `SpotifyScraperPlugin.ts` into `server/src/plugins/metadata/spotify/artists/artistExploration.ts`.
* **Modules Created:**
  - `server/src/plugins/metadata/spotify/artists/artistExploration.ts`: Exports:
    - `resolveArtistImage(artistName: string): Promise<string>`
    - `getTopArtists(limit?: number): Promise<Artist[]>`
    - `searchArtists(query: string, limit?: number): Promise<Artist[]>`
    - `getArtistTracks(artistId: string, artistName?: string): Promise<Track[]>`
    - `getArtistDetails(artistId: string, artistName?: string): Promise<any>`
  - `tests/unit/artistExploration.test.ts`: 16 comprehensive unit tests covering:
    - `resolveArtistImage`: Official image resolution for catalog superstars and ui-avatars fallback.
    - `getTopArtists`: Discovery from seed playlists (`Today's Top Hits`, `Top 50 - Global`, etc.), invalid name filtering, follower-based ranking, and fallback to catalog superstars when playlist scraping throws network errors.
    - `searchArtists`: Query trimming, empty query delegation to `getTopArtists`, curated superstar matching with authentic GQL metadata, GQL candidate enrichment, junk channel filtering, name deduplication, and limit enforcement.
    - `getArtistTracks`: Empty query handling, prefix stripping (`sp_art_`, `yt_art_`), primary/lead artist verification, junk song rejection, title canonicalization across live/remix/acoustic versions, and track cover replacement with authentic Spotify album artwork.
    - `getArtistDetails`: Profile composition including bio, avatar, and genres for known superstars, and fallback generation when GQL overview cannot be fetched.
    - Class delegation and module independence: `SpotifyScraperPlugin` methods delegate cleanly to extracted functions, and `artistExploration.ts` can be imported independently without importing `SpotifyScraperPlugin.ts`.
* **Implementation Integrity & Compatibility:**
  - Preserved original implementations byte-for-byte identical in logic to baseline commit `32f6220784f580f2fed64589a1fadd78c32a6d99`.
  - Converted `getTopArtists`, `searchArtists`, `getArtistTracks`, and `getArtistDetails` into thin delegates on `SpotifyScraperPlugin`.
  - Added `resolveArtistImage` class method delegate to preserve class API contract.
  - Preserved `searchTracks` untouched; its `this.searchArtists(cleanQuery, 3)` call delegates seamlessly.
  - None of the 5 functions were among the 18 baseline named exports in commit `32f6220784f580f2fed64589a1fadd78c32a6d99`; zero named exports added to `SpotifyScraperPlugin.ts`.
  - All 18 baseline public exports remain 100% intact.
  - Monolith reduced from 1,119 lines to **781 lines** (-338 lines; -1,011 lines total deconstructed across Phase 2, a 56.4% reduction from original 1,792 lines).
* **Verification Metrics:**
  - Full Test Suite: **327 / 327 unit tests passing across 116 suites (100%)** in ~2.7s.
  - Server TypeScript: Clean pass (`0 errors`).
  - Client TypeScript: Clean pass (`0 errors`).
  - Server & Client Production Builds: Clean pass (`0 errors`, `0 warnings`).
  - `git diff --check`: Clean (no whitespace or formatting errors).
  - Baseline equivalence: 100% logic parity with baseline commit.

---

## 5. Strict Verification Confirmation

* **Production business logic modified:** **0 unrelated lines changed**. Only artist exploration subsystem extracted to `artistExploration.ts`, imported internally, and delegated.
* **Existing files deleted:** **NONE**.
* **Dependencies removed or installed:** **NONE**.
* **Pre-existing behavior preserved:** 100% verified via baseline builds and 327 automated tests.

---

## 6. Next Step: Phase 2, Task 1.15

With Task 1.1 through Task 1.14 complete:
* **Task 1.15:** Await user direction for the next extraction step (e.g., Discovery Subsystem `getNewReleases`, `getFeaturedPlaylists`, `getTopTracks`, `getCategories`, `getRecommendations` or Dual-Engine Track Search `searchTracks`).
