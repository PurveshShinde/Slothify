import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  POPULAR_SPOTIFY_PLAYLISTS,
  stringSimilarity,
  calculateSimilarity,
  isArtistNameMatch,
  calculateArtistRelevanceScore,
  SpotifyScraperPlugin
} from '../../server/src/plugins/metadata/SpotifyScraperPlugin.js';

describe('SpotifyScraper Pre-Extraction Catalog & Public Utility Tests', () => {
  describe('POPULAR_SPOTIFY_PLAYLISTS Catalog Integrity', () => {
    it('contains exactly 49 curated popular playlists', () => {
      assert.equal(POPULAR_SPOTIFY_PLAYLISTS.length, 49);
    });

    it('contains all required fields with non-empty string values for every playlist', () => {
      for (const item of POPULAR_SPOTIFY_PLAYLISTS) {
        assert.ok(typeof item.id === 'string' && item.id.trim().length > 0, `Missing or invalid id in playlist`);
        assert.ok(typeof item.name === 'string' && item.name.trim().length > 0, `Missing or invalid name for playlist ${item.id}`);
        assert.ok(typeof item.description === 'string' && item.description.trim().length > 0, `Missing or invalid description for playlist ${item.id}`);
        assert.ok(typeof item.image === 'string' && item.image.trim().length > 0, `Missing or invalid image for playlist ${item.id}`);
      }
    });

    it('ensures all playlist IDs conform to the valid 22-character Spotify ID format', () => {
      const spotifyIdRegex = /^[0-9A-Za-z]{22}$/;
      for (const item of POPULAR_SPOTIFY_PLAYLISTS) {
        assert.match(
          item.id,
          spotifyIdRegex,
          `Playlist "${item.name}" has invalid Spotify ID format: "${item.id}" (expected 22 alphanumeric characters)`
        );
      }
    });

    it('ensures all playlist IDs in the catalog are unique with zero duplicate entries', () => {
      const seenIds = new Set<string>();
      for (const item of POPULAR_SPOTIFY_PLAYLISTS) {
        assert.equal(
          seenIds.has(item.id),
          false,
          `Duplicate playlist ID "${item.id}" detected in catalog for playlist "${item.name}"`
        );
        seenIds.add(item.id);
      }
      assert.equal(seenIds.size, 49);
    });

    it('ensures all artwork image references are valid HTTPS URLs with parseable hostnames', () => {
      for (const item of POPULAR_SPOTIFY_PLAYLISTS) {
        assert.ok(typeof item.image === 'string', `Image must be a string for "${item.name}"`);
        let parsed: URL;
        assert.doesNotThrow(() => {
          parsed = new URL(item.image);
        }, `Invalid URL structure for playlist "${item.name}": "${item.image}"`);
        assert.equal(parsed!.protocol, 'https:', `Playlist "${item.name}" image URL must use HTTPS protocol`);
        assert.ok(parsed!.hostname.length > 0, `Playlist "${item.name}" image URL must have a valid hostname`);
      }
    });
  });

  describe('String Similarity Function Properties & Symmetry', () => {
    it('always produces values strictly bounded within [0.0, 1.0]', () => {
      const samplePairs: [string, string][] = [
        ['', ''],
        ['', 'hello'],
        ['hello', ''],
        ['hello', 'hello'],
        ['kitten', 'sitting'],
        ['abcdef', 'uvwxyz'],
        ['The Beatles', 'Beatles'],
        ['Arijit Singh', 'Arjit Singh']
      ];

      for (const [a, b] of samplePairs) {
        const sim = stringSimilarity(a, b);
        assert.ok(sim >= 0.0 && sim <= 1.0, `Expected 0.0 <= sim <= 1.0, got ${sim} for ("${a}", "${b}")`);
      }
    });

    it('is symmetric: stringSimilarity(a, b) === stringSimilarity(b, a)', () => {
      const pairs: [string, string][] = [
        ['Taylor Swift', 'Taylor'],
        ['Ed Sheeran', 'Ed Sheran'],
        ['Kendrick Lamar', 'Drake'],
        ['Coldplay', 'coldplay']
      ];

      for (const [a, b] of pairs) {
        assert.equal(
          stringSimilarity(a, b),
          stringSimilarity(b, a),
          `Asymmetry detected for pair ("${a}", "${b}")`
        );
      }
    });

    it('verifies calculateSimilarity is an exact drop-in alias for stringSimilarity', () => {
      const testCases: [string, string][] = [
        ['Billie Eilish', 'Billie Eilish'],
        ['Post Malone', 'Posty'],
        ['Dua Lipa', 'Dua Lipa Official'],
        ['', 'test']
      ];

      for (const [a, b] of testCases) {
        assert.equal(calculateSimilarity(a, b), stringSimilarity(a, b));
      }
    });

    it('handles identical empty strings and empty vs non-empty edge cases', () => {
      assert.equal(stringSimilarity('', ''), 1.0);
      assert.equal(stringSimilarity('abc', ''), 0.0);
      assert.equal(stringSimilarity('', 'xyz'), 0.0);
    });
  });

  describe('Public Artist Matching & Relevance Scoring Edge Cases', () => {
    it('matches artist names with hyphens, slashes, and normalized punctuation', () => {
      assert.equal(isArtistNameMatch('Jay-Z', 'jay z'), true);
      assert.equal(isArtistNameMatch('AC/DC', 'ac dc'), true);
      assert.equal(isArtistNameMatch("Guns N' Roses", 'guns n roses'), true);
    });

    it('matches condensed artist queries without whitespace', () => {
      assert.equal(isArtistNameMatch('Dove Cameron', 'dovecameron'), true);
      assert.equal(isArtistNameMatch('Taylor Swift', 'taylorswift'), true);
    });

    it('tolerates minor typos in queries with length >= 3', () => {
      assert.equal(isArtistNameMatch('Dua Lipa', 'Dua Lpa'), true);
      assert.equal(isArtistNameMatch('Travis Scott', 'Travis Scot'), true);
    });

    it('calculates artist relevance score with prefix matches scoring higher than generic substrings', () => {
      const prefixArtist = { name: 'Dove Cameron', followers: 500000 };
      const genericArtist = { name: 'White Dove Sanctuary', followers: 500000 };
      const prefixScore = calculateArtistRelevanceScore(prefixArtist, 'dove');
      const genericScore = calculateArtistRelevanceScore(genericArtist, 'dove');

      assert.ok(
        prefixScore > genericScore,
        `Prefix match "${prefixArtist.name}" (${prefixScore}) should score higher than generic match "${genericArtist.name}" (${genericScore})`
      );
    });

    it('handles artist objects with missing, zero, or object-structured follower values without throwing', () => {
      assert.doesNotThrow(() => {
        calculateArtistRelevanceScore({ name: 'Unknown Artist' }, 'Unknown');
        calculateArtistRelevanceScore({ name: 'Zero Fan Band', followers: 0 }, 'Zero');
        calculateArtistRelevanceScore({ name: 'Object Fan Artist', followers: { total: 250000 } }, 'Object');
        calculateArtistRelevanceScore({ name: 'Negative Fallback', followers: -10 }, 'Negative');
      });
    });

    it('verifies logarithmic follower scaling ensures a 10x follower jump yields proportional score increase', () => {
      const baseArtist = { name: 'Target Artist', followers: 1000 };
      const tenXArtist = { name: 'Target Artist', followers: 10000 };
      const hundredXArtist = { name: 'Target Artist', followers: 100000 };

      const baseScore = calculateArtistRelevanceScore(baseArtist, 'Target Artist');
      const tenXScore = calculateArtistRelevanceScore(tenXArtist, 'Target Artist');
      const hundredXScore = calculateArtistRelevanceScore(hundredXArtist, 'Target Artist');

      const delta1 = tenXScore - baseScore;
      const delta2 = hundredXScore - tenXScore;

      // 6 * log10(10000/1000) = 6 * 1 = 6; 6 * log10(100000/10000) = 6 * 1 = 6.
      assert.ok(Math.abs(delta1 - delta2) < 0.001, `Expected logarithmic delta symmetry, got ${delta1} vs ${delta2}`);
      assert.ok(Math.abs(delta1 - 6.0) < 0.001, `Expected 6 * log10(10) = 6.0, got ${delta1}`);
    });
  });

  describe('SpotifyScraperPlugin Class Contract & Static Method Responses', () => {
    const plugin = new SpotifyScraperPlugin();

    it('exposes the standard plugin name "SpotifyScraper"', () => {
      assert.equal(plugin.name, 'SpotifyScraper');
    });

    it('getCuratedPlaylists slices catalog accurately with default and custom limits', () => {
      const defaultSlice = plugin.getCuratedPlaylists();
      assert.equal(defaultSlice.length, 20);
      assert.equal(defaultSlice[0].id, POPULAR_SPOTIFY_PLAYLISTS[0].id);

      const customSlice = plugin.getCuratedPlaylists(5);
      assert.equal(customSlice.length, 5);

      const excessSlice = plugin.getCuratedPlaylists(100);
      assert.equal(excessSlice.length, 49);
    });

    it('getCategories returns exactly 8 standard browse categories with valid structure', async () => {
      const categories = await plugin.getCategories();
      assert.equal(categories.length, 8);
      const expectedIds = ['pop', 'hip-hop', 'rock', 'chill', 'dance-electronic', 'workout', 'focus', 'country'];
      const actualIds = categories.map(c => c.id);
      assert.deepEqual(actualIds, expectedIds);

      for (const cat of categories) {
        assert.ok(cat.id.length > 0);
        assert.ok(cat.name.length > 0);
        assert.ok(Array.isArray(cat.icons) && cat.icons.length > 0);
        assert.ok(cat.icons[0].url.startsWith('https://'));
      }
    });

    it('getFeaturedPlaylists returns 49 formatted playlists matching curated catalog metadata', async () => {
      const featured = await plugin.getFeaturedPlaylists();
      assert.equal(featured.length, 49);

      for (let i = 0; i < featured.length; i++) {
        const feat = featured[i];
        const raw = POPULAR_SPOTIFY_PLAYLISTS[i];
        assert.equal(feat.id, raw.id);
        assert.equal(feat.name, raw.name);
        assert.equal(feat.description, raw.description);
        assert.equal(feat.images[0].url, raw.image);
        assert.equal(feat.owner.id, 'spotify');
        assert.equal(feat.owner.display_name, 'Spotify');
        assert.equal(feat.tracks.total, 50);
      }
    });
  });
});

