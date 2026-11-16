import test, { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

// Preserve original globalThis.fetch and axios adapter
const originalFetch = globalThis.fetch;
const originalAdapter = axios.defaults.adapter;

// Mock handlers
let mockGqlHandler: ((url: string, init?: any) => Promise<any>) | null = null;
let mockAxiosHandler: ((url: string, config?: any) => Promise<any>) | null = null;

// Pre-install mock fetch for Spotube auth prewarming & Spotify GQL
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
        accessToken: 'mock-bearer-token-track-search',
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
      json: async () => ({ data: { searchV2: { tracksV2: { items: [] } } } })
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
      config,
      request: {}
    } as any;
  }
  return {
    data: { results: [] },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {}
  } as any;
};

// Import modules under test
import { searchTracks } from '../../server/src/plugins/metadata/spotify/search/trackSearch.js';
import { SpotifyScraperPlugin } from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

describe('Spotify Dual-Engine Track Search Tests', () => {
  beforeEach(() => {
    mockGqlHandler = null;
    mockAxiosHandler = null;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    axios.defaults.adapter = originalAdapter;
  });

  describe('1. Empty Query and URL Handling', () => {
    it('returns empty array when query is empty or whitespace', async () => {
      const res1 = await searchTracks('');
      const res2 = await searchTracks('   ');
      assert.deepEqual(res1, []);
      assert.deepEqual(res2, []);
    });

    it('parses JioSaavn direct Album URL correctly', async () => {
      mockAxiosHandler = async (url: string) => {
        if (url.includes('type=album') && url.includes('token=k6vk9964rnM_')) {
          return {
            songs: [
              {
                id: 'song123',
                song: 'Eyes Don&#039;t Lie',
                primary_artists: 'Isabel LaRosa',
                album: 'Eyes Don&#039;t Lie - Single',
                image: 'https://c.saavncdn.com/123/album-150x150.jpg',
                duration: '180',
                media_preview_url: 'https://preview.saavn.com/test.mp3'
              }
            ]
          };
        }
        return { songs: [] };
      };

      const res = await searchTracks('https://www.jiosaavn.com/album/eyes-dont-lie/k6vk9964rnM_');
      assert.equal(res.length, 1);
      assert.equal(res[0].id, 'saavn_song123');
      assert.equal(res[0].uri, 'spotify:track:saavn_song123');
      assert.equal(res[0].name, "Eyes Don't Lie");
      assert.equal(res[0].artists[0].name, 'Isabel LaRosa');
      assert.equal(res[0].album.name, "Eyes Don't Lie - Single");
      assert.equal(res[0].album.images[0].url, 'https://c.saavncdn.com/123/album-500x500.jpg');
      assert.equal(res[0].duration_ms, 180000);
      assert.equal(res[0].preview_url, 'https://preview.saavn.com/test.mp3');
    });

    it('parses JioSaavn direct Song URL correctly', async () => {
      mockAxiosHandler = async (url: string) => {
        if (url.includes('type=song') && url.includes('token=NgUBWTdKB3A')) {
          return {
            song_obj: {
              id: 'song456',
              song: 'Love Me Like You Do &amp; More',
              primary_artists: 'Ellie Goulding',
              album: 'Fifty Shades of Grey',
              image: 'https://c.saavncdn.com/456/song-150x150.jpg',
              duration: '240',
              media_preview_url: 'https://preview.saavn.com/ellie.mp3'
            }
          };
        }
        return {};
      };

      const res = await searchTracks('https://www.jiosaavn.com/song/love-me-like-you-do/NgUBWTdKB3A');
      assert.equal(res.length, 1);
      assert.equal(res[0].id, 'saavn_song456');
      assert.equal(res[0].name, 'Love Me Like You Do & More');
      assert.equal(res[0].artists[0].name, 'Ellie Goulding');
      assert.equal(res[0].album.images[0].url, 'https://c.saavncdn.com/456/song-500x500.jpg');
      assert.equal(res[0].duration_ms, 240000);
    });
  });

  describe('2. Dual-Engine Search & Relevance Scoring', () => {
    it('searches Spotify and JioSaavn in parallel and maps popularity metrics', async () => {
      // Mock Spotify GQL response
      mockGqlHandler = async () => {
        return {
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
                          id: 'spot1',
                          uri: 'spotify:track:spot1',
                          name: 'Blinding Lights',
                          artists: { items: [{ profile: { name: 'The Weeknd' } }] },
                          albumOfTrack: {
                            name: 'After Hours',
                            coverArt: { sources: [{ url: 'https://i.scdn.co/image/spot1' }] }
                          },
                          duration: { totalMilliseconds: 200000 }
                        }
                      }
                    }
                  ]
                }
              }
            }
          })
        };
      };

      // Mock JioSaavn response
      mockAxiosHandler = async (url: string, config?: any) => {
        if (config?.params?.__call === 'search.getResults') {
          return {
            results: [
              {
                id: 'saavn1',
                song: 'Blinding Lights',
                primary_artists: 'The Weeknd',
                album: 'After Hours',
                image: 'https://c.saavncdn.com/bl/cover-150x150.jpg',
                duration: '200',
                play_count: '25000000'
              }
            ]
          };
        }
        if (config?.params?.__call === 'autocomplete.get') {
          return { topquery: { data: [] }, songs: { data: [] } };
        }
        return { results: [] };
      };

      const res = await searchTracks('blinding lights by the weeknd', 10);
      assert.ok(res.length >= 1);
      const top = res[0];
      assert.equal(top.id, 'spot1');
      assert.equal(top.name, 'Blinding Lights');
      assert.equal(top.artists[0].name, 'The Weeknd');
      // Popularity mapped from JioSaavn 25M plays -> 79
      assert.equal((top as any).popularity, 79);
      assert.equal((top as any).playCount, 25000000);
    });

    it('invokes autocomplete fallback when Spotify returns few results', async () => {
      let fallbackSearched = false;

      mockGqlHandler = async (url: string) => {
        if (decodeURIComponent(url).toLowerCase().includes('teenage dream')) {
          fallbackSearched = true;
          return {
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
                            id: 'katy1',
                            uri: 'spotify:track:katy1',
                            name: 'Teenage Dream',
                            artists: { items: [{ profile: { name: 'Katy Perry' } }] },
                            albumOfTrack: {
                              name: 'Teenage Dream',
                              coverArt: { sources: [{ url: 'https://i.scdn.co/image/katy1' }] }
                            },
                            duration: { totalMilliseconds: 227000 }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            })
          };
        }
        // First search ("teenage drea") returns empty
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { searchV2: { tracksV2: { items: [] } } } })
        };
      };

      mockAxiosHandler = async (url: string, config?: any) => {
        if (config?.params?.__call === 'autocomplete.get') {
          return {
            topquery: {
              data: [
                {
                  title: 'Teenage Dream',
                  type: 'song'
                }
              ]
            },
            songs: { data: [] }
          };
        }
        return { results: [] };
      };

      const res = await searchTracks('teenage drea', 10);
      assert.ok(fallbackSearched);
      assert.ok(res.some(t => t.name === 'Teenage Dream'));
    });
  });

  describe('3. Strict No-Remix / No-Junk Guard', () => {
    it('filters out remix, lofi, reverb, and workout tracks when query does not request them', async () => {
      mockGqlHandler = async () => {
        return {
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
                          id: 'clean1',
                          uri: 'spotify:track:clean1',
                          name: 'Golden Hour',
                          artists: { items: [{ profile: { name: 'JVKE' } }] },
                          albumOfTrack: { name: 'this is what ____ feels like', coverArt: { sources: [{ url: 'https://i.scdn.co/image/gh' }] } },
                          duration: { totalMilliseconds: 209000 }
                        }
                      }
                    },
                    {
                      item: {
                        data: {
                          id: 'junk1',
                          uri: 'spotify:track:junk1',
                          name: 'Golden Hour (Lofi Remix)',
                          artists: { items: [{ profile: { name: 'JVKE' } }] },
                          albumOfTrack: { name: 'Lofi Vibes', coverArt: { sources: [{ url: 'https://i.scdn.co/image/lofi' }] } },
                          duration: { totalMilliseconds: 180000 }
                        }
                      }
                    },
                    {
                      item: {
                        data: {
                          id: 'junk2',
                          uri: 'spotify:track:junk2',
                          name: 'Golden Hour - Slowed + Reverb',
                          artists: { items: [{ profile: { name: 'JVKE' } }] },
                          albumOfTrack: { name: 'Slowed', coverArt: { sources: [{ url: 'https://i.scdn.co/image/slowed' }] } },
                          duration: { totalMilliseconds: 230000 }
                        }
                      }
                    }
                  ]
                }
              }
            }
          })
        };
      };

      const res = await searchTracks('golden hour', 10);
      assert.equal(res.length, 1);
      assert.equal(res[0].id, 'clean1');
      assert.equal(res[0].name, 'Golden Hour');
    });

    it('retains remix tracks when the user explicitly searches for remix', async () => {
      mockGqlHandler = async () => {
        return {
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
                          id: 'remix1',
                          uri: 'spotify:track:remix1',
                          name: 'Levitating (feat. DaBaby) - Remix',
                          artists: { items: [{ profile: { name: 'Dua Lipa' } }] },
                          albumOfTrack: { name: 'Future Nostalgia', coverArt: { sources: [{ url: 'https://i.scdn.co/image/dua' }] } },
                          duration: { totalMilliseconds: 203000 }
                        }
                      }
                    }
                  ]
                }
              }
            }
          })
        };
      };

      const res = await searchTracks('levitating remix', 10);
      assert.equal(res.length, 1);
      assert.equal(res[0].id, 'remix1');
    });
  });

  describe('4. Class Delegation and Limit Enforcement', () => {
    it('enforces limit parameter correctly', async () => {
      mockGqlHandler = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              searchV2: {
                tracksV2: {
                  items: Array.from({ length: 30 }, (_, i) => ({
                    item: {
                      data: {
                        id: `track_${i}`,
                        uri: `spotify:track:track_${i}`,
                        name: `Track Song ${i}`,
                        artists: { items: [{ profile: { name: `Artist ${i}` } }] },
                        albumOfTrack: { name: `Album ${i}`, coverArt: { sources: [{ url: `https://i.scdn.co/image/t_${i}` }] } },
                        duration: { totalMilliseconds: 180000 }
                      }
                    }
                  }))
                }
              }
            }
          })
        };
      };

      const res = await searchTracks('track song', 5);
      assert.equal(res.length, 5);
    });

    it('SpotifyScraperPlugin.searchTracks delegates to extracted searchTracks', async () => {
      const plugin = new SpotifyScraperPlugin();
      const res = await plugin.searchTracks('   ');
      assert.deepEqual(res, []);
    });
  });
});
