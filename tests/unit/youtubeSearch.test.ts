import test, { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { searchYouTubeInnertubeTracks } from '../../server/src/plugins/metadata/spotify/scrapers/youtubeSearch.js';
import { searchYouTubeInnertubeTracks as searchYouTubeFromPlugin } from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

// Preserve original globalThis.fetch
const originalFetch = globalThis.fetch;

// Pre-install a mock fetch before any test runs to guarantee zero real network access
let mockFetchHandler: ((url: any, init?: any) => Promise<any>) | null = null;

globalThis.fetch = async (url: any, init?: any) => {
  if (mockFetchHandler) {
    return mockFetchHandler(url, init);
  }
  return {
    ok: false,
    status: 500,
    json: async () => ({})
  } as any;
};

function createMockSearchResponse(videoItems: any[]): any {
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
                    contents: videoItems
                  }
                }
              ]
            }
          }
        }
      }
    })
  };
}

describe('YouTube InnerTube Search Scraper Tests', () => {
  afterEach(() => {
    mockFetchHandler = null;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Standard Response Parsing', () => {
    it('correctly parses videoRenderer item into standard Slothify Track format', async () => {
      mockFetchHandler = async () =>
        createMockSearchResponse([
          {
            videoRenderer: {
              videoId: 'dQw4w9WgXcQ',
              title: { runs: [{ text: 'Rick Astley - Never Gonna Give You Up' }] },
              ownerText: { runs: [{ text: 'Rick Astley' }] },
              thumbnail: {
                thumbnails: [
                  { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg', width: 120, height: 90 },
                  { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', width: 480, height: 360 }
                ]
              }
            }
          }
        ]);

      const tracks = await searchYouTubeInnertubeTracks('never gonna give you up');
      assert.equal(tracks.length, 1);
      const track = tracks[0];

      assert.equal(track.id, 'dQw4w9WgXcQ');
      assert.equal(track.uri, 'spotify:track:dQw4w9WgXcQ');
      assert.equal(track.name, 'Never Gonna Give You Up');
      assert.deepEqual(track.artists, [{ name: 'Rick Astley' }]);
      assert.equal(track.album.name, 'Never Gonna Give You Up');
      assert.deepEqual(track.album.images, [{ url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }]);
      assert.equal(track.duration_ms, 180000);
      assert.equal(track.preview_url, null);
    });

    it('falls back to ownerText artist when title does not contain " - "', async () => {
      mockFetchHandler = async () =>
        createMockSearchResponse([
          {
            videoRenderer: {
              videoId: 'abc123xyz',
              title: { runs: [{ text: 'Bohemian Rhapsody' }] },
              ownerText: { runs: [{ text: 'Queen' }] },
              thumbnail: {
                thumbnails: [{ url: 'https://img.youtube.com/thumb.jpg' }]
              }
            }
          }
        ]);

      const tracks = await searchYouTubeInnertubeTracks('bohemian rhapsody');
      assert.equal(tracks.length, 1);
      assert.equal(tracks[0].name, 'Bohemian Rhapsody');
      assert.deepEqual(tracks[0].artists, [{ name: 'Queen' }]);
      assert.equal(tracks[0].album.name, 'Bohemian Rhapsody');
    });

    it('falls back to "Unknown Artist" when neither title hyphen nor ownerText exists', async () => {
      mockFetchHandler = async () =>
        createMockSearchResponse([
          {
            videoRenderer: {
              videoId: 'no_artist_vid',
              title: { runs: [{ text: 'Standalone Track' }] },
              thumbnail: { thumbnails: [] }
            }
          }
        ]);

      const tracks = await searchYouTubeInnertubeTracks('standalone');
      assert.equal(tracks.length, 1);
      assert.equal(tracks[0].name, 'Standalone Track');
      assert.deepEqual(tracks[0].artists, [{ name: 'Unknown Artist' }]);
    });
  });

  describe('Artist / Title Splitting and Cleaning', () => {
    it('splits artist and title on the first " - " separator', async () => {
      mockFetchHandler = async () =>
        createMockSearchResponse([
          {
            videoRenderer: {
              videoId: 'vid1',
              title: { runs: [{ text: 'The Weeknd - Blinding Lights' }] },
              ownerText: { runs: [{ text: 'TheWeekndVEVO' }] }
            }
          }
        ]);

      const [track] = await searchYouTubeInnertubeTracks('blinding lights');
      assert.equal(track.name, 'Blinding Lights');
      assert.deepEqual(track.artists, [{ name: 'The Weeknd' }]);
    });

    it('preserves multi-hyphen titles after splitting on the first hyphen', async () => {
      mockFetchHandler = async () =>
        createMockSearchResponse([
          {
            videoRenderer: {
              videoId: 'vid2',
              title: { runs: [{ text: 'Pink Floyd - Comfortably Numb - Live at Pompeii - 2016' }] },
              ownerText: { runs: [{ text: 'Pink Floyd' }] }
            }
          }
        ]);

      const [track] = await searchYouTubeInnertubeTracks('comfortably numb');
      assert.equal(track.name, 'Comfortably Numb - Live at Pompeii - 2016');
      assert.deepEqual(track.artists, [{ name: 'Pink Floyd' }]);
    });

    it('strips (Official Music Video), [Official Video], and variations case-insensitively', async () => {
      const testCases = [
        { raw: 'Artist - Song (Official Music Video)', expected: 'Song' },
        { raw: 'Artist - Song (Official Video)', expected: 'Song' },
        { raw: 'Artist - Song (Music Video)', expected: 'Song' },
        { raw: 'Artist - Song (Video)', expected: 'Song' },
        { raw: 'Artist - Song [Official Music Video]', expected: 'Song' },
        { raw: 'Artist - Song [Official Video]', expected: 'Song' },
        { raw: 'Artist - Song [Music Video]', expected: 'Song' },
        { raw: 'Artist - Song [Video]', expected: 'Song' },
        { raw: 'Artist - Song (Audio)', expected: 'Song' },
        { raw: 'Artist - Song (Official Audio)', expected: 'Song' },
        { raw: 'Artist - Song [Audio]', expected: 'Song' },
        { raw: 'Artist - Song [Official Audio]', expected: 'Song' },
        { raw: 'Artist - Song (Lyric)', expected: 'Song' },
        { raw: 'Artist - Song (Lyrics)', expected: 'Song' },
        { raw: 'Artist - Song [Lyrics]', expected: 'Song' },
        { raw: 'Artist - Song (HD)', expected: 'Song' },
        { raw: 'Artist - Song (Official Audio) (HD)', expected: 'Song' }
      ];

      for (let i = 0; i < testCases.length; i++) {
        const { raw, expected } = testCases[i];
        mockFetchHandler = async () =>
          createMockSearchResponse([
            {
              videoRenderer: {
                videoId: `vid_${i}`,
                title: { runs: [{ text: raw }] }
              }
            }
          ]);

        const [track] = await searchYouTubeInnertubeTracks('test');
        assert.equal(track.name, expected, `Failed for raw: ${raw}`);
      }
    });
  });

  describe('Thumbnail Handling', () => {
    it('selects the highest resolution thumbnail (last element in array)', async () => {
      mockFetchHandler = async () =>
        createMockSearchResponse([
          {
            videoRenderer: {
              videoId: 'thumb_test',
              title: { runs: [{ text: 'Thumb Test' }] },
              thumbnail: {
                thumbnails: [
                  { url: 'https://img.com/low.jpg', width: 120 },
                  { url: 'https://img.com/med.jpg', width: 320 },
                  { url: 'https://img.com/high.jpg', width: 720 }
                ]
              }
            }
          }
        ]);

      const [track] = await searchYouTubeInnertubeTracks('thumb');
      assert.equal(track.album.images[0].url, 'https://img.com/high.jpg');
    });

    it('falls back to empty string when thumbnail array is empty or absent', async () => {
      mockFetchHandler = async () =>
        createMockSearchResponse([
          {
            videoRenderer: {
              videoId: 'no_thumb_1',
              title: { runs: [{ text: 'No Thumb 1' }] },
              thumbnail: { thumbnails: [] }
            }
          },
          {
            videoRenderer: {
              videoId: 'no_thumb_2',
              title: { runs: [{ text: 'No Thumb 2' }] }
            }
          }
        ]);

      const tracks = await searchYouTubeInnertubeTracks('nothumb');
      assert.equal(tracks[0].album.images[0].url, '');
      assert.equal(tracks[1].album.images[0].url, '');
    });
  });

  describe('Limit Enforcement and Multi-Section Handling', () => {
    it('stops processing when limit is reached within a single section', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        videoRenderer: {
          videoId: `id_${i}`,
          title: { runs: [{ text: `Song ${i}` }] }
        }
      }));

      mockFetchHandler = async () => createMockSearchResponse(items);

      const tracks = await searchYouTubeInnertubeTracks('query', 4);
      assert.equal(tracks.length, 4);
      assert.equal(tracks[0].id, 'id_0');
      assert.equal(tracks[3].id, 'id_3');
    });

    it('traverses across multiple sections until limit is reached', async () => {
      mockFetchHandler = async () => ({
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
                          { videoRenderer: { videoId: 'sec1_1', title: { runs: [{ text: 'Sec1 Song 1' }] } } },
                          { videoRenderer: { videoId: 'sec1_2', title: { runs: [{ text: 'Sec1 Song 2' }] } } }
                        ]
                      }
                    },
                    {
                      itemSectionRenderer: {
                        contents: [
                          { videoRenderer: { videoId: 'sec2_1', title: { runs: [{ text: 'Sec2 Song 1' }] } } },
                          { videoRenderer: { videoId: 'sec2_2', title: { runs: [{ text: 'Sec2 Song 2' }] } } }
                        ]
                      }
                    }
                  ]
                }
              }
            }
          }
        })
      });

      const tracks = await searchYouTubeInnertubeTracks('query', 3);
      assert.equal(tracks.length, 3);
      assert.equal(tracks[0].id, 'sec1_1');
      assert.equal(tracks[1].id, 'sec1_2');
      assert.equal(tracks[2].id, 'sec2_1');
    });

    it('defaults limit to 20 when not specified', async () => {
      const items = Array.from({ length: 30 }, (_, i) => ({
        videoRenderer: {
          videoId: `id_${i}`,
          title: { runs: [{ text: `Song ${i}` }] }
        }
      }));

      mockFetchHandler = async () => createMockSearchResponse(items);

      const tracks = await searchYouTubeInnertubeTracks('query');
      assert.equal(tracks.length, 20);
    });
  });

  describe('Malformed Responses and Edge Cases', () => {
    it('returns empty array when response JSON has no contents', async () => {
      mockFetchHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({})
      });

      const tracks = await searchYouTubeInnertubeTracks('query');
      assert.deepEqual(tracks, []);
    });

    it('returns empty array when sectionList contents is not an array', async () => {
      mockFetchHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          contents: {
            twoColumnSearchResultsRenderer: {
              primaryContents: {
                sectionListRenderer: {
                  contents: null
                }
              }
            }
          }
        })
      });

      const tracks = await searchYouTubeInnertubeTracks('query');
      assert.deepEqual(tracks, []);
    });

    it('ignores sections missing itemSectionRenderer or non-array contents', async () => {
      mockFetchHandler = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          contents: {
            twoColumnSearchResultsRenderer: {
              primaryContents: {
                sectionListRenderer: {
                  contents: [
                    { adSlotRenderer: {} },
                    { itemSectionRenderer: { contents: 'invalid' } },
                    {
                      itemSectionRenderer: {
                        contents: [
                          { channelRenderer: { channelId: 'c1' } },
                          { videoRenderer: { /* missing videoId */ title: { runs: [{ text: 'No Id' }] } } },
                          { videoRenderer: { videoId: 'valid_id', title: { runs: [{ text: 'Valid' }] } } }
                        ]
                      }
                    }
                  ]
                }
              }
            }
          }
        })
      });

      const tracks = await searchYouTubeInnertubeTracks('query');
      assert.equal(tracks.length, 1);
      assert.equal(tracks[0].id, 'valid_id');
    });
  });

  describe('HTTP Failure, Network Errors, and Timeout Resilience', () => {
    it('returns empty array on non-200 HTTP response', async () => {
      mockFetchHandler = async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' })
      });

      const tracks = await searchYouTubeInnertubeTracks('query');
      assert.deepEqual(tracks, []);
    });

    it('returns empty array on network rejection (fetch throws)', async () => {
      mockFetchHandler = async () => {
        throw new Error('Connection reset by peer');
      };

      const tracks = await searchYouTubeInnertubeTracks('query');
      assert.deepEqual(tracks, []);
    });

    it('returns empty array when request aborts due to timeout', async () => {
      mockFetchHandler = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      const tracks = await searchYouTubeInnertubeTracks('query');
      assert.deepEqual(tracks, []);
    });
  });

  describe('Endpoint, Headers, and Request Body Verification', () => {
    it('sends POST request to the exact InnerTube search endpoint with required headers and payload', async () => {
      let capturedUrl: string | null = null;
      let capturedInit: any = null;

      mockFetchHandler = async (url: any, init?: any) => {
        capturedUrl = String(url);
        capturedInit = init;
        return createMockSearchResponse([]);
      };

      await searchYouTubeInnertubeTracks('test query', 10);

      assert.equal(capturedUrl, 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false');
      assert.equal(capturedInit.method, 'POST');
      assert.equal(capturedInit.headers['Content-Type'], 'application/json');
      assert.equal(
        capturedInit.headers['User-Agent'],
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      const parsedBody = JSON.parse(capturedInit.body);
      assert.deepEqual(parsedBody, {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00'
          }
        },
        query: 'test query'
      });

      assert.ok(capturedInit.signal instanceof AbortSignal, 'AbortSignal must be provided');
    });
  });

  describe('Module Exports & Backward Compatibility', () => {
    it('re-exports searchYouTubeInnertubeTracks with strict reference identity from SpotifyScraperPlugin', () => {
      assert.strictEqual(
        searchYouTubeInnertubeTracks,
        searchYouTubeFromPlugin,
        'Exported function reference in SpotifyScraperPlugin must match youtubeSearch module export'
      );
    });
  });
});

