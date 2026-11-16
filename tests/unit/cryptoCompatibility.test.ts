import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  generateRecoveryPassphrase,
  encryptPayload,
  decryptPayload,
  deriveKey,
  deriveKeyWithSecret,
  BoundedKeyCache,
  getCryptoCacheStats,
  clearCryptoCache,
  CANDIDATE_SECRETS
} from '../../server/src/utils/crypto.js';

// Helper to encrypt a payload under a specific historical secret (legacy format for test fixtures)
function encryptWithHistoricalSecret(data: any, userId: string, secret: string) {
  const key = crypto.scryptSync(userId + secret, 'slothify_salt', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(data);
  let ciphertext = cipher.update(json, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag
  };
}

describe('Zero-Knowledge Crypto & Historical Compatibility', () => {
  beforeEach(() => {
    clearCryptoCache();
  });

  describe('Recovery Passphrase Generation', () => {
    it('generates a 12-word mnemonic passphrase', () => {
      const phrase = generateRecoveryPassphrase();
      assert.ok(phrase, 'Passphrase must not be empty');
      const words = phrase.split(' ');
      assert.equal(words.length, 12, 'Passphrase must consist of exactly 12 words');
    });

    it('consists only of valid lowercase alphabetic words', () => {
      const phrase = generateRecoveryPassphrase();
      const words = phrase.split(' ');
      for (const word of words) {
        assert.match(word, /^[a-z]+$/, `Word "${word}" must contain only lowercase letters`);
      }
    });

    it('generates non-identical passphrases across calls (cryptographically random)', () => {
      const p1 = generateRecoveryPassphrase();
      const p2 = generateRecoveryPassphrase();
      assert.notEqual(p1, p2, 'Subsequent passphrases must not match');
    });
  });

  describe('Round-trip Encryption & Decryption (Async)', () => {
    it('encrypts and decrypts structured JSON objects correctly', async () => {
      const userId = 'user_test_999';
      const samplePlaylist = {
        id: 'pl_123',
        name: 'My Chill Vibes',
        tracks: { total: 2, items: [{ track: { id: 't1', name: 'Song One' } }] }
      };

      const encrypted = await encryptPayload(samplePlaylist, userId);
      assert.ok(encrypted.ciphertext, 'Ciphertext must be present');
      assert.equal(encrypted.iv.length, 24, '12-byte IV must be 24 hex characters');
      assert.equal(encrypted.tag.length, 32, '16-byte Auth Tag must be 32 hex characters');

      const decrypted = await decryptPayload(encrypted.ciphertext, encrypted.iv, encrypted.tag, userId);
      assert.deepEqual(decrypted, samplePlaylist);
    });

    it('handles unicode, non-ASCII, and emoji content without corruption', async () => {
      const userId = 'user_unicode_777';
      const unicodeData = {
        title: 'दिल बेचारा • Dil Bechara (Arijit Singh) 🎶🔥',
        artist: 'रोहन & Привет',
        symbols: '日本語 / Français / Español'
      };

      const encrypted = await encryptPayload(unicodeData, userId);
      const decrypted = await decryptPayload(encrypted.ciphertext, encrypted.iv, encrypted.tag, userId);
      assert.deepEqual(decrypted, unicodeData);
    });
  });

  describe('Buffer Immutability & Defensive Copying', () => {
    it('protects cached key buffer from mutation by caller', async () => {
      const userId = 'buffer_protect_user';
      const secret = 'buffer_protect_sec';
      const key1 = await deriveKeyWithSecret(userId, secret);
      const originalHex = key1.toString('hex');

      // Caller mutates the returned buffer
      key1.fill(0);
      assert.equal(key1.toString('hex'), '0'.repeat(64));

      // Subsequent cache retrieval must return the untainted key
      const key2 = await deriveKeyWithSecret(userId, secret);
      assert.equal(key2.toString('hex'), originalHex);
      assert.notEqual(key2.toString('hex'), key1.toString('hex'));
    });

    it('BoundedKeyCache.set() copies the incoming buffer defensively', () => {
      const cache = new BoundedKeyCache(10, 10000);
      const mutableKey = Buffer.from('a'.repeat(32));
      cache.set('test_key', mutableKey);

      // Mutate the original buffer after passing to set()
      mutableKey.fill('z');

      // Cached value must remain pristine
      const fetched = cache.get('test_key');
      assert.equal(fetched?.toString('utf8'), 'a'.repeat(32));
    });
  });

  describe('Historical Candidate Secret Compatibility', () => {
    const userId = 'legacy_user_atlas_456';
    const legacyPayload = {
      playlistId: 'pl_legacy_101',
      name: 'Retro Hits 2026',
      trackCount: 42
    };

    const historicalSecrets = [
      'slothify_zero_knowledge_super_secret_pepper_2026',
      'slothify-zero-knowledge-fallback-secret-2026',
      'slothify-zero-knowledge-fallback-secret'
    ];

    for (const secret of historicalSecrets) {
      it(`successfully decrypts payloads encrypted with past secret: "${secret}"`, async () => {
        const encrypted = encryptWithHistoricalSecret(legacyPayload, userId, secret);
        const decrypted = await decryptPayload(
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.tag,
          userId
        );
        assert.deepEqual(
          decrypted,
          legacyPayload,
          `Failed to decrypt historical record encrypted under secret: ${secret}`
        );
      });
    }

    it('fails safely and returns null if encrypted with an unknown secret', async () => {
      const encrypted = encryptWithHistoricalSecret(legacyPayload, userId, 'completely_unknown_unauthorized_secret');
      const decrypted = await decryptPayload(encrypted.ciphertext, encrypted.iv, encrypted.tag, userId);
      assert.equal(decrypted, null, 'Must return null for unknown secrets without throwing');
    });

    describe('Fixed Legacy Ciphertext Fixtures (Pre-computed from main)', () => {
      const fixedFixtures = [
        {
          name: 'Primary default secret (2026)',
          userId: 'fixed_fixture_user_2026',
          ciphertext: '5587c289b6b26a1004890d2fe98f6ed9ca6228c4f9eaaff0320b2c367009ab07c59ac5f57957fe4da00441c60956ba32a673329e3c287ce33ccd10d2455939176f8d23ed271751962bfdf92c3360d4667995',
          iv: '0123456789abcdef01234567',
          tag: '858623bb3c2a283c15b37be820f47959',
          expected: { testId: 'legacy_fixture_v1', trackName: 'Sloth Beat 101', artists: ['DJ Sloth'] }
        },
        {
          name: 'Fallback secret (2026)',
          userId: 'fixed_fixture_user_2026',
          ciphertext: '58668cafe49807f25b365d8df9a9eebf3fae167371b954429dc9aeddb151f8bee4aa4aa7dda1b24cfa383d87e76201bde6ec93145092b585bf2285f1520d4f161473f726cfc7a08a1519066ef86de2d5ce0d',
          iv: '0123456789abcdef01234567',
          tag: '347d69c88005755f686776f1a163a4c7',
          expected: { testId: 'legacy_fixture_v1', trackName: 'Sloth Beat 101', artists: ['DJ Sloth'] }
        },
        {
          name: 'Legacy fallback secret (pre-2026)',
          userId: 'fixed_fixture_user_2026',
          ciphertext: '7ec8c720b3978e49ab0b957f1e4c78215f8e0326f8aa5d887b47e6d2e7af631122eec7264ed49127000b4b989950cc47a176e3949f0449f8babfde2accd6d8343703c0b4a6ae91c1bc7b4fdf008f292c2270',
          iv: '0123456789abcdef01234567',
          tag: '2be51a158f07c19de8b91fc7038a229e',
          expected: { testId: 'legacy_fixture_v1', trackName: 'Sloth Beat 101', artists: ['DJ Sloth'] }
        }
      ];

      for (const fix of fixedFixtures) {
        it(`decrypts pre-computed legacy fixture: ${fix.name}`, async () => {
          const decrypted = await decryptPayload(fix.ciphertext, fix.iv, fix.tag, fix.userId);
          assert.deepEqual(decrypted, fix.expected);
        });
      }
    });
  });

  describe('Process-Local HMAC Cache Key Isolation', () => {
    it('isolates cache entries by user and secret with length-prefixed encoding', async () => {
      // User 1: userId="user:1", secret="secret" -> len-prefix: 6:user:1:6:secret
      // User 2: userId="user", secret="1:secret" -> len-prefix: 4:user:8:1:secret
      // Without length-prefixing, simple delimiter concatenation might collide
      const key1 = await deriveKeyWithSecret('user:1', 'secret');
      const key2 = await deriveKeyWithSecret('user', '1:secret');

      assert.notEqual(key1.toString('hex'), key2.toString('hex'), 'Keys for distinct user/secret pairs must be distinct');
      const stats = getCryptoCacheStats();
      assert.equal(stats.size, 2, 'Cache must isolate distinct user/secret combinations under unique HMAC keys');
    });

    it('produces identical keys for identical user and secret parameters', async () => {
      const keyA = await deriveKeyWithSecret('user_stable', 'secret_stable');
      const keyB = await deriveKeyWithSecret('user_stable', 'secret_stable');
      assert.equal(keyA.toString('hex'), keyB.toString('hex'));
    });
  });

  describe('Tampering and Authentication Tag Verification', () => {
    const userId = 'tamper_test_user';
    const originalData = { secretNotes: 'Top secret playlist info' };

    it('detects corrupted ciphertext and returns null safely', async () => {
      const enc = await encryptPayload(originalData, userId);
      const corruptedCipher = (enc.ciphertext[0] === 'a' ? 'b' : 'a') + enc.ciphertext.slice(1);
      const result = await decryptPayload(corruptedCipher, enc.iv, enc.tag, userId);
      assert.equal(result, null, 'Tampered ciphertext must fail authentication and return null');
    });

    it('detects corrupted authentication tag and returns null safely', async () => {
      const enc = await encryptPayload(originalData, userId);
      const corruptedTag = enc.tag.slice(0, -1) + (enc.tag[enc.tag.length - 1] === '0' ? '1' : '0');
      const result = await decryptPayload(enc.ciphertext, enc.iv, corruptedTag, userId);
      assert.equal(result, null, 'Tampered auth tag must fail authentication and return null');
    });

    it('detects wrong userId and returns null safely (cannot decrypt other users data)', async () => {
      const enc = await encryptPayload(originalData, userId);
      const result = await decryptPayload(enc.ciphertext, enc.iv, enc.tag, 'different_user_999');
      assert.equal(result, null, 'Decrypting with a different userId must return null');
    });

    it('handles empty, null, or undefined parameters gracefully', async () => {
      assert.equal(await decryptPayload('', 'iv', 'tag', 'user'), null);
      assert.equal(await decryptPayload('cipher', '', 'tag', 'user'), null);
      assert.equal(await decryptPayload('cipher', 'iv', '', 'user'), null);
      assert.equal(await decryptPayload('cipher', 'iv', 'tag', ''), null);
      assert.equal(await decryptPayload(null as any, 'iv', 'tag', 'user'), null);
      assert.equal(await decryptPayload('cipher', null as any, 'tag', 'user'), null);
    });

    it('rejects invalid IV length (< 12 bytes or > 12 bytes)', async () => {
      const enc = await encryptPayload(originalData, userId);
      assert.equal(await decryptPayload(enc.ciphertext, 'abcd', enc.tag, userId), null);
      assert.equal(await decryptPayload(enc.ciphertext, enc.iv + 'ff', enc.tag, userId), null);
    });

    it('rejects invalid auth tag length (< 16 bytes or > 16 bytes)', async () => {
      const enc = await encryptPayload(originalData, userId);
      assert.equal(await decryptPayload(enc.ciphertext, enc.iv, 'abcd', userId), null);
      assert.equal(await decryptPayload(enc.ciphertext, enc.iv, enc.tag + 'ff', userId), null);
    });
  });

  describe('Bounded LRU Key Cache Behavior', () => {
    it('records cache hits on subsequent key derivations for identical user/secret', async () => {
      const userId = 'cache_user_1';
      const secret = 'cache_secret_1';

      // First call -> Cache Miss
      const key1 = await deriveKeyWithSecret(userId, secret);
      const stats1 = getCryptoCacheStats();
      assert.equal(stats1.hits, 0);
      assert.equal(stats1.misses, 1);
      assert.equal(stats1.size, 1);

      // Second call -> Cache Hit
      const key2 = await deriveKeyWithSecret(userId, secret);
      const stats2 = getCryptoCacheStats();
      assert.equal(stats2.hits, 1);
      assert.equal(stats2.misses, 1);
      assert.equal(key1.toString('hex'), key2.toString('hex'));
    });

    it('evicts least-recently-used item when capacity is exceeded', () => {
      const smallCache = new BoundedKeyCache(3, 100000);
      const keyA = Buffer.from('a'.repeat(32));
      const keyB = Buffer.from('b'.repeat(32));
      const keyC = Buffer.from('c'.repeat(32));
      const keyD = Buffer.from('d'.repeat(32));

      smallCache.set('key_a', keyA);
      smallCache.set('key_b', keyB);
      smallCache.set('key_c', keyC);

      assert.equal(smallCache.getStats().size, 3);
      assert.equal(smallCache.getStats().evictions, 0);

      // Access key_a so that key_b becomes the least-recently-used
      assert.equal(smallCache.get('key_a')?.toString('hex'), keyA.toString('hex'));

      // Adding key_d must evict key_b (LRU)
      smallCache.set('key_d', keyD);
      assert.equal(smallCache.getStats().size, 3);
      assert.equal(smallCache.getStats().evictions, 1);

      assert.equal(smallCache.get('key_b'), null, 'key_b must have been evicted');
      assert.ok(smallCache.get('key_a'), 'key_a was refreshed and must remain in cache');
      assert.ok(smallCache.get('key_c'), 'key_c must remain in cache');
      assert.ok(smallCache.get('key_d'), 'key_d must be present in cache');
    });

    it('expires entries after TTL elapses', async () => {
      const shortCache = new BoundedKeyCache(10, 25);
      const keyBuf = Buffer.from('x'.repeat(32));
      shortCache.set('temp_key', keyBuf);

      assert.ok(shortCache.get('temp_key'), 'Key must be present immediately');

      // Wait 40ms for TTL to expire
      await new Promise(r => setTimeout(r, 40));

      assert.equal(shortCache.get('temp_key'), null, 'Expired key must return null and be pruned');
      assert.equal(shortCache.getStats().size, 0);
    });

    it('clearCryptoCache resets size, hits, misses, and evictions', async () => {
      await deriveKeyWithSecret('user_clear', 'secret_clear');
      await deriveKeyWithSecret('user_clear', 'secret_clear'); // hit
      assert.ok(getCryptoCacheStats().size > 0);
      assert.ok(getCryptoCacheStats().hits > 0);

      clearCryptoCache();
      const stats = getCryptoCacheStats();
      assert.equal(stats.size, 0);
      assert.equal(stats.hits, 0);
      assert.equal(stats.misses, 0);
      assert.equal(stats.evictions, 0);
    });
  });

  describe('In-Flight Derivation Deduplication & Race Protection', () => {
    it('collapses multiple concurrent derivations for the same user/secret into 1 operation', async () => {
      const userId = 'herd_user_123';
      const secret = 'shared_secret_456';

      // Launch 10 concurrent key derivation requests simultaneously
      const promises = Array.from({ length: 10 }, () => deriveKeyWithSecret(userId, secret));
      const results = await Promise.all(promises);

      // All 10 returned keys must match
      const firstKeyHex = results[0].toString('hex');
      for (const res of results) {
        assert.equal(res.toString('hex'), firstKeyHex);
      }

      // Stats verify: only 1 cache miss/computation occurred, the rest deduplicated
      const stats = getCryptoCacheStats();
      assert.equal(stats.misses, 1, 'Only exactly 1 cache miss before populated');
      assert.equal(stats.scryptComputations, 1, 'Only exactly 1 scrypt computation should have been initiated');
      assert.equal(stats.inFlightDeduplications, 9, '9 concurrent requests must have deduplicated onto the in-flight Promise');
      assert.equal(stats.size, 1);
    });

    it('exercises production deriveKeyWithSecret flow: older promise resolution does not remove newer in-flight entry', async () => {
      const originalScrypt = crypto.scrypt;
      const userId = 'flow_user_race_test';
      const secret = 'flow_secret_race_test';

      let callbackA: ((err: any, key: Buffer) => void) | null = null;
      let callbackB: ((err: any, key: Buffer) => void) | null = null;

      try {
        // Test-scoped mock of crypto.scrypt to control resolution order deterministically
        (crypto as any).scrypt = function(password: any, salt: any, keylen: any, cb: any) {
          if (!callbackA) {
            callbackA = cb;
          } else if (!callbackB) {
            callbackB = cb;
          } else {
            return (originalScrypt as any).apply(this, arguments);
          }
        };

        // 1. Start derivation A
        const promiseA = deriveKeyWithSecret(userId, secret);
        assert.ok(callbackA, 'Derivation A must have invoked scrypt and captured callbackA');

        // 2. Clear the cache while A is pending
        clearCryptoCache();

        // 3. Start derivation B for the exact same key
        const promiseB = deriveKeyWithSecret(userId, secret);
        assert.ok(callbackB, 'Derivation B must have invoked scrypt and captured callbackB');

        // 4. Resolve A first
        const keyA = Buffer.alloc(32, 0x11);
        callbackA!(null, keyA);
        const resultA = await promiseA;
        assert.equal(resultA.toString('hex'), keyA.toString('hex'));

        // 5. Verify A's cleanup did NOT remove B's in-flight entry:
        // Starting derivation C must deduplicate onto B instead of launching a 3rd scrypt computation
        const promiseC = deriveKeyWithSecret(userId, secret);
        const stats = getCryptoCacheStats();
        assert.equal(
          stats.inFlightDeduplications,
          1,
          "Derivation C must have deduplicated onto B's active in-flight entry (not wiped out by A's cleanup)"
        );

        // 6. Resolve B and verify normal completion for both B and C
        const keyB = Buffer.alloc(32, 0x22);
        callbackB!(null, keyB);
        const [resultB, resultC] = await Promise.all([promiseB, promiseC]);

        assert.equal(resultB.toString('hex'), keyB.toString('hex'));
        assert.equal(resultC.toString('hex'), keyB.toString('hex'), 'C must have received B derived key via deduplication');
      } finally {
        (crypto as any).scrypt = originalScrypt;
      }
    });

    it('handles concurrent derivations gracefully across cache clearance', async () => {
      const userId = 'race_concurrent_user';
      const secret = 'race_concurrent_sec';

      // Start initial derivation
      const p1 = deriveKeyWithSecret(userId, secret);

      // Clear cache while p1 is in worker threadpool
      clearCryptoCache();

      // Start second and third concurrent derivations
      const p2 = deriveKeyWithSecret(userId, secret);
      const p3 = deriveKeyWithSecret(userId, secret);

      const [k1, k2, k3] = await Promise.all([p1, p2, p3]);
      assert.equal(k1.toString('hex'), k2.toString('hex'));
      assert.equal(k2.toString('hex'), k3.toString('hex'));

      const stats = getCryptoCacheStats();
      assert.equal(stats.inFlightDeduplications, 1, 'Third request must have deduplicated onto in-flight request 2');
    });

    it('derives keys for different users independently without interference', async () => {
      const [keyUser1, keyUser2] = await Promise.all([
        deriveKeyWithSecret('concurrent_user_1', 'same_secret'),
        deriveKeyWithSecret('concurrent_user_2', 'same_secret')
      ]);

      assert.notEqual(keyUser1.toString('hex'), keyUser2.toString('hex'), 'Keys for different users must be distinct');
      assert.equal(getCryptoCacheStats().size, 2);
    });
  });

  describe('Event-Loop Responsiveness (Non-blocking scrypt)', () => {
    it('permits event-loop ticks while async scrypt derivations are processing', async () => {
      let tickCount = 0;
      let intervalActive = true;

      const interval = setInterval(() => {
        if (intervalActive) tickCount++;
      }, 2);

      const coldUsers = ['bench_u1', 'bench_u2', 'bench_u3', 'bench_u4', 'bench_u5'];
      await Promise.all(coldUsers.map(u => deriveKeyWithSecret(u, 'secret_responsive')));

      intervalActive = false;
      clearInterval(interval);

      assert.ok(
        tickCount > 0,
        `Event loop must have ticked during async scrypt operations (actual ticks: ${tickCount})`
      );
    });
  });
});
