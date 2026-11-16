import test, { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import audioRouter, {
  defaultResolvers,
  AudioResolveResult
} from '../../server/src/routes/audio.js';

describe('Audio Provider Route-Level Integration & Concurrency Tests', () => {
  // Track original resolvers to restore cleanly after tests
  const originalJioSaavnResolver = defaultResolvers.resolveJioSaavn;
  const originalYouTubeResolver = defaultResolvers.resolveYouTube;

  let mockJioSaavnFails = false;
  let mockYouTubeFails = false;
  let simulatedDelayMs = 0;

  before(() => {
    // Install mock resolvers so tests make zero external network calls
    defaultResolvers.resolveJioSaavn = async (q, title, artist): Promise<AudioResolveResult> => {
      if (simulatedDelayMs > 0) {
        await new Promise((r) => setTimeout(r, simulatedDelayMs));
      }
      if (mockJioSaavnFails) {
        throw new Error('JioSaavn mock network failure');
      }
      return {
        success: true,
        provider: 'jiosaavn',
        title: title || q,
        url: `https://mock-saavn.cdn/${encodeURIComponent(q)}.mp4`
      };
    };

    defaultResolvers.resolveYouTube = async (q, title, artist): Promise<AudioResolveResult> => {
      if (simulatedDelayMs > 0) {
        await new Promise((r) => setTimeout(r, simulatedDelayMs));
      }
      if (mockYouTubeFails) {
        throw new Error('YouTube mock network failure');
      }
      return {
        success: true,
        provider: 'youtube',
        title: title || q,
        url: `https://mock-youtube.cdn/${encodeURIComponent(q)}.mp3`
      };
    };
  });

  after(() => {
    // Restore original resolvers
    defaultResolvers.resolveJioSaavn = originalJioSaavnResolver;
    defaultResolvers.resolveYouTube = originalYouTubeResolver;
  });

  beforeEach(() => {
    mockJioSaavnFails = false;
    mockYouTubeFails = false;
    simulatedDelayMs = 0;
  });

  /**
   * Helper that dispatches requests directly through the Express router
   * without requiring TCP socket binding (sandbox compliant).
   */
  function invokeRoute(
    method: 'GET' | 'POST',
    path: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      query?: Record<string, string>;
    } = {}
  ): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
      const parsed = new URL(path, 'http://localhost');
      const query: Record<string, string> = { ...options.query };
      parsed.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      let statusCode = 200;
      const resHeaders: Record<string, string> = {};

      const req: any = {
        method,
        url: parsed.pathname + parsed.search,
        path: parsed.pathname,
        query,
        body: options.body || {},
        headers: { ...(options.headers || {}) }
      };

      const res: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        setHeader(k: string, v: string) {
          resHeaders[k] = v;
          return this;
        },
        json(data: any) {
          resolve({ status: statusCode, body: data });
          return this;
        },
        send(data: any) {
          resolve({ status: statusCode, body: data });
          return this;
        }
      };

      audioRouter(req, res, (err?: any) => {
        if (err) {
          resolve({ status: 500, body: { error: err.message } });
        } else {
          resolve({ status: 404, body: { error: 'Not Found' } });
        }
      });
    });
  }

  describe('Route-level: GET /providers & POST /provider semantics', () => {
    it('GET /providers reports auto strategy and available engines without claiming per-user state', async () => {
      const getRes = await invokeRoute('GET', '/providers');
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.active, 'jiosaavn');
      assert.equal(getRes.body.activePlugin, 'JioSaavnAudio');
      assert.equal(getRes.body.defaultEngine, 'jiosaavn');
      assert.equal(getRes.body.strategy, 'deterministic-fallback');
      assert.ok(Array.isArray(getRes.body.providers));
      assert.equal(getRes.body.providers.length, 2);
    });

    it('POST /provider acknowledges provider selection for backward compatibility without mutating global state', async () => {
      const postJio = await invokeRoute('POST', '/provider', {
        body: { provider: 'jiosaavn' }
      });
      assert.equal(postJio.status, 200);
      assert.equal(postJio.body.success, true);
      assert.equal(postJio.body.active, 'jiosaavn');
      assert.equal(postJio.body.scope, 'client-managed');

      const postYt = await invokeRoute('POST', '/provider', {
        body: { provider: 'youtube' }
      });
      assert.equal(postYt.status, 200);
      assert.equal(postYt.body.success, true);
      assert.equal(postYt.body.active, 'youtube');
      assert.equal(postYt.body.scope, 'client-managed');

      // GET /providers remains stable and deterministic, not hijacked by the POST calls
      const getRes = await invokeRoute('GET', '/providers');
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.active, 'jiosaavn');
      assert.equal(getRes.body.activePlugin, 'JioSaavnAudio');
    });

    it('returns status 400 for invalid provider values', async () => {
      const postRes = await invokeRoute('POST', '/provider', {
        body: { provider: 'spotify_unsupported' }
      });
      assert.equal(postRes.status, 400);
      assert.equal(postRes.body.success, false);
      assert.ok(postRes.body.error.includes('Invalid provider'));
    });
  });

  describe('Multi-Client Isolation: Concurrent auto-mode and provider preference requests', () => {
    it('proves two clients with different preferences make concurrent auto-mode requests without influencing each other', async () => {
      simulatedDelayMs = 10;

      // Client A attempts to set YouTube in the background
      const clientAPost = invokeRoute('POST', '/provider', { body: { provider: 'youtube' } });

      // Client B attempts to set JioSaavn in the background
      const clientBPost = invokeRoute('POST', '/provider', { body: { provider: 'jiosaavn' } });

      // Simultaneously, both Client A and Client B issue auto-mode resolution requests
      const clientAResolve = invokeRoute('GET', '/resolve?q=song_client_a');
      const clientBResolve = invokeRoute('GET', '/resolve?q=song_client_b');

      const [postARes, postBRes, resA, resB] = await Promise.all([
        clientAPost,
        clientBPost,
        clientAResolve,
        clientBResolve
      ]);

      // Both POST endpoints responded successfully without crashing
      assert.equal(postARes.status, 200);
      assert.equal(postBRes.status, 200);

      // In the old architecture, whichever client POSTed last hijacked auto-mode for the other client.
      // In the new stateless architecture, BOTH auto-mode requests resolve deterministically to JioSaavn
      // (320kbps master quality) with zero state pollution or crosstalk!
      assert.equal(resA.status, 200);
      assert.equal(resA.body.provider, 'jiosaavn');
      assert.ok(resA.body.url.includes('mock-saavn.cdn'));

      assert.equal(resB.status, 200);
      assert.equal(resB.body.provider, 'jiosaavn');
      assert.ok(resB.body.url.includes('mock-saavn.cdn'));
    });

    it('proves concurrent requests with different client-persisted preferences resolve independently', async () => {
      simulatedDelayMs = 10;

      // Client A has chosen YouTube preference (sent via x-audio-provider header)
      // Client B has chosen JioSaavn preference (sent via query parameter)
      // Client C has chosen default Auto mode (no overrides)
      const reqClientA = invokeRoute('GET', '/resolve?q=track_client_a', {
        headers: { 'x-audio-provider': 'youtube' }
      });
      const reqClientB = invokeRoute('GET', '/resolve?q=track_client_b&provider=jiosaavn');
      const reqClientC = invokeRoute('GET', '/resolve?q=track_client_c');

      const [resA, resB, resC] = await Promise.all([reqClientA, reqClientB, reqClientC]);

      assert.equal(resA.status, 200);
      assert.equal(resA.body.provider, 'youtube');
      assert.ok(resA.body.url.includes('mock-youtube.cdn'));

      assert.equal(resB.status, 200);
      assert.equal(resB.body.provider, 'jiosaavn');
      assert.ok(resB.body.url.includes('mock-saavn.cdn'));

      assert.equal(resC.status, 200);
      assert.equal(resC.body.provider, 'jiosaavn'); // deterministic auto default
      assert.ok(resC.body.url.includes('mock-saavn.cdn'));
    });
  });

  describe('Route-level: Per-request provider overrides (Query & Header)', () => {
    it('resolves via query parameter ?provider=jiosaavn', async () => {
      const res = await invokeRoute('GET', '/resolve?q=Kesariya&provider=jiosaavn');
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, 'jiosaavn');
      assert.ok(res.body.url.includes('mock-saavn.cdn'));
    });

    it('resolves via query parameter ?provider=youtube', async () => {
      const res = await invokeRoute('GET', '/resolve?q=Kesariya&provider=youtube');
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, 'youtube');
      assert.ok(res.body.url.includes('mock-youtube.cdn'));
    });

    it('resolves via x-audio-provider header override', async () => {
      const res = await invokeRoute('GET', '/resolve?q=Starboy', {
        headers: { 'x-audio-provider': 'youtube' }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, 'youtube');
      assert.ok(res.body.url.includes('mock-youtube.cdn'));
    });

    it('returns status 400 when q query parameter is missing', async () => {
      const res = await invokeRoute('GET', '/resolve');
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Missing query parameter q');
    });
  });

  describe('Route-level: Fallback handling and error shapes', () => {
    it('falls back to YouTube when JioSaavn fails on a jiosaavn request', async () => {
      mockJioSaavnFails = true;
      const res = await invokeRoute('GET', '/resolve?q=Excuses&provider=jiosaavn');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.provider, 'youtube');
      assert.ok(res.body.url.includes('mock-youtube.cdn'));
    });

    it('falls back to JioSaavn when YouTube fails on a youtube request', async () => {
      mockYouTubeFails = true;
      const res = await invokeRoute('GET', '/resolve?q=Excuses&provider=youtube');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.provider, 'jiosaavn');
      assert.ok(res.body.url.includes('mock-saavn.cdn'));
    });

    it('falls back to YouTube when JioSaavn fails in auto mode', async () => {
      mockJioSaavnFails = true;
      const res = await invokeRoute('GET', '/resolve?q=Excuses');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.provider, 'youtube');
      assert.ok(res.body.url.includes('mock-youtube.cdn'));
    });

    it('returns status 500 when both providers fail', async () => {
      mockJioSaavnFails = true;
      mockYouTubeFails = true;
      const res = await invokeRoute('GET', '/resolve?q=BrokenTrack&provider=jiosaavn');
      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Playback resolution failed across all providers');
    });
  });

  describe('Route-level: Concurrent multi-client request isolation', () => {
    it('handles 30 simultaneous requests with mixed providers without crosstalk', async () => {
      simulatedDelayMs = 10;

      const requests = [];
      for (let i = 0; i < 30; i++) {
        const id = i;
        if (i % 3 === 0) {
          requests.push({
            id,
            path: `/resolve?q=song_${id}&provider=jiosaavn`,
            headers: {},
            expectedProvider: 'jiosaavn'
          });
        } else if (i % 3 === 1) {
          requests.push({
            id,
            path: `/resolve?q=song_${id}&provider=youtube`,
            headers: {},
            expectedProvider: 'youtube'
          });
        } else {
          requests.push({
            id,
            path: `/resolve?q=song_${id}`,
            headers: { 'x-audio-provider': 'youtube' },
            expectedProvider: 'youtube'
          });
        }
      }

      // Fire all 30 HTTP requests simultaneously
      const responses = await Promise.all(
        requests.map(async (req) => {
          const res = await invokeRoute('GET', req.path, { headers: req.headers });
          assert.equal(res.status, 200);
          return {
            id: req.id,
            expected: req.expectedProvider,
            actual: res.body.provider
          };
        })
      );

      assert.equal(responses.length, 30);
      for (const item of responses) {
        assert.equal(
          item.actual,
          item.expected,
          `Request ${item.id} cross-contaminated: expected ${item.expected}, got ${item.actual}`
        );
      }
    });
  });
});
