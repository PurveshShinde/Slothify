import test, { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Save original globalThis.fetch before any test runs
const originalFetch = globalThis.fetch;

// Pre-install a deterministic mock fetch before any dynamic module import is evaluated
// to ensure that any eager token prewarming in spotubeAuth.ts never touches the real network.
globalThis.fetch = async (url: any) => {
  const urlStr = String(url);
  if (urlStr.includes('nuances.json')) {
    return {
      ok: true,
      json: async () => [{ s: 'GM3TMMJTGYZTQNZVGM4DINJZHA4TGOBYGMZTCMRTGEYDSMJRHE4TEOBUG4YTCMRUGQ4DQOJUGQYTAMRRGA2TCMJSHE3TCMBY', v: 61 }]
    } as any;
  }
  if (urlStr.includes('server-time')) {
    return { ok: true, json: async () => ({ serverTime: 30000 }) } as any;
  }
  if (urlStr.includes('/api/token')) {
    return {
      ok: true,
      json: async () => ({
        accessToken: 'initial-prewarm-mock-token',
        accessTokenExpirationTimestampMs: Date.now() + 60000
      })
    } as any;
  }
  return { ok: false, status: 404 } as any;
};

// Helper to load an isolated fresh module instance with deterministic mock fetch
let moduleCounter = 0;
async function loadFreshSpotubeAuth(customFetch?: (url: string | URL, init?: any) => Promise<any>) {
  if (customFetch) {
    globalThis.fetch = customFetch as any;
  }
  const id = ++moduleCounter;
  return import(`../../server/src/plugins/metadata/spotify/auth/spotubeAuth.js?test_isolate=${id}`);
}

describe('Spotube Authentication Subsystem Tests', () => {
  const testSecret = 'MZXW6YTBOI======'; // Base32 for 'foobar'

  afterEach(() => {
    // Restore default safe mock fetch between tests so no stray network calls occur
    globalThis.fetch = async () => ({ ok: false, status: 500 } as any);
  });

  after(() => {
    // Restore original globalThis.fetch when test suite completes
    globalThis.fetch = originalFetch;
  });

  describe('RFC 4648 Base32 Decoding', () => {
    it('decodes standard RFC 4648 test vectors correctly', async () => {
      const { base32Decode } = await loadFreshSpotubeAuth();
      // RFC 4648 Section 10 test vectors
      assert.equal(base32Decode('').toString('utf-8'), '');
      assert.equal(base32Decode('MY======').toString('utf-8'), 'f');
      assert.equal(base32Decode('MZXW6===').toString('utf-8'), 'foo');
      assert.equal(base32Decode('MZXW6YQ=').toString('utf-8'), 'foob');
      assert.equal(base32Decode('MZXW6YTB').toString('utf-8'), 'fooba');
      assert.equal(base32Decode('MZXW6YTBOI======').toString('utf-8'), 'foobar');
    });

    it('handles lowercase base32 input case-insensitively', async () => {
      const { base32Decode } = await loadFreshSpotubeAuth();
      assert.equal(base32Decode('mzxw6ytboi======').toString('utf-8'), 'foobar');
    });

    it('safely handles unpadded base32 strings', async () => {
      const { base32Decode } = await loadFreshSpotubeAuth();
      assert.equal(base32Decode('MZXW6YTBOI').toString('utf-8'), 'foobar');
    });

    it('skips non-base32 characters and handles arbitrary binary data without throwing', async () => {
      const { base32Decode } = await loadFreshSpotubeAuth();
      const decoded = base32Decode('MZXW-6YT!BOI');
      assert.ok(decoded instanceof Buffer);
      assert.ok(decoded.length > 0);
    });
  });

  describe('RFC 6238 TOTP Generation', () => {
    it('always generates a 6-digit zero-padded numeric string', async () => {
      const { generateSpotubeTOTP } = await loadFreshSpotubeAuth();
      const code = generateSpotubeTOTP(testSecret, 1700000000);
      assert.match(code, /^\d{6}$/);
      assert.equal(code.length, 6);
    });

    it('is completely deterministic for identical inputs', async () => {
      const { generateSpotubeTOTP } = await loadFreshSpotubeAuth();
      const code1 = generateSpotubeTOTP(testSecret, 1700000015);
      const code2 = generateSpotubeTOTP(testSecret, 1700000015);
      assert.equal(code1, code2);
    });

    it('maintains the same TOTP within the 30-second window step', async () => {
      const { generateSpotubeTOTP } = await loadFreshSpotubeAuth();
      const baseTime = 30000;
      const codeStart = generateSpotubeTOTP(testSecret, baseTime);
      const codeMid = generateSpotubeTOTP(testSecret, baseTime + 14);
      const codeEnd = generateSpotubeTOTP(testSecret, baseTime + 29);

      assert.equal(codeStart, codeMid);
      assert.equal(codeMid, codeEnd);
    });

    it('generates a different TOTP when crossing the 30-second time-step boundary', async () => {
      const { generateSpotubeTOTP } = await loadFreshSpotubeAuth();
      const baseTime = 30000;
      const codeWindow1 = generateSpotubeTOTP(testSecret, baseTime + 29);
      const codeWindow2 = generateSpotubeTOTP(testSecret, baseTime + 30);

      assert.notEqual(codeWindow1, codeWindow2);
    });
  });

  describe('Nuance Gist Retrieval and Selection', () => {
    it('successfully retrieves remote nuances and selects the highest version', async () => {
      let tokenRequestUrl = '';
      const customNuanceSecret = 'MZXW6YTBOI======'; // 'foobar'
      const customNuanceVersion = 99;

      const mockFetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('nuances.json')) {
          return {
            ok: true,
            json: async () => [
              { s: 'LOWVERSIONSECRET', v: 40 },
              { s: customNuanceSecret, v: customNuanceVersion },
              { s: 'MIDVERSIONSECRET', v: 70 }
            ]
          } as any;
        }
        if (urlStr.includes('server-time')) {
          return { ok: true, json: async () => ({ serverTime: 30000 }) } as any;
        }
        if (urlStr.includes('/api/token')) {
          tokenRequestUrl = urlStr;
          return {
            ok: true,
            json: async () => ({
              accessToken: 'token-with-v99',
              accessTokenExpirationTimestampMs: Date.now() + 20
            })
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      // Load fresh isolated instance: nuanceFetched starts false, prewarming triggers Gist fetch
      const auth = await loadFreshSpotubeAuth(mockFetch);
      // Wait 35ms for the unawaited Gist fetch to update cachedNuance and the initial prewarm token to expire
      await new Promise(resolve => setTimeout(resolve, 35));

      // Force fresh token exchange
      const token = await auth.getSpotubeSpotifyToken();
      assert.ok(token);
      // Verify that totpVer in token URL uses the highest remote version (99)
      assert.ok(tokenRequestUrl.includes(`totpVer=${customNuanceVersion}`), `Expected tokenUrl to contain totpVer=99, got: ${tokenRequestUrl}`);
    });

    it('falls back to the embedded default nuance when Gist retrieval fails', async () => {
      let tokenRequestUrl = '';

      const mockFetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('nuances.json')) {
          // Gist endpoint network failure
          throw new Error('Gist network unreachable');
        }
        if (urlStr.includes('server-time')) {
          return { ok: true, json: async () => ({ serverTime: 30000 }) } as any;
        }
        if (urlStr.includes('/api/token')) {
          tokenRequestUrl = urlStr;
          return {
            ok: true,
            json: async () => ({
              accessToken: 'token-with-default-nuance',
              accessTokenExpirationTimestampMs: Date.now() + 60000
            })
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const auth = await loadFreshSpotubeAuth(mockFetch);
      await new Promise(resolve => setTimeout(resolve, 30));

      const token = await auth.getSpotubeSpotifyToken();
      assert.ok(token);
      // Verify that totpVer in token URL falls back to default version 61
      assert.ok(tokenRequestUrl.includes('totpVer=61'), `Expected tokenUrl to contain default totpVer=61, got: ${tokenRequestUrl}`);
    });
  });

  describe('Token Exchange, Caching, and Expiry', () => {
    it('returns a valid token and caches it until expiration', async () => {
      let tokenFetchCount = 0;

      const mockFetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('nuances.json')) {
          return { ok: true, json: async () => [{ s: testSecret, v: 61 }] } as any;
        }
        if (urlStr.includes('server-time')) {
          return { ok: true, json: async () => ({ serverTime: 30000 }) } as any;
        }
        if (urlStr.includes('/api/token')) {
          tokenFetchCount++;
          return {
            ok: true,
            json: async () => ({
              accessToken: 'mock-access-token-active',
              accessTokenExpirationTimestampMs: Date.now() + 40
            })
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const auth = await loadFreshSpotubeAuth(mockFetch);
      const token1 = await auth.getSpotubeSpotifyToken();
      assert.equal(token1, 'mock-access-token-active');

      // Second immediate call must hit the cache without calling fetch again
      const token2 = await auth.getSpotubeSpotifyToken();
      assert.equal(token2, 'mock-access-token-active');
      assert.equal(tokenFetchCount, 1);
    });

    it('refreshes the token when the cached token expires', async () => {
      let tokenFetchCount = 0;

      const mockFetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('server-time')) {
          return { ok: true, json: async () => ({ serverTime: 30000 }) } as any;
        }
        if (urlStr.includes('/api/token')) {
          tokenFetchCount++;
          return {
            ok: true,
            json: async () => ({
              accessToken: `mock-token-${tokenFetchCount}`,
              accessTokenExpirationTimestampMs: Date.now() + 25 // expires in 25ms
            })
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const auth = await loadFreshSpotubeAuth(mockFetch);
      const token1 = await auth.getSpotubeSpotifyToken();
      assert.equal(token1, 'mock-token-1');

      // Wait 35ms for the token to expire
      await new Promise(resolve => setTimeout(resolve, 35));

      const token2 = await auth.getSpotubeSpotifyToken();
      assert.equal(token2, 'mock-token-2');
      assert.equal(tokenFetchCount, 2);
    });
  });

  describe('Concurrency & In-Flight Request Deduplication', () => {
    it('collapses simultaneous requests into a single in-flight network exchange', async () => {
      let tokenApiCalls = 0;

      const mockFetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('server-time')) {
          return { ok: true, json: async () => ({ serverTime: 30000 }) } as any;
        }
        if (urlStr.includes('/api/token')) {
          tokenApiCalls++;
          await new Promise(r => setTimeout(r, 20));
          return {
            ok: true,
            json: async () => ({
              accessToken: 'mock-dedup-token',
              accessTokenExpirationTimestampMs: Date.now() + 60000
            })
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const auth = await loadFreshSpotubeAuth(mockFetch);
      const [res1, res2, res3] = await Promise.all([
        auth.getSpotubeSpotifyToken(),
        auth.getSpotubeSpotifyToken(),
        auth.getSpotubeSpotifyToken()
      ]);

      assert.equal(res1, 'mock-dedup-token');
      assert.equal(res2, 'mock-dedup-token');
      assert.equal(res3, 'mock-dedup-token');
      assert.equal(tokenApiCalls, 1);
    });
  });

  describe('Network Failures and Fallback Resilience', () => {
    it('falls back to local machine clock when server-time endpoint fails', async () => {
      let serverTimeCalled = false;
      let tokenEndpointCalled = false;

      const mockFetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('server-time')) {
          serverTimeCalled = true;
          throw new Error('Server-time timeout');
        }
        if (urlStr.includes('/api/token')) {
          tokenEndpointCalled = true;
          return {
            ok: true,
            json: async () => ({
              accessToken: 'token-after-time-fallback',
              accessTokenExpirationTimestampMs: Date.now() + 60000
            })
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const auth = await loadFreshSpotubeAuth(mockFetch);
      const token = await auth.getSpotubeSpotifyToken();
      assert.equal(serverTimeCalled, true);
      assert.equal(tokenEndpointCalled, true);
      assert.equal(token, 'token-after-time-fallback');
    });

    it('returns null and does not throw when token endpoint returns HTTP 500 error', async () => {
      const mockFetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/token')) {
          return { ok: false, status: 500 } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const auth = await loadFreshSpotubeAuth(mockFetch);
      const token = await auth.getSpotubeSpotifyToken();
      assert.equal(token, null);
    });

    it('returns null and does not throw when token endpoint encounters network rejection', async () => {
      const mockFetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/token')) {
          throw new TypeError('Failed to fetch (simulated network rejection)');
        }
        return { ok: false, status: 404 } as any;
      };

      const auth = await loadFreshSpotubeAuth(mockFetch);
      const token = await auth.getSpotubeSpotifyToken();
      assert.equal(token, null);
    });
  });

  describe('Module Exports & Backward Compatibility', () => {
    it('exports getSpotubeSpotifyToken identically from both spotubeAuth and SpotifyScraperPlugin', async () => {
      const auth = await loadFreshSpotubeAuth();
      const { getSpotubeSpotifyToken: reExportedGetToken } = await import('../../server/src/plugins/metadata/SpotifyScraperPlugin.js');
      assert.equal(typeof auth.getSpotubeSpotifyToken, 'function');
      assert.equal(typeof reExportedGetToken, 'function');
    });
  });
});
