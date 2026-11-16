import axios from 'axios';
import { withTimeout } from '../../../../utils/timeout.js';
import type { Artist, Track } from '../../../interfaces.js';
import { POPULAR_SPOTIFY_PLAYLISTS } from '../catalogs/curatedPlaylists.js';
import { TOP_ARTIST_PROFILES } from '../catalogs/topArtistsCatalog.js';
import { isArtistNameMatch, calculateArtistRelevanceScore } from '../utils/similarityUtils.js';
import { cleanSearchQuery } from '../utils/queryUtils.js';
import { decodeHtmlEntities } from '../utils/htmlUtils.js';
import {
    searchSpotifyArtists,
    fetchSpotifyArtistOverview,
    searchSpotubeSpotifyTracks
} from '../clients/spotifyGqlClient.js';
import { searchYouTubeInnertubeTracks } from '../scrapers/youtubeSearch.js';
import { scrapeSpotifyPlaylistEmbed } from '../scrapers/playlistAlbumScraper.js';
import { resolveSpotifyTrackCover } from '../scrapers/spotifyEmbedScraper.js';
import {
    resolveArtistMetadata,
    getArtistFollowers,
    isJunkChannel,
    TOP_ARTIST_SPOTIFY_IDS,
    ARTIST_META_CACHE
} from './artistResolution.js';

/**
 * Resolve artist image URL
 */
export async function resolveArtistImage(artistName: string): Promise<string> {
    const meta = await resolveArtistMetadata(artistName);
    return meta.imageUrl;
}

/**
 * Get top artists:
 * Flagship global chart artists each with their own unique official HD portrait.
 */
export async function getTopArtists(limit: number = 50): Promise<Artist[]> {
    const results: Artist[] = [];
    const seenNames = new Set<string>();

    // 1. Flagship chart playlist tracks from Spotify to discover currently trending artist names
    const playlistIds = [
        '37i9dQZF1DXcBWIGoYBM5M', // Today's Top Hits
        '37i9dQZEVXbMDoHDwVN2tF', // Top 50 - Global
        '37i9dQZF1DX0XUsuxWHRQd', // RapCaviar
        '37i9dQZF1DX10zKzsJ2jva'  // Viva Latino
    ];

    const candidateArtists: string[] = [];

    for (const pId of playlistIds) {
        try {
            const playlist = await scrapeSpotifyPlaylistEmbed(pId);
            const items = playlist.tracks?.items || [];
            for (const item of items) {
                const t = item.track;
                if (!t || !Array.isArray(t.artists)) continue;

                for (const a of t.artists) {
                    const artistName = (a.name || '').trim();
                    const norm = artistName.toLowerCase();
                    if (
                        artistName &&
                        artistName.length >= 2 &&
                        !artistName.toLowerCase().includes('unknown') &&
                        !seenNames.has(norm)
                    ) {
                        seenNames.add(norm);
                        candidateArtists.push(artistName);
                    }
                    if (candidateArtists.length >= limit) break;
                }
                if (candidateArtists.length >= limit) break;
            }
        } catch (err: any) {
            console.warn(`[SpotifyScraper] getTopArtists failed for playlist ${pId}:`, err.message);
        }
        if (candidateArtists.length >= limit) break;
    }

    // If candidates are fewer than limit, append known superstars
    for (const name of Object.keys(TOP_ARTIST_PROFILES)) {
        if (!seenNames.has(name)) {
            seenNames.add(name);
            const capitalized = name.replace(/\b\w/g, c => c.toUpperCase());
            candidateArtists.push(capitalized);
        }
        if (candidateArtists.length >= limit) break;
    }

    // Resolve each artist's individual portrait and real metadata in parallel batches
    const artistPromises = candidateArtists.slice(0, limit).map(async (name) => {
        const meta = await resolveArtistMetadata(name);
        return {
            id: `sp_art_${encodeURIComponent(name)}`,
            name,
            images: [{ url: meta.imageUrl }],
            genres: meta.genres,
            followers: { total: meta.followers },
            monthlyListeners: meta.monthlyListeners
        };
    });

    const resolved = await Promise.all(artistPromises);
    resolved.sort((a, b) => (b.followers?.total || 0) - (a.followers?.total || 0));
    return resolved;
}

/**
 * Real-time Artist Search:
 * Strictly returns artists whose names match the search query, ranked by follower count descending
 */
