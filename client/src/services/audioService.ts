import { Track } from '../types';

export interface SaavnImage {
  quality: string;
  url: string;
}

export interface SaavnDownloadUrl {
  quality: string;
  url: string;
}

export interface SaavnArtistRef {
  id: string;
  name: string;
  role?: string;
  image?: SaavnImage[];
  type?: string;
  url?: string;
}

export interface SaavnSong {
  id: string;
  name: string;
  type?: string;
  year?: string;
  releaseDate?: string | null;
  duration?: number;
  label?: string;
  explicitContent?: boolean;
  playCount?: number;
  language?: string;
  hasLyrics?: boolean;
  lyricsId?: string | null;
  url?: string;
  copyright?: string;
  album?: {
    id: string;
    name: string;
    url?: string;
  };
  artists?: {
    primary: SaavnArtistRef[];
    featured: SaavnArtistRef[];
    all: SaavnArtistRef[];
  };
  image?: SaavnImage[];
  downloadUrl?: SaavnDownloadUrl[];
}

export interface SaavnSearchSongsResponse {
  success: boolean;
  data: {
    total: number;
    start: number;
    results: SaavnSong[];
  };
}

export interface SaavnGlobalSearchResponse {
  success: boolean;
  data: {
    topQuery?: { results: any[] };
    songs?: { results: any[] };
    albums?: { results: any[] };
    artists?: { results: any[] };
    playlists?: { results: any[] };
  };
}

const RAW_URL = import.meta.env.VITE_AUDIO_SERVICE_URL || 'https://slothify-audio-services.shindepurvesh007.workers.dev';
const BASE_URL = RAW_URL ? RAW_URL.replace(/\/+$/, '') : 'https://slothify-audio-services.shindepurvesh007.workers.dev';

// Known direct JioSaavn URLs for studio original tracks (bypasses search algorithm for exact audio fidelity)
const KNOWN_DIRECT_TRACK_LINKS: Record<string, string> = {
  'boyfriend dove cameron': 'https://www.jiosaavn.com/song/boyfriend/Cg0RaSNAW2w',
  'dove cameron boyfriend': 'https://www.jiosaavn.com/song/boyfriend/Cg0RaSNAW2w'
};

