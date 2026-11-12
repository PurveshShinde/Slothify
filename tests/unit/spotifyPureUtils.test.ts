import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHtmlEntities } from '../../server/src/plugins/metadata/spotify/utils/htmlUtils.js';
import { cleanSearchQuery } from '../../server/src/plugins/metadata/spotify/utils/queryUtils.js';
import {
  stringSimilarity,
  calculateSimilarity,
  isArtistNameMatch,
  calculateArtistRelevanceScore
} from '../../server/src/plugins/metadata/spotify/utils/similarityUtils.js';

describe('Spotify Pure HTML & Query Utilities Tests', () => {
  describe('decodeHtmlEntities', () => {
    it('decodes standard HTML entities properly', () => {
      assert.equal(decodeHtmlEntities('&quot;Hello&quot;'), '"Hello"');
      assert.equal(decodeHtmlEntities('Rock &amp; Roll'), 'Rock & Roll');
      assert.equal(decodeHtmlEntities('Don&#039;t Stop'), "Don't Stop");
      assert.equal(decodeHtmlEntities('&lt;tag&gt;'), '<tag>');
    });

    it('decodes multiple mixed entities in a single string', () => {
      const input = '&quot;Tom &amp; Jerry&#039;s &lt;Great&gt; Adventure&quot;';
      const expected = '"Tom & Jerry\'s <Great> Adventure"';
      assert.equal(decodeHtmlEntities(input), expected);
    });

    it('leaves plain text without entities untouched', () => {
      assert.equal(decodeHtmlEntities('Plain text string'), 'Plain text string');
      assert.equal(decodeHtmlEntities('12345!@#$%^*()'), '12345!@#$%^*()');
    });

    it('preserves exact baseline handling of falsy values (returns empty string)', () => {
      assert.equal(decodeHtmlEntities(null), '');
      assert.equal(decodeHtmlEntities(undefined), '');
      assert.equal(decodeHtmlEntities(''), '');
      assert.equal(decodeHtmlEntities(0), '');
      assert.equal(decodeHtmlEntities(false), '');
      assert.equal(decodeHtmlEntities(NaN), '');
    });

    it('unwraps object with .name property and decodes', () => {
      assert.equal(decodeHtmlEntities({ name: 'Simon &amp; Garfunkel' }), 'Simon & Garfunkel');
    });

    it('unwraps object with .title property when .name is absent and decodes', () => {
      assert.equal(decodeHtmlEntities({ title: 'Song &quot;Hit&quot;' }), 'Song "Hit"');
    });

    it('prioritizes .name over .title if both are present on object', () => {
      assert.equal(
        decodeHtmlEntities({ name: 'Name &amp; Priority', title: 'Title &quot;Secondary&quot;' }),
        'Name & Priority'
      );
    });

    it('converts objects without name or title to String representation', () => {
      assert.equal(decodeHtmlEntities({ other: 123 }), '[object Object]');
    });

    it('converts non-string truthy primitives to string representation', () => {
      assert.equal(decodeHtmlEntities(12345), '12345');
      assert.equal(decodeHtmlEntities(true), 'true');
    });

    it('does not broaden entity decoding beyond the 5 supported entities', () => {
      // Unhandled entities should remain literal as per original implementation
      assert.equal(decodeHtmlEntities('&nbsp;'), '&nbsp;');
      assert.equal(decodeHtmlEntities('&copy;'), '&copy;');
      assert.equal(decodeHtmlEntities('&#x27;'), '&#x27;');
    });
  });

  describe('cleanSearchQuery', () => {
    it('removes the word "by" case-insensitively with word boundaries', () => {
      assert.equal(cleanSearchQuery('Someone Like You by Adele'), 'Someone Like You Adele');
      assert.equal(cleanSearchQuery('STAND BY ME'), 'STAND ME');
      assert.equal(cleanSearchQuery('By Your Side'), 'Your Side');
    });

    it('preserves words that contain "by" as a substring', () => {
      assert.equal(cleanSearchQuery('Lullaby Goodnight'), 'Lullaby Goodnight');
      assert.equal(cleanSearchQuery('Baby One More Time'), 'Baby One More Time');
      assert.equal(cleanSearchQuery('Standby'), 'Standby');
    });

    it('removes parenthetical expressions and their contents', () => {
      assert.equal(cleanSearchQuery('Starboy (feat. Daft Punk)'), 'Starboy');
      assert.equal(cleanSearchQuery('Shape of You (Official Music Video)'), 'Shape of You');
      assert.equal(cleanSearchQuery('Track (Remix) (Radio Edit)'), 'Track');
    });

    it('strips straight quotes and curly apostrophes', () => {
      assert.equal(cleanSearchQuery('"Bohemian Rhapsody"'), 'Bohemian Rhapsody');
      assert.equal(cleanSearchQuery("'Don't Stop'"), 'Dont Stop');
      assert.equal(cleanSearchQuery('It’s My Life'), 'Its My Life');
    });

    it('collapses multiple consecutive spaces and trims leading/trailing whitespace', () => {
      assert.equal(cleanSearchQuery('   Blinding    Lights   '), 'Blinding Lights');
      assert.equal(cleanSearchQuery('   '), '');
      assert.equal(cleanSearchQuery(''), '');
    });

    it('handles combined complex queries matching real-world YouTube/Spotify inputs', () => {
      const raw = '  "Blinding Lights" (Official Audio) by The Weeknd (2020)  ';
      const expected = 'Blinding Lights The Weeknd';
      assert.equal(cleanSearchQuery(raw), expected);
    });
  });

  describe('similarityUtils Direct Module Verification', () => {
    it('verifies stringSimilarity and calculateSimilarity direct imports', () => {
      assert.equal(stringSimilarity('hello', 'hello'), 1.0);
      assert.equal(calculateSimilarity('hello', 'hello'), 1.0);
      assert.equal(stringSimilarity('', ''), 1.0);
      assert.equal(stringSimilarity('abc', 'xyz'), 0.0);
      assert.ok(stringSimilarity('Taylor Swift', 'Taylor Swyft') >= 0.8);
    });

    it('verifies isArtistNameMatch direct imports', () => {
      assert.equal(isArtistNameMatch('The Weeknd', 'the weeknd'), true);
      assert.equal(isArtistNameMatch('Billie Eilish', 'Billie'), true);
      assert.equal(isArtistNameMatch('Kendrick Lamar', 'Kendrick'), true);
      assert.equal(isArtistNameMatch('Drake', 'Eminem'), false);
      assert.equal(isArtistNameMatch('', 'test'), false);
      assert.equal(isArtistNameMatch('test', ''), false);
    });

    it('verifies calculateArtistRelevanceScore direct imports', () => {
      const artist = { name: 'Dua Lipa', followers: { total: 10000000 } };
      const scoreExact = calculateArtistRelevanceScore(artist, 'Dua Lipa');
      const scorePrefix = calculateArtistRelevanceScore(artist, 'Dua');
      const scoreUnrelated = calculateArtistRelevanceScore(artist, 'Coldplay');

      assert.ok(scoreExact > scorePrefix, 'Exact match should score higher than prefix match');
      assert.ok(scorePrefix > scoreUnrelated, 'Prefix match should score higher than unrelated query');
      assert.equal(calculateArtistRelevanceScore({ name: '' }, 'test'), 0);
    });
  });
});

