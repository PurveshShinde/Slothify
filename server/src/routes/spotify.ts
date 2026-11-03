import express from 'express';
import axios from 'axios';
import type { Playlist, Track } from '../plugins/interfaces.js';

const router = express.Router();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface ParsedSpotifyTarget {
    type: 'playlist' | 'album' | 'track' | 'unknown';
    id: string;
}

/**
 * Robust extractor for Spotify URLs, URIs, and pure IDs
 * Handles:
 * - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
 * - https://open.spotify.com/album/4eLPsYPBmXABThSJ821sqY
 * - https://open.spotify.com/track/1nZwGBxjuCZ7NKU5jyeN9F
 * - spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
 * - 37i9dQZF1DXcBWIGoYBM5M (22 alphanumeric characters)
 */
function parseSpotifyTarget(input: string): ParsedSpotifyTarget {
    const clean = (input || '').trim();
    if (!clean) return { type: 'unknown', id: '' };

    const match = clean.match(/(playlist|album|track)[\/:]([a-zA-Z0-9]{22})/i);
    if (match) {
        return {
            type: match[1].toLowerCase() as 'playlist' | 'album' | 'track',
            id: match[2]
        };
    }

    if (/^[a-zA-Z0-9]{22}$/.test(clean)) {
        return { type: 'playlist', id: clean };
    }

    return { type: 'unknown', id: clean };
}

// In-memory cache for track-specific album artworks
const trackArtCache = new Map<string, string>();

async function resolveTrackThumbnail(trackId: string): Promise<string | null> {
    if (!trackId) return null;
    if (trackArtCache.has(trackId)) {
        return trackArtCache.get(trackId)!;
    }
    try {
        const res = await axios.get(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 2500
        });
        const rawUrl = res.data?.thumbnail_url;
        if (rawUrl && typeof rawUrl === 'string') {
            const hdUrl = rawUrl.replace(/00001e02|00004851/, '0000b273');
            trackArtCache.set(trackId, hdUrl);
            return hdUrl;
        }
    } catch {}
    return null;
}

/**
 * Scrapes playlist, album, or track data directly from public Spotify Embed.
 * Completely immune to `api.spotify.com/v1` 429 rate limits because it does not use OAuth or developer tokens.
 */
async function scrapeSpotifyTarget(target: ParsedSpotifyTarget): Promise<Playlist | null> {
    const { type, id } = target;
    if (type === 'unknown' || !id) return null;

    const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
    const res = await axios.get<string>(embedUrl, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
    });

    const html = res.data;
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match || !match[1]) {
        throw new Error('Spotify embed page format was unrecognized');
    }

    const nextData = JSON.parse(match[1]);
    const entity = nextData.props?.pageProps?.state?.data?.entity;
    if (!entity) {
        throw new Error('Spotify entity not found on embed page');
    }

    const coverArtUrl = entity.coverArt?.sources?.[0]?.url ||
        entity.visualIdentity?.image?.[0]?.url ||
        entity.images?.[0]?.url ||
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

    // 1. If Target is a Single Track (e.g. user pasted https://open.spotify.com/track/1nZwGBxjuCZ7NKU5jyeN9F)
    if (type === 'track') {
        const trackTitle = entity.name || entity.title || 'Unknown Track';
        const rawArtist = entity.subtitle || entity.artists?.[0]?.name || 'Spotify Artist';
        const artistNames = String(rawArtist).split(/,\s*/);
        const duration = Number(entity.duration) || 180000;

        // Try to get high-res single track album artwork
        const singleTrackThumb = (await resolveTrackThumbnail(id)) || coverArtUrl;

        const singleTrack: Track = {
            id,
            uri: `spotify:track:${id}`,
            name: trackTitle,
            artists: artistNames.map((name: string) => ({ name: name.trim() })),
            album: {
                name: entity.album?.name || `${trackTitle} - Single`,
                images: [{ url: singleTrackThumb }]
            },
            duration_ms: duration,
            preview_url: entity.audioPreview?.url || null
        };

        return {
            id: `sp_tr_${id}`,
            name: `${trackTitle} - Single`,
            description: `Imported Spotify single track by ${rawArtist}`,
            images: [{ url: singleTrackThumb }],
            owner: {
                id: 'spotify',
                display_name: 'Spotify'
            },
            tracks: {
                total: 1,
                items: [{ track: singleTrack }]
            },
            isSpotify: true
        };
    }

    // 2. If Target is a Playlist or Album
    const rawTrackList = Array.isArray(entity.trackList) ? entity.trackList : [];
    // Filter out restricted/deleted ghost tracks with no title
    const trackList = rawTrackList.filter((t: any) => t && (t.title || t.name));

    // Resolve individual track album artworks concurrently in batches of 15
    const trackThumbnails: (string | null)[] = new Array(trackList.length).fill(null);
    const batchSize = 15;
    for (let i = 0; i < trackList.length; i += batchSize) {
        const batch = trackList.slice(i, i + batchSize);
        const batchPromises = batch.map(async (t: any, batchIdx: number) => {
            const trackUri = t.uri || `spotify:track:${t.id || (i + batchIdx)}`;
            const trackId = trackUri.replace(/^spotify:track:/, '');
            const thumb = await resolveTrackThumbnail(trackId);
            trackThumbnails[i + batchIdx] = thumb;
        });
        await Promise.allSettled(batchPromises);
    }

    const allTrackItems: { track: Track }[] = [];

    for (let i = 0; i < trackList.length; i++) {
        const t = trackList[i];
        if (!t) continue;

        const trackTitle = t.title || t.name || 'Unknown Track';
        const rawArtist = t.subtitle || (Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(', ') : 'Artist');
        const artistNames = String(rawArtist).split(/,\s*/);
        const trackUri = t.uri || `spotify:track:${t.id || i}`;
        const trackId = trackUri.replace(/^spotify:track:/, '');

        // Use authentic individual track artwork resolved via oEmbed, or fallback to single high-res cover
        let singleCoverFallback = coverArtUrl;
        if (coverArtUrl.includes('mosaic.scdn.co')) {
            const hashMatch = coverArtUrl.match(/ab67616d[a-f0-9]{32}/i);
            if (hashMatch) {
                singleCoverFallback = `https://i.scdn.co/image/${hashMatch[0].replace('00001e02', '0000b273')}`;
            }
        }
        const trackImage = trackThumbnails[i] || singleCoverFallback;

        allTrackItems.push({
            track: {
                id: trackId,
                uri: trackUri,
                name: trackTitle,
                artists: artistNames.map((n: string) => ({ name: n.trim() })),
                album: {
                    name: type === 'album' ? (entity.name || entity.title || 'Album') : `${trackTitle} (Single)`,
                    images: [{ url: trackImage }]
                },
                duration_ms: Number(t.duration) || 180000,
                preview_url: t.audioPreview?.url || null
            }
        });
    }

    const playlistTitle = entity.name || entity.title || (type === 'album' ? 'Spotify Album' : 'Spotify Playlist');
    const playlistDesc = entity.description || entity.subtitle || (type === 'album' ? `Album by ${entity.subtitle || 'Artist'}` : 'Imported Spotify Playlist');

    return {
        id: `sp_${type}_${id}`,
        name: playlistTitle,
        description: playlistDesc,
        images: [{ url: coverArtUrl }],
        owner: {
            id: 'spotify',
            display_name: entity.owner?.display_name || 'Spotify'
        },
        tracks: {
            total: allTrackItems.length,
            items: allTrackItems
        },
        isSpotify: true
    };
}

