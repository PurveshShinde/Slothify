# Contributing to Neko Music (Slothify) & Audio Services

Thank you for your interest in contributing to **Neko Music** (featuring the **Slothify** streaming client and **Saavn Audio Services** extension)! Open-source collaboration drives the reliability, speed, and privacy of this project.

Please take a few moments to review these guidelines before submitting bug reports, proposing enhancements, or creating pull requests.

---

## Code of Conduct

All contributors, maintainers, and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to maintain a respectful, welcoming, and harassment-free environment for everyone.

---

## Ecosystem Scope

The Neko Music ecosystem comprises two complementary codebases:

1. **Slothify Core Platform (`d:\Projects\Slothify\Slothify`)**:
   - **Frontend (`client/`)**: React 18, Vite 5, TypeScript, Tailwind CSS, Framer Motion.
   - **Backend (`server/`)**: Node.js, Express, TypeScript, Mongoose, Redis.
   - **Plugin Subsystems (`server/src/plugins/`)**: Spotify GraphQL/embed scraping, YouTube extraction, and audio routing.
2. **Saavn Audio Services Extension (`saavn-extension-main/slothify-audio-services`)**:
   - Ultra-low-latency edge microservice built on Hono and Bun.
   - Deployed to Cloudflare Workers for 320 kbps media stream decryption (DES-ECB) and direct CDN extraction.

Contributions to either or both components are welcomed.

---

## How Can I Contribute?

### 1. Reporting Bugs
Before filing an issue, please search existing issues to check if the bug has already been reported.

When opening a new bug report, include:
- **Clear Title**: Brief summary of the bug.
- **Environment**: Operating System, Node.js / Bun version, Browser (Chrome, Firefox, Safari, Brave), Viewport (Desktop / Mobile).
- **Reproduction Steps**: Clear, step-by-step instructions to reproduce the behavior.
- **Observed vs. Expected Behavior**: What actually happened vs. what you expected to happen.
- **Relevant Logs**: Terminal output or browser console logs (redact personal tokens, passwords, or recovery keys).

### 2. Suggesting Enhancements
Feature requests are always welcome!
- Explain **why** the feature is valuable and who benefits from it.
- Outline the proposed user experience or API interface.
- Provide links to relevant specifications, APIs, or open-source libraries if applicable.

### 3. Submitting Pull Requests (PRs)
- Keep PRs focused on a single feature, bug fix, or documentation update.
- Ensure all automated tests and typechecks pass before requesting review.
- Include screenshots or screen recordings for frontend UI changes.

---

## Development Workflow

### Step 1: Fork & Clone
1. Fork the repository to your GitHub account.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Slothify.git
   cd Slothify
   ```

### Step 2: Create a Feature Branch
Use descriptive branch naming following conventional prefixes:
- `feat/player-volume-normalization`
- `fix/saavn-stream-seek-timeout`
- `refactor/crypto-lru-cache`
- `docs/setup-instructions-update`

```bash
git checkout -b feat/your-feature-name
```

### Step 3: Install Dependencies
- **Core Platform**:
  ```bash
  npm install --prefix client
  npm install --prefix server
  ```
- **Saavn Audio Services**:
  ```bash
  cd ../saavn-extension-main/slothify-audio-services
  bun install
  ```

### Step 4: Make Your Changes & Test
- Adhere strictly to the project's coding standards.
- Run the test suite:
  ```bash
  # Root tests (Node native test runner with tsx)
  npm test
  
  # Typechecks
  npm run build --prefix client
  npm run build --prefix server
  ```

### Step 5: Commit Your Changes
We adhere to **Conventional Commits**:
- `feat:` New user-facing feature or capability.
- `fix:` Bug fix.
- `refactor:` Code reorganization without behavioral change.
- `perf:` Performance optimization.
- `docs:` Documentation updates.
- `test:` Adding or updating unit/integration tests.
- `chore:` Tooling, dependency, or configuration updates.

Example:
```bash
git commit -m "feat(player): add gapless transition between consecutive tracks"
```

### Step 6: Push & Open a Pull Request
1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request against the upstream `main` branch.
3. Fill out the PR template completely.

---

## Coding Standards & Architectural Guidelines

### 1. TypeScript & Type Safety
- Maintain strict typing throughout frontend and backend.
- Avoid the use of `any` where structured interfaces or generics can be applied.
- Ensure all newly introduced functions have clean type signatures and descriptive JSDoc comments.

### 2. Zero-Knowledge Cryptography Invariants
- **NEVER** transmit or persist unencrypted user library payloads (playlists, liked songs) to remote databases.
- All client library persistence must use AES-256-GCM encryption with keys derived via PBKDF2/scrypt.
- Never log plaintext secrets, recovery passphrases, or encryption keys in console logs or error reports.

### 3. Stateless Audio Provider Routing
- In `server/src/routes/audio.ts`, **never mutate global process-wide state** inside request handlers (e.g., avoid modifying `pluginRegistry.setActiveAudioPlugin()` during route resolution).
- Audio provider selection must remain request-scoped via `?provider=...` query parameters or `x-audio-provider` headers to maintain multi-tenant client isolation.

### 4. UI & Visual Design Principles
- Preserve the clean, modern aesthetic (inspired by Apple Music and Linear).
- Avoid cluttered neon glow blobs or artificial AI styling.
- Ensure components adapt gracefully to both visual themes:
  - **Ocean Breeze**: Deep navy `#071329`, cyan accents, cool ambient highlights.
  - **Autumn Ember**: Warm espresso `#140b07`, orange-amber accents, peach highlights.
- Support both **Normal** (modern square cover) and **Vintage** (rotating vinyl platter with audio visualizer waveform) player modes.

---

## Licensing & Attribution

By submitting a contribution to this project, you agree that your contribution will be licensed under the **MIT License** with attribution:

```
Copyright (c) 2026 Purvesh Shinde
```

Thank you for helping make Neko Music & Slothify better for everyone!

