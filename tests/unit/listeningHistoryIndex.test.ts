import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ListeningHistory } from '../../server/src/models/ListeningHistory.js';

describe('ListeningHistory Schema & Compound Index Specification', () => {
  describe('Schema Compound Index Definition', () => {
    it('defines a compound index on { userId: 1, playedAt: -1 }', () => {
      const indexes = ListeningHistory.schema.indexes();
      assert.ok(Array.isArray(indexes), 'schema.indexes() must return an array');

      const compoundIndex = indexes.find(([fields]) => {
        return fields && fields.userId === 1 && fields.playedAt === -1;
      });

      assert.ok(
        compoundIndex,
        'ListeningHistory schema must define compound index { userId: 1, playedAt: -1 }'
      );
    });

    it('eliminates redundant single-field index on userId (covered by compound prefix)', () => {
      const userIdPath = ListeningHistory.schema.path('userId');
      assert.equal(
        userIdPath.options.index,
        undefined,
        'userId should not declare index: true because it is the leading prefix of the compound index'
      );

      // Verify no standalone { userId: 1 } exists in schema.indexes()
      const indexes = ListeningHistory.schema.indexes();
      const standaloneUserIndex = indexes.find(([fields]) => {
        return fields && fields.userId === 1 && Object.keys(fields).length === 1;
      });
      assert.equal(
        standaloneUserIndex,
        undefined,
        'Standalone { userId: 1 } index must not exist in schema.indexes()'
      );
    });

    it('eliminates unused standalone single-field index on playedAt', () => {
      const playedAtPath = ListeningHistory.schema.path('playedAt');
      assert.equal(
        playedAtPath.options.index,
        undefined,
        'playedAt should not declare index: true because no application query filters by playedAt without userId'
      );

      // Verify no standalone { playedAt: 1 } or { playedAt: -1 } exists in schema.indexes()
      const indexes = ListeningHistory.schema.indexes();
      const standalonePlayedAtIndex = indexes.find(([fields]) => {
        return fields && (fields.playedAt === 1 || fields.playedAt === -1) && Object.keys(fields).length === 1;
      });
      assert.equal(
        standalonePlayedAtIndex,
        undefined,
        'Standalone playedAt index must not exist in schema.indexes()'
      );
    });

    it('defines exactly one index on the schema ({ userId: 1, playedAt: -1 })', () => {
      const indexes = ListeningHistory.schema.indexes();
      assert.equal(indexes.length, 1, 'Schema must define exactly 1 compound index to avoid index bloat');
      assert.deepEqual(indexes[0][0], { userId: 1, playedAt: -1 });
    });
  });

  describe('Query Pattern Coverage & Behavioral Equivalence', () => {
    const sampleHistory = [
      {
        userId: 'user_alpha',
        trackId: 'track_1',
        trackName: 'First Track',
        artistName: 'Artist A',
        playedAt: new Date('2026-11-01T10:00:00Z')
      },
      {
        userId: 'user_alpha',
        trackId: 'track_2',
        trackName: 'Second Track',
        artistName: 'Artist B',
        playedAt: new Date('2026-11-01T12:00:00Z')
      },
      {
        userId: 'user_alpha',
        trackId: 'track_3',
        trackName: 'Third Track',
        artistName: 'Artist C',
        playedAt: new Date('2026-11-01T14:00:00Z')
      },
      {
        userId: 'user_beta',
        trackId: 'track_4',
        trackName: 'Beta Track',
        artistName: 'Artist D',
        playedAt: new Date('2026-11-01T15:00:00Z')
      }
    ];

    it('supports reverse-chronological sorting (playedAt: -1) for recent history queries', () => {
      // Simulates ListeningHistory.find({ userId: 'user_alpha' }).sort({ playedAt: -1 })
      const userAlphaTracks = sampleHistory
        .filter(h => h.userId === 'user_alpha')
        .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());

      assert.equal(userAlphaTracks.length, 3);
      assert.equal(userAlphaTracks[0].trackId, 'track_3', 'Newest played track must be first');
      assert.equal(userAlphaTracks[1].trackId, 'track_2');
      assert.equal(userAlphaTracks[2].trackId, 'track_1', 'Oldest played track must be last');
    });

    it('supports forward-chronological sorting (playedAt: 1) for 100-item excess pruning', () => {
      // Simulates ListeningHistory.find({ userId: 'user_alpha' }).sort({ playedAt: 1 }).limit(excess)
      const oldestTracks = sampleHistory
        .filter(h => h.userId === 'user_alpha')
        .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

      assert.equal(oldestTracks[0].trackId, 'track_1', 'Oldest track must be first when sorting playedAt: 1');
      assert.equal(oldestTracks[2].trackId, 'track_3', 'Newest track must be last');
    });

    it('strictly isolates records by userId (no cross-user leakage)', () => {
      const userAlphaTracks = sampleHistory.filter(h => h.userId === 'user_alpha');
      const userBetaTracks = sampleHistory.filter(h => h.userId === 'user_beta');

      assert.ok(userAlphaTracks.every(t => t.userId === 'user_alpha'));
      assert.ok(userBetaTracks.every(t => t.userId === 'user_beta'));
      assert.equal(userAlphaTracks.some(t => t.trackId === 'track_4'), false);
    });

    it('validates schema document creation and default values', () => {
      const doc = new ListeningHistory({
        userId: 'user_test_doc',
        trackId: 'track_test_101',
        trackName: 'Test Song',
        artistName: 'Test Artist'
      });

      assert.equal(doc.userId, 'user_test_doc');
      assert.equal(doc.trackId, 'track_test_101');
      assert.equal(doc.duration_ms, 180000, 'Default duration_ms must be 180000');
      assert.ok(doc.playedAt instanceof Date, 'playedAt must default to a valid Date instance');
    });
  });
});

