import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreTrackRelevance,
  deduplicateTracks,
  normalizePlayCountToPopularity
} from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';
import {
  scoreTrackRelevance as scoreTrackRelevanceDirect,
  deduplicateTracks as deduplicateTracksDirect,
  normalizePlayCountToPopularity as normalizePlayCountToPopularityDirect
} from '../../server/src/plugins/metadata/spotify/ranking/trackRanking.js';

describe('Track Relevance Scoring & Deduplication', () => {
  describe('normalizePlayCountToPopularity', () => {
    it('normalizes low play counts to minimum baseline (10)', () => {
      assert.equal(normalizePlayCountToPopularity(0), 10);
      assert.equal(normalizePlayCountToPopularity(500), 10);
    });

    it('scales mid-range play counts proportionally', () => {
      const pop50k = normalizePlayCountToPopularity(50000);
      assert.equal(pop50k, 25);

      const pop500k = normalizePlayCountToPopularity(500000);
      assert.equal(pop500k, 45);
    });

    it('caps mega hits with tens of millions of plays near or at 100', () => {
      const pop100m = normalizePlayCountToPopularity(100000000);
      assert.ok(pop100m >= 90 && pop100m <= 100, `Expected popularity 90-100, got ${pop100m}`);
    });

    it('handles unusual, negative, falsy, or NaN inputs safely by returning 10', () => {
      assert.equal(normalizePlayCountToPopularity(null as any), 10);
      assert.equal(normalizePlayCountToPopularity(undefined as any), 10);
      assert.equal(normalizePlayCountToPopularity(-500), 10);
      assert.equal(normalizePlayCountToPopularity(NaN), 10);
    });

    it('verifies exact tier boundaries across the entire piece-wise spectrum', () => {
      assert.equal(normalizePlayCountToPopularity(1000), 10);
      assert.equal(normalizePlayCountToPopularity(50000), 25);
      assert.equal(normalizePlayCountToPopularity(500000), 45);
      assert.equal(normalizePlayCountToPopularity(5000000), 70);
      assert.equal(normalizePlayCountToPopularity(50000000), 90);
      assert.equal(normalizePlayCountToPopularity(1000000000), 100);
    });
  });

  describe('scoreTrackRelevance', () => {
    it('awards major bonuses (+90) for Spotify index 0 canonical hits', () => {
      const canonicalTrack = {
        name: 'Shape of You',
        artists: [{ name: 'Ed Sheeran' }],
        popularity: 90
      };
      const scoreIndex0 = scoreTrackRelevance(canonicalTrack, 'Shape of You', 0);
      const scoreIndex10 = scoreTrackRelevance(canonicalTrack, 'Shape of You', 10);

      assert.ok(scoreIndex0 > scoreIndex10, 'Index 0 must score significantly higher than index 10');
      assert.ok(scoreIndex0 >= 300, `Expected score >= 300 for canonical hit, got ${scoreIndex0}`);
    });

    it('rewards recognized superstar artists', () => {
      const starTrack = {
        name: 'Blinding Lights',
        artists: [{ name: 'The Weeknd' }],
        popularity: 80
      };
      const score = scoreTrackRelevance(starTrack, 'Blinding Lights', 0);
      assert.ok(score > 250);
    });

    it('penalizes knockoff spam where artist name matches the search title', () => {
      const spamTrack = {
        name: 'Shape of You',
        artists: [{ name: 'Shape Of You' }], // knockoff fake artist
        popularity: 5
      };
      const score = scoreTrackRelevance(spamTrack, 'Shape of You', 5);
      const legitimateTrack = {
        name: 'Shape of You',
        artists: [{ name: 'Ed Sheeran' }],
        popularity: 90
      };
      const legitimateScore = scoreTrackRelevance(legitimateTrack, 'Shape of You', 0);

      assert.ok(legitimateScore > score + 200, 'Legitimate song must vastly outperform knockoff spam');
    });

    it('handles artist as a string property equivalently to artists array', () => {
      const trackA = { name: 'Yellow', artist: 'Coldplay', popularity: 50 };
      const trackB = { name: 'Yellow', artists: [{ name: 'Coldplay' }], popularity: 50 };

      assert.equal(
        scoreTrackRelevance(trackA, 'Coldplay', 10),
        scoreTrackRelevance(trackB, 'Coldplay', 10)
      );
    });

    it('evaluates exact artist and multi-word matching tiers', () => {
      const track = { name: 'Untouched', artists: [{ name: 'Indie Band X' }], popularity: 10 };

      // Exact artist query: titleMatched = false, isArtistExact = true -> +100 + 15 = 115
      const scoreExact = scoreTrackRelevance(track, 'Indie Band X', 10);
      assert.equal(scoreExact, 115);

      // Multi-word query matching combined title and artist:
      // trackTitle = 'untouched', primaryArtist = 'indie band x'
      // Query 'Untouched Indie' matches (trackTitle + ' ' + primaryArtist).includes('untouched indie') -> +40 + 15 = 55
      const scoreMulti = scoreTrackRelevance(track, 'Untouched Indie', 10);
      assert.equal(scoreMulti, 55);
    });

    it('penalizes covers/tributes by -100 unless query explicitly includes cover or tribute', () => {
      const normalTrack = { name: 'Fix You', artists: [{ name: 'Unknown Artist' }], popularity: 10 };
      const tributeTrack = { name: 'Fix You (Tribute to Coldplay)', artists: [{ name: 'Unknown Artist' }], popularity: 10 };

      // When query does NOT mention cover or tribute: penalty applies
      const scoreNormal = scoreTrackRelevance(normalTrack, 'Fix You', 10);
      const scoreTribute = scoreTrackRelevance(tributeTrack, 'Fix You', 10);
      assert.equal(scoreNormal - scoreTribute, 100);

      // When track is cover version and query explicitly includes 'cover': penalty is bypassed
      const coverTrack = { name: 'Fix You Cover Version', artists: [{ name: 'Unknown Artist' }], popularity: 10 };
      const scoreWithCoverQuery = scoreTrackRelevance(coverTrack, 'Fix You Cover Version', 10);
      // Exact title match (+100) + combined query bonus (+40) + popularity (+15) = 155
      assert.equal(scoreWithCoverQuery, 155);
    });

    it('suppresses low-play cover artists with fewer than 200,000 plays by -120', () => {
      const lowPlayTrack = { name: 'Famous Song', artists: [{ name: 'Obscure Singer' }], playCount: 50000, popularity: 10 };
      const highPlayTrack = { name: 'Famous Song', artists: [{ name: 'Obscure Singer' }], playCount: 500000, popularity: 10 };

      const scoreLow = scoreTrackRelevance(lowPlayTrack, 'Famous Song', 10);
      const scoreHigh = scoreTrackRelevance(highPlayTrack, 'Famous Song', 10);
      assert.equal(scoreHigh - scoreLow, 120);
    });

    it('awards Spotify engine rank bonuses strictly according to index position', () => {
      const track = { name: 'Track', artists: [{ name: 'Artist' }], popularity: 10 };

      const s0 = scoreTrackRelevance(track, 'Query', 0);
      const s1 = scoreTrackRelevance(track, 'Query', 1);
      const s2 = scoreTrackRelevance(track, 'Query', 2);
      const s3 = scoreTrackRelevance(track, 'Query', 3);
      const s5 = scoreTrackRelevance(track, 'Query', 5);
      const s6 = scoreTrackRelevance(track, 'Query', 6);

      assert.equal(s0 - s6, 90);
      assert.equal(s1 - s6, 55);
      assert.equal(s2 - s6, 35);
      assert.equal(s3 - s6, 20);
      assert.equal(s5 - s6, 20);
    });

    it('falls back to default popularity of 10 when popularity is undefined', () => {
      const trackNoPop = { name: 'Sample', artists: [{ name: 'Indie Artist' }] };
      const trackPop10 = { name: 'Sample', artists: [{ name: 'Indie Artist' }], popularity: 10 };

      assert.equal(
        scoreTrackRelevance(trackNoPop, 'Sample', 10),
        scoreTrackRelevance(trackPop10, 'Sample', 10)
      );
    });
  });

  describe('deduplicateTracks', () => {
    it('filters out fitness/workout/nightcore/tribute spam tracks', () => {
      const rawTracks = [
        {
          id: '1',
          name: 'Shape of You (Workout Remix 128 BPM)',
          artists: [{ name: 'Gym Fitness Music' }],
          score: 150
        },
        {
          id: '2',
          name: 'Shape of You (Nightcore Edit)',
          artists: [{ name: 'Nightcore Squad' }],
          score: 140
        },
        {
          id: '3',
          name: 'Shape of You',
          artists: [{ name: 'Ed Sheeran' }],
          album: { name: '÷ (Deluxe)' },
          score: 350
        }
      ];

      const deduped = deduplicateTracks(rawTracks);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].id, '3');
      assert.equal(deduped[0].name, 'Shape of You');
    });

    it('prioritizes canonical studio album over compilation album', () => {
      const compilationTrack = {
        id: 'comp-1',
        name: 'Teenage Dream',
        artists: [{ name: 'Katy Perry' }],
        album: { name: '100 Pop Hits 2010 Collection' },
        score: 320
      };

      const studioTrack = {
        id: 'studio-1',
        name: 'Teenage Dream',
        artists: [{ name: 'Katy Perry' }],
        album: { name: 'Teenage Dream' },
        score: 310 // even if score is slightly lower, studio album takes precedence over compilation
      };

      const deduped = deduplicateTracks([compilationTrack, studioTrack]);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].id, 'studio-1');
      assert.equal(deduped[0].album.name, 'Teenage Dream');
    });

    it('returns tracks sorted by highest score first', () => {
      const tracks = [
        { id: '1', name: 'Song Low', artists: [{ name: 'Artist A' }], score: 50 },
        { id: '2', name: 'Song High', artists: [{ name: 'Artist B' }], score: 400 },
        { id: '3', name: 'Song Medium', artists: [{ name: 'Artist C' }], score: 200 }
      ];

      const sorted = deduplicateTracks(tracks);
      assert.equal(sorted[0].id, '2');
      assert.equal(sorted[1].id, '3');
      assert.equal(sorted[2].id, '1');
    });

    it('handles empty input arrays cleanly by returning an empty array', () => {
      assert.deepEqual(deduplicateTracks([]), []);
    });

    it('preserves Rule 0: clean original studio recording is retained and acoustic/live version is replaced', () => {
      const studioTrack = { id: 's1', name: 'Creep', artists: [{ name: 'Radiohead' }], score: 200 };
      const acousticTrack = { id: 'a1', name: 'Creep (Acoustic)', artists: [{ name: 'Radiohead' }], score: 300 };

      // Case A: Existing clean studio track must not be replaced by acoustic version
      const resA = deduplicateTracks([studioTrack, acousticTrack]);
      assert.equal(resA.length, 1);
      assert.equal(resA[0].id, 's1');

      // Case B: Existing acoustic version must be replaced by clean studio recording
      const resB = deduplicateTracks([acousticTrack, studioTrack]);
      assert.equal(resB.length, 1);
      assert.equal(resB[0].id, 's1');
    });

    it('preserves Rule 1: Spotify tracks take precedence and inherit cross-provider playCount and popularity metrics', () => {
      // Case A: Spotify track arrives after JioSaavn track -> replaces it and inherits metrics
      const jioTrack = { id: 'saavn_123', uri: 'saavn:123', name: 'Halo', artists: [{ name: 'Beyoncé' }], playCount: 8500000, popularity: 75, score: 200 };
      const spotifyTrack = { id: 'spot_456', uri: 'spotify:track:456', name: 'Halo', artists: [{ name: 'Beyoncé' }], popularity: 70, score: 250 };

      const resA = deduplicateTracks([jioTrack, spotifyTrack]);
      assert.equal(resA.length, 1);
      assert.equal(resA[0].id, 'spot_456');
      assert.equal(resA[0].playCount, 8500000);
      assert.equal(resA[0].popularity, 75);

      // Case B: Spotify track is already present -> retains position and borrows metrics from incoming JioSaavn
      const spotifyFirst = { id: 'spot_456', uri: 'spotify:track:456', name: 'Halo', artists: [{ name: 'Beyoncé' }], popularity: 70, score: 250 };
      const jioSecond = { id: 'saavn_123', uri: 'saavn:123', name: 'Halo', artists: [{ name: 'Beyoncé' }], playCount: 9900000, popularity: 80, score: 200 };

      const resB = deduplicateTracks([spotifyFirst, jioSecond]);
      assert.equal(resB.length, 1);
      assert.equal(resB[0].id, 'spot_456');
      assert.equal(resB[0].playCount, 9900000);
    });

    it('verifies direct module imports from trackRanking.ts', () => {
      assert.equal(typeof normalizePlayCountToPopularityDirect, 'function');
      assert.equal(typeof scoreTrackRelevanceDirect, 'function');
      assert.equal(typeof deduplicateTracksDirect, 'function');
      assert.equal(normalizePlayCountToPopularityDirect(50000), 25);
    });
  });
});

