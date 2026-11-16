# Security Policy & Zero-Knowledge Privacy Architecture

The **Neko Music** platform (including **Slothify** and **Saavn Audio Services**) is designed with zero-knowledge privacy, client data ownership, and defensive engineering at its core.

---

## 1. Reporting Security Vulnerabilities

We take the security of this project and the privacy of our users very seriously. If you discover a security vulnerability, please do **NOT** open a public GitHub issue.

### Private Reporting Process
1. Email your findings directly to the lead maintainer:
   - **Contact**: Purvesh Shinde
   - **Email**: [shindepurvesh007@gmail.com](mailto:shindepurvesh007@gmail.com)
2. Include in your report:
   - A detailed description of the vulnerability.
   - Proof-of-concept (PoC) code or step-by-step reproduction instructions.
   - The potential impact on users or host infrastructure.
3. **Response SLA**: You will receive an acknowledgment within **48 hours**, followed by regular progress updates until a patch is released.
4. **Coordinated Disclosure**: We request that you give us reasonable time to investigate and address the vulnerability before making any public disclosure.

---

## 2. Zero-Knowledge Cryptography Architecture

Slothify implements a zero-knowledge encryption architecture for all persistent user data stored in the database.

```
                  ┌──────────────────────────────────────────────┐
                  │                 User Secret                  │
                  │      (Account Password / 12-Word Key)        │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │          Asynchronous scrypt KDF             │
                  │   crypto.scrypt(userId + secret, salt, 32)   │
                  │   (Executed in libuv worker threadpool)      │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │             Derived AES-256 Key              │
                  │            (32-byte Binary Buffer)           │
                  └──────────────┬───────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
    ┌─────────────────────────┐     ┌──────────────────────────┐
    │     LRU Key Cache       │     │     AES-256-GCM Engine   │
    │  - Max 500 entries      │     │  - 12-byte random IV     │
    │  - 1-hour TTL           │     │  - 16-byte auth tag      │
    │  - Ephemeral HMAC-SHA256│     │  - Ciphertext output     │
    │  - In-flight deduplication    └────────────┬─────────────┘
    └─────────────────────────┘                  │
                                                 ▼
                                    ┌──────────────────────────┐
                                    │     MongoDB Document     │
                                    │ { ciphertext, iv, tag }  │
                                    └──────────────────────────┘
```

### 2.1 Key Derivation (`deriveKeyWithSecret`)
- **Algorithm**: `crypto.scrypt` with cost parameters yielding ~25-30ms derivation time.
- **Non-Blocking libuv Execution**: Key derivation is executed asynchronously using libuv worker threads (`UV_THREADPOOL_SIZE`), ensuring the Node.js event loop remains 100% responsive and non-blocking for concurrent I/O.
- **Salt**: Deterministic, domain-isolated salt (`slothify_salt`).

### 2.2 Bounded LRU Key Cache (`BoundedKeyCache`)
To prevent redundant CPU-heavy derivations when a user loads a 50-track playlist:
- **Capacity**: Bounded to at most **500 entries** to prevent memory exhaustion.
- **Expiration**: Strict 1-hour time-to-live (`ttlMs = 3,600,000`).
- **Memory Bound**: Only 32-byte derived key Buffers are stored. **Plaintext track metadata and decrypted audio streams are NEVER cached in memory**.
- **Defensive Buffer Immutability**: Returns defensive `Buffer.from()` copies on read and creates defensive copies on write, ensuring callers cannot mutate cached keys.
- **Keyed Ephemeral HMAC**: Cache keys are generated using an ephemeral `CACHE_HMAC_SECRET` (`crypto.randomBytes(32)`) generated in RAM on server boot. This prevents offline secret cracking from memory dumps.
- **In-Flight Deduplication**: Concurrent requests for the same user key collapse onto a single `Promise<Buffer>` using an in-flight derivation map, eliminating thundering herd threadpool spikes.

### 2.3 Candidate Secret Fallback
To prevent data loss across multi-environment deployments, `decryptPayload` attempts decryption using the primary server secret, then cleanly falls back sequentially across all valid historical secrets:
1. `process.env.ENCRYPTION_SECRET`
2. `'slothify_zero_knowledge_super_secret_pepper_2026'`
3. `'slothify-zero-knowledge-fallback-secret-2026'`
4. `'slothify-zero-knowledge-fallback-secret'`

Payloads that fail authentication with all candidate secrets return `null` safely without crashing the application.

---

## 3. Account Security & Recovery Passphrase

Slothify supports **zero-friction, private account creation**:
- **No Email or Phone**: Users register with only a `username` and `password`.
- **12-Word Recovery Passphrase**: Generated upon registration (`generateRecoveryPassphrase()`) using cryptographically secure random bytes mapped to a curated mnemonic wordlist.
- **Hashed Verification**: The server only stores `bcrypt.hash(password)` and `bcrypt.hash(recoveryPassphrase)`. Centralized master recovery keys do not exist.
- **Password Reset**: Users can reset their password exclusively by presenting their valid 12-word recovery passphrase. If a user loses both their password and recovery key, their encrypted data cannot be decrypted by anyone (including the developers).

---

## 4. Input Sanitization & Injection Defense

### 4.1 SQL & Script Injection Defense
- **Identifier Validation**: `validateArtistId()` validates incoming artist identifiers against strict regex patterns, immediately blocking queries containing `<script>`, `SELECT`, `DROP TABLE`, or suspicious control characters.
- **Mongoose Parameterization**: All MongoDB queries use parameterized Mongoose document queries (`findOne`, `find`, `deleteMany`), completely immune to NoSQL injection.
- **HTML Entity Decoding**: Track and album titles returned from public scrapers are sanitized with `decodeHtmlEntities()` to prevent Stored XSS attacks in client browsers.

### 4.2 Regex Injection Defense
- All dynamic username lookups use escaped regex metacharacters:
  ```ts
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  ```

---

## 5. Media Rights & Content Distribution Architecture

1. **No Media Hosting**: Neither Slothify nor the Saavn Audio Services extension hosts, uploads, or stores copyrighted audio or video files.
2. **Direct Source Streaming**: Audio resolution endpoints (`/api/audio/resolve` and Cloudflare Workers) resolve direct, publicly accessible CDN stream URLs hosted on JioSaavn and Google/YouTube servers. Audio data streams directly from source CDNs to the user's browser without passing through host storage.
3. **Third-Party Trademarks**: All artist names, track titles, and album artworks remain the intellectual property of their respective creators and copyright holders.

---

## 6. Privacy Policy & Data Collection

| Data Category | Collected? | Storage Location | Retention / Policy |
|:---|:---:|:---|:---|
| **Email / Phone / Identity** | **NO** | None | We never ask for or store personal identification. |
| **IP Addresses** | **NO** | None | No persistent IP access logging or tracking. |
| **Analytics / Telemetry** | **NO** | None | Zero third-party tracking scripts, pixels, or telemetry. |
| **Playlists & Liked Songs** | **YES** | MongoDB (Encrypted) | Encrypted via AES-256-GCM. Decryptable only with user credentials. |
| **Listening History** | **YES** | MongoDB (Plaintext) | Strictly capped at 100 entries. Can be purged anytime via Settings. |
| **Guest / Offline Data** | **YES** | Client `localStorage` | Stored exclusively on user's device. Never sent to cloud servers. |

Users have the right to permanently purge their account and all associated encrypted database records at any time via the **Settings -> Delete Account** interface.

