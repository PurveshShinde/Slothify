import type { Playlist, Track, Category } from '../../../interfaces.js';
import { withTimeout } from '../../../../utils/timeout.js';
import { POPULAR_SPOTIFY_PLAYLISTS } from '../catalogs/curatedPlaylists.js';
import { scrapeSpotifyPlaylistEmbed } from '../scrapers/playlistAlbumScraper.js';
import { searchSpotubeSpotifyTracks } from '../clients/spotifyGqlClient.js';
import { searchYouTubeInnertubeTracks } from '../scrapers/youtubeSearch.js';
import { searchTracks as defaultSearchTracks } from '../search/trackSearch.js';

export const PINNED_FIRST_TOP_TRACK: Track = {
    id: 'isabel-larosa-eyes-dont-lie',
    uri: 'spotify:track:isabel-larosa-eyes-dont-lie',
    name: "Eyes Don't Lie",
    artists: [{ name: 'Isabel LaRosa' }],
    album: {
        name: "Eyes Don't Lie",
        images: [{ url: 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg' }]
    },
    duration_ms: 150000,
    preview_url: null
};

export const STANDARD_CATEGORIES: Category[] = [
    { id: 'pop', name: 'Pop', icons: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300' }] },
    { id: 'hip-hop', name: 'Hip-Hop', icons: [{ url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300' }] },
    { id: 'rock', name: 'Rock', icons: [{ url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300' }] },
    { id: 'chill', name: 'Chill', icons: [{ url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300' }] },
    { id: 'dance-electronic', name: 'Electronic', icons: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300' }] },
    { id: 'workout', name: 'Workout', icons: [{ url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300' }] },
    { id: 'focus', name: 'Focus', icons: [{ url: 'https://images.unsplash.com/photo-1520523839898-5071270409a8?w=300' }] },
    { id: 'country', name: 'Country', icons: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300' }] }
];

/**
 * Get featured playlists
 */
export async function getFeaturedPlaylists(): Promise<Playlist[]> {
    return POPULAR_SPOTIFY_PLAYLISTS.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        images: [{ url: p.image }],
        owner: { id: 'spotify', display_name: 'Spotify' },
        tracks: { total: 50 }
    }));
}

/**
 * Get top tracks
 */
export async function getTopTracks(
    getPlaylistFn: (playlistId: string) => Promise<Playlist> = scrapeSpotifyPlaylistEmbed
): Promise<Track[]> {
    // Spotify Today's Top Hits flagship chart
    try {
        const playlist = await getPlaylistFn('37i9dQZF1DXcBWIGoYBM5M');
        const items = playlist.tracks?.items || [];
        if (items.length > 0) {
            const tracks = items
                .map(i => i.track)
                .filter((t: Track) => t && !t.name.toLowerCase().includes('eyes don'));
            if (tracks.length > 0) {
                return [PINNED_FIRST_TOP_TRACK, ...tracks];
            }
        }
    } catch (sErr: any) {
        console.warn('[SpotifyScraper] Spotify top tracks notice:', sErr.message);
    }

    return [PINNED_FIRST_TOP_TRACK];
}

/**
 * Browse categories
 */
export async function getCategories(): Promise<Category[]> {
    return STANDARD_CATEGORIES;
}

/**
 * Category playlists
 */
export async function getCategoryPlaylists(
    categoryId: string,
    getFeaturedFn: () => Promise<Playlist[]> = getFeaturedPlaylists
): Promise<Playlist[]> {
    return getFeaturedFn();
}

/**
 * Recommendations based on seed tracks
 */
export async function getRecommendations(
    seedTracks: string[],
    getTopTracksFn: () => Promise<Track[]> = getTopTracks
): Promise<Track[]> {
    return getTopTracksFn();
}

export interface SmartMoodOptions {
    searchSpotubeFn?: (query: string, limit: number) => Promise<Track[]>;
    searchYtFn?: (query: string, limit: number) => Promise<Track[]>;
    searchTracksFn?: (query: string, limit: number) => Promise<Track[]>;
    getTopTracksFn?: () => Promise<Track[]>;
}

/**
 * Smart Mood Suggestions:
 * Discovers songs matching the mood, style, and sonic cluster of the current track & artist using Spotify & YouTube
 */
export async function getSmartMoodSuggestions(
    trackName: string,
    artistName: string,
    options?: SmartMoodOptions
): Promise<Track[]> {
    const cleanTrack = (trackName || '').toLowerCase().trim();
    const cleanArtist = (artistName || '').trim();
    const suggestions: Track[] = [];
    const seenIds = new Set<string>();

    const searchSpotube = options?.searchSpotubeFn || searchSpotubeSpotifyTracks;
    const searchYt = options?.searchYtFn || searchYouTubeInnertubeTracks;
    const searchTracks = options?.searchTracksFn || defaultSearchTracks;
    const getTop = options?.getTopTracksFn || getTopTracks;

    try {
        if (cleanArtist) {
            // 1. Search Spotify & YouTube in parallel for artist's songs & vibe (time-boxed to 800ms)
            const [spotifyTracks, ytTracks] = await Promise.allSettled([
                withTimeout(searchSpotube(cleanArtist, 12), 800),
                withTimeout(searchYt(`${cleanArtist} songs`, 12), 800)
            ]);

            if (spotifyTracks.status === 'fulfilled' && Array.isArray(spotifyTracks.value)) {
                for (const item of spotifyTracks.value) {
                    if (item.name?.toLowerCase() !== cleanTrack && !seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        suggestions.push(item);
                    }
                }
            }

            if (ytTracks.status === 'fulfilled' && Array.isArray(ytTracks.value)) {
                for (const item of ytTracks.value) {
                    if (item.name?.toLowerCase() !== cleanTrack && !seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        suggestions.push(item);
                    }
                }
            }
        }

        if (suggestions.length < 5 && cleanArtist) {
            const searchResults = await searchTracks(cleanArtist, 10);
            for (const t of searchResults) {
                if (t.name.toLowerCase() !== cleanTrack && !seenIds.has(t.id)) {
                    seenIds.add(t.id);
                    suggestions.push(t);
                }
            }
        }
    } catch (err: any) {
        console.warn('[SpotifyScraper] Smart mood suggestions notice:', err.message);
    }

    if (suggestions.length === 0) {
        return getTop();
    }

    return suggestions;
}
