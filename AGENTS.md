# AI Agents & Automated Workflow Guidelines

This document establishes standard operating procedures, architectural invariants, and verification protocols for **AI Coding Assistants** (including Google Antigravity, Gemini CLI, Claude Code, GitHub Copilot, Cursor, and GPT-based agents) working on the **Neko Music (Slothify)** and **Saavn Audio Services** codebases.

---

## 1. Mandatory Directives for AI Assistants

Whenever performing modifications, refactoring, bug fixes, or feature updates in this repository, you **MUST** follow these core directives:

### Directive 1: Never Break Existing Tests or Builds
Before concluding your turn or claiming a task is complete, execute and observe clean runs for:
1. **Unit Test Suite**: `npm test` (executes all unit test suites via `scripts/run-tests.mjs`).
2. **Backend Typecheck**: `npm run build --prefix server` (or `tsc -p server/tsconfig.json --noEmit`).
3. **Frontend Typecheck**: `npm run build --prefix client` (or `tsc -p client/tsconfig.json --noEmit`).
4. **Never fabricate or assume test results**. Only report numbers and statuses directly observed from tool output.

### Directive 2: Maintain Documentation Integrity
- **`AI_README.md` Maintenance**: Update the Change Log in Section 8 of `AI_README.md` with:
  - Date, Author/AI model, files modified, and problem solved.
- **Preserve Comments & Docstrings**: Do not delete existing code comments, docstrings, or type definitions unless explicitly directed by the user.

### Directive 3: Respect Cryptographic & Privacy Invariants
- **Zero-Knowledge Security**: All stored user playlists and liked tracks in MongoDB must be encrypted via AES-256-GCM.
- **Never Log Secrets**: Never output plaintext recovery passphrases, encryption keys, or unencrypted user data to console logs or error reports.
- **Preserve Candidate Secret Fallback**: In `server/src/utils/crypto.ts`, all historical secrets in `CANDIDATE_SECRETS` must be preserved in exact order to maintain backward compatibility.

### Directive 4: Stateless Audio Routing & Multi-Tenant Isolation
- In `server/src/routes/audio.ts`, **NEVER** mutate process-wide global state (such as `pluginRegistry.setActiveAudioPlugin()`) inside HTTP request handlers.
- Provider resolution must remain request-scoped (`req.query.provider` or `req.headers['x-audio-provider']`) to guarantee multi-client isolation.

### Directive 5: UI Aesthetic Standards
- Maintain the minimalist, human-designed aesthetic inspired by Apple Music and Linear.
- Avoid tacky, oversaturated AI-style aesthetics (e.g., harsh triple-gradients, floating neon blobs, or nested frosted cards).
- All new UI elements must adapt seamlessly to both **Ocean Breeze** (cyan/blue) and **Autumn Ember** (amber/peach) themes.

---

## 2. Codebase Map & Subsystem Inventory

```
d:\Projects\Slothify\
├── Slothify/                               # Primary Full-Stack Application
│   ├── client/                             # React 18 / Vite 5 Frontend
│   │   ├── src/components/                 # Player, Turntable, Sidebar, Modals
│   │   ├── src/pages/                      # 14 Route pages (Home, Albums, Artists, etc.)
│   │   ├── src/context/                    # ThemeContext, CacheContext, SpotifyContext
│   │   ├── src/services/                   # audioService.ts (Audio lifecycle)
│   │   └── src/utils/                      # imageOptimizer.ts, trackParser.ts
│   ├── server/                             # Node.js / Express Backend
│   │   ├── src/models/                     # Mongoose models (User, EncryptedPlaylist, etc.)
│   │   ├── src/routes/                     # api.ts, audio.ts, auth.ts, saavn.ts, etc.
│   │   ├── src/plugins/                    # Audio & Metadata plugin engines
│   │   │   ├── metadata/spotify/           # Modular Spotify scraping subsystems
│   │   │   │   ├── auth/                   # Spotube TOTP authentication
│   │   │   │   ├── clients/                # Spotify Pathfinder GraphQL client
│   │   │   │   ├── scrapers/               # Playlist, album & YouTube scrapers
│   │   │   │   ├── ranking/                # Track relevance scoring & deduplication
│   │   │   │   └── artists/                # Artist exploration & resolution
│   │   │   └── audio/                      # JioSaavnAudioPlugin, YouTubeAudioPlugin
│   │   └── src/utils/                      # crypto.ts, timeout.ts
│   ├── tests/unit/                         # Node 24 native test suites (*.test.ts)
│   └── scripts/                            # run-tests.mjs, sync-version.mjs
└── saavn-extension-main/
    └── slothify-audio-services/            # Cloudflare Workers Edge Microservice
        ├── src/                            # Hono routes & DES-ECB media decrypters
        └── wrangler.toml                   # Cloudflare Workers deployment config
```

---

## 3. Standard Operating Procedures for AI Tasks

### Recipe A: Adding a New Unit Test
1. Create or open the relevant test file in `tests/unit/<name>.test.ts`.
2. Use Node.js native test runner:
   ```ts
   import test, { describe, it } from 'node:test';
   import assert from 'node:assert/strict';
   ```
3. Ensure the test mocks network boundaries (e.g., mock `fetch` or route resolvers) so tests run offline with zero external network dependencies.
4. Execute test validation:
   ```bash
   npm test
   ```

### Recipe B: Adding a Backend Database Model
1. Define the Mongoose schema and TypeScript document interface in `server/src/models/<ModelName>.ts`.
2. Add necessary compound indexes to support high-frequency query patterns (e.g., `{ userId: 1, playedAt: -1 }`).
3. Avoid standalone single-field indexes when they are already covered by the leading prefix of a compound index.
4. Write a unit test in `tests/unit/` validating schema indexing definitions.

### Recipe C: Modifying Audio or Metadata Scrapers
1. Ensure the module conforms to `MetadataPlugin` or `AudioPlugin` interfaces in `server/src/plugins/interfaces.ts`.
2. Do not introduce circular dependencies between plugins and parent classes.
3. Validate scraping resilience against network timeouts, non-200 HTTP responses, and malformed HTML/JSON.
4. Always provide deterministic fallback structures rather than throwing uncaught errors.

---

## 4. Troubleshooting & Known Quirks

| Symptom | Cause | Remedy |
|:---|:---|:---|
| `MODULE_NOT_FOUND: jsonwebtoken` | Invoking `tsx --test` without `NODE_PATH` set to `server/node_modules`. | Always run tests via `npm test` (which executes `scripts/run-tests.mjs` with `NODE_PATH` pre-configured). |
| Windows Git `index.lock: Permission denied` | Terminal sandbox blocking write access to `.git/` directory. | Staging and commit operations on Windows require elevated permissions (`BypassSandbox: true`). |
| In-memory sort warning in MongoDB | Query with `.sort()` missing covering compound index. | Define compound index in schema matching query fields (e.g., `{ userId: 1, playedAt: -1 }`). |
| Vite `/index.css doesn't exist` build warning | Legacy `<link rel="stylesheet" href="/index.css">` tag in `index.html`. | Styles are bundled automatically via `import './index.css'` in `main.tsx`. Never link unbundled css directly in HTML. |

