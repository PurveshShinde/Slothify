import test, { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

// Preserve original fetch and axios adapter
const originalFetch = globalThis.fetch;
const originalAdapter = axios.defaults.adapter;

// Handler for mock axios calls
let mockAxiosHandler: ((url: string, config?: any) => Promise<any>) | null = null;

// Pre-install mock fetch for Spotube auth prewarming
globalThis.fetch = async (url: any, init?: any) => {
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
      status: 200,
      json: async () => ({
        accessToken: 'mock-bearer-token-playlist',
        accessTokenExpirationTimestampMs: Date.now() + 3600000
      })
    } as any;
  }
  return { ok: false, status: 500, json: async () => ({}) } as any;
};

// Install adapter mock on axios
axios.defaults.adapter = async (config) => {
  if (mockAxiosHandler) {
    const res = await mockAxiosHandler(config.url || '', config);
    return {
      data: res.data !== undefined ? res.data : res,
      status: res.status || 200,
      statusText: 'OK',
      headers: res.headers || {},
      config
    };
  }
  return {
    data: '',
    status: 200,
    statusText: 'OK',
    headers: {},
    config
  };
};

// Imports from extracted module
import {
  scrapeSpotifyPlaylistEmbed,
  scrapeSpotifyAlbumEmbed
} from '../../server/src/plugins/metadata/spotify/scrapers/playlistAlbumScraper.js';

// Imports from monolith and stores
import { SpotifyScraperPlugin } from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';
import { localLibrary } from '../../server/src/store/localLibrary.js';

