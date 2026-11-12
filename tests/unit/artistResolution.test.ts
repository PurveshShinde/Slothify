import test, { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';

// Preserve original globalThis.fetch
const originalFetch = globalThis.fetch;

// Default mock token returned by spotube auth endpoint
const MOCK_BEARER_TOKEN = 'mock-bearer-token-artist-res';

// Handlers for tests to customize fetch responses
let mockFetchHandler: ((url: string, init?: any) => Promise<any>) | null = null;

// Pre-install mock fetch before any static or dynamic module import is evaluated
globalThis.fetch = async (url: any, init?: any) => {
  const urlStr = String(url);

  // Spotube token endpoints (for eager prewarming or GQL client calls)
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
        accessToken: MOCK_BEARER_TOKEN,
        accessTokenExpirationTimestampMs: Date.now() + 3600000
      })
    } as any;
  }

  if (mockFetchHandler) {
    return mockFetchHandler(urlStr, init);
  }

  return { ok: false, status: 500, json: async () => ({}), text: async () => '' } as any;
};

// Static imports from extracted module
import {
  TOP_ARTIST_SPOTIFY_IDS,
  ArtistMeta,
  ARTIST_META_CACHE,
  getArtistFollowers,
  resolveSpotifyArtistId,
  resolveYouTubeArtistAvatar,
  resolveArtistMetadata,
  isJunkChannel
} from '../../server/src/plugins/metadata/spotify/artists/artistResolution.js';

// Static import from monolith for parity and strict export identity
import {
  resolveSpotifyArtistId as resolveArtistIdFromMonolith
} from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

// Counter for isolated module instances
let isolateCounter = 0;
async function loadIsolatedArtistResolution() {
  const id = ++isolateCounter;
  return import(`../../server/src/plugins/metadata/spotify/artists/artistResolution.js?test_isolate=${id}`);
}

