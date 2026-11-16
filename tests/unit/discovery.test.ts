import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getFeaturedPlaylists,
  getTopTracks,
  getCategories,
  getCategoryPlaylists,
  getRecommendations,
  getSmartMoodSuggestions,
  PINNED_FIRST_TOP_TRACK,
  STANDARD_CATEGORIES
} from '../../server/src/plugins/metadata/spotify/discovery/discovery.js';
import { SpotifyScraperPlugin } from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';
import type { Playlist, Track } from '../../server/src/plugins/interfaces.js';

describe('Discovery & Mood Suggestions Subsystem Tests', () => {
  describe('1. getFeaturedPlaylists', () => {
    it('returns featured playlists mapped from popular Spotify playlists catalog', async () => {
      const playlists = await getFeaturedPlaylists();
      assert.ok(playlists.length > 0);
      assert.ok(playlists[0].id);
      assert.ok(playlists[0].name);
      assert.equal(playlists[0].owner.id, 'spotify');
      assert.equal(playlists[0].tracks.total, 50);
    });
  });

  describe('2. getTopTracks', () => {
    it('prepends pinned first track and excludes duplicate Eyes Don\'t Lie tracks from scraped playlist', async () => {
      const mockPlaylistScraper = async (id: string): Promise<Playlist> => {
        assert.equal(id, '37i9dQZF1DXcBWIGoYBM5M');
        return {
          id,
          name: "Today's Top Hits",
          tracks: {
            items: [
              { track: { id: 'dup-eyes', name: "Eyes Don't Lie (Remix)", artists: [{ name: 'Isabel' }], duration_ms: 150000 } as any },
              { track: { id: 'track-2', name: 'Espresso', artists: [{ name: 'Sabrina Carpenter' }], duration_ms: 180000 } as any },
              { track: { id: 'track-3', name: 'Birds of a Feather', artists: [{ name: 'Billie Eilish' }], duration_ms: 190000 } as any }
            ]
          }
        } as any;
      };

      const tracks = await getTopTracks(mockPlaylistScraper);
      assert.equal(tracks.length, 3);
      assert.equal(tracks[0].id, PINNED_FIRST_TOP_TRACK.id);
      assert.equal(tracks[0].name, "Eyes Don't Lie");
      assert.equal(tracks[1].name, 'Espresso');
      assert.equal(tracks[2].name, 'Birds of a Feather');
    });

    it('falls back to [PINNED_FIRST_TOP_TRACK] when playlist scrape throws', async () => {
      const failingScraper = async (): Promise<Playlist> => {
        throw new Error('Embed timeout');
      };

      const tracks = await getTopTracks(failingScraper);
      assert.equal(tracks.length, 1);
      assert.equal(tracks[0].id, PINNED_FIRST_TOP_TRACK.id);
    });
  });

  describe('3. getCategories & getCategoryPlaylists', () => {
    it('returns standard categories list with 8 core genres', async () => {
      const categories = await getCategories();
      assert.equal(categories.length, 8);
      assert.deepEqual(categories, STANDARD_CATEGORIES);
      assert.ok(categories.some(c => c.id === 'pop'));
      assert.ok(categories.some(c => c.id === 'hip-hop'));
      assert.ok(categories.some(c => c.id === 'chill'));
    });

    it('returns featured playlists for any category id', async () => {
      const playlists = await getCategoryPlaylists('rock');
      assert.ok(playlists.length > 0);
      assert.equal(playlists[0].owner.id, 'spotify');
    });
  });

  describe('4. getRecommendations', () => {
    it('returns top tracks as recommendations', async () => {
      const tracks = await getRecommendations(['seed1', 'seed2']);
      assert.ok(tracks.length > 0);
      assert.equal(tracks[0].id, PINNED_FIRST_TOP_TRACK.id);
    });
  });

  describe('5. getSmartMoodSuggestions', () => {
    it('discovers and deduplicates artist tracks from Spotify & YouTube excluding current track', async () => {
      const mockSpotubeFn = async (query: string, limit: number): Promise<Track[]> => [
        { id: 'sp1', name: 'Cruel Summer', artists: [{ name: 'Taylor Swift' }] } as any,
        { id: 'sp2', name: 'Anti-Hero', artists: [{ name: 'Taylor Swift' }] } as any,
        { id: 'sp3', name: 'Cardigan', artists: [{ name: 'Taylor Swift' }] } as any
      ];

      const mockYtFn = async (query: string, limit: number): Promise<Track[]> => [
        { id: 'yt1', name: 'Lover', artists: [{ name: 'Taylor Swift' }] } as any,
        { id: 'yt2', name: 'Anti-Hero', artists: [{ name: 'Taylor Swift' }] } as any, // duplicate of sp2
        { id: 'yt3', name: 'Fortnight', artists: [{ name: 'Taylor Swift' }] } as any
      ];

      const suggestions = await getSmartMoodSuggestions('anti-hero', 'Taylor Swift', {
        searchSpotubeFn: mockSpotubeFn,
        searchYtFn: mockYtFn
      });

      // 'Anti-Hero' should be filtered out because it matches trackName
      assert.ok(!suggestions.some(s => s.name.toLowerCase() === 'anti-hero'));
      assert.ok(suggestions.some(s => s.name === 'Cruel Summer'));
      assert.ok(suggestions.some(s => s.name === 'Cardigan'));
      assert.ok(suggestions.some(s => s.name === 'Lover'));
      assert.ok(suggestions.some(s => s.name === 'Fortnight'));
    });

    it('falls back to searchTracks when fewer than 5 items are found', async () => {
      let searchTracksCalled = false;
      const mockSpotubeFn = async (): Promise<Track[]> => [
        { id: 'sp1', name: 'Unique Song', artists: [{ name: 'Niche Artist' }] } as any
      ];
      const mockYtFn = async (): Promise<Track[]> => [];
      const mockSearchTracksFn = async (query: string, limit: number): Promise<Track[]> => {
        searchTracksCalled = true;
        return [
          { id: 'st1', name: 'Discovered Track 1', artists: [{ name: 'Niche Artist' }] } as any,
          { id: 'st2', name: 'Discovered Track 2', artists: [{ name: 'Niche Artist' }] } as any
        ];
      };

      const suggestions = await getSmartMoodSuggestions('Different Song', 'Niche Artist', {
        searchSpotubeFn: mockSpotubeFn,
        searchYtFn: mockYtFn,
        searchTracksFn: mockSearchTracksFn
      });

      assert.ok(searchTracksCalled);
      assert.equal(suggestions.length, 3);
    });

    it('falls back to getTopTracks when no suggestions are found', async () => {
      const mockGetTop = async (): Promise<Track[]> => [PINNED_FIRST_TOP_TRACK];

      const suggestions = await getSmartMoodSuggestions('', '', {
        searchSpotubeFn: async () => [],
        searchYtFn: async () => [],
        searchTracksFn: async () => [],
        getTopTracksFn: mockGetTop
      });

      assert.equal(suggestions.length, 1);
      assert.equal(suggestions[0].id, PINNED_FIRST_TOP_TRACK.id);
    });
  });

  describe('6. Class Delegation & Module Compatibility', () => {
    it('SpotifyScraperPlugin class methods delegate cleanly to discovery functions', async () => {
      const plugin = new SpotifyScraperPlugin();

      const featured = await plugin.getFeaturedPlaylists();
      assert.ok(featured.length > 0);

      const categories = await plugin.getCategories();
      assert.equal(categories.length, 8);

      const catPlaylists = await plugin.getCategoryPlaylists('pop');
      assert.ok(catPlaylists.length > 0);

      const recs = await plugin.getRecommendations(['seed']);
      assert.ok(recs.length > 0);

      const topTracks = await plugin.getTopTracks();
      assert.ok(topTracks.length > 0);
      assert.equal(topTracks[0].id, PINNED_FIRST_TOP_TRACK.id);
    });
  });
});

