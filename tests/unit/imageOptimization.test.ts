import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOptimizedImageUrl,
  getArtistAvatarUrl,
  getTrackThumbnail,
  generateMonogramSvg,
  KNOWN_ARTIST_AVATARS
} from '../../client/src/utils/imageOptimizer.ts';

describe('Image Optimization Utilities', () => {
  describe('getOptimizedImageUrl', () => {
    it('returns empty string for null or undefined input', () => {
      assert.equal(getOptimizedImageUrl(null), '');
      assert.equal(getOptimizedImageUrl(undefined), '');
    });

    it('transforms JioSaavn CDN image dimensions to target size', () => {
      const saavn500 = 'https://c.saavncdn.com/123/Song-Title-500x500.jpg';
      const saavn150 = getOptimizedImageUrl(saavn500, '150');
      assert.equal(saavn150, 'https://c.saavncdn.com/123/Song-Title-150x150.jpg');

      const saavn600 = getOptimizedImageUrl(saavn500, '600');
      assert.equal(saavn600, 'https://c.saavncdn.com/123/Song-Title-600x600.jpg');
    });

    it('transforms Apple / iTunes image dimensions', () => {
      const itunes600 = 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/123/600x600bb.jpg';
      const itunes150 = getOptimizedImageUrl(itunes600, '150');
      assert.equal(itunes150, 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/123/150x150bb.jpg');
    });

    it('transforms Unsplash w=... query parameters', () => {
      const unsplashUrl = 'https://images.unsplash.com/photo-12345?w=1000&auto=format';
      const result = getOptimizedImageUrl(unsplashUrl, '300');
      assert.ok(result.includes('w=300'), `Expected w=300 in ${result}`);
    });

    it('leaves standard non-CDN URLs untouched', () => {
      const genericUrl = 'https://example.com/album-art.png';
      assert.equal(getOptimizedImageUrl(genericUrl, '150'), genericUrl);
    });
  });

  describe('generateMonogramSvg', () => {
    it('generates a valid data:image/svg+xml URI', () => {
      const dataUri = generateMonogramSvg('T', 'Taylor Swift');
      assert.ok(dataUri.startsWith('data:image/svg+xml;utf8,'), 'Must start with SVG data URI prefix');
      assert.ok(dataUri.includes('%3Csvg'), 'Must contain encoded SVG markup');
      assert.ok(dataUri.includes('T'), 'Must contain initial character');
    });

    it('is deterministic: same name always yields same palette & output', () => {
      const uri1 = generateMonogramSvg('E', 'Ed Sheeran');
      const uri2 = generateMonogramSvg('E', 'Ed Sheeran');
      assert.equal(uri1, uri2);
    });
  });

  describe('getArtistAvatarUrl', () => {
    it('uses KNOWN_ARTIST_AVATARS for recognized superstars when no valid image exists', () => {
      const avatar = getArtistAvatarUrl({ name: 'Taylor Swift' }, '150');
      const expectedUrl = getOptimizedImageUrl(KNOWN_ARTIST_AVATARS['taylor swift'], '150');
      assert.equal(avatar, expectedUrl);
    });

    it('falls back to offline SVG monogram for unknown artists with no image', () => {
      const avatar = getArtistAvatarUrl({ name: 'Completely Unknown Indie Musician' });
      assert.ok(avatar.startsWith('data:image/svg+xml;utf8,'));
    });

    it('rejects placeholder images (ui-avatars or unsplash) in favor of known or monogram', () => {
      const avatar = getArtistAvatarUrl({
        name: 'The Weeknd',
        coverImage: 'https://ui-avatars.com/api/?name=TW'
      });
      // Should reject ui-avatars and use known portrait
      const expectedUrl = getOptimizedImageUrl(KNOWN_ARTIST_AVATARS['the weeknd'], '150');
      assert.equal(avatar, expectedUrl);
    });
  });

  describe('getTrackThumbnail', () => {
    it('returns 150px thumbnail when track has multiple album art sizes', () => {
      const track = {
        name: 'Shape of You',
        album: {
          images: [
            { url: 'https://c.saavncdn.com/123/Deluxe-500x500.jpg' },
            { url: 'https://c.saavncdn.com/123/Deluxe-250x250.jpg' }
          ]
        }
      };
      const thumb = getTrackThumbnail(track, '', '150');
      assert.equal(thumb, 'https://c.saavncdn.com/123/Deluxe-150x150.jpg');
    });

    it('falls back to SVG monogram when track has no album artwork', () => {
      const track = { name: 'Acoustic Melody', album: { images: [] } };
      const thumb = getTrackThumbnail(track);
      assert.ok(thumb.startsWith('data:image/svg+xml;utf8,'));
    });
  });
});

