import test, { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';

// Preserve original globalThis.fetch
const originalFetch = globalThis.fetch;

// Default mock token returned by spotube auth endpoint
const MOCK_BEARER_TOKEN = 'mock-bearer-token-xyz-123';

// Handler for tests to customize fetch responses
let mockGqlHandler: ((url: string, init?: any) => Promise<any>) | null = null;
let mockTokenHandler: ((url: string, init?: any) => Promise<any>) | null = null;

// Pre-install mock fetch before any static or dynamic module import is evaluated
globalThis.fetch = async (url: any, init?: any) => {
  const urlStr = String(url);

  // Spotube token endpoints
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
    if (mockTokenHandler) {
      return mockTokenHandler(urlStr, init);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: MOCK_BEARER_TOKEN,
        accessTokenExpirationTimestampMs: Date.now() + 3600000
      })
    } as any;
  }

  // Spotify Pathfinder GraphQL endpoint
  if (urlStr.includes('pathfinder/v1/query')) {
    if (mockGqlHandler) {
      return mockGqlHandler(urlStr, init);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: {} })
    } as any;
  }

  return { ok: false, status: 404, json: async () => ({}) } as any;
};

// Static imports from both the extracted client and original monolith
import {
  searchSpotubeSpotifyTracks,
  searchSpotifyArtists,
  fetchSpotifyArtistOverview
} from '../../server/src/plugins/metadata/spotify/clients/spotifyGqlClient.js';

import {
  searchSpotubeSpotifyTracks as searchTracksFromPlugin,
  searchSpotifyArtists as searchArtistsFromPlugin,
  fetchSpotifyArtistOverview as fetchOverviewFromPlugin
} from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

import type { SpotifyArtistOverviewData } from '../../server/src/plugins/metadata/spotify/clients/spotifyGqlClient.js';

// Counter for unique isolated module loading
let isolateCounter = 0;
async function loadIsolatedClient(options?: { tokenFails?: boolean }) {
  const id = ++isolateCounter;
  if (options?.tokenFails) {
    mockTokenHandler = async () => ({ ok: false, status: 500, json: async () => ({}) });
  } else {
    mockTokenHandler = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: `isolated-token-${id}`,
        accessTokenExpirationTimestampMs: Date.now() + 3600000
      })
    });
  }
  return import(`../../server/src/plugins/metadata/spotify/clients/spotifyGqlClient.js?isolate=${id}`);
}

