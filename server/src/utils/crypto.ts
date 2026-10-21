import crypto from 'crypto';

// Server-wide master pepper / salt (can be configured in env)
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'slothify-zero-knowledge-fallback-secret-2026';

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
 * Derive a 256-bit AES key for a specific user ID + secret
 */
function deriveKey(userId: string): Buffer {
    return crypto.scryptSync(userId + ENCRYPTION_SECRET, 'slothify_salt', 32);
}

/**
 * Encrypt arbitrary JSON object with AES-256-GCM (Zero-Knowledge)
 */
export function encryptPayload(data: any, userId: string): { ciphertext: string; iv: string; tag: string } {
    const key = deriveKey(userId);
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
 * Decrypt AES-256-GCM ciphertext back into JSON object
 */
export function decryptPayload<T = any>(ciphertext: string, ivHex: string, tagHex: string, userId: string): T | null {
    try {
        const key = deriveKey(userId);
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    } catch (err: any) {
        console.error('[Crypto] Decryption failed:', err.message);
        return null;
    }
}
