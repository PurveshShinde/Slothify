import type { Request, Response } from 'express';
import forge from 'node-forge';
import type { AudioPlugin, AudioSearchResult } from '../interfaces.js';

// In-Memory RAM Caches (0 disk storage used)
const saavnSearchCache = new Map<string, AudioSearchResult>();
const saavnStreamCache = new Map<string, { url: string; expiresAt: number }>();
const songMetaCache = new Map<string, any>();

/**
 * Decrypts JioSaavn encrypted_media_url using DES-ECB (sumitkolhe/jiosaavn-api algorithm)
 */
export function decryptSaavnMediaUrl(encryptedMediaUrl: string): string {
    const key = '38346591';
    const iv = '00000000';

    const encrypted = forge.util.decode64(encryptedMediaUrl);
    const decipher = forge.cipher.createDecipher('DES-ECB', forge.util.createBuffer(key));
    decipher.start({ iv: forge.util.createBuffer(iv) });
    decipher.update(forge.util.createBuffer(encrypted));
    decipher.finish();

    const decrypted = decipher.output.getBytes();
    // Default decrypted link is usually 96kbps; upgrade to 320kbps for pristine audio quality
    return decrypted
        .replace('_96.mp4', '_320.mp4')
        .replace('_96.m4a', '_320.mp4');
}

/**
 * Get direct stream URL from JioSaavn by song ID or query
 */
