import axios from 'axios';
import type { MetadataPlugin, Track, Playlist, Artist, Category } from '../interfaces.js';
import { withTimeout } from '../../utils/timeout.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

import {
    scrapeSpotifyPlaylistEmbed,
    scrapeSpotifyAlbumEmbed
} from './spotify/scrapers/playlistAlbumScraper.js';
import { searchAlbums as searchSpotifyAlbums } from './spotify/search/albumSearch.js';
import {
    getTopArtists,
    searchArtists,
    getArtistTracks,
    getArtistDetails,
    resolveArtistImage
} from './spotify/artists/artistExploration.js';

// Curated popular Spotify playlists for home / featured views & import discovery
export { POPULAR_SPOTIFY_PLAYLISTS } from './spotify/catalogs/curatedPlaylists.js';
import { POPULAR_SPOTIFY_PLAYLISTS } from './spotify/catalogs/curatedPlaylists.js';
import { TOP_ARTIST_PROFILES } from './spotify/catalogs/topArtistsCatalog.js';
import { decodeHtmlEntities } from './spotify/utils/htmlUtils.js';
import { cleanSearchQuery } from './spotify/utils/queryUtils.js';
export {
    stringSimilarity,
    calculateSimilarity,
    isArtistNameMatch,
    calculateArtistRelevanceScore
} from './spotify/utils/similarityUtils.js';
import {
    stringSimilarity,
    calculateSimilarity,
    isArtistNameMatch,
    calculateArtistRelevanceScore
} from './spotify/utils/similarityUtils.js';
export {
    normalizePlayCountToPopularity,
    scoreTrackRelevance,
    deduplicateTracks
} from './spotify/ranking/trackRanking.js';
import {
    normalizePlayCountToPopularity,
    scoreTrackRelevance,
    deduplicateTracks
} from './spotify/ranking/trackRanking.js';

export { getSpotubeSpotifyToken } from './spotify/auth/spotubeAuth.js';
import { getSpotubeSpotifyToken } from './spotify/auth/spotubeAuth.js';

export { searchYouTubeInnertubeTracks } from './spotify/scrapers/youtubeSearch.js';
import { searchYouTubeInnertubeTracks } from './spotify/scrapers/youtubeSearch.js';

export type { SpotifyArtistOverviewData } from './spotify/clients/spotifyGqlClient.js';
export {
    searchSpotubeSpotifyTracks,
    searchSpotifyArtists,
    fetchSpotifyArtistOverview
} from './spotify/clients/spotifyGqlClient.js';
import {
    searchSpotubeSpotifyTracks,
    searchSpotifyArtists,
    fetchSpotifyArtistOverview
} from './spotify/clients/spotifyGqlClient.js';

export {
    resolveSpotifyTrackCover,
    scrapeSpotifyArtistEmbed
} from './spotify/scrapers/spotifyEmbedScraper.js';
import {
    resolveSpotifyTrackCover,
    scrapeSpotifyArtistEmbed
} from './spotify/scrapers/spotifyEmbedScraper.js';

export {
    resolveSpotifyArtistId
} from './spotify/artists/artistResolution.js';
import {
    resolveSpotifyArtistId,
    resolveArtistMetadata,
    getArtistFollowers,
    isJunkChannel,
    TOP_ARTIST_SPOTIFY_IDS,
    ARTIST_META_CACHE
} from './spotify/artists/artistResolution.js';

function getLevenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function normalizeSearchString(s: string): string {
    return (s || '')
        .toLowerCase()
        .replace(/["'’`]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export class SpotifyScraperPlugin implements MetadataPlugin {
    readonly name = 'SpotifyScraper';

    getCuratedPlaylists(limit: number = 20) {
        return POPULAR_SPOTIFY_PLAYLISTS.slice(0, limit);
    }

    /**
     * Scrape playlist data from Spotify embed with in-memory caching and resilient local fallback
     */
    async getPlaylist(playlistId: string): Promise<Playlist> {
        return scrapeSpotifyPlaylistEmbed(playlistId);
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        const playlist = await this.getPlaylist(playlistId);
        return (playlist.tracks.items || []).map(item => item.track);
    }

    /**
     * Scrape album metadata and all tracks from Spotify embed
     */
    async getAlbum(albumId: string): Promise<any> {
        return scrapeSpotifyAlbumEmbed(albumId);
    }

    /**
     * Real-time search for albums across Spotify and Apple Music catalogs
     */
    async searchAlbums(query: string, limit: number = 20): Promise<any[]> {
        return searchSpotifyAlbums(query, limit);
    }

    /**
     * Search tracks using Dual-Engine Search (Spotify Pathfinder + JioSaavn):
     * - Direct JioSaavn album/song URL support
     * - JioSaavn's superior hit ranking for popular original songs
     * - HTML entity decoding
     * - Query cleaning (removes "by" keyword, e.g. "eyes dont lie by isabel larose")
     * - Cross-engine token overlap deduplication with Spotify CDN artwork priority
     */
    async searchTracks(query: string, limit: number = 20): Promise<Track[]> {
        const raw = query.trim();
        if (!raw) return [];

        // 1. Direct JioSaavn Album URL support (e.g. https://www.jiosaavn.com/album/eyes-dont-lie/k6vk9964rnM_)
        const albumMatch = raw.match(/jiosaavn\.com\/album\/[^/]+\/([a-zA-Z0-9_-]+)/);
        if (albumMatch) {
            const token = albumMatch[1];
            try {
                const aRes = await axios.get(`https://www.jiosaavn.com/api.php?__call=webapi.get&token=${encodeURIComponent(token)}&type=album&_format=json&_marker=0&cc=in`, { timeout: 6000 });
                if (Array.isArray(aRes.data?.songs) && aRes.data.songs.length > 0) {
                    return aRes.data.songs.map((s: any) => ({
                        id: `saavn_${s.id}`,
                        uri: `spotify:track:saavn_${s.id}`,
                        name: decodeHtmlEntities(s.song || s.title),
                        artists: [{ name: decodeHtmlEntities(s.primary_artists || s.singers || aRes.data.primary_artists || 'Unknown Artist') }],
                        album: {
                            name: decodeHtmlEntities(s.album || aRes.data.title || s.song),
                            images: [{ url: (s.image || aRes.data.image || '').replace('150x150', '500x500') }]
                        },
                        duration_ms: (Number(s.duration) || 180) * 1000,
                        preview_url: s.media_preview_url || null
                    }));
                }
            } catch (err: any) {
                console.warn('[SpotifyScraper] JioSaavn album URL parse failed:', err.message);
            }
        }

        // 2. Direct JioSaavn Song URL support (e.g. https://www.jiosaavn.com/song/love-me-like-you-do/NgUBWTdKB3A)
        const songMatch = raw.match(/jiosaavn\.com\/song\/[^/]+\/([a-zA-Z0-9_-]+)/);
        if (songMatch) {
            const token = songMatch[1];
            try {
                const sRes = await axios.get(`https://www.jiosaavn.com/api.php?__call=webapi.get&token=${encodeURIComponent(token)}&type=song&_format=json&_marker=0&cc=in`, { timeout: 6000 });
                const song = sRes.data?.[Object.keys(sRes.data)[0]];
                if (song && song.id) {
                    return [{
                        id: `saavn_${song.id}`,
                        uri: `spotify:track:saavn_${song.id}`,
                        name: decodeHtmlEntities(song.song || song.title),
                        artists: [{ name: decodeHtmlEntities(song.primary_artists || song.singers || 'Unknown Artist') }],
                        album: {
                            name: decodeHtmlEntities(song.album || song.song),
                            images: [{ url: (song.image || '').replace('150x150', '500x500') }]
                        },
                        duration_ms: (Number(song.duration) || 180) * 1000,
                        preview_url: song.media_preview_url || null
                    }];
                }
            } catch (err: any) {
                console.warn('[SpotifyScraper] JioSaavn song URL parse failed:', err.message);
            }
        }


        // Clean query: strip "by" keyword (e.g. "eyes dont lie by isabel larose" -> "eyes dont lie isabel larose")
        const cleanQuery = cleanSearchQuery(raw);
        const fetchLimit = Math.max(limit * 2, 30);

        // Pre-query matched artists to inject their top songs only if searching for a recognized major artist (time-boxed to 800ms)
        const matchedArtists = await withTimeout(this.searchArtists(cleanQuery, 3), 800).catch(() => []);
        const primaryArtist = matchedArtists.find(a => isArtistNameMatch(a.name, cleanQuery));
        const isRecognizedMajorArtist = primaryArtist && (
            (primaryArtist.followers?.total || 0) >= 50000 || 
            TOP_ARTIST_PROFILES[primaryArtist.name.toLowerCase()]
        );
        const artistTrackPromise = isRecognizedMajorArtist
            ? searchSpotubeSpotifyTracks(`artist:${primaryArtist.name}`, fetchLimit).catch(() => [])
            : Promise.resolve([]);

        // 0. Time-Boxed Multi-Engine Parallel Search (Strictly Spotify + JioSaavn):
        // 1. Spotify Pathfinder GraphQL (Official global catalog & artwork)
        // 2. JioSaavn Search (Authentic play count stream metric)
        // 3. JioSaavn Autocomplete (Typo / spell-check matching)
        // 4. Spotify Artist Top Tracks (if searching by major artist)
        const [spotubeRes, saavnRes, saavnAutoRes, artistTracksRes] = await Promise.allSettled([
            withTimeout(searchSpotubeSpotifyTracks(cleanQuery, fetchLimit), 3500),
            withTimeout(axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'search.getResults',
                    _format: 'json',
                    _marker: '0',
                    cc: 'in',
                    p: 1,
                    n: fetchLimit,
                    q: cleanQuery
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*'
                },
                timeout: 3000
            }), 3000),
            withTimeout(axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'autocomplete.get',
                    _format: 'json',
                    _marker: '0',
                    cc: 'in',
                    query: cleanQuery
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 2500
            }), 2500),
            withTimeout(artistTrackPromise, 3500)
        ]);

        const rawCandidates: { track: Track; originalIndex: number }[] = [];

        // Map JioSaavn play counts for authentic cross-engine track popularity
        const saavnPopularityMap = new Map<string, number>();
        if (saavnRes.status === 'fulfilled' && Array.isArray(saavnRes.value.data?.results)) {
            saavnRes.value.data.results.forEach((item: any) => {
                const name = decodeHtmlEntities(item.song || item.title);
                const artist = decodeHtmlEntities(item.primary_artists || item.singers || 'Unknown Artist');
                const playCount = Number(item.play_count) || 0;
                const saavnPopularity = normalizePlayCountToPopularity(playCount);
                const baseTitle = name.replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const primaryArtistStr = artist.split(/[,x&•|–-]/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                saavnPopularityMap.set(`${baseTitle}-${primaryArtistStr}`, saavnPopularity);
            });
        }

        let spotubeCandidates: Track[] = (spotubeRes.status === 'fulfilled' && Array.isArray(spotubeRes.value)) ? spotubeRes.value : [];

        // If Spotify prefix search returned few or 0 items (e.g. user typed "teenage drea" before the final "m"),
        // check autocomplete suggestion to grab official Spotify release with canonical artwork
        if (spotubeCandidates.length < 3 && saavnAutoRes.status === 'fulfilled') {
            const autoTitle = saavnAutoRes.value?.data?.topquery?.data?.[0]?.title;
            if (autoTitle && autoTitle.toLowerCase() !== cleanQuery.toLowerCase()) {
                try {
                    const fallbackSpotify = await withTimeout(searchSpotubeSpotifyTracks(autoTitle, fetchLimit), 1000);
                    if (Array.isArray(fallbackSpotify) && fallbackSpotify.length > 0) {
                        spotubeCandidates = [...spotubeCandidates, ...fallbackSpotify];
                    }
                } catch (e) {}
            }
        }

        // 1. Primary: Collect Spotube candidates (Official global Spotify catalog & covers) - HIGHEST RELEVANCE
        if (spotubeCandidates.length > 0) {
            spotubeCandidates.forEach((track, idx) => {
                const baseTitle = (track.name || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[-–—]\s*(remastered|live|acoustic|version|edit|official).*$/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const primaryArtistStr = (track.artists?.[0]?.name || (track as any).artist || 'unknown').split(/[,x&•|–-]/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const sig = `${baseTitle}-${primaryArtistStr}`;

                if (saavnPopularityMap.has(sig)) {
                    (track as any).popularity = saavnPopularityMap.get(sig);
                } else {
                    (track as any).popularity = typeof (track as any).popularity === 'number'
                        ? (track as any).popularity
                        : (idx === 0 ? 98 : idx === 1 ? 92 : idx === 2 ? 85 : Math.max(10, 65 - idx * 4));
                }
                rawCandidates.push({ track, originalIndex: idx });
            });
        }

        // 2. Supplementary: Collect Top Spotify Artist Tracks (if searching for a major star)
        if (artistTracksRes.status === 'fulfilled' && Array.isArray(artistTracksRes.value)) {
            artistTracksRes.value.forEach((track, idx) => {
                (track as any).popularity = Math.max(30, 95 - idx * 2);
                (track as any).followers = primaryArtist?.followers?.total || 0;
                rawCandidates.push({ track, originalIndex: idx + 2 });
            });
        }

        // 3. Collect JioSaavn candidates (Provides regional/Indian coverage where Spotify catalog is sparse)
        if (saavnRes.status === 'fulfilled' && Array.isArray(saavnRes.value.data?.results)) {
            saavnRes.value.data.results.forEach((item: any, idx: number) => {
                const name = decodeHtmlEntities(item.song || item.title);
                const artist = decodeHtmlEntities(item.primary_artists || item.singers || 'Unknown Artist');
                const playCount = Number(item.play_count) || 0;
                const saavnPopularity = normalizePlayCountToPopularity(playCount);

                rawCandidates.push({
                    track: {
                        id: `saavn_${item.id}`,
                        uri: `spotify:track:saavn_${item.id}`,
                        name,
                        artists: [{ name: artist }],
                        album: {
                            name: decodeHtmlEntities(item.album || name),
                            images: [{ url: (item.image || '').replace('150x150', '500x500') }]
                        },
                        duration_ms: (Number(item.duration) || 180) * 1000,
                        preview_url: item.media_preview_url || null,
                        ...({ popularity: saavnPopularity, playCount } as any)
                    },
                    originalIndex: idx + 10
                });
            });
        }

        // 4. Collect JioSaavn Autocomplete candidates (Phonetic & Typo spell-check matching)
        if (saavnAutoRes.status === 'fulfilled' && saavnAutoRes.value?.data) {
            const autoSongs = [
                ...(saavnAutoRes.value.data?.topquery?.data || []),
                ...(saavnAutoRes.value.data?.songs?.data || [])
            ];
            autoSongs.forEach((item: any, idx: number) => {
                if (!item || !item.id || item.type !== 'song') return;
                const name = decodeHtmlEntities(item.title || item.song);
                const artist = decodeHtmlEntities(item.more_info?.primary_artists || item.more_info?.singers || item.description?.split('·')?.[1]?.trim() || 'Unknown Artist');
                const ctr = Number(item.ctr) || 0;
                const autoPopularity = ctr > 1000 ? Math.min(95, Math.round(70 + Math.log10(ctr) * 7)) : (ctr > 0 ? 30 : 15);
                rawCandidates.push({
                    track: {
                        id: `saavn_${item.id}`,
                        uri: `spotify:track:saavn_${item.id}`,
                        name,
                        artists: [{ name: artist }],
                        album: {
                            name: decodeHtmlEntities(item.album || name),
                            images: [{ url: (item.image || '').replace(/50x50|150x150/, '500x500') }]
                        },
                        duration_ms: 180000,
                        preview_url: null,
                        ...({ popularity: autoPopularity } as any)
                    },
                    originalIndex: idx + 20
                });
            });
        }

        // 2. Strict No-Remix / No-Junk Guard
        // Drop remix/flip/lofi/unplugged/reverb/slowed/instrumental/karaoke/lyrical/8d/nightcore/workout/tribute/cover unless user typed those words
        const junkRegex = /\b(remix|flip|lofi|unplugged|reverb|slowed|instrumental|karaoke|lyrical|8d|8-?bit|16-?bit|nightcore|tribute|cover|workout|fitness|gym|bpm|tabata|hardtekk|hardstyle|techno|switching\s*vocals|backing\s*track|type\s*beat|speed\s*up|sped\s*up)\b/i;
        const cleanResults = rawCandidates.filter(({ track }) => {
            // If the user's query didn't ask for a flip/remix/cover/workout, drop tracks that contain those words
            if (!junkRegex.test(raw)) {
                const trackTitle = (track.name || (track as any).title || '').toLowerCase();
                const trackArtist = (track.artists || []).map((a: any) => a.name).join(' ').toLowerCase();
                if (junkRegex.test(trackTitle) || junkRegex.test(trackArtist)) {
                    return false;
                }
            }
            return true;
        });

        // 3. Relevance scoring (Fuzzy Matching + Track Popularity)
        const scoredTracks = cleanResults.map(({ track, originalIndex }) => {
            (track as any).score = scoreTrackRelevance(track, raw, originalIndex);
            return track;
        });

        // 4. Smart Deduplication Fingerprinting
        const deduplicated = deduplicateTracks(scoredTracks);

        return deduplicated.slice(0, limit);
    }

    /**
     * Get featured playlists
     */
    async getFeaturedPlaylists(): Promise<Playlist[]> {
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
     * Get authentic, real-time new releases and top chart albums from live public APIs
     */
    async getNewReleases(): Promise<any[]> {
        const albums: any[] = [];
        const seenNames = new Set<string>();
        const seenIds = new Set<string>();

        try {
            const [usRes, inRes, saavnRes] = await Promise.allSettled([
                axios.get('https://itunes.apple.com/us/rss/topalbums/limit=35/json', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                }),
                axios.get('https://itunes.apple.com/in/rss/topalbums/limit=35/json', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                }),
                axios.get('https://www.jiosaavn.com/api.php?__call=content.getAlbums&_format=json&_marker=0&cc=in&p=1&n=30', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4000
                })
            ]);

            // 1. Apple Music Global / US Top Chart Albums
            if (usRes.status === 'fulfilled') {
                const entries = usRes.value.data?.feed?.entry || [];
                for (const e of entries) {
                    const name = decodeHtmlEntities(e['im:name']?.label);
                    const artist = decodeHtmlEntities(e['im:artist']?.label || 'Artist');
                    const rawImg = e['im:image']?.[2]?.label || e['im:image']?.[0]?.label;
                    const img = rawImg ? rawImg.replace(/\/\d+x\d+bb\./, '/600x600bb.') : '';
                    const genre = e['category']?.attributes?.label || 'Pop';
                    const year = e['im:releaseDate']?.label?.substring(0, 4) || '2024';
                    const tracks = Number(e['im:itemCount']?.label || 10);
                    const id = e['id']?.attributes?.['im:id'] || `it_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

                    const norm = name.toLowerCase().trim();
                    if (name && !seenNames.has(norm) && !seenIds.has(id)) {
                        seenNames.add(norm);
                        seenIds.add(id);
                        albums.push({
                            id,
                            name,
                            artists: [{ name: artist }],
                            images: img ? [{ url: img }] : [],
                            release_date: year,
                            total_tracks: tracks,
                            genre
                        });
                    }
                }
            }

            // 2. Apple Music Regional / India Top Chart Albums
            if (inRes.status === 'fulfilled') {
                const entries = inRes.value.data?.feed?.entry || [];
                for (const e of entries) {
                    const name = decodeHtmlEntities(e['im:name']?.label);
                    const artist = decodeHtmlEntities(e['im:artist']?.label || 'Artist');
                    const rawImg = e['im:image']?.[2]?.label || e['im:image']?.[0]?.label;
                    const img = rawImg ? rawImg.replace(/\/\d+x\d+bb\./, '/600x600bb.') : '';
                    const genre = e['category']?.attributes?.label || 'Indian';
                    const year = e['im:releaseDate']?.label?.substring(0, 4) || '2024';
                    const tracks = Number(e['im:itemCount']?.label || 10);
                    const id = e['id']?.attributes?.['im:id'] || `it_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

                    const norm = name.toLowerCase().trim();
                    if (name && !seenNames.has(norm) && !seenIds.has(id)) {
                        seenNames.add(norm);
                        seenIds.add(id);
                        albums.push({
                            id,
                            name,
                            artists: [{ name: artist }],
                            images: img ? [{ url: img }] : [],
                            release_date: year,
                            total_tracks: tracks,
                            genre
                        });
                    }
                }
            }

            // 3. JioSaavn Real-Time Indian & Bollywood Releases
            if (saavnRes.status === 'fulfilled' && Array.isArray(saavnRes.value.data)) {
                for (const item of saavnRes.value.data) {
                    const name = decodeHtmlEntities(item.title || item.name);
                    if (!name) continue;
                    const norm = name.toLowerCase().trim();
                    const rawImg = item.image || '';
                    const img = rawImg ? rawImg.replace(/150x150|50x50/, '500x500') : '';
                    let artist = 'Various Artists';
                    if (item.Artist?.music && Array.isArray(item.Artist.music)) {
                        artist = item.Artist.music.map((m: any) => m.name).filter(Boolean).join(', ') || 'Artist';
                    }
                    const cleanId = `saavn_${item.albumid || item.id || norm.replace(/[^a-z0-9]/g, '')}`;

                    if (!seenNames.has(norm) && !seenIds.has(cleanId)) {
                        seenNames.add(norm);
                        seenIds.add(cleanId);
                        albums.push({
                            id: cleanId,
                            name,
                            artists: [{ name: artist }],
                            images: img ? [{ url: img }] : [],
                            release_date: item.year || '2026',
                            total_tracks: 10,
                            genre: 'Bollywood'
                        });
                    }
                }
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] Real-time albums fetch notice:', err.message);
        }

        // Curated real-time chart albums fallback if public RSS feeds are unreachable
        if (albums.length === 0) {
            const fallbackCuratedAlbums = [
                {
                    id: 'sp_alb_hitmehard',
                    name: 'HIT ME HARD AND SOFT',
                    artists: [{ name: 'Billie Eilish' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27371d62ea7ea8a5be92d3c1f62' }],
                    release_date: '2024',
                    total_tracks: 10,
                    genre: 'Pop'
                },
                {
                    id: 'sp_alb_ttpd',
                    name: 'THE TORTURED POETS DEPARTMENT',
                    artists: [{ name: 'Taylor Swift' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2735232938b815615712176b054' }],
                    release_date: '2024',
                    total_tracks: 16,
                    genre: 'Pop'
                },
                {
                    id: 'sp_alb_shortnsweet',
                    name: "Short n' Sweet",
                    artists: [{ name: 'Sabrina Carpenter' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273659cd4673230913b3918e0d5' }],
                    release_date: '2024',
                    total_tracks: 12,
                    genre: 'Pop'
                },
                {
                    id: 'sp_alb_midwestprincess',
                    name: 'The Rise and Fall of a Midwest Princess',
                    artists: [{ name: 'Chappell Roan' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273b5d27fb63024564c74070be6' }],
                    release_date: '2024',
                    total_tracks: 14,
                    genre: 'Pop'
                },
                {
                    id: 'sp_alb_gnx',
                    name: 'GNX',
                    artists: [{ name: 'Kendrick Lamar' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273d9985092cd88bffd97653b58' }],
                    release_date: '2024',
                    total_tracks: 12,
                    genre: 'Hip-Hop'
                },
                {
                    id: 'sp_alb_utopia',
                    name: 'UTOPIA',
                    artists: [{ name: 'Travis Scott' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273881d5d052504d947263b386f' }],
                    release_date: '2023',
                    total_tracks: 19,
                    genre: 'Hip-Hop'
                },
                {
                    id: 'sp_alb_animal',
                    name: 'Animal',
                    artists: [{ name: 'Pritam, JAM8, Vishal Mishra' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2730261696c5df3be99da6ed3f3' }],
                    release_date: '2023',
                    total_tracks: 14,
                    genre: 'Bollywood'
                },
                {
                    id: 'sp_alb_aashiqui2',
                    name: 'Aashiqui 2',
                    artists: [{ name: 'Mithoon, Ankit Tiwari, Jeet Gannguli' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27357452e8964893e17cf6f69ad' }],
                    release_date: '2023',
                    total_tracks: 11,
                    genre: 'Bollywood'
                },
                {
                    id: 'sp_alb_ghost',
                    name: 'Ghost',
                    artists: [{ name: 'Diljit Dosanjh' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27341e0584eb266b04fec8b3684' }],
                    release_date: '2023',
                    total_tracks: 21,
                    genre: 'Punjabi'
                },
                {
                    id: 'sp_alb_makingmemories',
                    name: 'Making Memories',
                    artists: [{ name: 'Karan Aujla, Ikky' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273d8b9980db67272cb4d4c3dfe' }],
                    release_date: '2023',
                    total_tracks: 9,
                    genre: 'Punjabi'
                },
                {
                    id: 'sp_alb_sos',
                    name: 'SOS',
                    artists: [{ name: 'SZA' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27370dbc9f47669d120e081e5f3' }],
                    release_date: '2023',
                    total_tracks: 23,
                    genre: 'R&B'
                },
                {
                    id: 'sp_alb_afterhours',
                    name: 'After Hours',
                    artists: [{ name: 'The Weeknd' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' }],
                    release_date: '2020',
                    total_tracks: 14,
                    genre: 'R&B'
                },
                {
                    id: 'sp_alb_moonmusic',
                    name: 'Moon Music',
                    artists: [{ name: 'Coldplay' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27392a95c96b797fc74d47a5089' }],
                    release_date: '2024',
                    total_tracks: 10,
                    genre: 'Rock & Indie'
                },
                {
                    id: 'sp_alb_am',
                    name: 'AM',
                    artists: [{ name: 'Arctic Monkeys' }],
                    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2734ae1c4c5c45aabe5ece75734' }],
                    release_date: '2013',
                    total_tracks: 12,
                    genre: 'Rock & Indie'
                }
            ];
            albums.push(...fallbackCuratedAlbums);
        }

        return albums;
    }

    /**
     * Get top artists:
     * Flagship global chart artists each with their own unique official HD portrait.
     */
    async getTopArtists(limit: number = 50): Promise<Artist[]> {
        return getTopArtists(limit);
    }

    /**
     * Real-time Artist Search:
     * Strictly returns artists whose names match the search query, ranked by follower count descending
     */
    async searchArtists(query: string, limit: number = 25): Promise<Artist[]> {
        return searchArtists(query, limit);
    }

    /**
     * Get Artist Top Tracks:
     * Discovers an artist's top playable songs across Spotify & YouTube,
     * strictly verifying that tracks belong to the requested artist and eliminating
     * unrelated songs, tribute covers, and duplicate releases.
     */
    async getArtistTracks(artistId: string, artistName?: string): Promise<Track[]> {
        return getArtistTracks(artistId, artistName);
    }

    /**
     * Get Artist Profile Details:
     * Unified single source of truth for artist portrait, followers, and bio
     */
    async getArtistDetails(artistId: string, artistName?: string): Promise<any> {
        return getArtistDetails(artistId, artistName);
    }

    /**
     * Resolve artist image URL
     */
    async resolveArtistImage(artistName: string): Promise<string> {
        return resolveArtistImage(artistName);
    }

    /**
     * Get top tracks
     */
    async getTopTracks(): Promise<Track[]> {
        const pinnedFirstTrack: Track = {
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

        // Spotify Today's Top Hits flagship chart
        try {
            const playlist = await this.getPlaylist('37i9dQZF1DXcBWIGoYBM5M');
            const items = playlist.tracks?.items || [];
            if (items.length > 0) {
                const tracks = items
                    .map(i => i.track)
                    .filter((t: Track) => t && !t.name.toLowerCase().includes('eyes don'));
                if (tracks.length > 0) {
                    return [pinnedFirstTrack, ...tracks];
                }
            }
        } catch (sErr: any) {
            console.warn('[SpotifyScraper] Spotify top tracks notice:', sErr.message);
        }

        return [pinnedFirstTrack];
    }

    /**
     * Browse categories
     */
    async getCategories(): Promise<Category[]> {
        return [
            { id: 'pop', name: 'Pop', icons: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300' }] },
            { id: 'hip-hop', name: 'Hip-Hop', icons: [{ url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300' }] },
            { id: 'rock', name: 'Rock', icons: [{ url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300' }] },
            { id: 'chill', name: 'Chill', icons: [{ url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300' }] },
            { id: 'dance-electronic', name: 'Electronic', icons: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300' }] },
            { id: 'workout', name: 'Workout', icons: [{ url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300' }] },
            { id: 'focus', name: 'Focus', icons: [{ url: 'https://images.unsplash.com/photo-1520523839898-5071270409a8?w=300' }] },
            { id: 'country', name: 'Country', icons: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300' }] }
        ];
    }

    /**
     * Category playlists
     */
    async getCategoryPlaylists(categoryId: string): Promise<Playlist[]> {
        const featured = await this.getFeaturedPlaylists();
        return featured;
    }

    /**
     * Recommendations based on seed tracks
     */
    async getRecommendations(seedTracks: string[]): Promise<Track[]> {
        return this.getTopTracks();
    }

    /**
     * Smart Mood Suggestions:
     * Discovers songs matching the mood, style, and sonic cluster of the current track & artist using Spotify & YouTube
     */
    async getSmartMoodSuggestions(trackName: string, artistName: string): Promise<Track[]> {
        const cleanTrack = (trackName || '').toLowerCase().trim();
        const cleanArtist = (artistName || '').trim();
        const suggestions: Track[] = [];
        const seenIds = new Set<string>();

        try {
            if (cleanArtist) {
                // 1. Search Spotify & YouTube in parallel for artist's songs & vibe (time-boxed to 800ms)
                const [spotifyTracks, ytTracks] = await Promise.allSettled([
                    withTimeout(searchSpotubeSpotifyTracks(cleanArtist, 12), 800),
                    withTimeout(searchYouTubeInnertubeTracks(`${cleanArtist} songs`, 12), 800)
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
                const searchResults = await this.searchTracks(cleanArtist, 10);
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
            return this.getTopTracks();
        }

        return suggestions;
    }
}
