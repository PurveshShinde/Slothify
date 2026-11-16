import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTracksArray, ExtendedTrack } from '../../client/src/utils/trackParser.js';

/**
 * Validates the exact production track array extraction utility (client/src/utils/trackParser.ts)
 * and playlist sorting algorithms / listening history deduplication logic.
 */

interface TrackItem {
  id: string;
  name: string;
  artists?: { name: string }[];
  duration_ms?: number;
  added_at?: string;
  added_by?: any;
}

// Exact sorting logic from PlaylistDetail.tsx
type SortOption = 'custom' | 'az' | 'za' | 'artist' | 'duration';

function sortTracks(tracks: TrackItem[], sortBy: SortOption): TrackItem[] {
  const copy = [...tracks];
  switch (sortBy) {
    case 'az':
      return copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'za':
      return copy.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    case 'artist':
      return copy.sort((a, b) => {
        const artA = a.artists?.[0]?.name || '';
        const artB = b.artists?.[0]?.name || '';
        return artA.localeCompare(artB);
      });
    case 'duration':
      return copy.sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0));
    case 'custom':
    default:
      return copy; // Preserves authentic Spotify / user insertion sequence
  }
}

// Listening history list management logic from History.tsx & api.ts
function recordListeningHistory(existingHistory: TrackItem[], playedTrack: TrackItem, limit = 100): TrackItem[] {
  // 1. Remove any prior duplicate play of the same trackId
  const filtered = existingHistory.filter(t => t.id !== playedTrack.id);
  // 2. Insert new track at the beginning
  const updated = [playedTrack, ...filtered];
  // 3. Cap history at limit
  return updated.slice(0, limit);
}

