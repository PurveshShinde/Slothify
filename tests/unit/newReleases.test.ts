import test, { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

// Preserve original axios adapter
const originalAdapter = axios.defaults.adapter;

let mockAxiosHandler: ((url: string, config?: any) => Promise<any>) | null = null;

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
    data: {},
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {}
  } as any;
};

import { getNewReleases, FALLBACK_CURATED_ALBUMS } from '../../server/src/plugins/metadata/spotify/discovery/newReleases.js';
import { SpotifyScraperPlugin } from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

describe('New Releases & Apple RSS Subsystem Tests', () => {
  beforeEach(() => {
    mockAxiosHandler = null;
  });

  after(() => {
    axios.defaults.adapter = originalAdapter;
  });

  describe('1. Apple Music RSS Parsing', () => {
    it('parses US iTunes RSS feed with 600x600 artwork upgrade and entity decoding', async () => {
      mockAxiosHandler = async (url: string) => {
        if (url.includes('/us/rss/topalbums')) {
          return {
            feed: {
              entry: [
                {
                  id: { attributes: { 'im:id': 'it_12345' } },
                  'im:name': { label: 'Short n&#039; Sweet' },
                  'im:artist': { label: 'Sabrina Carpenter' },
                  'im:image': [
                    { label: 'https://is1-ssl.mzstatic.com/image/thumb/Music/55x55bb.jpg' },
                    { label: 'https://is1-ssl.mzstatic.com/image/thumb/Music/60x60bb.jpg' },
                    { label: 'https://is1-ssl.mzstatic.com/image/thumb/Music/170x170bb.jpg' }
                  ],
                  category: { attributes: { label: 'Pop' } },
                  'im:releaseDate': { label: '2024-08-23T00:00:00-07:00' },
                  'im:itemCount': { label: '12' }
                }
              ]
            }
          };
        }
        return {};
      };

      const albums = await getNewReleases();
      assert.ok(albums.length >= 1);
      const album = albums.find(a => a.id === 'it_12345');
      assert.ok(album);
      assert.equal(album.name, "Short n' Sweet");
      assert.equal(album.artists[0].name, 'Sabrina Carpenter');
      assert.equal(album.images[0].url, 'https://is1-ssl.mzstatic.com/image/thumb/Music/600x600bb.jpg');
      assert.equal(album.genre, 'Pop');
      assert.equal(album.release_date, '2024');
      assert.equal(album.total_tracks, 12);
    });

    it('deduplicates identical albums across US and India feeds', async () => {
      mockAxiosHandler = async (url: string) => {
        if (url.includes('/us/rss/topalbums') || url.includes('/in/rss/topalbums')) {
          return {
            feed: {
              entry: [
                {
                  id: { attributes: { 'im:id': 'it_common' } },
                  'im:name': { label: 'Shared Global Album' },
                  'im:artist': { label: 'Global Star' },
                  'im:image': [{ label: '' }, { label: '' }, { label: 'https://mzstatic.com/170x170bb.jpg' }],
                  category: { attributes: { label: 'Pop' } },
                  'im:releaseDate': { label: '2024-01-01' },
                  'im:itemCount': { label: '10' }
                }
              ]
            }
          };
        }
        return {};
      };

      const albums = await getNewReleases();
      const occurrences = albums.filter(a => a.name.toLowerCase() === 'shared global album');
      assert.equal(occurrences.length, 1);
    });
  });

  describe('2. JioSaavn Releases Parsing', () => {
    it('parses JioSaavn releases with artist mapping and 500x500 artwork upgrade', async () => {
      mockAxiosHandler = async (url: string) => {
        if (url.includes('content.getAlbums')) {
          return [
            {
              albumid: 'saavn_alb_789',
              title: 'Animal &amp; Hits',
              image: 'https://c.saavncdn.com/789/animal-150x150.jpg',
              year: '2023',
              Artist: {
                music: [
                  { name: 'Pritam' },
                  { name: 'Vishal Mishra' }
                ]
              }
            }
          ];
        }
        return {};
      };

      const albums = await getNewReleases();
      const album = albums.find(a => a.id === 'saavn_saavn_alb_789');
      assert.ok(album);
      assert.equal(album.name, 'Animal & Hits');
      assert.equal(album.artists[0].name, 'Pritam, Vishal Mishra');
      assert.equal(album.images[0].url, 'https://c.saavncdn.com/789/animal-500x500.jpg');
      assert.equal(album.release_date, '2023');
      assert.equal(album.genre, 'Bollywood');
    });
  });

  describe('3. Fallback Curated Catalog & Resilience', () => {
    it('returns 14 fallback curated albums when all public endpoints fail or reject', async () => {
      mockAxiosHandler = async () => {
        throw new Error('Network timeout');
      };

      const albums = await getNewReleases();
      assert.equal(albums.length, FALLBACK_CURATED_ALBUMS.length);
      assert.equal(albums.length, 14);
      assert.equal(albums[0].id, 'sp_alb_hitmehard');
      assert.equal(albums[0].name, 'HIT ME HARD AND SOFT');
    });
  });

  describe('4. Class Delegation and Module Compatibility', () => {
    it('SpotifyScraperPlugin.getNewReleases delegates to extracted getNewReleases', async () => {
      mockAxiosHandler = async () => {
        throw new Error('Fallback trigger');
      };

      const plugin = new SpotifyScraperPlugin();
      const albums = await plugin.getNewReleases();
      assert.equal(albums.length, 14);
    });
  });
});
