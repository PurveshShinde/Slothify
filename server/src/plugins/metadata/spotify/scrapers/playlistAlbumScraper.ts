import axios from 'axios';
import type { Playlist, Track } from '../../../interfaces.js';
import { POPULAR_SPOTIFY_PLAYLISTS } from '../catalogs/curatedPlaylists.js';
import { localLibrary } from '../../../../store/localLibrary.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const playlistMemoryCache = new Map<string, { playlist: Playlist; expiresAt: number }>();

/**
 * Scrape playlist data from Spotify embed with in-memory caching and resilient local fallback
 */
export async function scrapeSpotifyPlaylistEmbed(playlistId: string): Promise<Playlist> {
    // 0. In-memory RAM cache
    const cached = playlistMemoryCache.get(playlistId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.playlist;
    }

    try {
        const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
        const { data: html } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 6000
        });

        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (match && match[1]) {
            const nextData = JSON.parse(match[1]);
            const entity = nextData.props?.pageProps?.state?.data?.entity;

            if (entity) {
                const coverArtUrl = entity.coverArt?.sources?.[0]?.url ||
                    entity.visualIdentity?.image?.[0]?.url ||
                    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

                const tracks: Track[] = (entity.trackList || []).map((t: any, index: number) => {
                    const artistNames = (t.subtitle || 'Unknown Artist').split(/,\s*/);
                    const trackId = t.uri ? t.uri.replace('spotify:track:', '') : `scraped_${playlistId}_${index}`;

                    return {
                        id: trackId,
                        uri: t.uri || `spotify:track:${trackId}`,
                        name: t.title || 'Unknown Track',
                        artists: artistNames.map((name: string) => ({ name })),
                        album: {
                            name: entity.name || 'Unknown Album',
                            images: [{ url: coverArtUrl }]
                        },
                        duration_ms: t.duration || 180000,
                        preview_url: t.audioPreview?.url || null
                    };
                });

                const resPlaylist: Playlist = {
                    id: playlistId,
                    name: entity.name || entity.title || 'Playlist',
                    description: entity.description || entity.subtitle || 'Curated music playlist',
                    images: [{ url: coverArtUrl }],
                    owner: {
                        id: 'spotify',
                        display_name: 'Spotify',
                        images: [{ url: coverArtUrl }]
                    },
                    tracks: {
                        total: tracks.length,
                        items: tracks.map((track) => ({ track }))
                    }
                };

                playlistMemoryCache.set(playlistId, {
                    playlist: resPlaylist,
                    expiresAt: Date.now() + 2 * 3600 * 1000
                });

                return resPlaylist;
            }
        }
    } catch (err: any) {
        console.warn(`[SpotifyScraper] Live scrape for playlist ${playlistId} failed (${err.message}), using fallback`);
    }

    // 1. Fallback: check local library snapshot (provides full tracks even when Spotify times out / 504s)
    try {
        const local = localLibrary.getPlaylist(playlistId);
        if (local && local.tracks && local.tracks.items && local.tracks.items.length > 0) {
            return local;
        }
    } catch { }

    // 2. Fallback: check curated list
    const curated = POPULAR_SPOTIFY_PLAYLISTS.find(p => p.id === playlistId);
    return {
        id: playlistId,
        name: curated?.name || 'Playlist',
        description: curated?.description || 'Curated music playlist',
        images: [{ url: curated?.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' }],
        owner: { id: 'spotify', display_name: 'Spotify' },
        tracks: { total: 0, items: [] }
    };
}

/**
 * Scrape album metadata and all tracks from Spotify embed
 */
export async function scrapeSpotifyAlbumEmbed(albumId: string): Promise<any> {
    try {
        const url = `https://open.spotify.com/embed/album/${albumId}`;
        const { data: html } = await axios.get<string>(url, {
            headers: { 'User-Agent': USER_AGENT }
        });

        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (match && match[1]) {
            const nextData = JSON.parse(match[1]);
            const entity = nextData.props?.pageProps?.state?.data?.entity;

            if (entity) {
                const images = entity.visualIdentity?.image || [];
                const coverArtUrl = images[2]?.url || images[0]?.url ||
                    'https://ui-avatars.com/api/?name=Album&background=181824&color=f5d0b5&size=500&bold=true';

                const artistNames = (entity.subtitle || 'Unknown Artist').split(/,\s*/);
                const releaseDate = entity.releaseDate?.isoString
                    ? entity.releaseDate.isoString.substring(0, 10)
                    : '2024';

                const tracks: Track[] = (entity.trackList || []).map((t: any, index: number) => {
                    const tArtists = (t.subtitle || entity.subtitle || 'Unknown Artist').split(/,\s*/);
                    const trackId = t.uri ? t.uri.replace('spotify:track:', '') : `album_${albumId}_${index}`;

                    return {
                        id: trackId,
                        uri: t.uri || `spotify:track:${trackId}`,
                        name: t.title || 'Unknown Track',
                        artists: tArtists.map((name: string) => ({ name })),
                        album: {
                            name: entity.name || entity.title || 'Album',
                            images: [{ url: coverArtUrl }]
                        },
                        duration_ms: t.duration || 180000,
                        preview_url: t.audioPreview?.url || null
                    };
                });

                return {
                    id: albumId,
                    name: entity.name || entity.title || 'Album',
                    artists: artistNames.map((name: string) => ({ name })),
                    images: [{ url: coverArtUrl }],
                    release_date: releaseDate,
                    total_tracks: tracks.length,
                    genres: ['Music'],
                    tracks
                };
            }
        }
    } catch (err: any) {
        console.warn(`[SpotifyScraper] Failed to scrape album ${albumId}:`, err.message);
    }

    return null;
}