export async function searchArtists(query: string, limit: number = 25): Promise<Artist[]> {
    const clean = (query || '').trim();
    if (!clean) return getTopArtists(limit);

    const results: Artist[] = [];
    const seen = new Set<string>();

    // 1. Direct match from curated superstars and top artists
    for (const name of Object.keys(TOP_ARTIST_PROFILES)) {
        if (isArtistNameMatch(name, clean)) {
            const norm = name.toLowerCase();
            if (!seen.has(norm)) {
                seen.add(norm);
                const meta = await resolveArtistMetadata(name);
                const capitalized = name.replace(/\b\w/g, c => c.toUpperCase());
                results.push({
                    id: `sp_art_${encodeURIComponent(capitalized)}`,
                    name: capitalized,
                    images: [{ url: meta.imageUrl }],
                    genres: meta.genres,
                    followers: { total: meta.followers },
                    monthlyListeners: meta.monthlyListeners
                });
            }
        }
    }

    // 2. Direct Spotify dedicated Artist Search via Pathfinder GraphQL (healthy 4000ms timeout)
    try {
        const spArtists = await withTimeout(searchSpotifyArtists(clean, Math.min(limit * 2, 40)), 4000).catch(() => []);
        // Enrich top candidates with genuine Spotify follower counts
        await Promise.all(spArtists.slice(0, 15).map(async (sa) => {
            const norm = sa.name.toLowerCase().trim();
            const existing = ARTIST_META_CACHE.get(norm);
            if (!existing || (existing.followers || 0) <= 500) {
                const overview = await withTimeout(fetchSpotifyArtistOverview(sa.id), 3500).catch(() => null);
                if (overview) {
                    ARTIST_META_CACHE.set(norm, {
                        imageUrl: overview.avatarUrl || sa.picture,
                        genres: ['Pop', 'Top Hits'],
                        followers: overview.followers,
                        monthlyListeners: overview.monthlyListeners,
                        verified: overview.verified
                    });
                    TOP_ARTIST_SPOTIFY_IDS[norm] = sa.id;
                }
            }
        }));

        for (const sa of spArtists) {
            const aName = (sa.name || '').trim();
            const norm = aName.toLowerCase();
            if (!aName || !isArtistNameMatch(aName, clean) || isJunkChannel(aName, clean)) continue;

            if (!seen.has(norm)) {
                seen.add(norm);
                const cachedMeta = ARTIST_META_CACHE.get(norm);
                const fans = cachedMeta?.followers || getArtistFollowers(aName);
                const picture = cachedMeta?.imageUrl || sa.picture || '';

                if (!ARTIST_META_CACHE.has(norm)) {
                    ARTIST_META_CACHE.set(norm, {
                        imageUrl: picture,
                        genres: ['Pop', 'Top Hits'],
                        followers: fans,
                        monthlyListeners: cachedMeta?.monthlyListeners || 0,
                        verified: cachedMeta?.verified ?? true
                    });
                    TOP_ARTIST_SPOTIFY_IDS[norm] = sa.id;
                }

                results.push({
                    id: `sp_art_${encodeURIComponent(aName)}`,
                    name: aName,
                    images: picture ? [{ url: picture }] : [],
                    genres: ['Pop', 'Top Hits'],
                    followers: { total: fans },
                    monthlyListeners: cachedMeta?.monthlyListeners || 0
                });
            }
        }
    } catch (err: any) {
        console.warn('[SpotifyScraperPlugin] searchSpotifyArtists error:', err.message);
    }

    // 3. Search Spotify catalog via Spotube with strict artist name verification
    try {
        const spotubeTracks = await searchSpotubeSpotifyTracks(`artist:${clean}`, limit);
        for (const t of spotubeTracks) {
            for (const art of t.artists) {
                const aName = (art.name || '').trim();
                const norm = aName.toLowerCase();
                if (!aName || !isArtistNameMatch(aName, clean) || isJunkChannel(aName, clean)) continue;

                if (!seen.has(norm)) {
                    seen.add(norm);
                    const fans = getArtistFollowers(aName);
                    results.push({
                        id: `sp_art_${encodeURIComponent(aName)}`,
                        name: aName,
                        images: [],
                        genres: ['Artist'],
                        followers: { total: fans }
                    });
                }
            }
        }
    } catch (err: any) {}

    // 4. YouTube Innertube with strict artist name verification
    try {
        const ytTracks = await searchYouTubeInnertubeTracks(`${clean} official audio`, limit);
        for (const t of ytTracks) {
            for (const art of t.artists) {
                const aName = (art.name || '').trim();
                const norm = aName.toLowerCase();
                if (!aName || !isArtistNameMatch(aName, clean) || isJunkChannel(aName, clean)) continue;

                if (!seen.has(norm)) {
                    seen.add(norm);
                    const fans = getArtistFollowers(aName);
                    results.push({
                        id: `yt_art_${encodeURIComponent(aName)}`,
                        name: aName,
                        images: [],
                        genres: ['Artist'],
                        followers: { total: fans }
                    });
                }
            }
        }
    } catch (err: any) {}

    // 5. Popularity (follower count descending) & composite text-relevance ranking
    results.sort((a, b) => {
        const fA = typeof a.followers === 'object' && a.followers !== null ? a.followers.total : (Number(a.followers) || 0);
        const fB = typeof b.followers === 'object' && b.followers !== null ? b.followers.total : (Number(b.followers) || 0);
        if (fB !== fA) return fB - fA;
        return calculateArtistRelevanceScore(b, clean) - calculateArtistRelevanceScore(a, clean);
    });

    // Strictly deduplicate by normalized artist name to eliminate duplicate cards
    const uniqueResults: Artist[] = [];
    const seenNorms = new Set<string>();
    for (const art of results) {
        const norm = (art.name || '').trim().toLowerCase();
        if (!norm || seenNorms.has(norm)) continue;
        seenNorms.add(norm);
        uniqueResults.push(art);
    }

    const topResults = uniqueResults.slice(0, limit);
    // Enrich portraits and authentic follower counts in parallel for the top candidates if needed
    await Promise.all(topResults.map(async (art) => {
        const curFans = typeof art.followers === 'object' && art.followers !== null ? art.followers.total : (Number(art.followers) || 0);
        if (!art.images || art.images.length === 0 || !art.images[0]?.url || curFans <= 500) {
            const meta = await resolveArtistMetadata(art.name);
            if (!art.images || art.images.length === 0 || !art.images[0]?.url) {
                art.images = [{ url: meta.imageUrl }];
            }
            art.genres = meta.genres;
            if (meta.followers && meta.followers > curFans) {
                art.followers = { total: meta.followers };
            }
            if (meta.monthlyListeners && (!art.monthlyListeners || meta.monthlyListeners > art.monthlyListeners)) {
                art.monthlyListeners = meta.monthlyListeners;
            }
        }
    }));

    return topResults;
}