describe('Spotify Playlist & Album Embed Scrapers', () => {
  let originalLocalGetPlaylist: any;

  beforeEach(() => {
    originalLocalGetPlaylist = localLibrary.getPlaylist;
  });

  afterEach(() => {
    mockAxiosHandler = null;
    localLibrary.getPlaylist = originalLocalGetPlaylist;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    axios.defaults.adapter = originalAdapter;
  });

  describe('scrapeSpotifyPlaylistEmbed', () => {
    const mockPlaylistHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "state": {
                "data": {
                  "entity": {
                    "name": "Today's Top Hits",
                    "description": "Jung Kook is on top of the Hottest 50!",
                    "coverArt": {
                      "sources": [{ "url": "https://i.scdn.co/image/ab67706f00000002top_hits" }]
                    },
                    "trackList": [
                      {
                        "uri": "spotify:track:track_id_11111111111",
                        "title": "Seven (feat. Latto)",
                        "subtitle": "Jung Kook, Latto",
                        "duration": 184000,
                        "audioPreview": { "url": "https://p.scdn.co/mp3-preview/sample1" }
                      },
                      {
                        "title": "Track Without URI",
                        "subtitle": "Solo Artist",
                        "duration": 210000
                      }
                    ]
                  }
                }
              }
            }
          }
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    it('extracts playlist and track details correctly from valid embed HTML', async () => {
      let capturedUrl = '';
      let capturedConfig: any = null;

      mockAxiosHandler = async (url: string, config?: any) => {
        capturedUrl = url;
        capturedConfig = config;
        return { data: mockPlaylistHtml, status: 200 };
      };

      const playlist = await scrapeSpotifyPlaylistEmbed('test-playlist-live');

      assert.strictEqual(capturedUrl, 'https://open.spotify.com/embed/playlist/test-playlist-live');
      assert.strictEqual(capturedConfig?.timeout, 6000);
      assert.ok(capturedConfig?.headers?.['User-Agent']?.includes('Chrome/120.0.0.0'));

      assert.strictEqual(playlist.id, 'test-playlist-live');
      assert.strictEqual(playlist.name, "Today's Top Hits");
      assert.strictEqual(playlist.description, 'Jung Kook is on top of the Hottest 50!');
      assert.strictEqual(playlist.images[0].url, 'https://i.scdn.co/image/ab67706f00000002top_hits');
      assert.strictEqual(playlist.owner.id, 'spotify');
      assert.strictEqual(playlist.owner.display_name, 'Spotify');
      assert.strictEqual(playlist.tracks.total, 2);

      const [track1, track2] = playlist.tracks.items.map((i: any) => i.track);

      // Track 1: URI present
      assert.strictEqual(track1.id, 'track_id_11111111111');
      assert.strictEqual(track1.uri, 'spotify:track:track_id_11111111111');
      assert.strictEqual(track1.name, 'Seven (feat. Latto)');
      assert.deepStrictEqual(track1.artists, [{ name: 'Jung Kook' }, { name: 'Latto' }]);
      assert.strictEqual(track1.album.name, "Today's Top Hits");
      assert.strictEqual(track1.album.images[0].url, 'https://i.scdn.co/image/ab67706f00000002top_hits');
      assert.strictEqual(track1.duration_ms, 184000);
      assert.strictEqual(track1.preview_url, 'https://p.scdn.co/mp3-preview/sample1');

      // Track 2: URI absent -> fallback ID
      assert.strictEqual(track2.id, 'scraped_test-playlist-live_1');
      assert.strictEqual(track2.uri, 'spotify:track:scraped_test-playlist-live_1');
      assert.strictEqual(track2.name, 'Track Without URI');
      assert.deepStrictEqual(track2.artists, [{ name: 'Solo Artist' }]);
      assert.strictEqual(track2.duration_ms, 210000);
      assert.strictEqual(track2.preview_url, null);
    });

    it('returns cached playlist within 2-hour TTL without re-requesting over network', async () => {
      let callCount = 0;
      mockAxiosHandler = async () => {
        callCount++;
        return { data: mockPlaylistHtml, status: 200 };
      };

      const res1 = await scrapeSpotifyPlaylistEmbed('test-playlist-cached');
      assert.strictEqual(callCount, 1);

      // Second call within TTL hits cache
      const res2 = await scrapeSpotifyPlaylistEmbed('test-playlist-cached');
      assert.strictEqual(callCount, 1, 'Second call should hit in-memory cache and not invoke network');
      assert.deepStrictEqual(res1, res2);
    });

    it('refetches playlist after in-memory TTL expires', async () => {
      let callCount = 0;
      mockAxiosHandler = async () => {
        callCount++;
        return { data: mockPlaylistHtml, status: 200 };
      };

      const originalDateNow = Date.now;
      let simulatedTime = 1000000000000;
      Date.now = () => simulatedTime;

      try {
        await scrapeSpotifyPlaylistEmbed('test-playlist-expiry');
        assert.strictEqual(callCount, 1);

        // Advance simulated time past 2 hours (2 * 3600 * 1000 + 1ms)
        simulatedTime += 2 * 3600 * 1000 + 10;

        await scrapeSpotifyPlaylistEmbed('test-playlist-expiry');
        assert.strictEqual(callCount, 2, 'Call after TTL expiration should fetch fresh data');
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('falls back to visualIdentity image or default unsplash when coverArt is missing', async () => {
      const htmlVisualIdentity = `
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "state": {
                "data": {
                  "entity": {
                    "name": "Visual Playlist",
                    "visualIdentity": {
                      "image": [{ "url": "https://i.scdn.co/image/visual_id_art" }]
                    },
                    "trackList": []
                  }
                }
              }
            }
          }
        }
        </script>
      `;

      mockAxiosHandler = async () => ({ data: htmlVisualIdentity, status: 200 });
      const pl1 = await scrapeSpotifyPlaylistEmbed('test-visual-playlist');
      assert.strictEqual(pl1.images[0].url, 'https://i.scdn.co/image/visual_id_art');

      const htmlNoImage = `
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "state": {
                "data": {
                  "entity": { "name": "No Image Playlist", "trackList": [] }
                }
              }
            }
          }
        }
        </script>
      `;
      mockAxiosHandler = async () => ({ data: htmlNoImage, status: 200 });
      const pl2 = await scrapeSpotifyPlaylistEmbed('test-no-img-playlist');
      assert.ok(pl2.images[0].url.includes('images.unsplash.com'));
    });

    it('falls back to localLibrary snapshot when live scrape throws', async () => {
      mockAxiosHandler = async () => {
        throw new Error('504 Gateway Timeout');
      };

      const mockLocalPlaylist: any = {
        id: 'test-local-fallback-id',
        name: 'Local Snapshot Playlist',
        description: 'From offline store',
        images: [{ url: 'https://example.com/local.jpg' }],
        owner: { id: 'me', display_name: 'Local User' },
        tracks: {
          total: 1,
          items: [{ track: { id: 't1', name: 'Local Track' } }]
        }
      };

      localLibrary.getPlaylist = (id: string) => {
        if (id === 'test-local-fallback-id') return mockLocalPlaylist;
        return undefined;
      };

      const res = await scrapeSpotifyPlaylistEmbed('test-local-fallback-id');
      assert.strictEqual(res.name, 'Local Snapshot Playlist');
      assert.strictEqual(res.tracks.total, 1);
    });

    it('falls back to POPULAR_SPOTIFY_PLAYLISTS when live scrape fails and local library has no tracks', async () => {
      mockAxiosHandler = async () => {
        throw new Error('Network error');
      };

      localLibrary.getPlaylist = () => undefined;

      // '37i9dQZF1DXcBWIGoYBM5M' is Today's Top Hits in curated catalog
      const res = await scrapeSpotifyPlaylistEmbed('37i9dQZF1DXcBWIGoYBM5M');
      assert.strictEqual(res.id, '37i9dQZF1DXcBWIGoYBM5M');
      assert.strictEqual(res.name, "Today's Top Hits");
      assert.strictEqual(res.tracks.total, 0);
    });

    it('falls back to unknown placeholder playlist when all resolvers fail', async () => {
      mockAxiosHandler = async () => {
        throw new Error('Network error');
      };

      localLibrary.getPlaylist = () => undefined;

      const res = await scrapeSpotifyPlaylistEmbed('completely-unknown-playlist-999');
      assert.strictEqual(res.id, 'completely-unknown-playlist-999');
      assert.strictEqual(res.name, 'Playlist');
      assert.strictEqual(res.description, 'Curated music playlist');
      assert.ok(res.images[0].url.includes('images.unsplash.com'));
      assert.strictEqual(res.tracks.total, 0);
      assert.deepStrictEqual(res.tracks.items, []);
    });
  });

  describe('scrapeSpotifyAlbumEmbed', () => {
    const mockAlbumHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "state": {
                "data": {
                  "entity": {
                    "name": "Midnights",
                    "subtitle": "Taylor Swift",
                    "releaseDate": { "isoString": "2022-10-21T00:00:00.000Z" },
                    "visualIdentity": {
                      "image": [
                        { "url": "https://i.scdn.co/image/midnights_sm" },
                        { "url": "https://i.scdn.co/image/midnights_med" },
                        { "url": "https://i.scdn.co/image/midnights_lg" }
                      ]
                    },
                    "trackList": [
                      {
                        "uri": "spotify:track:anti_hero_123",
                        "title": "Anti-Hero",
                        "duration": 200000,
                        "audioPreview": { "url": "https://p.scdn.co/preview/anti-hero" }
                      },
                      {
                        "title": "Karma (Feat. Ice Spice)",
                        "subtitle": "Taylor Swift, Ice Spice",
                        "duration": 201000
                      }
                    ]
                  }
                }
              }
            }
          }
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    it('extracts album details, release date, and tracks correctly from embed HTML', async () => {
      let capturedUrl = '';
      let capturedConfig: any = null;

      mockAxiosHandler = async (url: string, config?: any) => {
        capturedUrl = url;
        capturedConfig = config;
        return { data: mockAlbumHtml, status: 200 };
      };

      const album = await scrapeSpotifyAlbumEmbed('4eLPsYPBmXABThSJ821sqY');

      assert.strictEqual(capturedUrl, 'https://open.spotify.com/embed/album/4eLPsYPBmXABThSJ821sqY');
      assert.ok(capturedConfig?.headers?.['User-Agent']?.includes('Chrome/120.0.0.0'));

      assert.strictEqual(album.id, '4eLPsYPBmXABThSJ821sqY');
      assert.strictEqual(album.name, 'Midnights');
      assert.deepStrictEqual(album.artists, [{ name: 'Taylor Swift' }]);
      assert.strictEqual(album.images[0].url, 'https://i.scdn.co/image/midnights_lg');
      assert.strictEqual(album.release_date, '2022-10-21');
      assert.strictEqual(album.total_tracks, 2);
      assert.deepStrictEqual(album.genres, ['Music']);

      const [t1, t2] = album.tracks;
      assert.strictEqual(t1.id, 'anti_hero_123');
      assert.strictEqual(t1.uri, 'spotify:track:anti_hero_123');
      assert.strictEqual(t1.name, 'Anti-Hero');
      assert.deepStrictEqual(t1.artists, [{ name: 'Taylor Swift' }]);
      assert.strictEqual(t1.album.name, 'Midnights');
      assert.strictEqual(t1.duration_ms, 200000);
      assert.strictEqual(t1.preview_url, 'https://p.scdn.co/preview/anti-hero');

      // Track 2 without URI
      assert.strictEqual(t2.id, 'album_4eLPsYPBmXABThSJ821sqY_1');
      assert.strictEqual(t2.name, 'Karma (Feat. Ice Spice)');
      assert.deepStrictEqual(t2.artists, [{ name: 'Taylor Swift' }, { name: 'Ice Spice' }]);
      assert.strictEqual(t2.preview_url, null);
    });

    it('falls back to ui-avatars.com when visualIdentity images are absent', async () => {
      const htmlNoImage = `
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "state": {
                "data": {
                  "entity": {
                    "name": "Coverless Album",
                    "subtitle": "Indie Band",
                    "trackList": []
                  }
                }
              }
            }
          }
        }
        </script>
      `;

      mockAxiosHandler = async () => ({ data: htmlNoImage, status: 200 });
      const album = await scrapeSpotifyAlbumEmbed('test-no-cover-id');
      assert.ok(album.images[0].url.includes('ui-avatars.com'));
      assert.strictEqual(album.release_date, '2024');
    });

    it('returns null when HTML does not contain __NEXT_DATA__ or JSON is malformed', async () => {
      mockAxiosHandler = async () => ({ data: '<html><body>No next data</body></html>', status: 200 });
      const res1 = await scrapeSpotifyAlbumEmbed('test-malformed-1');
      assert.strictEqual(res1, null);

      mockAxiosHandler = async () => ({
        data: '<script id="__NEXT_DATA__" type="application/json">{invalid-json</script>',
        status: 200
      });
      const res2 = await scrapeSpotifyAlbumEmbed('test-malformed-2');
      assert.strictEqual(res2, null);
    });

    it('returns null on axios network rejection or HTTP failure', async () => {
      mockAxiosHandler = async () => {
        throw new Error('404 Not Found');
      };
      const res = await scrapeSpotifyAlbumEmbed('test-missing-album-id');
      assert.strictEqual(res, null);
    });
  });

  describe('SpotifyScraperPlugin Class Integration', () => {
    it('delegates plugin.getPlaylist and plugin.getAlbum to extracted functions', async () => {
      const plugin = new SpotifyScraperPlugin();

      mockAxiosHandler = async (url: string) => {
        if (url.includes('/embed/playlist/')) {
          return {
            data: `
              <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "state": {
                      "data": {
                        "entity": {
                          "name": "Plugin Delegated Playlist",
                          "trackList": [{ "uri": "spotify:track:p1", "title": "Delegated Track 1" }]
                        }
                      }
                    }
                  }
                }
              }
              </script>
            `,
            status: 200
          };
        }
        if (url.includes('/embed/album/')) {
          return {
            data: `
              <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "state": {
                      "data": {
                        "entity": {
                          "name": "Plugin Delegated Album",
                          "trackList": [{ "uri": "spotify:track:a1", "title": "Album Track 1" }]
                        }
                      }
                    }
                  }
                }
              }
              </script>
            `,
            status: 200
          };
        }
        return { data: '', status: 404 };
      };

      const pl = await plugin.getPlaylist('delegate-test-pl');
      assert.strictEqual(pl.name, 'Plugin Delegated Playlist');
      assert.strictEqual(pl.tracks.total, 1);

      const tracks = await plugin.getPlaylistTracks('delegate-test-pl');
      assert.strictEqual(tracks.length, 1);
      assert.strictEqual(tracks[0].name, 'Delegated Track 1');

      const alb = await plugin.getAlbum('delegate-test-alb');
      assert.strictEqual(alb.name, 'Plugin Delegated Album');
      assert.strictEqual(alb.tracks.length, 1);
    });
  });
});
