/**
 * Utility for aggressive image optimization.
 * Maps image URLs to appropriate thumbnail sizes (e.g. 150px) for lists,
 * search results, and artist tracklists, reserving 500px/600px for hero
 * headers and the main player bar.
 */

export function getOptimizedImageUrl(
  url?: string | null,
  size: '150' | '300' | '500' | '600' = '150'
): string {
  if (!url) return '';

  // 1. JioSaavn CDN images: replace 500x500 or 50x50 with desired size (e.g. 150x150)
  if (url.includes('saavncdn.com')) {
    return url.replace(/\b(50x50|150x150|250x250|350x350|500x500)\b/g, `${size}x${size}`);
  }

  // 2. Apple / iTunes images: replace 600x600bb / 1000x1000bb with desired size
  if (url.includes('mzstatic.com') || url.includes('apple.com')) {
    return url.replace(/\d+x\d+bb/g, `${size}x${size}bb`);
  }

  // 3. Unsplash images: adjust query param w=...
  if (url.includes('unsplash.com')) {
    if (/[?&]w=\d+/.test(url)) {
      return url.replace(/([?&]w=)\d+/g, `$1${size}`);
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=${size}`;
  }

  // 4. UI Avatars
  if (url.includes('ui-avatars.com')) {
    return url.replace(/size=\d+/g, `size=${size}`);
  }

  return url;
}

/**
 * Helper to pick the most appropriate image from a track or album's images array.
 * For search results and track lists, maps to 150px thumbnail.
 * For hero headers and player bars, requests 500px/600px.
 */
export function getTrackThumbnail(
  track: { album?: { images?: { url: string }[] } } | null | undefined,
  fallback = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=150',
  size: '150' | '300' | '500' | '600' = '150'
): string {
  const images = track?.album?.images;
  if (!images || images.length === 0) return fallback;

  // If Spotify or multi-size array provided (e.g. [640x640, 300x300, 64x64])
  if (size === '150') {
    if (images.length >= 2) {
      // Pick medium (~300px) or small (~64px) instead of 640x640
      const mid = images[1] || images[images.length - 1];
      if (mid?.url) {
        return getOptimizedImageUrl(mid.url, '150');
      }
    }
    return getOptimizedImageUrl(images[0]?.url, '150');
  }

  // For hero / player bar, request 500px/600px
  return getOptimizedImageUrl(images[0]?.url, size);
}
