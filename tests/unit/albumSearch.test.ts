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
    return {
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'mock-bearer-token-album-search',
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

// Imports from the newly extracted search module and monolith
import { searchAlbums } from '../../server/src/plugins/metadata/spotify/search/albumSearch.js';
import { SpotifyScraperPlugin } from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

describe('Spotify Album Search Subsystem Tests', () => {
  beforeEach(() => {
    mockGqlHandler = null;
    mockAxiosHandler = null;
  });

  afterEach(() => {
    mockGqlHandler = null;
    mockAxiosHandler = null;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    axios.defaults.adapter = originalAdapter;
  });

  describe('1. JioSaavn Parsing and Normalization', () => {
    it('decodes HTML entities in album title and normalizes image from 150x150 to 500x500', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'jio101',
              title: 'Rock &amp; Roll &#039;Anthology&#039;',
              image: 'https://c.saavncdn.com/101/rock-150x150.jpg',
              year: '2023',
              more_info: {
                song_pids: 's1,s2,s3,s4,s5',
                artistMap: { primary_artists: [{ name: 'Led Zeppelin' }] }
              }
            }
          ]
        }
      });

      const albums = await searchAlbums('Rock & Roll');
      assert.equal(albums.length, 1);
      assert.equal(albums[0].id, 'saavn_alb_jio101');
      assert.equal(albums[0].name, "Rock & Roll 'Anthology'");
      assert.equal(albums[0].artists[0].name, 'Led Zeppelin');
      assert.equal(albums[0].images[0].url, 'https://c.saavncdn.com/101/rock-500x500.jpg');
      assert.equal(albums[0].release_date, '2023');
      assert.equal(albums[0].total_tracks, 5);
    });

    it('upgrades 50x50 image URLs to 500x500 and uses default year 2024 when missing', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'jio102',
              name: 'Acoustic Sessions',
              image: 'https://c.saavncdn.com/102/acoustic-50x50.jpg',
              more_info: {
                artistMap: { primary_artists: ['Ed Sheeran'] }
              }
            }
          ]
        }
      });

      const albums = await searchAlbums('Acoustic');
      assert.equal(albums.length, 1);
      assert.equal(albums[0].images[0].url, 'https://c.saavncdn.com/102/acoustic-500x500.jpg');
      assert.equal(albums[0].release_date, '2024');
      assert.equal(albums[0].total_tracks, 10);
    });

    it('falls back to ui-avatars.com when JioSaavn album image is empty', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'jio103',
              title: 'No Artwork Album',
              image: '',
              more_info: {}
            }
          ]
        }
      });

      const albums = await searchAlbums('No Artwork');
      assert.equal(albums.length, 1);
      assert.match(albums[0].images[0].url, /ui-avatars\.com\/api\/\?name=No%20Artwork%20Album/);
    });
  });

  describe('2. Artist Extraction Fallback Hierarchy', () => {
    it('extracts artist names from artistMap.primary_artists profile.name', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'art1',
              title: 'Collab Album',
              more_info: {
                artistMap: {
                  primary_artists: [
                    { profile: { name: 'Daft Punk' } },
                    { name: 'Pharrell Williams' }
                  ]
                }
              }
            }
          ]
        }
      });

      const albums = await searchAlbums('Collab');
      assert.equal(albums[0].artists[0].name, 'Daft Punk, Pharrell Williams');
    });

    it('parses JSON-stringified artistMap with artists array', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'art2',
              title: 'Stringified Map Album',
              more_info: {
                artistMap: JSON.stringify({
                  artists: [{ name: 'The Weeknd' }]
                })
              }
            }
          ]
        }
      });

      const albums = await searchAlbums('Stringified');
      assert.equal(albums[0].artists[0].name, 'The Weeknd');
    });

    it('falls back through subtitle, header_desc, artist, primary_artists, and more_info.primary_artists', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'sub1',
              title: 'Subtitle Test',
              subtitle: 'Kendrick Lamar',
              more_info: {}
            },
            {
              id: 'hd1',
              title: 'Header Test',
              header_desc: 'J. Cole',
              more_info: {}
            },
            {
              id: 'art_str1',
              title: 'Artist String Test',
              artist: 'Drake',
              more_info: {}
            },
            {
              id: 'prim1',
              title: 'Primary String Test',
              primary_artists: 'Travis Scott',
              more_info: {}
            },
            {
              id: 'mi_prim1',
              title: 'More Info Primary Test',
              more_info: { primary_artists: 'Post Malone' }
            },
            {
              id: 'art_obj1',
              title: 'Artist Object Test',
              artist: { name: 'Kanye West' },
              more_info: {}
            }
          ]
        }
      });

      const albums = await searchAlbums('Test', 10);
      const albumMap = new Map(albums.map(a => [a.id, a.artists[0].name]));
      assert.equal(albumMap.get('saavn_alb_sub1'), 'Kendrick Lamar');
      assert.equal(albumMap.get('saavn_alb_hd1'), 'J. Cole');
      assert.equal(albumMap.get('saavn_alb_art_str1'), 'Drake');
      assert.equal(albumMap.get('saavn_alb_prim1'), 'Travis Scott');
      assert.equal(albumMap.get('saavn_alb_mi_prim1'), 'Post Malone');
      assert.equal(albumMap.get('saavn_alb_art_obj1'), 'Kanye West');
    });

    it('rejects "[object Object]" and invalid values, safely defaulting to "Artist"', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'obj_junk',
              title: 'Junk Artist Test',
              subtitle: '[object Object]',
              artist: '[object Object]',
              primary_artists: '[object Object]',
              more_info: { primary_artists: '' }
            }
          ]
        }
      });

      const albums = await searchAlbums('Junk');
      assert.equal(albums[0].artists[0].name, 'Artist');
    });
  });

  describe('3. Spotify GQL Track-to-Album Processing', () => {
    it('processes Spotify GQL tracks into unique album records with authentic Spotify album IDs', async () => {
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
                        id: 'midnights_album_id',
                        uri: 'spotify:track:track1',
                        name: 'Anti-Hero',
                        albumOfTrack: {
                          uri: 'spotify:album:midnights_album_id',
                          name: 'Midnights',
                          coverArt: {
                            sources: [{ url: 'https://i.scdn.co/image/midnights-art.jpg' }]
                          }
                        },
                        artists: {
                          items: [{ profile: { name: 'Taylor Swift' } }]
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

      const albums = await searchAlbums('Midnights');
      assert.equal(albums.length, 1);
      assert.equal(albums[0].name, 'Midnights');
      assert.equal(albums[0].id, 'midnights_album_id');
      assert.equal(albums[0].artists[0].name, 'Taylor Swift');
      assert.equal(albums[0].images[0].url, 'https://i.scdn.co/image/midnights-art.jpg');
      assert.equal(albums[0].release_date, '2024');
      assert.equal(albums[0].total_tracks, 10);
    });

    it('skips Spotify tracks lacking album cover art or album name', async () => {
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
                        id: 'no_art_track',
                        uri: 'spotify:track:no_art_track',
                        name: 'No Art Track',
                        albumOfTrack: {
                          uri: 'spotify:album:no_art_alb',
                          name: 'No Art Album',
                          coverArt: { sources: [] }
                        },
                        artists: { items: [{ profile: { name: 'Test' } }] }
                      }
                    }
                  }
                ]
              }
            }
          }
        })
      });

      const albums = await searchAlbums('No Art');
      assert.equal(albums.length, 0);
    });
  });

  describe('4. Cross-Engine Deduplication', () => {
    it('deduplicates albums present in both JioSaavn and Spotify by normalized name', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'saavn_starboy',
              title: 'Starboy',
              image: 'https://c.saavncdn.com/starboy-150x150.jpg',
              more_info: {
                artistMap: { primary_artists: [{ name: 'The Weeknd' }] }
              }
            }
          ]
        }
      });

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
                        id: 'starboy_track',
                        uri: 'spotify:track:starboy_track',
                        name: 'Starboy',
                        albumOfTrack: {
                          uri: 'spotify:album:spotify_starboy',
                          name: 'Starboy',
                          coverArt: {
                            sources: [{ url: 'https://i.scdn.co/image/starboy-cdn.jpg' }]
                          }
                        },
                        artists: {
                          items: [{ profile: { name: 'The Weeknd' } }]
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

      const albums = await searchAlbums('Starboy');
      // Should deduplicate 'starboy' and keep the first seen
      assert.equal(albums.length, 1);
      assert.equal(albums[0].name, 'Starboy');
    });
  });

  describe('5. Relevance Scoring and Descending Sorting', () => {
    it('ranks exact matches (+200) ahead of prefix (+150), substring (+100), combined (+70), and artist (+50)', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'base1',
              title: 'Something Else Entirely',
              image: 'https://img/base.jpg',
              more_info: { primary_artists: 'Someone Else' } // base +10
            },
            {
              id: 'artist1',
              title: 'Greatest Hits',
              image: 'https://img/art.jpg',
              more_info: { primary_artists: 'Nirvana' } // artist match +50
            },
            {
              id: 'sub1',
              title: 'Live at Nirvana MTV',
              image: 'https://img/sub.jpg',
              more_info: { primary_artists: 'Kurt' } // substring match +100
            },
            {
              id: 'prefix1',
              title: 'Nirvana Unplugged',
              image: 'https://img/prefix.jpg',
              more_info: { primary_artists: 'Various' } // prefix match +150
            },
            {
              id: 'exact1',
              title: 'Nirvana',
              image: 'https://img/exact.jpg',
              more_info: { primary_artists: 'Nirvana' } // exact match +200
            }
          ]
        }
      });

      const albums = await searchAlbums('Nirvana', 10);
      assert.equal(albums.length, 5);
      assert.equal(albums[0].name, 'Nirvana'); // exact (+200)
      assert.equal(albums[1].name, 'Nirvana Unplugged'); // prefix (+150)
      assert.equal(albums[2].name, 'Live at Nirvana MTV'); // substring (+100)
      assert.equal(albums[3].name, 'Greatest Hits'); // artist match (+50)
      assert.equal(albums[4].name, 'Something Else Entirely'); // base (+10)
    });
  });

  describe('6. Default and Explicit Limit Enforcement', () => {
    it('enforces explicit limit parameter', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: Array.from({ length: 30 }, (_, i) => ({
            id: `alb_${i}`,
            title: `Hits Volume ${i}`,
            image: 'https://img/art.jpg',
            more_info: {}
          }))
        }
      });

      const albums = await searchAlbums('Hits', 5);
      assert.equal(albums.length, 5);
    });

    it('defaults to 20 albums when limit is omitted', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: Array.from({ length: 30 }, (_, i) => ({
            id: `alb_${i}`,
            title: `Pop Album ${i}`,
            image: 'https://img/art.jpg',
            more_info: {}
          }))
        }
      });

      const albums = await searchAlbums('Pop');
      assert.equal(albums.length, 20);
    });
  });

  describe('7. Provider Failure and Timeout Resilience', () => {
    it('returns Spotify results when JioSaavn fails with network error', async () => {
      mockAxiosHandler = async () => {
        throw new Error('JioSaavn network timeout');
      };

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
                        id: 't1',
                        uri: 'spotify:track:t1',
                        name: 'Flowers',
                        albumOfTrack: {
                          uri: 'spotify:album:sp_alb1',
                          name: 'Endless Summer Vacation',
                          coverArt: { sources: [{ url: 'https://img/miley.jpg' }] }
                        },
                        artists: { items: [{ profile: { name: 'Miley Cyrus' } }] }
                      }
                    }
                  }
                ]
              }
            }
          }
        })
      });

      const albums = await searchAlbums('Endless Summer');
      assert.equal(albums.length, 1);
      assert.equal(albums[0].name, 'Endless Summer Vacation');
    });

    it('returns JioSaavn results when Spotify GQL fails with HTTP 500', async () => {
      mockGqlHandler = async () => ({
        ok: false,
        status: 500,
        json: async () => ({})
      });

      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'jio_only',
              title: 'Only On Saavn',
              image: 'https://img/saavn.jpg',
              more_info: { primary_artists: 'Local Artist' }
            }
          ]
        }
      });

      const albums = await searchAlbums('Only On Saavn');
      assert.equal(albums.length, 1);
      assert.equal(albums[0].name, 'Only On Saavn');
    });

    it('returns empty array [] when both search engines fail or time out', async () => {
      mockAxiosHandler = async () => {
        throw new Error('JioSaavn down');
      };
      mockGqlHandler = async () => {
        throw new Error('Spotify GQL down');
      };

      const albums = await searchAlbums('NonExistent');
      assert.deepEqual(albums, []);
    });
  });

  describe('8. Class Delegation and Module Compatibility', () => {
    it('SpotifyScraperPlugin.searchAlbums delegates to extracted searchAlbums function', async () => {
      mockAxiosHandler = async () => ({
        data: {
          results: [
            {
              id: 'delegate_alb',
              title: 'Delegation Album',
              image: 'https://img/del.jpg',
              more_info: { primary_artists: 'Delegate Artist' }
            }
          ]
        }
      });

      const plugin = new SpotifyScraperPlugin();
      const albums = await plugin.searchAlbums('Delegation', 10);
      assert.equal(albums.length, 1);
      assert.equal(albums[0].id, 'saavn_alb_delegate_alb');
      assert.equal(albums[0].name, 'Delegation Album');
    });

    it('can import albumSearch independently without importing SpotifyScraperPlugin', async () => {
      const mod = await import('../../server/src/plugins/metadata/spotify/search/albumSearch.js');
      assert.equal(typeof mod.searchAlbums, 'function');
    });
  });
});