/**
 * POST /api/spotify/fetch-playlists
 * Imports Spotify playlists, albums, or tracks directly by URL or ID.
 * Immune to API 429 rate limits.
 * STRICT NON-SYNC: Never persists data to MongoDB Atlas.
 */
router.post('/fetch-playlists', async (req, res) => {
    try {
        const { url, playlistUrl, playlistIds = [] } = req.body;
        const rawInputs: string[] = [];

        if (typeof url === 'string' && url.trim()) rawInputs.push(url.trim());
        if (typeof playlistUrl === 'string' && playlistUrl.trim()) rawInputs.push(playlistUrl.trim());
        if (Array.isArray(playlistIds)) {
            playlistIds.forEach((pid: any) => {
                if (typeof pid === 'string' && pid.trim()) rawInputs.push(pid.trim());
            });
        }

        if (rawInputs.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a Spotify playlist, album, or track link.'
            });
        }

        const importedPlaylists: Playlist[] = [];
        const errors: string[] = [];

        for (const input of rawInputs) {
            const target = parseSpotifyTarget(input);
            if (target.type === 'unknown') {
                errors.push(`Invalid Spotify link: "${input}". Please paste a valid open.spotify.com link.`);
                continue;
            }

            try {
                const playlist = await scrapeSpotifyTarget(target);
                if (playlist && playlist.tracks.total > 0) {
                    importedPlaylists.push(playlist);
                } else {
                    errors.push(`Could not extract tracks from Spotify link: ${input}`);
                }
            } catch (scrapeErr: any) {
                console.error(`[Spotify Scraper] Failed for ${input}:`, scrapeErr.message);
                errors.push(`Failed to load ${target.type}: ${scrapeErr.message}`);
            }
        }

        if (importedPlaylists.length === 0) {
            return res.status(422).json({
                success: false,
                error: errors[0] || 'Unable to import this Spotify link. Make sure the playlist or album is public.'
            });
        }

        return res.json({
            success: true,
            importedCount: importedPlaylists.length,
            playlists: importedPlaylists,
            playlist: importedPlaylists[0]
        });
    } catch (err: any) {
        console.error('[Spotify Fetch Playlists] Route error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to process Spotify link',
            details: err.message
        });
    }
});

export default router;