export async function getJioSaavnStreamUrl(songId: string): Promise<string> {
    const now = Date.now();
    const cached = saavnStreamCache.get(songId);
    if (cached && cached.expiresAt > now) {
        return cached.url;
    }

    // 1. Check if custom JIOSAAVN_API_URL is configured (e.g., self-hosted sumitkolhe/jiosaavn-api)
    if (process.env.JIOSAAVN_API_URL) {
        try {
            const base = process.env.JIOSAAVN_API_URL.replace(/\/$/, '');
            const res = await fetch(`${base}/api/songs?id=${encodeURIComponent(songId)}`, {
                signal: AbortSignal.timeout(5000),
                headers: { 'User-Agent': 'Slothify/1.0' }
            });
            if (res.ok) {
                const data = (await res.json()) as any;
                const song = data.data?.[0] || data.data?.results?.[0] || data.data;
                const downloadUrl = song?.downloadUrl;
                if (Array.isArray(downloadUrl) && downloadUrl.length > 0) {
                    // Pick 320kbps if available, else best quality
                    const best = downloadUrl.find((d: any) => d.quality === '320kbps') || downloadUrl[downloadUrl.length - 1];
                    const streamUrl = best.url || best.link;
                    if (streamUrl) {
                        saavnStreamCache.set(songId, { url: streamUrl, expiresAt: now + 6 * 3600 * 1000 });
                        return streamUrl;
                    }
                }
            }
        } catch (apiErr: any) {
            console.warn('[JioSaavnAudioPlugin] Custom JIOSAAVN_API_URL error, falling back to direct API:', apiErr.message);
        }
    }

    // 2. Direct JioSaavn API Song Details
    let encryptedMediaUrl = songMetaCache.get(songId)?.encrypted_media_url;

    if (!encryptedMediaUrl) {
        const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0%3F_marker%3D0&_format=json&pids=${encodeURIComponent(songId)}`;
        const res = await fetch(detailsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) {
            throw new Error(`JioSaavn details request failed with status: ${res.status}`);
        }

        const data = (await res.json()) as any;
        const songData = data[songId] || Object.values(data)[0] as any;
        encryptedMediaUrl = songData?.encrypted_media_url;
        if (songData) {
            songMetaCache.set(songId, songData);
        }
    }

    if (!encryptedMediaUrl) {
        throw new Error(`No encrypted media URL found for JioSaavn song ${songId}`);
    }

    const decryptedUrl = decryptSaavnMediaUrl(encryptedMediaUrl);
    saavnStreamCache.set(songId, {
        url: decryptedUrl,
        expiresAt: now + 6 * 3600 * 1000
    });

    return decryptedUrl;
}

/**
 * Clean search query to work seamlessly with JioSaavn's Solr query parser
 */
export function cleanSaavnQuery(raw: string): string {
    return raw
        .replace(/\b(audio|official|video|music\s*video|remastered|lyrics?|explicit)\b/gi, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/["'’]/g, '')
        .replace(/&/g, ' ')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export class JioSaavnAudioPlugin implements AudioPlugin {
    readonly name = 'JioSaavnAudio';

    /**
     * Search JioSaavn catalog for track with resilient query cascading and ranking
     */
    async search(query: string, titleHint?: string, artistHint?: string): Promise<AudioSearchResult> {
        const trimmed = query.trim();
        const cleanQuery = cleanSaavnQuery(trimmed).toLowerCase();

        // 0. Direct JioSaavn URL support (e.g. https://www.jiosaavn.com/song/love-me-like-you-do/NgUBWTdKB3A)
        const urlMatch = trimmed.match(/jiosaavn\.com\/song\/[^/]+\/([a-zA-Z0-9_-]+)/);
        if (urlMatch) {
            const token = urlMatch[1];
            try {
                const tokenRes = await fetch(`https://www.jiosaavn.com/api.php?__call=webapi.get&token=${encodeURIComponent(token)}&type=song&_format=json&_marker=0&cc=in`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(6000)
                });
                if (tokenRes.ok) {
                    const tData = (await tokenRes.json()) as any;
                    const song = tData[Object.keys(tData)[0]];
                    if (song && song.id) {
                        songMetaCache.set(song.id, song);
                        return {
                            videoId: song.id,
                            title: song.song || song.title || '',
                            duration: Number(song.duration) || 0,
                            thumbnail: (song.image || '').replace('150x150', '500x500'),
                            streamToken: 'jiosaavn'
                        };
                    }
                }
            } catch (err: any) {
                console.warn('[JioSaavnAudioPlugin] Token URL search failed:', err.message);
            }
        }

        const cached = saavnSearchCache.get(cleanQuery);
        if (cached) {
            return cached;
        }

        // 1. Try custom JIOSAAVN_API_URL if configured
        if (process.env.JIOSAAVN_API_URL) {
            try {
                const base = process.env.JIOSAAVN_API_URL.replace(/\/$/, '');
                const res = await fetch(`${base}/api/search/songs?query=${encodeURIComponent(cleanQuery || query.trim())}`, {
                    signal: AbortSignal.timeout(5000),
                    headers: { 'User-Agent': 'Slothify/1.0' }
                });
                if (res.ok) {
                    const data = (await res.json()) as any;
                    const results = data.data?.results || data.results;
                    if (results && results.length > 0) {
                        const song = results[0];
                        const result: AudioSearchResult = {
                            videoId: song.id,
                            title: song.name || song.title,
                            duration: Number(song.duration) || 0,
                            thumbnail: Array.isArray(song.image) ? song.image[song.image.length - 1]?.url : (song.image || ''),
                            streamToken: 'jiosaavn'
                        };
                        saavnSearchCache.set(cleanQuery, result);
                        return result;
                    }
                }
            } catch (err: any) {
                console.warn('[JioSaavnAudioPlugin] Custom API search error, using direct search:', err.message);
            }
        }

        // 2. Direct JioSaavn Search API with multi-tier candidate cascade
        const candidates: string[] = [];

        // Candidate A: Cleaned title if provided
        if (titleHint) {
            const cleanTitle = cleanSaavnQuery(titleHint);
            if (cleanTitle) candidates.push(cleanTitle);
        }
        if (cleanQuery && !candidates.includes(cleanQuery)) {
            candidates.push(cleanQuery);
        }

        // Candidate B: Clean title + primary artist
        if (titleHint && artistHint) {
            const combo = cleanSaavnQuery(`${titleHint} ${artistHint}`);
            if (combo && !candidates.includes(combo)) candidates.push(combo);
        }

        // Candidate C: First 3 words of cleanQuery (captures clean title when raw query is long)
        const words = cleanQuery.split(' ');
        if (words.length > 3) {
            const prefix = words.slice(0, 3).join(' ');
            if (!candidates.includes(prefix)) candidates.push(prefix);
        }

        // Candidate D: Raw query fallback
        if (!candidates.includes(trimmed)) {
            candidates.push(trimmed);
        }

        let bestSong: any = null;

        for (const candidate of candidates) {
            if (!candidate || candidate.length < 2) continue;
            try {
                const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=15&q=${encodeURIComponent(candidate)}`;
                const response = await fetch(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(6000)
                });

                if (!response.ok) continue;

                const data = (await response.json()) as any;
                const results: any[] = data.results;
                if (!results || results.length === 0) continue;

                // Rank results: if artistHint or query contains an artist name, prioritize matching artist
                const targetArtist = (artistHint || '').toLowerCase().trim();
                if (targetArtist) {
                    const matched = results.find(r => {
                        const artistStr = (r.primary_artists || r.singers || '').toLowerCase();
                        return artistStr.includes(targetArtist) || targetArtist.split(' ').some(w => w.length > 2 && artistStr.includes(w));
                    });
                    if (matched) {
                        bestSong = matched;
                        break;
                    }
                }

                // If no specific artist match or no artist provided, take the top result
                bestSong = results[0];
                break;
            } catch (err: any) {
                console.warn(`[JioSaavnAudioPlugin] Candidate "${candidate}" failed:`, err.message);
            }
        }

        if (!bestSong) {
            throw new Error(`No JioSaavn track found for query: ${query}`);
        }

        // Cache metadata for fast stream resolution
        songMetaCache.set(bestSong.id, bestSong);

        const result: AudioSearchResult = {
            videoId: bestSong.id,
            title: bestSong.song || bestSong.title || '',
            duration: Number(bestSong.duration) || 0,
            thumbnail: (bestSong.image || '').replace('150x150', '500x500'),
            streamToken: 'jiosaavn'
        };

        if (saavnSearchCache.size > 500) {
            const firstKey = saavnSearchCache.keys().next().value;
            if (firstKey) saavnSearchCache.delete(firstKey);
        }
        saavnSearchCache.set(cleanQuery, result);

        return result;
    }

    /**
     * Extract stream URL from JioSaavn
     */
    async extractStreamUrl(songId: string): Promise<string> {
        return getJioSaavnStreamUrl(songId);
    }

    /**
     * Preload / warm up the stream URL in memory
     */
    async preload(songId: string): Promise<void> {
        try {
            await getJioSaavnStreamUrl(songId);
        } catch (err: any) {
            console.warn(`[JioSaavnAudioPlugin] Preload failed for ${songId}:`, err.message);
        }
    }

    /**
     * Stream audio directly to client via CDN URL
     */
    async stream(songId: string, req: Request, res: Response): Promise<void> {
        try {
            const audioUrl = await getJioSaavnStreamUrl(songId);
            if (!res.headersSent) {
                res.setHeader('Cache-Control', 'public, max-age=21600'); // Cache stream response for 6 hours
                res.json({
                    success: true,
                    url: audioUrl,
                    provider: 'jiosaavn'
                });
            }
        } catch (err: any) {
            console.error('[JioSaavnAudioPlugin] Stream failed:', err.message);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Extraction failed',
                    details: err.message
                });
            }
        }
    }
}
