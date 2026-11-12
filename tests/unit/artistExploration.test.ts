import test, { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

// Preserve original globalThis.fetch and axios adapter
const originalFetch = globalThis.fetch;
const originalAdapter = axios.defaults.adapter;

// Mock handlers
let mockFetchHandler: ((url: string, init?: any) => Promise<any>) | null = null;
let mockAxiosHandler: ((url: string, config?: any) => Promise<any>) | null = null;

// Pre-install mock fetch
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
        accessToken: 'mock-bearer-token-artist-exploration',
        accessTokenExpirationTimestampMs: Date.now() + 3600000
      })
    } as any;
  }

  if (mockFetchHandler) {
    return mockFetchHandler(urlStr, init);
  }

  // Default empty pathfinder response
  if (urlStr.includes('pathfinder/v1/query')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: {} })
    } as any;
  }

  // Default empty YouTube InnerTube response
  if (urlStr.includes('youtubei/v1/search')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [] } } } } })
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
    data: '',
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {}
  } as any;
};

// Imports from the newly extracted module and monolith
import {
  getTopArtists,
  searchArtists,
  getArtistTracks,
  getArtistDetails,
  resolveArtistImage
} from '../../server/src/plugins/metadata/spotify/artists/artistExploration.js';
import { ARTIST_META_CACHE } from '../../server/src/plugins/metadata/spotify/artists/artistResolution.js';
import { SpotifyScraperPlugin } from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

