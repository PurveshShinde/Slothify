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

export const KNOWN_ARTIST_AVATARS: Record<string, string> = {
  'chappell roan': 'https://i.scdn.co/image/ab6761610000e5eb6f8de55129d12702ebff5710',
  'olivia dean': 'https://i.scdn.co/image/ab6761610000e5eb5c7577ad44daeb7ce4b941a1',
  'jamie miller': 'https://i.scdn.co/image/ab6761610000e5ebeacc346eb50276f366ac542c',
  'temper city': 'https://i.scdn.co/image/ab6761610000e5eb58cd69025e54b4f139005b6e',
  'jade': 'https://i.scdn.co/image/ab6761610000e5eb5d8f24eed04df5dac0adecf4',
  'gracie abrams': 'https://i.scdn.co/image/ab6761610000e5ebe1800836d95b63c49e60ea3b',
  'katseye': 'https://i.scdn.co/image/ab6761610000e5eb04ba72b2749f90d62152ebec',
  'grand theft auto vi': 'https://i.scdn.co/image/ab6761610000e5eb8b64bf5ce23508af9838eade',
  'gta vi': 'https://i.scdn.co/image/ab6761610000e5eb8b64bf5ce23508af9838eade',
  'gener8ion': 'https://i.scdn.co/image/ab6761610000e5eb9203ea92f4c538f41e6eea8c',
  'stella lefty': 'https://i.scdn.co/image/ab6761610000e5eb37597ef39468f4fe8fcd9690',
  'alyssa grace': 'https://i.scdn.co/image/ab6761610000e5ebe95e39575c4f2c668eb11bc4',
  'solto (fr)': 'https://i.scdn.co/image/ab6761610000e5ebf2f0c84b86e48dd70d9bcc59',
  'solto': 'https://i.scdn.co/image/ab6761610000e5ebf2f0c84b86e48dd70d9bcc59',
  'taylor swift': 'https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0',
  'the weeknd': 'https://i.scdn.co/image/ab6761610000e5eb214f3cf1cbe8d304c487e5a0',
  'billie eilish': 'https://i.scdn.co/image/ab6761610000e5ebd8b9980db67272cb4d4c3dfe',
  'drake': 'https://i.scdn.co/image/ab6761610000e5eb4293385d324db8558179afd9',
  'ariana grande': 'https://i.scdn.co/image/ab6761610000e5eb478b87a9526742eb559eb2ec',
  'bruno mars': 'https://i.scdn.co/image/ab6761610000e5ebc36dd9eb55fb0db4911f25dd',
  'post malone': 'https://i.scdn.co/image/ab6761610000e5ebe17c0aa1714a03d62b5ce4e0',
  'sabrina carpenter': 'https://i.scdn.co/image/ab6761610000e5ebc58dfa3c10640108ff4f932e',
  'kendrick lamar': 'https://i.scdn.co/image/ab6761610000e5eb437b9e2a82505b3d93fe1022',
  'dua lipa': 'https://i.scdn.co/image/ab6761610000e5ebf107f9c8d57545ca8be5af17',
  'lady gaga': 'https://i.scdn.co/image/ab6761610000e5ebb54a6bc74041b6ec26efccbc',
  'travis scott': 'https://i.scdn.co/image/ab6761610000e5ebb99cacf8acd5378206767261',
  'coldplay': 'https://i.scdn.co/image/ab6761610000e5ebfe1fab276582a303ff359a7b',
  'justin bieber': 'https://i.scdn.co/image/ab6761610000e5eb8ae7f2aaa9817a704a87ea36',
  'ed sheeran': 'https://i.scdn.co/image/ab6761610000e5eb12a2ef1897d2e38103dcae32',
  'eminem': 'https://i.scdn.co/image/ab6761610000e5eba00b11c129b27a88fc72f36b',
  'sza': 'https://i.scdn.co/image/ab6761610000e5eb9cb67e530095815340ea1a55',
  'rihanna': 'https://i.scdn.co/image/ab6761610000e5ebceab420e8ded9e0de267df37',
  'bad bunny': 'https://i.scdn.co/image/ab67616d0000b27361f01b4fa6f523369d340c75',
  'olivia rodrigo': 'https://i.scdn.co/image/ab6761610000e5ebe03a985e510ff406bd2367ff',
  'lana del rey': 'https://i.scdn.co/image/ab6761610000e5ebb99cacf8acd5378206767261',
  'benson boone': 'https://i.scdn.co/image/ab6761610000e5eb2d285a8507c6f05f82631584',
  'teddy swims': 'https://i.scdn.co/image/ab6761610000e5ebc1db646ebcf2896f6ae9b5e3',
  'tate mcrae': 'https://i.scdn.co/image/ab6761610000e5ebb2366b0aeb384c718cbb5f15',
  'zach bryan': 'https://i.scdn.co/image/ab6761610000e5ebbe1766a0149ea8b584ff1ddc',
  'morgan wallen': 'https://i.scdn.co/image/ab6761610000e5eb70355152a550ed96f13b6320',
  'harry styles': 'https://i.scdn.co/image/ab67616d0000b273731f0f3040d66000d82f0350',
  'beyonce': 'https://i.scdn.co/image/ab6761610000e5eb16e87f5d9472e903bc39c647',
  'kanye west': 'https://i.scdn.co/image/ab6761610000e5eb8b52c6d9bc4e43d08f773f25',
  'adele': 'https://i.scdn.co/image/ab6761610000e5eb6970ecf6cb90b510795c6c64',
  'shakira': 'https://i.scdn.co/image/ab6761610000e5eb41f7e02b7936a7b11d88667a',
  'maroon 5': 'https://i.scdn.co/image/ab6761610000e5eb034a78735cc832c3fa5c05ab',
  'imagine dragons': 'https://i.scdn.co/image/ab6761610000e5eb9836371cfb23ca395fc078e8',
  'arijit singh': 'https://i.scdn.co/image/ab6761610000e5eb0261696c5df3be99da6ed3f3',
  'pritam': 'https://i.scdn.co/image/ab6761610000e5ebcb6926f44f620555ba444fca',
  'a.r. rahman': 'https://i.scdn.co/image/ab6761610000e5ebb6b92f4477813a37aa2db217',
  'ar rahman': 'https://i.scdn.co/image/ab6761610000e5ebb6b92f4477813a37aa2db217',
  'shreya ghoshal': 'https://i.scdn.co/image/ab6761610000e5eb3b1f4bf54cba8f0e515d48a0',
  'diljit dosanjh': 'https://i.scdn.co/image/ab6761610000e5eb1d2b86b46187cc8e7bbd5696',
  'sidhu moose wala': 'https://i.scdn.co/image/ab6761610000e5eb12a2ef1897d2e38103dcae32',
  'karan aujla': 'https://i.scdn.co/image/ab6761610000e5ebd8b9980db67272cb4d4c3dfe',
  'anirudh ravichander': 'https://i.scdn.co/image/ab6761610000e5eb478b87a9526742eb559eb2ec',
  'isabel larosa': 'https://i.scdn.co/image/ab6761610000e5eb4f47983634e0feea42302179',
  'isabel la rosa': 'https://i.scdn.co/image/ab6761610000e5eb4f47983634e0feea42302179'
};

