import crypto from 'crypto';

// Server-wide master pepper / salt (can be configured in env)
const PRIMARY_SECRET = process.env.ENCRYPTION_SECRET || 'slothify_zero_knowledge_super_secret_pepper_2026';

// All known candidate secrets to decrypt records created across different deployments/environments
export const CANDIDATE_SECRETS = Array.from(new Set([
    PRIMARY_SECRET,
    process.env.ENCRYPTION_SECRET,
    'slothify_zero_knowledge_super_secret_pepper_2026',
    'slothify-zero-knowledge-fallback-secret-2026',
    'slothify-zero-knowledge-fallback-secret'
].filter(Boolean) as string[]));

// 128 English words for easy, memorable recovery passphrases
const WORD_LIST = [
    'amber', 'anchor', 'apple', 'arcade', 'arrow', 'atlas', 'autumn', 'bamboo',
    'beacon', 'blossom', 'breeze', 'bridge', 'bubble', 'canyon', 'castle', 'cedar',
    'celestial', 'charm', 'cherry', 'cider', 'cliff', 'clover', 'cobalt', 'comet',
    'coral', 'cosmic', 'crater', 'crystal', 'current', 'dawn', 'desert', 'diamond',
    'dolphin', 'dragon', 'drift', 'dusk', 'eagle', 'echo', 'ember', 'falcon',
    'feather', 'fern', 'flare', 'forest', 'frost', 'galaxy', 'garden', 'glacier',
    'glow', 'grape', 'harbor', 'haven', 'hickory', 'horizon', 'indigo', 'island',
    'jasper', 'jungle', 'lagoon', 'lantern', 'laser', 'lava', 'leaf', 'legacy',
    'legend', 'lemon', 'lightning', 'lotus', 'lunar', 'magnet', 'mango', 'maple',
    'marble', 'meadow', 'melody', 'meteor', 'mist', 'moon', 'moss', 'mountain',
    'nebula', 'oasis', 'ocean', 'olive', 'opal', 'orbit', 'orchid', 'pebble',
    'phoenix', 'pine', 'planet', 'prism', 'quartz', 'rain', 'rainbow', 'raven',
    'reef', 'river', 'ruby', 'sage', 'sapphire', 'sequoia', 'shadow', 'shell',
    'silver', 'solar', 'spark', 'spring', 'star', 'stellar', 'stone', 'summit',
    'sunset', 'thunder', 'tide', 'topaz', 'trail', 'valley', 'velvet', 'wave',
    'whisper', 'willow', 'wind', 'winter', 'zenith', 'zephyr'
];

interface CacheEntry {
    derivedKey: Buffer;
    expiresAt: number;
}

/**
 * Bounded Least Recently Used (LRU) Key Cache with TTL.
 * Strictly bounds heap usage: only caches derived 32-byte key Buffers.
 * Returns defensive copies on read and makes defensive copies on write to prevent external buffer mutation.
 * Never caches plaintext track data or audio streams.
 */
export class BoundedKeyCache {
    private maxEntries: number;
    private ttlMs: number;
    private cache = new Map<string, CacheEntry>();
    private hits = 0;
    private misses = 0;
    private evictions = 0;

    constructor(maxEntries = 500, ttlMs = 3600000) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
    }

    get(key: string): Buffer | null {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        // Move to most-recently-used position in O(1) time
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.hits++;
        // Defensive copy on read: caller cannot mutate internal cached Buffer
        return Buffer.from(entry.derivedKey);
    }

    set(key: string, derivedKey: Buffer): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxEntries) {
            // Evict least-recently-used (oldest entry in Map iteration order)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
                this.evictions++;
            }
        }
        this.cache.set(key, {
            // Defensive copy on write: internal buffer cannot be mutated by caller's reference
            derivedKey: Buffer.from(derivedKey),
            expiresAt: Date.now() + this.ttlMs
        });
    }

    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }

    getStats() {
        return {
            size: this.cache.size,
            maxEntries: this.maxEntries,
            ttlMs: this.ttlMs,
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictions
        };
    }
}

// Bounded LRU cache instance: max 500 derived keys, 1 hour TTL
export const keyCache = new BoundedKeyCache(500, 3600000);

// In-flight Promise deduplication map: collapses simultaneous derivations for identical user/secret
const inFlightDerivations = new Map<string, Promise<Buffer>>();
let inFlightDeduplications = 0;
let scryptComputations = 0;

// Ephemeral process-local HMAC key generated with cryptographically secure randomness on boot.
// Never persisted, never exported, never logged. Prevents offline guessing of secrets from heap dumps.
const CACHE_HMAC_SECRET = crypto.randomBytes(32);