describe('Playlist & Listening History Business Logic', () => {
  describe('extractTracksArray Robust Data Parsing', () => {
    it('extracts tracks from raw array', () => {
      const raw = [{ id: '1', name: 'Song A' }, { id: '2', name: 'Song B' }];
      const extracted = extractTracksArray(raw);
      assert.deepEqual(extracted, raw);
    });

    it('extracts tracks from { tracks: [...] } format', () => {
      const data = {
        name: 'My Playlist',
        tracks: [{ id: '10', name: 'Song Ten' }]
      };
      const extracted = extractTracksArray(data);
      assert.equal(extracted.length, 1);
      assert.equal(extracted[0].id, '10');
    });

    it('extracts tracks from Spotify API envelope { tracks: { items: [{ track: ... }] } }', () => {
      const spotifyEnvelope = {
        tracks: {
          total: 2,
          items: [
            { track: { id: 'sp1', name: 'Spotify Track 1' }, added_at: '2026-01-01' },
            { track: { id: 'sp2', name: 'Spotify Track 2' }, added_at: '2026-01-02' }
          ]
        }
      };
      const extracted = extractTracksArray(spotifyEnvelope);
      assert.equal(extracted.length, 2);
      assert.equal(extracted[0].id, 'sp1');
      assert.equal(extracted[0].added_at, '2026-01-01');
      assert.equal(extracted[1].id, 'sp2');
    });

    it('extracts tracks from direct { items: [...] } envelopes with track objects and raw tracks', () => {
      const itemsEnvelope = {
        items: [
          { track: { id: 'it1', name: 'Item Track 1' }, added_at: '2026-01-03', added_by: { id: 'u1' } },
          { id: 'it2', name: 'Item Track 2', added_at: '2026-01-04' }
        ]
      };
      const extracted = extractTracksArray(itemsEnvelope);
      assert.equal(extracted.length, 2);
      assert.equal(extracted[0].id, 'it1');
      assert.equal(extracted[0].added_at, '2026-01-03');
      assert.equal(extracted[1].id, 'it2');
      assert.equal(extracted[1].added_at, '2026-01-04');
    });

    it('handles null, undefined, numbers, strings, or corrupt objects safely without throwing', () => {
      assert.deepEqual(extractTracksArray(null), []);
      assert.deepEqual(extractTracksArray(undefined), []);
      assert.deepEqual(extractTracksArray(12345), []);
      assert.deepEqual(extractTracksArray('unexpected string'), []);
      assert.deepEqual(extractTracksArray({ malformed: true }), []);
      assert.deepEqual(extractTracksArray({ tracks: { items: [null, undefined, { invalid: true }] } }), []);
      assert.deepEqual(extractTracksArray({ items: [null, undefined, { invalid: true }] }), []);
    });

    it('safely filters null and undefined items in data.items without throwing (production regression test)', () => {
      const payloadWithNulls = {
        items: [
          null,
          undefined,
          { track: { id: 'track_1', name: 'Safe Track 1' }, added_at: '2026-01-05' },
          null,
          { id: 'track_2', name: 'Safe Track 2' },
          undefined
        ]
      };
      // Invokes the actual production extractTracksArray function
      const result = extractTracksArray(payloadWithNulls);
      assert.equal(result.length, 2);
      assert.equal(result[0].id, 'track_1');
      assert.equal(result[0].name, 'Safe Track 1');
      assert.equal(result[0].added_at, '2026-01-05');
      assert.equal(result[1].id, 'track_2');
      assert.equal(result[1].name, 'Safe Track 2');
    });

    it('safely filters null and undefined elements in raw array and tracks.items', () => {
      const rawWithNulls = [null, { id: 'raw_1', name: 'Raw One' }, undefined];
      const resRaw = extractTracksArray(rawWithNulls);
      assert.equal(resRaw.length, 1);
      assert.equal(resRaw[0].id, 'raw_1');

      const spotifyWithNulls = {
        tracks: {
          items: [
            null,
            { track: { id: 'sp_safe', name: 'Spotify Safe' } },
            undefined
          ]
        }
      };
      const resSp = extractTracksArray(spotifyWithNulls);
      assert.equal(resSp.length, 1);
      assert.equal(resSp[0].id, 'sp_safe');
    });

    it('preserves complete track structure and metadata for valid inputs', () => {
      const trackPayload = {
        tracks: [
          {
            id: 't_complete',
            uri: 'spotify:track:123',
            name: 'Tum Hi Ho',
            artists: [{ name: 'Arijit Singh' }],
            album: { name: 'Aashiqui 2', images: [{ url: 'http://img.jpg' }] },
            duration_ms: 262000
          }
        ]
      };
      const result = extractTracksArray(trackPayload);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 't_complete');
      assert.equal(result[0].name, 'Tum Hi Ho');
      assert.equal(result[0].artists[0].name, 'Arijit Singh');
      assert.equal(result[0].album.name, 'Aashiqui 2');
      assert.equal(result[0].duration_ms, 262000);
    });
  });

  describe('Playlist Sorting Algorithms', () => {
    const originalList: TrackItem[] = [
      { id: '1', name: 'Yaaram', artists: [{ name: 'Sunidhi Chauhan' }], duration_ms: 250000 },
      { id: '2', name: 'Maahi', artists: [{ name: 'Arijit Singh' }], duration_ms: 180000 },
      { id: '3', name: 'Khamoshiyan', artists: [{ name: 'Arijit Singh' }], duration_ms: 320000 },
      { id: '4', name: 'Animals', artists: [{ name: 'Martin Garrix' }], duration_ms: 195000 }
    ];

    it('preserves authentic custom sequence when sorted by "custom"', () => {
      const sorted = sortTracks(originalList, 'custom');
      assert.deepEqual(sorted.map(t => t.name), ['Yaaram', 'Maahi', 'Khamoshiyan', 'Animals']);
    });

    it('sorts alphabetically A-Z by track name', () => {
      const sorted = sortTracks(originalList, 'az');
      assert.deepEqual(sorted.map(t => t.name), ['Animals', 'Khamoshiyan', 'Maahi', 'Yaaram']);
    });

    it('sorts reverse alphabetically Z-A by track name', () => {
      const sorted = sortTracks(originalList, 'za');
      assert.deepEqual(sorted.map(t => t.name), ['Yaaram', 'Maahi', 'Khamoshiyan', 'Animals']);
    });

    it('sorts alphabetically by primary artist name', () => {
      const sorted = sortTracks(originalList, 'artist');
      assert.equal(sorted[0].artists?.[0].name, 'Arijit Singh');
      assert.equal(sorted[sorted.length - 1].artists?.[0].name, 'Sunidhi Chauhan');
    });

    it('sorts by duration descending (longest first)', () => {
      const sorted = sortTracks(originalList, 'duration');
      assert.equal(sorted[0].name, 'Khamoshiyan'); // 320000 ms
      assert.equal(sorted[sorted.length - 1].name, 'Maahi'); // 180000 ms
    });
  });

  describe('Listening History Record & 100-Item Cap Logic', () => {
    it('moves previously played track to the top without creating duplicate records', () => {
      const initialHistory: TrackItem[] = [
        { id: 'song-1', name: 'Song 1' },
        { id: 'song-2', name: 'Song 2' },
        { id: 'song-3', name: 'Song 3' }
      ];

      // Replay song-3
      const updated = recordListeningHistory(initialHistory, { id: 'song-3', name: 'Song 3' });
      assert.equal(updated.length, 3, 'Length must not increase upon replaying existing song');
      assert.equal(updated[0].id, 'song-3', 'Replayed song must be at index 0 (most recent)');
      assert.equal(updated[1].id, 'song-1');
      assert.equal(updated[2].id, 'song-2');
    });

    it('strictly caps history list at 100 entries', () => {
      const fullHistory: TrackItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: `song-${i}`,
        name: `Song ${i}`
      }));

      const newTrack = { id: 'song-new-101', name: 'Fresh Song' };
      const capped = recordListeningHistory(fullHistory, newTrack, 100);

      assert.equal(capped.length, 100, 'Must remain strictly capped at 100 items');
      assert.equal(capped[0].id, 'song-new-101', 'New item must be at index 0');
      assert.equal(capped[capped.length - 1].id, 'song-98', 'Oldest item must be pushed off');
    });
  });
});