export const AudioService = {
  baseUrl: BASE_URL,

  /**
   * Check if external audio service is configured
   */
  isConfigured: (): boolean => Boolean(BASE_URL),

  /**
   * Fetch song directly by JioSaavn URL (bypasses search algorithm, guarantees exact original studio track)
   */
  getSongByLink: async (
    link: string,
    signal?: AbortSignal
  ): Promise<SaavnSong | null> => {
    const base = AudioService.baseUrl || 'https://slothify-audio-services.shindepurvesh007.workers.dev';
    try {
      const response = await fetch(
        `${base}/api/songs?link=${encodeURIComponent(link)}`,
        { signal }
      );
      if (!response.ok) throw new Error(`Audio service link fetch failed (${response.status})`);
      const json = await response.json();
      const song = json.data?.[0] || json.data;
      return song || null;
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.warn('Error fetching song by direct link:', error.message);
      }
      return null;
    }
  },

  /**
   * Search for songs by query string
   */
  searchSongs: async (
    query: string,
    page = 1,
    limit = 20,
    signal?: AbortSignal
  ): Promise<SaavnSearchSongsResponse | null> => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(
        `${BASE_URL}/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
        { signal }
      );
      if (!response.ok) throw new Error(`Audio service search failed (${response.status})`);
      return await response.json();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error fetching from Slothify Audio Service (searchSongs):', error);
      }
      return null;
    }
  },

  /**
   * Global search across all categories (songs, albums, artists, playlists)
   */
  searchAll: async (query: string, signal?: AbortSignal): Promise<SaavnGlobalSearchResponse | null> => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(`${BASE_URL}/api/search?query=${encodeURIComponent(query)}`, { signal });
      if (!response.ok) throw new Error(`Audio service global search failed (${response.status})`);
      return await response.json();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error fetching from Slothify Audio Service (searchAll):', error);
      }
      return null;
    }
  },

  /**
   * Search for albums
   */
  searchAlbums: async (query: string, page = 1, limit = 20, signal?: AbortSignal) => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(
        `${BASE_URL}/api/search/albums?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
        { signal }
      );
      if (!response.ok) throw new Error(`Audio service album search failed (${response.status})`);
      return await response.json();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error fetching from Slothify Audio Service (searchAlbums):', error);
      }
      return null;
    }
  },

  /**
   * Search for artists
   */
  searchArtists: async (query: string, page = 1, limit = 20, signal?: AbortSignal) => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(
        `${BASE_URL}/api/search/artists?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
        { signal }
      );
      if (!response.ok) throw new Error(`Audio service artist search failed (${response.status})`);
      return await response.json();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error fetching from Slothify Audio Service (searchArtists):', error);
      }
      return null;
    }
  },

  /**
   * Search for playlists
   */
  searchPlaylists: async (query: string, page = 1, limit = 20, signal?: AbortSignal) => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(
        `${BASE_URL}/api/search/playlists?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
        { signal }
      );
      if (!response.ok) throw new Error(`Audio service playlist search failed (${response.status})`);
      return await response.json();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error fetching from Slothify Audio Service (searchPlaylists):', error);
      }
      return null;
    }
  },

  /**
   * Get detailed song information and direct download URLs by song ID
   */
  getSongDetails: async (songId: string, signal?: AbortSignal): Promise<SaavnSong | null> => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(`${BASE_URL}/api/songs/${encodeURIComponent(songId)}`, { signal });
      if (!response.ok) throw new Error(`Audio service getSongDetails failed (${response.status})`);
      const json = await response.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        return json.data[0];
      }
      return json.data || null;
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error(`Error fetching song details for ID ${songId}:`, error);
      }
      return null;
    }
  },

  /**
   * Get album details by ID
   */
  getAlbumDetails: async (albumId: string, signal?: AbortSignal) => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(`${BASE_URL}/api/albums?id=${encodeURIComponent(albumId)}`, { signal });
      if (!response.ok) throw new Error(`Audio service getAlbumDetails failed (${response.status})`);
      return await response.json();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error(`Error fetching album details for ID ${albumId}:`, error);
      }
      return null;
    }
  },

  /**
   * Get artist details by ID
   */
  getArtistDetails: async (artistId: string, signal?: AbortSignal) => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(`${BASE_URL}/api/artists?id=${encodeURIComponent(artistId)}`, { signal });
      if (!response.ok) throw new Error(`Audio service getArtistDetails failed (${response.status})`);
      return await response.json();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error(`Error fetching artist details for ID ${artistId}:`, error);
      }
      return null;
    }
  },

  /**
   * Get playlist details by ID
   */
  getPlaylistDetails: async (playlistId: string, signal?: AbortSignal) => {
    if (!BASE_URL) return null;
    try {
      const response = await fetch(`${BASE_URL}/api/playlists?id=${encodeURIComponent(playlistId)}`, { signal });
      if (!response.ok) throw new Error(`Audio service getPlaylistDetails failed (${response.status})`);
      return await response.json();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error(`Error fetching playlist details for ID ${playlistId}:`, error);
      }
      return null;
    }
  },

  /**
   * Selects highest available bitrate audio stream (preferring 320kbps -> 160kbps -> 96kbps)
   */
  extractBestStreamUrl: (downloadUrls?: SaavnDownloadUrl[]): string | null => {
    if (!downloadUrls || !downloadUrls.length) return null;
    const prefOrder = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
    for (const q of prefOrder) {
      const found = downloadUrls.find((u) => u.quality === q);
      if (found?.url) return found.url;
    }
    return downloadUrls[downloadUrls.length - 1]?.url || null;
  },

  /**
   * Resolve high-fidelity stream URL directly from a song ID
   */
  getSongStreamUrl: async (songId: string, signal?: AbortSignal): Promise<string | null> => {
    const song = await AudioService.getSongDetails(songId, signal);
    if (!song) return null;
    return AudioService.extractBestStreamUrl(song.downloadUrl);
  },

  /**
   * Find matching JioSaavn stream by track title and artist with timestamp/duration matching
   */
  findStreamForTrack: async (
    title: string,
    artist = '',
    targetDurationSec = 0,
    signal?: AbortSignal
  ): Promise<{ songId: string; streamUrl: string; song: SaavnSong } | null> => {
    // 0. Direct link bypass: check if title is a JioSaavn link or known direct track link
    const urlMatch = (title || '').match(/jiosaavn\.com\/song\/[^/]+\/([a-zA-Z0-9_-]+)/);
    const lookupKey = `${title} ${artist}`.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const reverseKey = `${artist} ${title}`.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const directUrl = urlMatch ? title.trim() : (KNOWN_DIRECT_TRACK_LINKS[lookupKey] || KNOWN_DIRECT_TRACK_LINKS[reverseKey]);

    if (directUrl) {
      const directSong = await AudioService.getSongByLink(directUrl, signal);
      if (directSong) {
        // If duration is provided, ensure direct link doesn't wildly deviate
        if (!targetDurationSec || !directSong.duration || Math.abs(directSong.duration - targetDurationSec) <= 12) {
          const streamUrl = AudioService.extractBestStreamUrl(directSong.downloadUrl);
          if (streamUrl) {
            return {
              songId: directSong.id,
              streamUrl,
              song: directSong
            };
          }
        }
      }
    }

    const cleanTitle = title
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/["'’]/g, '')
      .trim();
    const query = `${cleanTitle} ${artist}`.trim();
    const res = await AudioService.searchSongs(query, 1, 20, signal);

    if (!res?.data?.results || res.data.results.length === 0) {
      return null;
    }

    const normArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetHasRemix = /\b(remix|mix)\b/i.test(cleanTitle);
    const junkPattern = /\b(8-?bit|16-?bit|karaoke|instrumental|nightcore|tribute|cover|lofi|slowed|reverb|sped\s*up|speed\s*up|hardstyle|techno|bass\s*boosted)\b/i;

    interface ScoredCandidate {
      song: SaavnSong;
      score: number;
      durationDelta: number;
    }

    const scored: ScoredCandidate[] = [];

    for (const song of res.data.results) {
      const songDuration = song.duration || 0;
      const durationDelta = targetDurationSec > 0 ? Math.abs(songDuration - targetDurationSec) : 0;
      let score = 0;

      // 1. Duration / Timestamp Matching: Authentic digital masters across platforms match within 1-4 seconds
      if (targetDurationSec > 0) {
        if (durationDelta <= 2) {
          score += 150; // Exact match to studio release
        } else if (durationDelta <= 5) {
          score += 90;
        } else {
          score -= 350; // Any deviation > 5s is an edit, cover, or different track
        }
      }

      // 2. Junk title check
      if (junkPattern.test(song.name || '')) {
        score -= 350;
      }

      // 3. Remix / Version Guard: Never return a remix when the authentic original was requested
      const candHasRemix = /\b(remix|mix|hypertechno|techno|drum & bass|drum and bass|dnb|sped\s*up|speed\s*up|slowed|reverb)\b/i.test(song.name || '');
      if (!targetHasRemix && candHasRemix) {
        score -= 300;
      }

      // 4. Primary Artist Matching: The requested artist MUST be primary or featured performer, NOT merely songwriter
      const primaryArtists = (song.artists?.primary || []).map((a) => (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
      const featuredArtists = (song.artists?.featured || []).map((a) => (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

      if (normArtist) {
        const isPrimary = primaryArtists.some(a => a === normArtist || a.includes(normArtist) || normArtist.includes(a));
        const isFeatured = featuredArtists.some(a => a === normArtist || a.includes(normArtist) || normArtist.includes(a));

        if (isPrimary) {
          score += 130;
        } else if (isFeatured) {
          score += 90;
        } else {
          // Artist is not performing this track (it's a cover or another artist's track)
          score -= 500;
        }
      }

      // 5. Title Matching
      const songTitleNorm = (song.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normTitle) {
        if (songTitleNorm === normTitle) {
          score += 80;
        } else if (songTitleNorm.includes(normTitle) || normTitle.includes(songTitleNorm)) {
          score += 40;
        } else {
          score -= 60;
        }
      }

      scored.push({ song, score, durationDelta });
    }

    scored.sort((a, b) => b.score - a.score);

    const top = scored[0];
    // Reject if score is low or if timestamp duration differs by more than 5 seconds
    if (!top || top.score < 80 || (targetDurationSec > 0 && top.durationDelta > 5)) {
      // JioSaavn Worker search does not have the authentic original; return null to fall back to direct JioSaavn / YouTube
      return null;
    }

    const best = top.song;
    const streamUrl = AudioService.extractBestStreamUrl(best.downloadUrl);
    if (!streamUrl) return null;

    return {
      songId: best.id,
      streamUrl,
      song: best
    };
  },

  /**
   * Transform a JioSaavn song item to Slothify's Track interface
   */
  toSlothifyTrack: (song: SaavnSong): Track => {
    const images =
      song.image && song.image.length > 0
        ? [
            {
              url:
                song.image.find((img) => img.quality === '500x500')?.url ||
                song.image[song.image.length - 1].url
            }
          ]
        : [{ url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=300' }];

    const artists =
      song.artists?.primary && song.artists.primary.length > 0
        ? song.artists.primary.map((a) => ({ name: a.name }))
        : [{ name: (song.artists?.all && song.artists.all[0]?.name) || 'Unknown Artist' }];

    return {
      id: `saavn_${song.id}`,
      uri: `saavn:track:${song.id}`,
      name: song.name,
      artists,
      album: {
        name: song.album?.name || song.name,
        images
      },
      duration_ms: (song.duration || 0) * 1000
    };
  }
};
