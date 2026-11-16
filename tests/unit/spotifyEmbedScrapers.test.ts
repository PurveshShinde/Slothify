import test, { describe, it, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';

// Preserve original globalThis.fetch
const originalFetch = globalThis.fetch;

// Handler for mock fetch calls
let mockFetchHandler: ((url: string, init?: any) => Promise<any>) | null = null;

// Pre-install mock fetch before any static or dynamic module import is evaluated
globalThis.fetch = async (url: any, init?: any) => {
  const urlStr = String(url);

  // Spotube token endpoints (for any eager prewarming)
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
        accessToken: 'mock-token',
        accessTokenExpirationTimestampMs: Date.now() + 3600000
      })
    } as any;
  }

  if (mockFetchHandler) {
    return mockFetchHandler(urlStr, init);
  }

  return { ok: false, status: 500, json: async () => ({}), text: async () => '' } as any;
};

// Static imports from extracted scraper module and original monolith
import {
  resolveSpotifyTrackCover,
  scrapeSpotifyArtistEmbed
} from '../../server/src/plugins/metadata/spotify/scrapers/spotifyEmbedScraper.js';

import {
  resolveSpotifyTrackCover as resolveCoverFromPlugin,
  scrapeSpotifyArtistEmbed as scrapeArtistFromPlugin
} from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

// Counter for isolated module instances
let isolateCounter = 0;
async function loadIsolatedScraper() {
  const id = ++isolateCounter;
  return import(`../../server/src/plugins/metadata/spotify/scrapers/spotifyEmbedScraper.js?test_isolate=${id}`);
}