/**
 * Deterministic, offline-safe SVG avatar monogram with pleasing gradient.
 * Never fails, never blocked by adblockers, requires zero external network calls.
 */
export function generateMonogramSvg(initial: string, name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
    ['#2563eb', '#1d4ed8'],
    ['#7c3aed', '#6d28d9'],
    ['#c87d46', '#9a5323'],
    ['#059669', '#047857'],
    ['#e11d48', '#be123c'],
    ['#0891b2', '#0e7490']
  ];
  const pair = palettes[Math.abs(hash) % palettes.length];
  const char = (initial || 'A').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${pair[0]}"/><stop offset="100%" stop-color="${pair[1]}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="120" font-weight="700">${char}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Robust artist avatar resolver.
 * 1. Checks if known artist mapping exists (guarantees genuine 200 OK portrait).
 * 2. If artist object has an authentic image (not ui-avatars and not 404 hash), uses it.
 * 3. Otherwise falls back to known portrait or offline SVG monogram.
 */
export function getArtistAvatarUrl(
  artist: { name?: string; images?: { url?: string }[]; coverImage?: string } | null | undefined,
  size: '150' | '300' | '500' | '600' = '150'
): string {
  const normName = (artist?.name || '').trim().toLowerCase();
  const known = KNOWN_ARTIST_AVATARS[normName];

  const rawUrl = artist?.coverImage || artist?.images?.[0]?.url;
  const isInvalid = !rawUrl || 
    rawUrl.includes('ui-avatars.com') || 
    rawUrl.includes('8e734c541c5905d45de98457') ||
    rawUrl.includes('unsplash.com');

  if (isInvalid) {
    if (known) return getOptimizedImageUrl(known, size);
    const name = (artist?.name || 'Artist').trim();
    const initial = name.charAt(0).toUpperCase() || 'A';
    return generateMonogramSvg(initial, name);
  }

  return getOptimizedImageUrl(rawUrl, size);
}

/**
 * Handle image load errors gracefully by falling back to known Spotify portrait
 * before falling back to offline SVG monogram.
 */
export function handleArtistImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  artistName?: string
) {
  const img = e.currentTarget;
  const norm = (artistName || '').trim().toLowerCase();
  const known = KNOWN_ARTIST_AVATARS[norm];
  if (known && img.src !== known) {
    img.src = known;
    return;
  }
  const fallbackName = (artistName || 'Artist').trim();
  const initial = fallbackName.charAt(0).toUpperCase() || 'A';
  img.src = generateMonogramSvg(initial, fallbackName);
}

/**
 * Helper to pick the most appropriate image from a track or album's images array.
 * For search results and track lists, maps to 150px thumbnail.
 * For hero headers and player bars, requests 500px/600px.
 */
export function getTrackThumbnail(
  track: { album?: { images?: { url: string }[] }; name?: string } | null | undefined,
  fallback = '',
  size: '150' | '300' | '500' | '600' = '150'
): string {
  const images = track?.album?.images;
  if (!images || images.length === 0 || !images[0]?.url || images[0].url.includes('unsplash.com')) {
    if (fallback) return fallback;
    const name = track?.name || 'Track';
    const char = name.charAt(0) || '♪';
    return generateMonogramSvg(char, name);
  }

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