/**
 * Get Artist Top Tracks:
 * Discovers an artist's top playable songs across Spotify & YouTube,
 * strictly verifying that tracks belong to the requested artist and eliminating
 * unrelated songs, tribute covers, and duplicate releases.
 */
export async function getArtistTracks(artistId: string, artistName?: string): Promise<Track[]> {
    const decoded = decodeURIComponent(artistName || artistId || '');
    const cleanTarget = decoded
        .replace(/^(sp_art_|yt_art_|dz_|it_|artist-)/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

    if (!cleanTarget) return [];

    const normTarget = cleanTarget
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const candidateTracks: Track[] = [];

    // 0. Authentic Spotify Pathfinder Top Tracks (authentic 640x640 artwork directly from Spotify CDN)
    const meta = await resolveArtistMetadata(cleanTarget);
    if (meta.topTracks && meta.topTracks.length > 0) {
        candidateTracks.push(...meta.topTracks);
    }

    // 1. Supplement with Spotube Spotify search with artist prefix to get additional official catalog tracks
    try {
        const spotubeArtistTracks = await searchSpotubeSpotifyTracks(`artist:${cleanTarget}`, 35);
        if (Array.isArray(spotubeArtistTracks)) {
            candidateTracks.push(...spotubeArtistTracks);
        }
    } catch (err: any) {
        console.warn('[SpotifyScraper] Spotube artist query notice:', err.message);
    }

    // 2. Also search YouTube Innertube for official audio if catalog needs more tracks
    if (candidateTracks.length < 15) {
        try {
            const ytTracks = await searchYouTubeInnertubeTracks(`${cleanTarget} official audio`, 20);
            if (Array.isArray(ytTracks)) {
                candidateTracks.push(...ytTracks);
            }
        } catch (err: any) {
            console.warn('[SpotifyScraper] YouTube artist search notice:', err.message);
        }
    }

    const junkRegex = /\b(tribute|karaoke|instrumental\s*version|backing\s*track|8-?bit|16-?bit|type\s*beat|string\s*quartet|in\s*the\s*style\s*of|behind\s*the\s*scenes|vevo\s*footnotes|fashion\s*show|lollapalooza|interview|documentary|full\s*set|festival\s*performance)\b/i;
    const results: Track[] = [];
    const seenCanonicalTitles = new Set<string>();

    for (const track of candidateTracks) {
        if (!track || !track.name || !Array.isArray(track.artists) || track.artists.length === 0) {
            continue;
        }

        const trackTitle = track.name.trim();
        const trackTitleLower = trackTitle.toLowerCase();

        // Reject tribute / karaoke / instrumental / parody / 8-bit / non-music video junk
        if (junkRegex.test(trackTitleLower)) {
            continue;
        }

        // Strict rule: The target singer MUST be the PRIMARY / LEAD artist (track.artists[0])
        // This guarantees songs by other artists (e.g. The Weeknd's "Die For You" or "Save Your Tears")
        // NEVER leak onto another singer's profile page.
        const primaryArtist = (track.artists[0]?.name || '').trim();
        const primaryNorm = primaryArtist
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');

        if (!primaryNorm) continue;

        // Reject if primary artist is a cover band or tribute entity
        if (junkRegex.test(primaryArtist.toLowerCase())) {
            continue;
        }

        const isPrimary = primaryNorm === normTarget || primaryNorm.includes(normTarget) || normTarget.includes(primaryNorm);
        if (!isPrimary) {
            // Not by this artist as primary lead performer -> skip!
            continue;
        }

        // Canonical title deduplication (strips remix, deluxe, live, acoustic, version tags)
        const canonical = trackTitleLower
            .replace(/\s*[\(\[].*?[\)\]]/gi, '')
            .replace(/[-–—]\s*(remix|remastered|live|acoustic|version|edit|instrumental|closed-captioned|official).*$/i, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();

        if (!canonical || seenCanonicalTitles.has(canonical)) {
            continue;
        }

        seenCanonicalTitles.add(canonical);

        // Clean up display title (strips trailing junk like "- Closed-Captioned" or "- Official")
        const cleanDisplayName = track.name
            .replace(/\s*[-–—]\s*(closed-captioned|official\s*video|official\s*audio|official|lyric\s*video)\s*$/i, '')
            .trim();

        // Guard: ensure track cover is authentic Spotify album artwork and NEVER the artist profile picture or Unsplash
        let trackCover = track.album?.images?.[0]?.url;
        if (trackCover && (trackCover.includes('ab676161') || trackCover.includes('unsplash.com'))) {
            const realCover = track.id && track.id.length === 22 ? await resolveSpotifyTrackCover(track.id) : null;
            trackCover = realCover || '';
        }

        results.push({
            ...track,
            name: cleanDisplayName || track.name,
            album: {
                ...track.album,
                name: track.album?.name || track.name,
                images: trackCover ? [{ url: trackCover }] : []
            }
        });

        if (results.length >= 25) {
            break;
        }
    }

    return results;
}

/**
 * Get Artist Profile Details:
 * Unified single source of truth for artist portrait, followers, and bio
 */
export async function getArtistDetails(artistId: string, artistName?: string): Promise<any> {
    const decoded = decodeURIComponent(artistName || artistId || '');
    let cleanName = decoded
        .replace(/^(sp_art_|yt_art_|dz_|it_|artist-)/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

    const norm = cleanName.toLowerCase().trim();
    const knownSpotifyId = TOP_ARTIST_SPOTIFY_IDS[norm];
    const effectiveId = (/^[0-9A-Za-z]{22}$/.test(artistId)) ? artistId : (knownSpotifyId || '');

    let ov: any = null;
    if (effectiveId) {
        ov = await fetchSpotifyArtistOverview(effectiveId);
        if (ov && ov.name) {
            cleanName = ov.name;
        }
    }

    const meta = await resolveArtistMetadata(cleanName);
    const displayName = cleanName.replace(/\b\w/g, c => c.toUpperCase());
    const coverImage = (ov?.avatarUrl) || meta.imageUrl;
    const headerImage = (ov?.headerUrl) || meta.headerUrl || coverImage;

    return {
        id: artistId,
        name: displayName,
        coverImage,
        headerImage,
        images: [{ url: coverImage }],
        monthlyListeners: ov?.monthlyListeners || meta.monthlyListeners || meta.followers || 0,
        followers: ov?.followers || meta.followers || 0,
        genres: meta.genres,
        bio: meta.bio || `<strong>${displayName}</strong> is a celebrated musical artist with millions of fans worldwide. Known for innovative sound design and emotive melodies, ${displayName} continues to craft charting tracks and iconic records.`,
        verified: ov?.verified ?? meta.verified ?? true
    };
}

