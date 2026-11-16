import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  stringSimilarity,
  calculateSimilarity,
  isArtistNameMatch,
  calculateArtistRelevanceScore
} from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';
import {
  cleanSaavnQuery,
  normalizeSaavnText,
  levenshteinDistance,
  isTitleFuzzyMatch,
  isArtistFuzzyMatch
} from '../../server/src/plugins/audio/JioSaavnAudioPlugin.js';

describe('String Similarity & Matching Algorithms', () => {
  describe('Levenshtein & String Similarity', () => {
    it('returns 1.0 for identical strings', () => {
      assert.equal(stringSimilarity('Ed Sheeran', 'Ed Sheeran'), 1.0);
      assert.equal(calculateSimilarity('Taylor Swift', 'Taylor Swift'), 1.0);
    });

    it('returns 0.0 for completely disjoint strings', () => {
      assert.equal(stringSimilarity('abcd', 'wxyz'), 0.0);
    });

    it('handles case-insensitive and whitespace variations', () => {
      const sim = stringSimilarity('ed sheeran', 'Ed Sheeran');
      assert.equal(sim, 1.0);
    });

    it('calculates proper partial similarity for close typos', () => {
      const sim = stringSimilarity('Sahiba', 'Saheba');
      assert.ok(sim >= 0.7, `Expected similarity >= 0.7, got ${sim}`);
    });

    it('calculates exact Levenshtein edit distance', () => {
      assert.equal(levenshteinDistance('', ''), 0);
      assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
      assert.equal(levenshteinDistance('flaw', 'lawn'), 2);
    });
  });

  describe('Artist Name Matching (Spotify)', () => {
    it('matches exact artist names regardless of casing or diacritics', () => {
      assert.equal(isArtistNameMatch('Beyoncé', 'beyonce'), true);
      assert.equal(isArtistNameMatch('ROSALÍA', 'rosalia'), true);
    });

    it('matches substring queries', () => {
      assert.equal(isArtistNameMatch('Billie Eilish', 'Billie'), true);
      assert.equal(isArtistNameMatch('The Weeknd', 'Weeknd'), true);
    });

    it('rejects completely unrelated artist names', () => {
      assert.equal(isArtistNameMatch('Drake', 'Taylor Swift'), false);
    });

    it('handles empty or null parameters safely', () => {
      assert.equal(isArtistNameMatch('', 'Drake'), false);
      assert.equal(isArtistNameMatch('Drake', ''), false);
    });
  });

  describe('Artist Relevance Scoring', () => {
    it('scores exact name matches higher than partial matches', () => {
      const exact = calculateArtistRelevanceScore({ name: 'Adele', followers: 50000000 }, 'Adele');
      const partial = calculateArtistRelevanceScore({ name: 'Adele Tribute Band', followers: 5000 }, 'Adele');
      assert.ok(exact > partial, `Exact match (${exact}) should exceed partial match (${partial})`);
    });

    it('rewards high follower counts for recognized chart artists', () => {
      const megaStar = calculateArtistRelevanceScore({ name: 'Coldplay', followers: 45000000 }, 'Coldplay');
      const indieArtist = calculateArtistRelevanceScore({ name: 'Coldplay', followers: 120 }, 'Coldplay');
      assert.ok(megaStar > indieArtist, `Mega star (${megaStar}) should exceed indie artist (${indieArtist})`);
    });
  });

  describe('JioSaavn Query Cleaning & Fuzzy Matching', () => {
    it('strips official/video/remastered junk from query strings', () => {
      const cleaned = cleanSaavnQuery('Shape of You (Official Music Video) [Remastered]');
      assert.equal(cleaned, 'Shape of You');
    });

    it('normalizes alphanumeric text and removes punctuation', () => {
      assert.equal(normalizeSaavnText("Don't Stop Believin' - 2024!"), 'dont stop believin 2024');
    });

    it('fuzzy-matches titles with minor spelling deviations', () => {
      assert.equal(isTitleFuzzyMatch('Sahiba - Jasleen Royal', 'Saheba'), true);
      assert.equal(isTitleFuzzyMatch('Blinding Lights (Remix)', 'Blinding Lights'), true);
    });

    it('fuzzy-matches artist tokens in collaborative tracks', () => {
      assert.equal(isArtistFuzzyMatch('Arijit Singh & Pritam', 'Arijit Singh'), true);
      assert.equal(isArtistFuzzyMatch('Post Malone feat. Swae Lee', 'Swae Lee'), true);
    });
  });
});

