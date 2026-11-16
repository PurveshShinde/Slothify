import axios from 'axios';
import type { Track, Artist } from '../../../interfaces.js';
import { withTimeout } from '../../../../utils/timeout.js';
import { decodeHtmlEntities } from '../utils/htmlUtils.js';
import { cleanSearchQuery } from '../utils/queryUtils.js';
import { isArtistNameMatch } from '../utils/similarityUtils.js';
import { TOP_ARTIST_PROFILES } from '../catalogs/topArtistsCatalog.js';
import { searchSpotubeSpotifyTracks } from '../clients/spotifyGqlClient.js';
import { searchArtists } from '../artists/artistExploration.js';
import {
    normalizePlayCountToPopularity,
    scoreTrackRelevance,
    deduplicateTracks
} from '../ranking/trackRanking.js';

export interface SearchTracksOptions {
    searchArtistsFn?: (query: string, limit: number) => Promise<Artist[]>;
}

/**
 * Search tracks using Dual-Engine Search (Spotify Pathfinder + JioSaavn):
 * - Direct JioSaavn album/song URL support
 * - JioSaavn's superior hit ranking for popular original songs
 * - HTML entity decoding
 * - Query cleaning (removes "by" keyword, e.g. "eyes dont lie by isabel larose")
 * - Cross-engine token overlap deduplication with Spotify CDN artwork priority
 */
export async function searchTracks(
    query: string,
    limit: number = 20,
    options?: SearchTracksOptions
): Promise<Track[]> {
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

    const resolveArtists = options?.searchArtistsFn || searchArtists;

    // Pre-query matched artists to inject their top songs only if searching for a recognized major artist (time-boxed to 800ms)
    const matchedArtists = await withTimeout(resolveArtists(cleanQuery, 3), 800).catch(() => []);
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