describe('Spotify GraphQL Client Tests', () => {
  afterEach(() => {
    mockGqlHandler = null;
    mockTokenHandler = null;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  describe('searchSpotubeSpotifyTracks', () => {
    it('constructs exact Pathfinder searchDesktop URL, headers, and query parameters', async () => {
      let capturedUrl = '';
      let capturedInit: any = null;

      mockGqlHandler = async (url, init) => {
        capturedUrl = url;
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { search: { tracks: { items: [] } } } })
        };
      };

      await searchSpotubeSpotifyTracks('The Killers Mr Brightside', 15);

      assert.ok(capturedUrl.startsWith('https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchDesktop'));
      const parsedUrl = new URL(capturedUrl);
      assert.equal(parsedUrl.searchParams.get('operationName'), 'searchDesktop');

      const variables = JSON.parse(parsedUrl.searchParams.get('variables')!);
      assert.equal(variables.searchTerm, 'The Killers Mr Brightside');
      assert.equal(variables.offset, 0);
      assert.equal(variables.limit, 15);
      assert.equal(variables.numberOfTopResults, 5);
      assert.equal(variables.includeAudiobooks, false);
      assert.equal(variables.includePreReleases, true);

      const extensions = JSON.parse(parsedUrl.searchParams.get('extensions')!);
      assert.deepEqual(extensions, {
        persistedQuery: {
          version: 1,
          sha256Hash: '75bbf6bfcfdf85b8fc828417bfad92b7cd66bf7f556d85670f4da8292373ebec'
        }
      });

      assert.equal(capturedInit.headers.Authorization, `Bearer ${MOCK_BEARER_TOKEN}`);
      assert.equal(capturedInit.headers.Accept, 'application/json');
      assert.equal(
        capturedInit.headers['User-Agent'],
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );
      assert.ok(capturedInit.signal instanceof AbortSignal);
    });

    it('clamps limit to maximum of 30 items', async () => {
      let requestedLimit = 0;
      mockGqlHandler = async (url) => {
        const parsedUrl = new URL(url);
        const variables = JSON.parse(parsedUrl.searchParams.get('variables')!);
        requestedLimit = variables.limit;
        return { ok: true, status: 200, json: async () => ({ data: {} }) };
      };

      await searchSpotubeSpotifyTracks('test', 50);
      assert.equal(requestedLimit, 30);
    });

    it('parses standard schema 1 (search.tracks.items) with upgraded cover art', async () => {
      mockGqlHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            search: {
              tracks: {
                items: [
                  {
                    track: {
                      id: 'track123',
                      uri: 'spotify:track:track123',
                      name: 'Mr. Brightside',
                      duration: { totalMilliseconds: 222973 },
                      artists: {
                        items: [{ profile: { name: 'The Killers' } }]
                      },
                      album: {
                        name: 'Hot Fuss',
                        coverArt: {
                          sources: [
                            { url: 'https://i.scdn.co/image/ab67616d00001e02abc', width: 300 },
                            { url: 'https://i.scdn.co/image/ab67616d00004851def', width: 64 }
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        })
      });

      const tracks = await searchSpotubeSpotifyTracks('mr brightside');
      assert.equal(tracks.length, 1);
      const [t] = tracks;
      assert.equal(t.id, 'track123');
      assert.equal(t.uri, 'spotify:track:track123');
      assert.equal(t.name, 'Mr. Brightside');
      assert.deepEqual(t.artists, [{ name: 'The Killers' }]);
      assert.equal(t.album.name, 'Hot Fuss');
      assert.equal(t.album.images[0].url, 'https://i.scdn.co/image/ab67616d0000b273def');
      assert.equal(t.duration_ms, 222973);
      assert.equal(t.preview_url, null);
    });

    it('parses alternate schema 2 (searchV2.tracksV2.items) and handles string artist format', async () => {
      mockGqlHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            searchV2: {
              tracksV2: {
                items: [
                  {
                    item: {
                      data: {
                        id: 'v2_id',
                        name: 'Song V2',
                        artists: ['Artist String'],
                        albumOfTrack: {
                          name: 'Album Of Track V2',
                          coverArt: {
                            sources: [{ url: 'https://i.scdn.co/image/ab67616d00001e02xyz' }]
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        })
      });

      const tracks = await searchSpotubeSpotifyTracks('song v2');
      assert.equal(tracks.length, 1);
      const [t] = tracks;
      assert.equal(t.id, 'v2_id');
      assert.equal(t.uri, 'spotify:track:v2_id');
      assert.equal(t.name, 'Song V2');
      assert.deepEqual(t.artists, [{ name: 'Artist String' }]);
      assert.equal(t.album.name, 'Album Of Track V2');
      assert.equal(t.album.images[0].url, 'https://i.scdn.co/image/ab67616d0000b273xyz');
      assert.equal(t.duration_ms, 180000); // default duration
    });

    it('falls back to "Unknown Artist" when artists array is empty', async () => {
      mockGqlHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            search: {
              tracks: {
                items: [
                  {
                    id: 'no_art_id',
                    name: 'Mystery Song',
                    artists: []
                  }
                ]
              }
            }
          }
        })
      });

      const [track] = await searchSpotubeSpotifyTracks('mystery');
      assert.deepEqual(track.artists, [{ name: 'Unknown Artist' }]);
    });

    it('returns empty array when cover art sources are absent', async () => {
      mockGqlHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            search: {
              tracks: {
                items: [
                  {
                    id: 'no_cover_id',
                    name: 'Coverless Song'
                  }
                ]
              }
            }
          }
        })
      });

      const [track] = await searchSpotubeSpotifyTracks('coverless');
      assert.deepEqual(track.album.images, []);
    });

    it('returns empty array when token retrieval returns null', async () => {
      const isolated = await loadIsolatedClient({ tokenFails: true });
      const tracks = await isolated.searchSpotubeSpotifyTracks('test');
      assert.deepEqual(tracks, []);
    });

    it('returns empty array when HTTP status is not ok (e.g. 401 or 500)', async () => {
      mockGqlHandler = async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' })
      });

      const tracks = await searchSpotubeSpotifyTracks('test');
      assert.deepEqual(tracks, []);
    });

    it('catches and logs warning without throwing on network rejection', async () => {
      mockGqlHandler = async () => {
        throw new Error('Connection refused by Pathfinder API');
      };

      const tracks = await searchSpotubeSpotifyTracks('test');
      assert.deepEqual(tracks, []);
    });
  });

  describe('searchSpotifyArtists', () => {
    it('constructs exact artist query with USER_AGENT header and 8000ms timeout', async () => {
      let capturedUrl = '';
      let capturedInit: any = null;

      mockGqlHandler = async (url, init) => {
        capturedUrl = url;
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { search: { artists: { items: [] } } } })
        };
      };

      await searchSpotifyArtists('Taylor Swift', 10);

      assert.ok(capturedUrl.startsWith('https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchDesktop'));
      assert.equal(capturedInit.headers.Authorization, `Bearer ${MOCK_BEARER_TOKEN}`);
      assert.equal(
        capturedInit.headers['User-Agent'],
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      assert.ok(capturedInit.signal instanceof AbortSignal);
    });

    it('parses artist items and strips "spotify:artist:" prefix to extract raw ID', async () => {
      mockGqlHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            search: {
              artists: {
                items: [
                  {
                    uri: 'spotify:artist:06HL4z0CvFAxyc27GXpf02',
                    profile: { name: 'Taylor Swift' },
                    visuals: {
                      avatarImage: {
                        sources: [
                          { url: 'https://i.scdn.co/image/ab67616100001e02low', width: 160 },
                          { url: 'https://i.scdn.co/image/ab67616100004851high', width: 640 }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        })
      });

      const artists = await searchSpotifyArtists('Taylor Swift');
      assert.equal(artists.length, 1);
      const [a] = artists;
      assert.equal(a.id, '06HL4z0CvFAxyc27GXpf02');
      assert.equal(a.name, 'Taylor Swift');
      assert.equal(a.picture, 'https://i.scdn.co/image/ab6761610000b273high');
    });

    it('falls back to headerImage when avatarImage is missing', async () => {
      mockGqlHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            search: {
              artists: {
                items: [
                  {
                    uri: 'spotify:artist:header_artist_id',
                    profile: { name: 'Header Band' },
                    visuals: {
                      headerImage: {
                        sources: [{ url: 'https://i.scdn.co/image/ab67616100001e02header' }]
                      }
                    }
                  }
                ]
              }
            }
          }
        })
      });

      const [artist] = await searchSpotifyArtists('Header Band');
      assert.equal(artist.picture, 'https://i.scdn.co/image/ab6761610000b273header');
    });

    it('skips artist items that lack id or name', async () => {
      mockGqlHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            search: {
              artists: {
                items: [
                  { uri: '', profile: { name: 'No ID' } },
                  { uri: 'spotify:artist:id_only', profile: { name: '' } },
                  { uri: 'spotify:artist:valid_id', profile: { name: 'Valid Name' } }
                ]
              }
            }
          }
        })
      });

      const artists = await searchSpotifyArtists('filter test');
      assert.equal(artists.length, 1);
      assert.equal(artists[0].id, 'valid_id');
      assert.equal(artists[0].name, 'Valid Name');
    });

    it('returns empty array when token is null or HTTP error occurs', async () => {
      const isolated = await loadIsolatedClient({ tokenFails: true });
      const resNullToken = await isolated.searchSpotifyArtists('test');
      assert.deepEqual(resNullToken, []);

      mockGqlHandler = async () => ({ ok: false, status: 403, json: async () => ({}) });
      const resHttpError = await searchSpotifyArtists('test');
      assert.deepEqual(resHttpError, []);
    });
  });

  describe('fetchSpotifyArtistOverview', () => {
    it('returns null immediately when artistId is empty', async () => {
      const res = await fetchSpotifyArtistOverview('');
      assert.equal(res, null);
    });

    it('constructs exact queryArtistOverview URL, operation, variables, and SHA256 hash', async () => {
      const isolated = await loadIsolatedClient();
      let capturedUrl = '';

      mockGqlHandler = async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              artistUnion: {
                id: 'artist_req_test',
                profile: { name: 'Req Test' }
              }
            }
          })
        };
      };

      await isolated.fetchSpotifyArtistOverview('artist_req_test');

      const parsedUrl = new URL(capturedUrl);
      assert.equal(parsedUrl.searchParams.get('operationName'), 'queryArtistOverview');

      const variables = JSON.parse(parsedUrl.searchParams.get('variables')!);
      assert.deepEqual(variables, {
        uri: 'spotify:artist:artist_req_test',
        locale: '',
        includePrerelease: true
      });

      const extensions = JSON.parse(parsedUrl.searchParams.get('extensions')!);
      assert.deepEqual(extensions, {
        persistedQuery: {
          version: 1,
          sha256Hash: '79a4a9d7c3a3781d801e62b62ef11c7ee56fce2626772eb26cd20c69f84b3f49'
        }
      });
    });

    it('parses artistUnion stats, portraits, and discography topTracks correctly', async () => {
      const isolated = await loadIsolatedClient();

      mockGqlHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            artistUnion: {
              id: 'taylor_swift_id',
              profile: {
                name: 'Taylor Swift',
                verified: true
              },
              stats: {
                followers: 105000000,
                monthlyListeners: 95000000
              },
              visuals: {
                avatarImage: {
                  sources: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebavatar', width: 640 }]
                },
                headerImage: {
                  sources: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebheader', width: 1280 }]
                }
              },
              discography: {
                topTracks: {
                  items: [
                    {
                      track: {
                        id: 'top1',
                        uri: 'spotify:track:top1',
                        name: 'Cruel Summer',
                        duration: { totalMilliseconds: 178426 },
                        artists: {
                          items: [{ profile: { name: 'Taylor Swift' } }]
                        },
                        albumOfTrack: {
                          name: 'Lover',
                          coverArt: {
                            sources: [{ url: 'https://i.scdn.co/image/ab67616d00001e02cover', width: 300 }]
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        })
      });

      const overview: SpotifyArtistOverviewData | null = await isolated.fetchSpotifyArtistOverview('taylor_swift_id');
      assert.ok(overview !== null);
      assert.equal(overview.id, 'taylor_swift_id');
      assert.equal(overview.name, 'Taylor Swift');
      assert.equal(overview.followers, 105000000);
      assert.equal(overview.monthlyListeners, 95000000);
      assert.equal(overview.verified, true);
      assert.equal(overview.avatarUrl, 'https://i.scdn.co/image/ab6761610000e5ebavatar');
      assert.equal(overview.headerUrl, 'https://i.scdn.co/image/ab6761610000e5ebheader');

      assert.equal(overview.topTracks?.length, 1);
      const [topTrack] = overview.topTracks!;
      assert.equal(topTrack.id, 'top1');
      assert.equal(topTrack.name, 'Cruel Summer');
      assert.deepEqual(topTrack.artists, [{ name: 'Taylor Swift' }]);
      assert.equal(topTrack.album.name, 'Lover');
      assert.equal(topTrack.album.images[0].url, 'https://i.scdn.co/image/ab67616d0000b273cover');
      assert.equal(topTrack.duration_ms, 178426);
    });

    it('caches overview result in ARTIST_OVERVIEW_CACHE for subsequent calls', async () => {
      const isolated = await loadIsolatedClient();
      let fetchCount = 0;

      mockGqlHandler = async () => {
        fetchCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              artistUnion: {
                id: 'cached_artist_1',
                profile: { name: 'Cached Artist' }
              }
            }
          })
        };
      };

      const res1 = await isolated.fetchSpotifyArtistOverview('cached_artist_1');
      assert.equal(fetchCount, 1);
      assert.equal(res1?.name, 'Cached Artist');

      // Second call should hit in-memory cache and not fetch
      const res2 = await isolated.fetchSpotifyArtistOverview('cached_artist_1');
      assert.equal(fetchCount, 1);
      assert.strictEqual(res1, res2);
    });

    it('collapses concurrent requests for the same artist into a single in-flight Promise', async () => {
      const isolated = await loadIsolatedClient();
      let fetchCount = 0;

      mockGqlHandler = async () => {
        fetchCount++;
        // Small delay to simulate in-flight request
        await new Promise((r) => setTimeout(r, 15));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              artistUnion: {
                id: 'concurrent_artist',
                profile: { name: 'Concurrent Artist' }
              }
            }
          })
        };
      };

      const [res1, res2, res3] = await Promise.all([
        isolated.fetchSpotifyArtistOverview('concurrent_artist'),
        isolated.fetchSpotifyArtistOverview('concurrent_artist'),
        isolated.fetchSpotifyArtistOverview('concurrent_artist')
      ]);

      assert.equal(fetchCount, 1);
      assert.equal(res1?.name, 'Concurrent Artist');
      assert.strictEqual(res1, res2);
      assert.strictEqual(res2, res3);
    });

    it('returns null when artistUnion is missing, HTTP fails, or network rejects', async () => {
      const isolated = await loadIsolatedClient();

      // Missing artistUnion
      mockGqlHandler = async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) });
      const resMissing = await isolated.fetchSpotifyArtistOverview('missing_union');
      assert.equal(resMissing, null);

      // HTTP Error
      mockGqlHandler = async () => ({ ok: false, status: 500, json: async () => ({}) });
      const resHttp = await isolated.fetchSpotifyArtistOverview('http_err');
      assert.equal(resHttp, null);

      // Network Rejection
      mockGqlHandler = async () => {
        throw new Error('Socket timeout');
      };
      const resNet = await isolated.fetchSpotifyArtistOverview('net_err');
      assert.equal(resNet, null);
    });
  });

  describe('Module Exports & Backward Compatibility', () => {
    it('preserves strict reference identity between SpotifyScraperPlugin and spotifyGqlClient', () => {
      assert.strictEqual(
        searchSpotubeSpotifyTracks,
        searchTracksFromPlugin,
        'searchSpotubeSpotifyTracks exported from SpotifyScraperPlugin must match spotifyGqlClient'
      );
      assert.strictEqual(
        searchSpotifyArtists,
        searchArtistsFromPlugin,
        'searchSpotifyArtists exported from SpotifyScraperPlugin must match spotifyGqlClient'
      );
      assert.strictEqual(
        fetchSpotifyArtistOverview,
        fetchOverviewFromPlugin,
        'fetchSpotifyArtistOverview exported from SpotifyScraperPlugin must match spotifyGqlClient'
      );
    });
  });
});