describe('Artist Resolution Subsystem Tests', () => {
  afterEach(() => {
    mockFetchHandler = null;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  describe('TOP_ARTIST_SPOTIFY_IDS Catalog', () => {
    it('contains all 47 expected top artist Spotify IDs', () => {
      const keys = Object.keys(TOP_ARTIST_SPOTIFY_IDS);
      assert.strictEqual(keys.length, 47);
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['taylor swift'], '06HL4z0CvFAxyc27GXpf02');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['the weeknd'], '1Xyo4u8uXC1ZmMpatF05PJ');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['drake'], '3TVXtAsR1Inumwj472S9r4');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['billie eilish'], '6qqNVTkY8uBg9cP3Jd7DAH');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['ariana grande'], '66CXWjxzNUsdJxJ2JdwvnR');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['bad bunny'], '4q3ewBCX7sLwd24euqV69X');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['kendrick lamar'], '2YZyLoL8N0Wb9xBt1NhZWg');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['charlie puth'], '665qv5gTsgI2s8t79xZq1N');
    });

    it('contains diacritic variations for specific artists', () => {
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['beyoncé'], '6vWDO969PvNqNYHIOW5v0m');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['adéla'], '2qanRMyA5bNuTvz1dK45OP');
      assert.strictEqual(TOP_ARTIST_SPOTIFY_IDS['adela'], '2qanRMyA5bNuTvz1dK45OP');
    });
  });

  describe('getArtistFollowers', () => {
    it('returns 0 for falsy or empty artist names', async () => {
      assert.strictEqual(getArtistFollowers(''), 0);
      assert.strictEqual(getArtistFollowers(null as any), 0);
      assert.strictEqual(getArtistFollowers(undefined as any), 0);
    });

    it('returns cached followers when present in ARTIST_META_CACHE', async () => {
      const mod = await loadIsolatedArtistResolution();
      mod.ARTIST_META_CACHE.set('custom artist', {
        imageUrl: 'https://example.com/art.jpg',
        followers: 1234567,
        genres: ['Pop']
      });

      assert.strictEqual(mod.getArtistFollowers('custom artist'), 1234567);
      assert.strictEqual(mod.getArtistFollowers('  CUSTOM ARTIST  '), 1234567);
    });

    it('returns cached followers by diacritics-normalized name when present in ARTIST_META_CACHE', async () => {
      const mod = await loadIsolatedArtistResolution();
      mod.ARTIST_META_CACHE.set('rosalia', {
        imageUrl: 'https://example.com/rosalia.jpg',
        followers: 888888,
        genres: ['Flamenco']
      });

      // 'Rosalía' normalizes NFD to 'rosalia'
      assert.strictEqual(mod.getArtistFollowers('Rosalía'), 888888);
    });

    it('returns 10,000,000 for catalog artists in TOP_ARTIST_PROFILES not yet in cache', async () => {
      const mod = await loadIsolatedArtistResolution();
      // 'Taylor Swift' is in TOP_ARTIST_PROFILES
      assert.strictEqual(mod.getArtistFollowers('Taylor Swift'), 10000000);
      assert.strictEqual(mod.getArtistFollowers('The Weeknd'), 10000000);
    });

    it('returns 0 for completely unknown artists not in cache or catalog', async () => {
      const mod = await loadIsolatedArtistResolution();
      assert.strictEqual(mod.getArtistFollowers('Unknown Indie Musician 99999'), 0);
    });
  });

  describe('resolveSpotifyArtistId', () => {
    it('returns immediately from TOP_ARTIST_SPOTIFY_IDS without any network call', async () => {
      let networkCalled = false;
      mockFetchHandler = async () => {
        networkCalled = true;
        throw new Error('Should not make network requests for known top artists');
      };

      const id = await resolveSpotifyArtistId('Taylor Swift');
      assert.strictEqual(id, '06HL4z0CvFAxyc27GXpf02');
      assert.strictEqual(networkCalled, false);
    });

    it('resolves unknown artist through Spotify GQL Pathfinder search and caches the result', async () => {
      const mod = await loadIsolatedArtistResolution();

      mockFetchHandler = async (urlStr: string, init?: any) => {
        if (urlStr.includes('pathfinder/v1/query')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                search: {
                  artists: {
                    items: [
                      {
                        uri: 'spotify:artist:999testArtistId123456',
                        profile: { name: 'Indie Star' },
                        visuals: { avatarImage: { sources: [{ url: 'https://example.com/avatar.jpg' }] } }
                      }
                    ]
                  }
                }
              }
            })
          } as any;
        }
        return { ok: false, status: 500, json: async () => ({}) } as any;
      };

      const resId = await mod.resolveSpotifyArtistId('Indie Star');
      assert.strictEqual(resId, '999testArtistId123456');
      assert.strictEqual(mod.TOP_ARTIST_SPOTIFY_IDS['indie star'], '999testArtistId123456');

      // Subsequent call should hit cache without network
      mockFetchHandler = async () => {
        throw new Error('Cache hit should not trigger network call');
      };
      const cachedId = await mod.resolveSpotifyArtistId('indie star');
      assert.strictEqual(cachedId, '999testArtistId123456');
    });

    it('falls back to DuckDuckGo HTML scraper when Spotify GQL search fails or yields no match', async () => {
      const mod = await loadIsolatedArtistResolution();
      let ddgUrlCalled = '';
      let ddgHeaders: any = null;

      mockFetchHandler = async (urlStr: string, init?: any) => {
        if (urlStr.includes('pathfinder/v1/query')) {
          // GQL fails with empty results
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: { search: { artists: { items: [] } } }
            })
          } as any;
        }

        if (urlStr.includes('duckduckgo.com')) {
          ddgUrlCalled = urlStr;
          ddgHeaders = init?.headers;
          const htmlContent = `
            <html><body>
              <a href="https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb">Radiohead on Spotify</a>
            </body></html>
          `;
          return {
            ok: true,
            status: 200,
            text: async () => htmlContent
          } as any;
        }

        return { ok: false, status: 500, json: async () => ({}) } as any;
      };

      const artistId = await mod.resolveSpotifyArtistId('Radiohead Fallback Test');
      assert.strictEqual(artistId, '4Z8W4fKeB5YxbusRsdQVPb');
      assert.ok(ddgUrlCalled.includes('https://html.duckduckgo.com/html/?q=site:open.spotify.com/artist/'));
      assert.ok(ddgUrlCalled.includes(encodeURIComponent('Radiohead Fallback Test')));
      assert.strictEqual(ddgHeaders?.['User-Agent'], 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      assert.strictEqual(mod.TOP_ARTIST_SPOTIFY_IDS['radiohead fallback test'], '4Z8W4fKeB5YxbusRsdQVPb');
    });

    it('returns null when both Spotify GQL search and DuckDuckGo scraper fail', async () => {
      const mod = await loadIsolatedArtistResolution();

      mockFetchHandler = async (urlStr: string) => {
        if (urlStr.includes('pathfinder/v1/query')) {
          throw new Error('GQL network timeout');
        }
        if (urlStr.includes('duckduckgo.com')) {
          return {
            ok: false,
            status: 503,
            text: async () => 'Service Unavailable'
          } as any;
        }
        return { ok: false, status: 500 } as any;
      };

      const result = await mod.resolveSpotifyArtistId('Nonexistent Musician Nowhere');
      assert.strictEqual(result, null);
    });

    it('returns null when DuckDuckGo response HTML contains no 22-character Spotify artist ID', async () => {
      const mod = await loadIsolatedArtistResolution();

      mockFetchHandler = async (urlStr: string) => {
        if (urlStr.includes('pathfinder/v1/query')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { search: { artists: { items: [] } } } })
          } as any;
        }
        if (urlStr.includes('duckduckgo.com')) {
          return {
            ok: true,
            status: 200,
            text: async () => '<html><body>No spotify artist links here</body></html>'
          } as any;
        }
        return { ok: false, status: 500 } as any;
      };

      const result = await mod.resolveSpotifyArtistId('Random No-Link Artist');
      assert.strictEqual(result, null);
    });
  });

  describe('resolveYouTubeArtistAvatar', () => {
    it('extracts and upgrades avatar URL from channelRenderer thumbnails', async () => {
      let postUrl = '';
      let postBody: any = null;
      let postHeaders: any = null;

      mockFetchHandler = async (urlStr: string, init?: any) => {
        if (urlStr.includes('youtubei/v1/search')) {
          postUrl = urlStr;
          postHeaders = init?.headers;
          postBody = JSON.parse(init?.body || '{}');

          return {
            ok: true,
            status: 200,
            json: async () => ({
              contents: {
                twoColumnSearchResultsRenderer: {
                  primaryContents: {
                    sectionListRenderer: {
                      contents: [
                        {
                          itemSectionRenderer: {
                            contents: [
                              {
                                channelRenderer: {
                                  thumbnail: {
                                    thumbnails: [
                                      { url: '//yt3.ggpht.com/a/default=s88-c-k-c0x00ffffff-no-rj' },
                                      { url: '//yt3.ggpht.com/a/default=s176-c-k-c0x00ffffff-no-rj' }
                                    ]
                                  }
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                }
              }
            })
          } as any;
        }
        return { ok: false, status: 500 } as any;
      };

      const avatar = await resolveYouTubeArtistAvatar('Dua Lipa');
      assert.strictEqual(avatar, 'https://yt3.ggpht.com/a/default=s500-c-k-c0x00ffffff-no-rj');
      assert.strictEqual(postUrl, 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false');
      assert.strictEqual(postHeaders['Content-Type'], 'application/json');
      assert.ok(postHeaders['User-Agent'].includes('Chrome/122.0.0.0'));
      assert.strictEqual(postBody.query, 'Dua Lipa official');
      assert.strictEqual(postBody.context.client.clientName, 'WEB');
    });

    it('extracts avatar from videoRenderer channel thumbnail when channelRenderer is absent', async () => {
      mockFetchHandler = async (urlStr: string) => {
        if (urlStr.includes('youtubei/v1/search')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              contents: {
                twoColumnSearchResultsRenderer: {
                  primaryContents: {
                    sectionListRenderer: {
                      contents: [
                        {
                          itemSectionRenderer: {
                            contents: [
                              {
                                videoRenderer: {
                                  channelThumbnailSupportedRenderers: {
                                    channelThumbnailWithLinkRenderer: {
                                      thumbnail: {
                                        thumbnails: [
                                          { url: 'https://yt3.ggpht.com/video-thumb=s100' }
                                        ]
                                      }
                                    }
                                  }
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                }
              }
            })
          } as any;
        }
        return { ok: false, status: 500 } as any;
      };

      const avatar = await resolveYouTubeArtistAvatar('Some Artist');
      assert.strictEqual(avatar, 'https://yt3.ggpht.com/video-thumb=s500-c-k-c0x00ffffff-no-rj');
    });

    it('returns empty string when YouTube response has no matching thumbnails', async () => {
      mockFetchHandler = async (urlStr: string) => {
        if (urlStr.includes('youtubei/v1/search')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              contents: {
                twoColumnSearchResultsRenderer: {
                  primaryContents: {
                    sectionListRenderer: {
                      contents: []
                    }
                  }
                }
              }
            })
          } as any;
        }
        return { ok: false, status: 500 } as any;
      };

      const avatar = await resolveYouTubeArtistAvatar('Ghost Artist');
      assert.strictEqual(avatar, '');
    });

    it('returns empty string on non-200 HTTP response or network throw', async () => {
      mockFetchHandler = async (urlStr: string) => {
        if (urlStr.includes('youtubei/v1/search')) {
          throw new Error('Connection refused');
        }
        return { ok: false, status: 500 } as any;
      };

      const avatar = await resolveYouTubeArtistAvatar('Error Artist');
      assert.strictEqual(avatar, '');
    });
  });

  describe('resolveArtistMetadata', () => {
    it('returns cached metadata immediately if already present in ARTIST_META_CACHE', async () => {
      const mod = await loadIsolatedArtistResolution();
      const cachedItem: ArtistMeta = {
        imageUrl: 'https://cdn.example.com/cached.jpg',
        headerUrl: 'https://cdn.example.com/cached-header.jpg',
        followers: 55555,
        monthlyListeners: 66666,
        genres: ['Electronic'],
        bio: 'Cached bio',
        verified: true,
        topTracks: []
      };
      mod.ARTIST_META_CACHE.set('electronic star', cachedItem);

      mockFetchHandler = async () => {
        throw new Error('Should not call fetch when cached in ARTIST_META_CACHE');
      };

      const meta = await mod.resolveArtistMetadata('Electronic Star');
      assert.deepStrictEqual(meta, cachedItem);
    });

    it('resolves metadata for catalog superstar using TOP_ARTIST_PROFILES and overview', async () => {
      const mod = await loadIsolatedArtistResolution();

      mockFetchHandler = async (urlStr: string, init?: any) => {
        if (urlStr.includes('queryArtistOverview')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                artistUnion: {
                  __typename: 'Artist',
                  id: '06HL4z0CvFAxyc27GXpf02',
                  profile: {
                    name: 'Taylor Swift',
                    verified: true,
                    biography: { text: 'American singer-songwriter.' }
                  },
                  visuals: {
                    avatarImage: { sources: [{ url: 'https://i.scdn.co/image/ts-avatar.jpg', width: 640 }] },
                    headerImage: { sources: [{ url: 'https://i.scdn.co/image/ts-header.jpg', width: 1200 }] }
                  },
                  stats: {
                    followers: 110000000,
                    monthlyListeners: 95000000
                  },
                  discography: {
                    topTracks: {
                      items: [
                        {
                          track: {
                            id: 'ts1',
                            name: 'Cruel Summer',
                            playcount: '2000000000',
                            duration: { totalMilliseconds: 178000 },
                            albumOfTrack: {
                              id: 'alb1',
                              name: 'Lover',
                              coverArt: { sources: [{ url: 'https://i.scdn.co/image/lover.jpg' }] }
                            },
                            artists: { items: [{ profile: { name: 'Taylor Swift' } }] }
                          }
                        }
                      ]
                    }
                  }
                }
              }
            })
          } as any;
        }
        return { ok: false, status: 500 } as any;
      };

      const meta = await mod.resolveArtistMetadata('Taylor Swift');
      assert.strictEqual(meta.followers, 110000000);
      assert.strictEqual(meta.monthlyListeners, 95000000);
      assert.strictEqual(meta.verified, true);
      assert.strictEqual(meta.imageUrl, 'https://i.scdn.co/image/ts-avatar.jpg');
      assert.strictEqual(meta.headerUrl, 'https://i.scdn.co/image/ts-header.jpg');
      assert.strictEqual(meta.topTracks?.length, 1);
      assert.strictEqual(meta.topTracks?.[0]?.name, 'Cruel Summer');

      // Verify it was cached
      assert.ok(mod.ARTIST_META_CACHE.has('taylor swift'));
    });

    it('falls back to YouTube avatar when Spotify overview has no avatarUrl', async () => {
      const mod = await loadIsolatedArtistResolution();

      mockFetchHandler = async (urlStr: string, init?: any) => {
        if (urlStr.includes('searchDesktop')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                search: {
                  artists: {
                    items: [
                      {
                        uri: 'spotify:artist:customYtArtistId1111',
                        profile: { name: 'Indie Band' }
                      }
                    ]
                  }
                }
              }
            })
          } as any;
        }

        if (urlStr.includes('queryArtistOverview')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                artistUnion: {
                  __typename: 'Artist',
                  profile: { name: 'Indie Band' },
                  visuals: {} // No avatar
                }
              }
            })
          } as any;
        }

        if (urlStr.includes('youtubei/v1/search')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              contents: {
                twoColumnSearchResultsRenderer: {
                  primaryContents: {
                    sectionListRenderer: {
                      contents: [
                        {
                          itemSectionRenderer: {
                            contents: [
                              {
                                channelRenderer: {
                                  thumbnail: {
                                    thumbnails: [{ url: '//yt3.ggpht.com/avatar=s88-c-k' }]
                                  }
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                }
              }
            })
          } as any;
        }

        return { ok: false, status: 500 } as any;
      };

      const meta = await mod.resolveArtistMetadata('Indie Band');
      assert.strictEqual(meta.imageUrl, 'https://yt3.ggpht.com/avatar=s500-c-k-c0x00ffffff-no-rj');
      assert.strictEqual(meta.headerUrl, 'https://yt3.ggpht.com/avatar=s500-c-k-c0x00ffffff-no-rj');
      assert.ok(mod.ARTIST_META_CACHE.has('indie band'));
    });

    it('falls back to ui-avatars.com and does NOT cache when all resolvers fail', async () => {
      const mod = await loadIsolatedArtistResolution();

      mockFetchHandler = async () => {
        return { ok: false, status: 500, json: async () => ({}) } as any;
      };

      const meta = await mod.resolveArtistMetadata('Completely Mystery Artist');
      assert.ok(meta.imageUrl.startsWith('https://ui-avatars.com/api/?name=Completely%20Mystery%20Artist'));
      assert.strictEqual(meta.followers, 0);
      assert.strictEqual(meta.monthlyListeners, 0);
      assert.strictEqual(meta.verified, false);
      assert.deepStrictEqual(meta.genres, ['Pop', 'Top Hits']);

      // UI-avatars fallbacks should NOT be saved in cache
      assert.strictEqual(mod.ARTIST_META_CACHE.has('completely mystery artist'), false);
    });
  });

  describe('isJunkChannel', () => {
    it('returns false when channel name exactly matches query case-insensitively', () => {
      assert.strictEqual(isJunkChannel('Taylor Swift', 'taylor swift'), false);
      assert.strictEqual(isJunkChannel('  DRAKE  ', 'drake'), false);
      assert.strictEqual(isJunkChannel('The Weeknd VEVO', 'The Weeknd VEVO'), false);
    });

    it('rejects composite artist channels when searching for an individual artist', () => {
      assert.strictEqual(isJunkChannel('Dove Cameron, Khalid', 'Khalid'), true);
      assert.strictEqual(isJunkChannel('Drake & 21 Savage', 'Drake'), true);
      assert.strictEqual(isJunkChannel('Eminem feat. Rihanna', 'Eminem'), true);
      assert.strictEqual(isJunkChannel('Post Malone ft. Swae Lee', 'Post Malone'), true);
      assert.strictEqual(isJunkChannel('Calvin Harris with Dua Lipa', 'Dua Lipa'), true);
    });

    it('allows composite channel names if the query itself also contains collaboration tokens', () => {
      assert.strictEqual(isJunkChannel('Dove Cameron, Khalid', 'Dove Cameron, Khalid'), false);
      assert.strictEqual(isJunkChannel('Drake & 21 Savage', 'Drake & 21 Savage'), false);
      assert.strictEqual(isJunkChannel('Eminem feat. Rihanna', 'Eminem feat. Rihanna'), false);
    });

    it('rejects corporate, record label, and commercial junk channels', () => {
      assert.strictEqual(isJunkChannel('Atlantic Records', 'Ed Sheeran'), true);
      assert.strictEqual(isJunkChannel('Sony Music Entertainment', 'Beyoncé'), true);
      assert.strictEqual(isJunkChannel('Queen - Topic', 'Queen'), true);
      assert.strictEqual(isJunkChannel('Taylor Swift VEVO', 'Taylor Swift'), true);
      assert.strictEqual(isJunkChannel('Warner Records Official Audio', 'Dua Lipa'), true);
      assert.strictEqual(isJunkChannel('Universal Music Group Commercial', 'Billie Eilish'), true);
      assert.strictEqual(isJunkChannel('Games Production Series TV', 'Mario'), true);
    });

    it('rejects regional branch channels unless query explicitly searches for them', () => {
      assert.strictEqual(isJunkChannel('Sony Music India', 'Arijit Singh'), true);
      assert.strictEqual(isJunkChannel('Universal Music Brazil', 'Anitta'), true);
      assert.strictEqual(isJunkChannel('Warner Music Philippines', 'SB19'), true);

      // If query explicitly includes the regional token
      assert.strictEqual(isJunkChannel('Sony Music India', 'Sony Music India'), false);
    });

    it('allows valid artist channel names that do not match junk patterns', () => {
      assert.strictEqual(isJunkChannel('Taylor Swift', 'Taylor Swift'), false);
      assert.strictEqual(isJunkChannel('Adele Official', 'Adele'), false);
      assert.strictEqual(isJunkChannel('Bruno Mars', 'Bruno Mars'), false);
    });
  });

  describe('Module Exports & Backward Compatibility', () => {
    it('re-exports resolveSpotifyArtistId from SpotifyScraperPlugin with strict reference identity', () => {
      assert.strictEqual(
        resolveArtistIdFromMonolith,
        resolveSpotifyArtistId,
        'Monolith re-export must strictly reference the extracted resolveSpotifyArtistId function'
      );
    });

    it('allows independent importation of artistResolution without importing SpotifyScraperPlugin', async () => {
      const standalone = await import('../../server/src/plugins/metadata/spotify/artists/artistResolution.js');
      assert.strictEqual(typeof standalone.resolveSpotifyArtistId, 'function');
      assert.strictEqual(typeof standalone.resolveArtistMetadata, 'function');
      assert.strictEqual(typeof standalone.getArtistFollowers, 'function');
      assert.strictEqual(typeof standalone.isJunkChannel, 'function');
      assert.strictEqual(typeof standalone.TOP_ARTIST_SPOTIFY_IDS, 'object');
      assert.ok(standalone.ARTIST_META_CACHE instanceof Map);
    });
  });
});