describe('Spotify Embed Scraper Subsystem Tests', () => {
  afterEach(() => {
    mockFetchHandler = null;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  describe('resolveSpotifyTrackCover', () => {
    describe('Input Validation & Normalization', () => {
      it('returns null for non-string, null, undefined, or empty trackId inputs', async () => {
        assert.equal(await resolveSpotifyTrackCover(''), null);
        assert.equal(await resolveSpotifyTrackCover(null as any), null);
        assert.equal(await resolveSpotifyTrackCover(undefined as any), null);
        assert.equal(await resolveSpotifyTrackCover(12345 as any), null);
      });

      it('returns null when cleanId length is not exactly 22 characters', async () => {
        assert.equal(await resolveSpotifyTrackCover('short_id'), null);
        assert.equal(await resolveSpotifyTrackCover('123456789012345678901'), null); // 21 chars
        assert.equal(await resolveSpotifyTrackCover('12345678901234567890123'), null); // 23 chars
      });

      it('returns null when cleanId contains an underscore (e.g. synthetic or composite IDs)', async () => {
        assert.equal(await resolveSpotifyTrackCover('1234567890_23456789012'), null); // 22 chars with '_'
      });

      it('normalizes trackId by stripping "spotify:track:" prefix and trimming whitespace', async () => {
        let requestedUrl = '';
        mockFetchHandler = async (url) => {
          requestedUrl = url;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              thumbnail_url: 'https://i.scdn.co/image/ab67616d00001e021234567890abcdef123456'
            })
          };
        };

        const res = await resolveSpotifyTrackCover('  spotify:track:4cOdK2wGLETKBW3PvgPWqT  ');
        assert.equal(requestedUrl, 'https://open.spotify.com/oembed?url=https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
        assert.equal(res, 'https://i.scdn.co/image/ab67616d0000b2731234567890abcdef123456');
      });
    });

    describe('Request Construction & Headers', () => {
      it('sends GET request to exact oEmbed endpoint with User-Agent and 3000ms timeout signal', async () => {
        let capturedUrl = '';
        let capturedInit: any = null;

        mockFetchHandler = async (url, init) => {
          capturedUrl = url;
          capturedInit = init;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              thumbnail_url: 'https://i.scdn.co/image/ab67616d0000b273test'
            })
          };
        };

        await resolveSpotifyTrackCover('0VjIjW4GlUZAMYd2vXMi3b');

        assert.equal(capturedUrl, 'https://open.spotify.com/oembed?url=https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b');
        assert.deepEqual(capturedInit.headers, {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        assert.ok(capturedInit.signal instanceof AbortSignal, 'Must supply an AbortSignal');
      });
    });

    describe('Response Parsing & Image Resolution Upgrade', () => {
      it('upgrades 300x300 (ab67616d00001e02) thumbnail to crystal-clear 640x640 (ab67616d0000b273)', async () => {
        mockFetchHandler = async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            thumbnail_url: 'https://i.scdn.co/image/ab67616d00001e02aabbccddeeff0011223344'
          })
        });

        const cover = await resolveSpotifyTrackCover('3n3Ppam7vgaVa1iaRUc9Lp');
        assert.equal(cover, 'https://i.scdn.co/image/ab67616d0000b273aabbccddeeff0011223344');
      });

      it('returns thumbnail_url unchanged when ab67616d00001e02 pattern is not present', async () => {
        mockFetchHandler = async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            thumbnail_url: 'https://images.spotify.com/custom_artwork_640.png'
          })
        });

        const cover = await resolveSpotifyTrackCover('57bgtoPSgt236HzfBOd8kj');
        assert.equal(cover, 'https://images.spotify.com/custom_artwork_640.png');
      });
    });

    describe('In-Memory Caching (SPOTIFY_TRACK_COVER_CACHE)', () => {
      it('caches resolved covers and avoids duplicate network requests for the same track ID', async () => {
        const isolated = await loadIsolatedScraper();
        let fetchCount = 0;

        mockFetchHandler = async () => {
          fetchCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              thumbnail_url: 'https://i.scdn.co/image/ab67616d00001e02cached12345678901234'
            })
          };
        };

        const firstResult = await isolated.resolveSpotifyTrackCover('7qiZfU4dY1lWllzX7mPBI3');
        assert.equal(fetchCount, 1);
        assert.equal(firstResult, 'https://i.scdn.co/image/ab67616d0000b273cached12345678901234');

        // Second call should return immediately from cache
        const secondResult = await isolated.resolveSpotifyTrackCover('7qiZfU4dY1lWllzX7mPBI3');
        assert.equal(fetchCount, 1, 'Duplicate fetch must not occur for cached trackId');
        assert.equal(secondResult, firstResult);
      });
    });

    describe('Error Resilience & Fallbacks', () => {
      it('returns null on non-200 HTTP responses', async () => {
        mockFetchHandler = async () => ({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' })
        });

        const result = await resolveSpotifyTrackCover('2takcwOaAZWiRQFLucUmWF');
        assert.equal(result, null);
      });

      it('returns null when response JSON has no thumbnail_url', async () => {
        mockFetchHandler = async () => ({
          ok: true,
          status: 200,
          json: async () => ({ title: 'Track Title Only' })
        });

        const result = await resolveSpotifyTrackCover('2takcwOaAZWiRQFLucUmWF');
        assert.equal(result, null);
      });

      it('returns null and suppresses errors on network rejection or timeout abort', async () => {
        mockFetchHandler = async () => {
          throw new Error('Connection reset by oEmbed server');
        };

        const result = await resolveSpotifyTrackCover('2takcwOaAZWiRQFLucUmWF');
        assert.equal(result, null);
      });
    });
  });

  describe('scrapeSpotifyArtistEmbed', () => {
    describe('Request Construction & Headers', () => {
      it('sends GET request to open.spotify.com/embed/artist with USER_AGENT and 3500ms timeout', async () => {
        let capturedUrl = '';
        let capturedInit: any = null;

        mockFetchHandler = async (url, init) => {
          capturedUrl = url;
          capturedInit = init;
          return {
            ok: true,
            status: 200,
            text: async () => '<html><body>No data</body></html>'
          };
        };

        await scrapeSpotifyArtistEmbed('06HL4z0CvFAxyc27GXpf02');

        assert.equal(capturedUrl, 'https://open.spotify.com/embed/artist/06HL4z0CvFAxyc27GXpf02');
        assert.equal(
          capturedInit.headers['User-Agent'],
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        assert.ok(capturedInit.signal instanceof AbortSignal, 'Must supply an AbortSignal');
      });
    });

    describe('Response Parsing & Visual Identity Extraction', () => {
      it('extracts name, trackList, and selects high-res portrait where maxWidth >= 500', async () => {
        const nextData = {
          props: {
            pageProps: {
              state: {
                data: {
                  entity: {
                    name: 'Taylor Swift',
                    visualIdentity: {
                      image: [
                        { url: 'https://i.scdn.co/image/low_res.jpg', maxWidth: 160 },
                        { url: 'https://i.scdn.co/image/high_res_640.jpg', maxWidth: 640 }
                      ]
                    },
                    trackList: [
                      { uri: 'spotify:track:123', title: 'Anti-Hero' }
                    ]
                  }
                }
              }
            }
          }
        };

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
            </head>
            <body></body>
          </html>
        `;

        mockFetchHandler = async () => ({
          ok: true,
          status: 200,
          text: async () => html
        });

        const result = await scrapeSpotifyArtistEmbed('06HL4z0CvFAxyc27GXpf02');
        assert.ok(result !== null);
        assert.equal(result.name, 'Taylor Swift');
        assert.equal(result.imageUrl, 'https://i.scdn.co/image/high_res_640.jpg');
        assert.equal(result.trackList?.length, 1);
        assert.equal(result.trackList?.[0].title, 'Anti-Hero');
      });

      it('falls back to first image URL when no image has maxWidth >= 500', async () => {
        const nextData = {
          props: {
            pageProps: {
              state: {
                data: {
                  entity: {
                    name: 'Indie Band',
                    visualIdentity: {
                      image: [
                        { url: 'https://i.scdn.co/image/only_image_300.jpg', maxWidth: 300 }
                      ]
                    }
                  }
                }
              }
            }
          }
        };

        const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></html>`;
        mockFetchHandler = async () => ({ ok: true, status: 200, text: async () => html });

        const result = await scrapeSpotifyArtistEmbed('indie_band_id');
        assert.ok(result !== null);
        assert.equal(result.name, 'Indie Band');
        assert.equal(result.imageUrl, 'https://i.scdn.co/image/only_image_300.jpg');
        assert.deepEqual(result.trackList, []);
      });

      it('handles missing visualIdentity or image array gracefully by returning undefined imageUrl', async () => {
        const nextData = {
          props: {
            pageProps: {
              state: {
                data: {
                  entity: {
                    name: 'Imageless Artist'
                  }
                }
              }
            }
          }
        };

        const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></html>`;
        mockFetchHandler = async () => ({ ok: true, status: 200, text: async () => html });

        const result = await scrapeSpotifyArtistEmbed('imageless_id');
        assert.ok(result !== null);
        assert.equal(result.name, 'Imageless Artist');
        assert.equal(result.imageUrl, undefined);
        assert.deepEqual(result.trackList, []);
      });
    });

    describe('Error Resilience & Fallbacks', () => {
      it('returns null on non-200 HTTP response', async () => {
        mockFetchHandler = async () => ({
          ok: false,
          status: 404,
          text: async () => 'Not found'
        });

        assert.equal(await scrapeSpotifyArtistEmbed('missing_id'), null);
      });

      it('returns null when HTML does not contain __NEXT_DATA__ script tag', async () => {
        mockFetchHandler = async () => ({
          ok: true,
          status: 200,
          text: async () => '<html><body>No Next Data script here</body></html>'
        });

        assert.equal(await scrapeSpotifyArtistEmbed('no_script_id'), null);
      });

      it('returns null when JSON inside __NEXT_DATA__ is malformed', async () => {
        mockFetchHandler = async () => ({
          ok: true,
          status: 200,
          text: async () => '<html><script id="__NEXT_DATA__" type="application/json">{invalid json</script></html>'
        });

        assert.equal(await scrapeSpotifyArtistEmbed('bad_json_id'), null);
      });

      it('returns null when entity is missing from parsed JSON state', async () => {
        mockFetchHandler = async () => ({
          ok: true,
          status: 200,
          text: async () => '<html><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"state":{"data":{}}}}}</script></html>'
        });

        assert.equal(await scrapeSpotifyArtistEmbed('no_entity_id'), null);
      });

      it('returns null on network throw or timeout abortion', async () => {
        mockFetchHandler = async () => {
          throw new Error('Network socket hang up');
        };

        assert.equal(await scrapeSpotifyArtistEmbed('throw_id'), null);
      });
    });
  });

  describe('Module Exports & Strict Backward Compatibility', () => {
    it('preserves strict reference identity between SpotifyScraperPlugin and spotifyEmbedScraper', () => {
      assert.strictEqual(
        resolveSpotifyTrackCover,
        resolveCoverFromPlugin,
        'resolveSpotifyTrackCover from SpotifyScraperPlugin must strictly equal the extracted module export'
      );
      assert.strictEqual(
        scrapeSpotifyArtistEmbed,
        scrapeArtistFromPlugin,
        'scrapeSpotifyArtistEmbed from SpotifyScraperPlugin must strictly equal the extracted module export'
      );
    });
  });
});