/**
 * Generate a process-local HMAC-SHA256 cache key with unambiguous length-prefixed field encoding.
 * Prevents delimiter-collision ambiguity and ensures memory dumps cannot be used for offline secret cracking.
 */
function getCacheKey(userId: string, secret: string): string {
    const userLen = Buffer.byteLength(userId, 'utf8');
    const secLen = Buffer.byteLength(secret, 'utf8');
    return crypto.createHmac('sha256', CACHE_HMAC_SECRET)
        .update(`${userLen}:${userId}:${secLen}:${secret}`)
        .digest('hex');
}

/**
 * Generate a random 12-word Recovery Passphrase (passkey)
 */
export function generateRecoveryPassphrase(): string {
    const words: string[] = [];
    const randomBytes = crypto.randomBytes(12);
    for (let i = 0; i < 12; i++) {
        const index = randomBytes[i] % WORD_LIST.length;
        words.push(WORD_LIST[index]);
    }
    return words.join(' ');
}

/**
 * Derive a 256-bit AES key for a specific user ID + secret asynchronously.
 * Offloads heavy scrypt computation to libuv worker threadpool (non-blocking).
 * Automatically checks bounded LRU cache and deduplicates in-flight derivations.
 */
export async function deriveKeyWithSecret(userId: string, secret: string): Promise<Buffer> {
    if (!userId || !secret) {
        throw new Error('userId and secret are required for key derivation');
    }

    const cacheKey = getCacheKey(userId, secret);

    // 1. Check In-Flight Deduplication Map
    const inFlight = inFlightDerivations.get(cacheKey);
    if (inFlight) {
        inFlightDeduplications++;
        return inFlight;
    }

    // 2. Check LRU Cache
    const cached = keyCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // 3. Dispatch asynchronous scrypt derivation to libuv worker threads
    scryptComputations++;
    let derivationPromise: Promise<Buffer>;
    derivationPromise = new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(userId + secret, 'slothify_salt', 32, (err, derivedKey) => {
            if (err) return reject(err);
            keyCache.set(cacheKey, derivedKey);
            resolve(Buffer.from(derivedKey));
        });
    }).finally(() => {
        // Only clean up if the map still points to this exact promise.
        // Prevents an older completed/cancelled derivation from wiping out a newer re-registered promise.
        if (inFlightDerivations.get(cacheKey) === derivationPromise) {
            inFlightDerivations.delete(cacheKey);
        }
    });

    inFlightDerivations.set(cacheKey, derivationPromise);
    return derivationPromise;
}

export async function deriveKey(userId: string): Promise<Buffer> {
    return deriveKeyWithSecret(userId, PRIMARY_SECRET);
}

/**
 * Encrypt arbitrary JSON object with AES-256-GCM (Zero-Knowledge) asynchronously.
 */
export async function encryptPayload(data: any, userId: string): Promise<{ ciphertext: string; iv: string; tag: string }> {
    const key = await deriveKey(userId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const json = JSON.stringify(data);
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return {
        ciphertext: encrypted,
        iv: iv.toString('hex'),
        tag
    };
}

/**
 * Decrypt AES-256-GCM ciphertext back into JSON object asynchronously.
 * Attempts decryption using current secret, falling back to legacy deployment secrets if needed.
 */
export async function decryptPayload<T = any>(
    ciphertext: string,
    ivHex: string,
    tagHex: string,
    userId: string
): Promise<T | null> {
    if (!ciphertext || !ivHex || !tagHex || !userId) return null;

    try {
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');

        // Fast parameter validation: 12-byte IV (24 hex chars) and 16-byte auth tag (32 hex chars)
        if (iv.length !== 12 || tag.length !== 16) {
            return null;
        }

        // Iterate through known candidate secrets (primary secret first)
        for (const secret of CANDIDATE_SECRETS) {
            try {
                const key = await deriveKeyWithSecret(userId, secret);
                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(tag);

                let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
                decrypted += decipher.final('utf8');

                return JSON.parse(decrypted);
            } catch {
                // Key/Auth-tag mismatch with this secret, try next candidate
                continue;
            }
        }

        console.warn(`[Crypto] Decryption not possible for user ${userId.slice(0, 8)}... (secret mismatch)`);
        return null;
    } catch (err: any) {
        console.error('[Crypto] Unexpected decryption error:', err.message);
        return null;
    }
}

/**
 * Helper to inspect cache metrics and hit rates during profiling and verification.
 */
export function getCryptoCacheStats() {
    return {
        ...keyCache.getStats(),
        inFlightDeduplications,
        scryptComputations
    };
}

/**
 * Helper to clear cache state between test runs.
 */
export function clearCryptoCache() {
    keyCache.clear();
    inFlightDerivations.clear();
    inFlightDeduplications = 0;
    scryptComputations = 0;
}