describe('Artist Exploration & Discography Subsystem Tests', () => {
  beforeEach(() => {
    mockFetchHandler = null;
    mockAxiosHandler = null;
    ARTIST_META_CACHE.clear();
  });

  afterEach(() => {
    mockFetchHandler = null;
    mockAxiosHandler = null;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    axios.defaults.adapter = originalAdapter;
  });

  describe('1. resolveArtistImage', () => {
    it('resolves official image for a known superstar from catalog', async () => {
      const url = await resolveArtistImage('The Weeknd');
      assert.ok(url.includes('spotifycdn.com') || url.includes('scdn.co'));
    });

    it('falls back to ui-avatars.com when artist metadata cannot be retrieved', async () => {
      mockFetchHandler = async () => ({
        ok: false,
        status: 404,
        json: async () => ({})
      });

      const url = await resolveArtistImage('Completely Unknown Nonexistent Artist 9999');
      assert.ok(url.includes('ui-avatars.com'));
    });
  });

  describe('2. getTopArtists', () => {
    it('discovers artists from seed playlists, filters invalid names, and returns ranked artists', async () => {
      mockAxiosHandler = async (url) => {
        if (url.includes('37i9dQZF1DXcBWIGoYBM5M')) {
          const html = `
            <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "state": {
                    "data": {
                      "entity": {
                        "name": "Today's Top Hits",
                        "trackList": [
                          { "title": "Song 1", "subtitle": "Dua Lipa" },
                          { "title": "Song 2", "subtitle": "Olivia Rodrigo" },
                          { "title": "Song 3", "subtitle": "Unknown Artist" },
                          { "title": "Song 4", "subtitle": "x" },
                          { "title": "Song 5", "subtitle": "" }
                        ]
                      }
                    }
                  }
                }
              }
            }
            </script>
          `;
          return { data: html, status: 200 };
        }
        return { data: '<html></html>', status: 200 };
      };

      const topArtists = await getTopArtists(5);
      assert.ok(topArtists.length >= 2);
      assert.ok(topArtists.length <= 5);

      const artistNames = topArtists.map(a => a.name.toLowerCase());
      assert.ok(artistNames.includes('dua lipa'));
      assert.ok(artistNames.includes('olivia rodrigo'));
      assert.ok(!artistNames.includes('unknown artist'));
      assert.ok(!artistNames.includes('x'));

      for (const artist of topArtists) {
        assert.ok(artist.id.startsWith('sp_art_'));
        assert.ok(Array.isArray(artist.images));
        assert.ok(typeof artist.followers?.total === 'number');
      }

      // Verify descending sort order by followers
      for (let i = 0; i < topArtists.length - 1; i++) {
        const fCurrent = topArtists[i].followers?.total || 0;
        const fNext = topArtists[i + 1].followers?.total || 0;
        assert.ok(fCurrent >= fNext, `Expected ${fCurrent} >= ${fNext}`);
      }
    });

    it('falls back to catalog superstars when playlist scraping throws network errors', async () => {
      mockAxiosHandler = async () => {
        throw new Error('Spotify embed network timeout');
      };

      const topArtists = await getTopArtists(10);
      assert.equal(topArtists.length, 10);
      for (const artist of topArtists) {
        assert.ok(artist.id.startsWith('sp_art_'));
        assert.ok(artist.images[0].url.length > 0);
      }
    });
  });

  describe('3. searchArtists', () => {
    it('returns getTopArtists when query is empty or whitespace', async () => {
      const emptyResult = await searchArtists('', 5);
      assert.equal(emptyResult.length, 5);
      const wsResult = await searchArtists('   ', 5);
      assert.equal(wsResult.length, 5);
    });

    it('returns direct catalog match for superstar query with metadata', async () => {
      mockFetchHandler = async (url) => {
        if (url.includes('pathfinder/v1/query')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                artistUnion: {
                  stats: { followers: 105000000, monthlyListeners: 110000000 }
                }
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const results = await searchArtists('Taylor Swift', 10);
      assert.ok(results.length >= 1);
      const match = results.find(a => a.name.toLowerCase() === 'taylor swift');
      assert.ok(match, 'Expected Taylor Swift in results');
      assert.equal(match.id, 'sp_art_Taylor%20Swift');
      assert.ok(match.followers?.total >= 10000000);
      assert.ok(match.images[0].url.includes('ab676161'));
    });

    it('enriches Spotify GQL search candidates and filters out junk channels', async () => {
      mockFetchHandler = async (url) => {
        if (url.includes('pathfinder/v1/query')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                searchV2: {
                  artists: {
                    items: [
                      {
                        data: {
                          uri: 'spotify:artist:sp_art_valid',
                          profile: { name: 'Bruno Mars' },
                          visuals: { avatarImage: { sources: [{ url: 'https://img/bruno.jpg' }] } }
                        }
                      },
                      {
                        data: {
                          uri: 'spotify:artist:sp_art_junk',
                          profile: { name: 'Bruno Mars Official VEVO Topic Karaoke' },
                          visuals: { avatarImage: { sources: [] } }
                        }
                      }
                    ]
                  }
                }
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const results = await searchArtists('Bruno Mars', 10);
      const names = results.map(a => a.name);
      assert.ok(names.includes('Bruno Mars'));
      assert.ok(!names.some(n => n.includes('VEVO Topic Karaoke')));
    });

    it('deduplicates duplicate candidate artist names and enforces limit', async () => {
      mockFetchHandler = async (url) => {
        if (url.includes('pathfinder/v1/query')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                searchV2: {
                  artists: {
                    items: [
                      { data: { uri: 'sp:1', profile: { name: 'Adele' }, visuals: { avatarImage: { sources: [] } } } },
                      { data: { uri: 'sp:2', profile: { name: 'adele' }, visuals: { avatarImage: { sources: [] } } } },
                      { data: { uri: 'sp:3', profile: { name: 'ADELE' }, visuals: { avatarImage: { sources: [] } } } }
                    ]
                  }
                }
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const results = await searchArtists('Adele', 2);
      assert.ok(results.length <= 2);
      const uniqueNames = new Set(results.map(a => a.name.toLowerCase()));
      assert.equal(uniqueNames.size, results.length);
    });
  });

  describe('4. getArtistTracks', () => {
    it('returns empty array when artistId and artistName are empty', async () => {
      const res = await getArtistTracks('', '');
      assert.deepEqual(res, []);
    });

    it('strips prefix and discovers top playable songs strictly matching target artist as primary lead', async () => {
      mockFetchHandler = async (url) => {
        if (url.includes('pathfinder/v1/query')) {
          // Return Spotube search tracks
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
                            id: 'track_lead_1',
                            name: 'Starboy',
                            artists: { items: [{ profile: { name: 'The Weeknd' } }, { profile: { name: 'Daft Punk' } }] },
                            albumOfTrack: { name: 'Starboy', coverArt: { sources: [{ url: 'https://img/starboy.jpg' }] } }
                          }
                        }
                      },
                      {
                        item: {
                          data: {
                            id: 'track_featured_leak',
                            name: 'Creepin',
                            artists: { items: [{ profile: { name: 'Metro Boomin' } }, { profile: { name: 'The Weeknd' } }] },
                            albumOfTrack: { name: 'Heroes & Villains', coverArt: { sources: [{ url: 'https://img/heroes.jpg' }] } }
                          }
                        }
                      },
                      {
                        item: {
                          data: {
                            id: 'track_tribute_junk',
                            name: 'Starboy (Tribute Karaoke Version)',
                            artists: { items: [{ profile: { name: 'The Weeknd' } }] },
                            albumOfTrack: { name: 'Karaoke Hits', coverArt: { sources: [{ url: 'https://img/junk.jpg' }] } }
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
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const tracks = await getArtistTracks('sp_art_The%20Weeknd', 'The Weeknd');
      assert.ok(tracks.length >= 1);
      // Lead track must be present
      assert.ok(tracks.some(t => t.name.includes('Starboy')));
      // Leaked track where target artist is NOT primary (Metro Boomin is primary) must be excluded
      assert.ok(!tracks.some(t => t.name === 'Creepin'));
      // Tribute / Karaoke must be excluded
      assert.ok(!tracks.some(t => t.name.includes('Karaoke Version')));
    });

    it('deduplicates canonical titles across live, remix, acoustic, and deluxe versions', async () => {
      mockFetchHandler = async (url) => {
        if (url.includes('pathfinder/v1/query')) {
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
                            id: 't_orig',
                            name: 'Blinding Lights',
                            artists: { items: [{ profile: { name: 'The Weeknd' } }] },
                            albumOfTrack: { name: 'After Hours', coverArt: { sources: [{ url: 'https://img/cover.jpg' }] } }
                          }
                        }
                      },
                      {
                        item: {
                          data: {
                            id: 't_remix',
                            name: 'Blinding Lights (Remix feat. Rosalía)',
                            artists: { items: [{ profile: { name: 'The Weeknd' } }] },
                            albumOfTrack: { name: 'After Hours', coverArt: { sources: [{ url: 'https://img/cover.jpg' }] } }
                          }
                        }
                      },
                      {
                        item: {
                          data: {
                            id: 't_live',
                            name: 'Blinding Lights - Live on SNL',
                            artists: { items: [{ profile: { name: 'The Weeknd' } }] },
                            albumOfTrack: { name: 'Live Album', coverArt: { sources: [{ url: 'https://img/cover.jpg' }] } }
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
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const tracks = await getArtistTracks('sp_art_the_weeknd', 'The Weeknd');
      const blindingLightsTracks = tracks.filter(t => t.name.toLowerCase().includes('blinding lights'));
      assert.equal(blindingLightsTracks.length, 1);
    });

    it('replaces artist profile picture avatar with authentic track cover', async () => {
      mockFetchHandler = async (url) => {
        if (url.includes('/oembed')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              thumbnail_url: 'https://i.scdn.co/image/ab67616d00001e02authentic_album_cover'
            })
          };
        }
        if (url.includes('pathfinder/v1/query')) {
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
                            id: '4cOdK2wGLETKBW3PvgPWqT',
                            name: 'Specific Track',
                            artists: { items: [{ profile: { name: 'Dua Lipa' } }] },
                            albumOfTrack: {
                              name: 'Future Nostalgia',
                              coverArt: { sources: [{ url: 'https://i.scdn.co/image/ab676161profile_pic' }] }
                            }
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
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const tracks = await getArtistTracks('sp_art_dua_lipa', 'Dua Lipa');
      const track = tracks.find(t => t.name === 'Specific Track');
      assert.ok(track);
      assert.equal(track.album.images[0].url, 'https://i.scdn.co/image/ab67616d0000b273authentic_album_cover');
    });
  });

  describe('5. getArtistDetails', () => {
    it('composes complete artist profile including bio, avatar, and genres for known superstar', async () => {
      mockFetchHandler = async (url) => {
        if (url.includes('pathfinder/v1/query')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                artistUnion: {
                  id: '1Xyo4u8uXC1ZmMpatF05PJ',
                  profile: {
                    name: 'The Weeknd',
                    verified: true,
                    biography: { text: 'Canadian singer, songwriter, and record producer.' }
                  },
                  visuals: {
                    avatarImage: { sources: [{ url: 'https://i.scdn.co/image/weeknd_avatar.jpg' }] },
                    headerImage: { sources: [{ url: 'https://i.scdn.co/image/weeknd_header.jpg' }] }
                  },
                  stats: {
                    followers: 85000000,
                    monthlyListeners: 105000000
                  }
                }
              }
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const details = await getArtistDetails('1Xyo4u8uXC1ZmMpatF05PJ', 'The Weeknd');
      assert.equal(details.id, '1Xyo4u8uXC1ZmMpatF05PJ');
      assert.equal(details.name, 'The Weeknd');
      assert.ok(details.coverImage.length > 0);
      assert.ok(details.headerImage.length > 0);
      assert.ok(details.followers >= 80000000);
      assert.ok(details.monthlyListeners >= 100000000);
      assert.ok(Array.isArray(details.genres));
      assert.ok(details.bio.length > 0);
      assert.equal(details.verified, true);
    });

    it('generates fallback bio and ui-avatar when overview cannot be fetched', async () => {
      mockFetchHandler = async () => ({
        ok: false,
        status: 404,
        json: async () => ({})
      });

      const details = await getArtistDetails('sp_art_unknown_indie', 'Unknown Indie Band');
      assert.equal(details.name, 'Unknown Indie Band');
      assert.ok(details.coverImage.includes('ui-avatars.com'));
      assert.ok(details.bio.includes('Unknown Indie Band'));
    });
  });

  describe('6. Class Delegation and Module Independence', () => {
    it('SpotifyScraperPlugin methods delegate cleanly to extracted functions', async () => {
      const plugin = new SpotifyScraperPlugin();

      // resolveArtistImage delegation
      const img = await plugin.resolveArtistImage('The Weeknd');
      assert.ok(img.includes('spotifycdn.com') || img.includes('scdn.co'));

      // getTopArtists delegation
      const top = await plugin.getTopArtists(3);
      assert.equal(top.length, 3);

      // searchArtists delegation
      const artists = await plugin.searchArtists('Taylor Swift', 3);
      assert.ok(artists.length >= 1);

      // getArtistTracks delegation
      const tracks = await plugin.getArtistTracks('sp_art_taylor_swift', 'Taylor Swift');
      assert.ok(Array.isArray(tracks));

      // getArtistDetails delegation
      const details = await plugin.getArtistDetails('sp_art_taylor_swift', 'Taylor Swift');
      assert.ok(details.name.toLowerCase().includes('taylor'));
    });

    it('allows independent importation of artistExploration without importing SpotifyScraperPlugin', async () => {
      const mod = await import('../../server/src/plugins/metadata/spotify/artists/artistExploration.js');
      assert.equal(typeof mod.getTopArtists, 'function');
      assert.equal(typeof mod.searchArtists, 'function');
      assert.equal(typeof mod.getArtistTracks, 'function');
      assert.equal(typeof mod.getArtistDetails, 'function');
      assert.equal(typeof mod.resolveArtistImage, 'function');
    });
  });
});
