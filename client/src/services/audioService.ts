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

const RAW_URL = import.meta.env.VITE_AUDIO_SERVICE_URL || '';
const BASE_URL = RAW_URL ? RAW_URL.replace(/\/+$/, '') : '';

export const AudioService = {
  baseUrl: BASE_URL,

  /**
   * Check if external audio service is configured
   */
  isConfigured: (): boolean => Boolean(BASE_URL),

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
   * Find matching JioSaavn stream by track title and artist
   */
  findStreamForTrack: async (
    title: string,
    artist = '',
    signal?: AbortSignal
  ): Promise<{ songId: string; streamUrl: string; song: SaavnSong } | null> => {
    const cleanTitle = title
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/["'’]/g, '')
      .trim();
    const query = `${cleanTitle} ${artist}`.trim();
    const res = await AudioService.searchSongs(query, 1, 10, signal);

    if (!res?.data?.results || res.data.results.length === 0) {
      return null;
    }

    const best = res.data.results[0];
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
