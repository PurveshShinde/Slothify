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

// Known direct JioSaavn URLs for studio original tracks (bypasses search algorithm for exact audio fidelity)
export const KNOWN_DIRECT_TRACK_LINKS: Record<string, string> = {
    'boyfriend dove cameron': 'https://www.jiosaavn.com/song/boyfriend/Cg0RaSNAW2w',
    'dove cameron boyfriend': 'https://www.jiosaavn.com/song/boyfriend/Cg0RaSNAW2w'
};

/**
 * Direct Link Fetcher via Cloudflare Worker (sumitkolhe/jiosaavn-api)
 * Completely bypasses search algorithm, ensuring exact studio master audio & 320kbps stream
 */
export async function fetchWorkerSongByLink(link: string): Promise<any | null> {
    const saavnApiUrl = process.env.JIOSAAVN_API_URL || 'https://slothify-audio-services.shindepurvesh007.workers.dev';
    try {
        const base = saavnApiUrl.replace(/\/$/, '');
        const res = await fetch(`${base}/api/songs?link=${encodeURIComponent(link)}`, {
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': 'Slothify/1.0' }
        });
        if (res.ok) {
            const data = (await res.json()) as any;
            const song = data.data?.[0] || data.data?.results?.[0] || data.data;
            if (song && song.id) {
                // Cache metadata & direct 320kbps stream
                songMetaCache.set(song.id, song);
                const downloadUrl = song.downloadUrl;
                if (Array.isArray(downloadUrl) && downloadUrl.length > 0) {
                    const best = downloadUrl.find((d: any) => d.quality === '320kbps') || downloadUrl[downloadUrl.length - 1];
                    const streamUrl = best?.url || best?.link;
                    if (streamUrl) {
                        saavnStreamCache.set(song.id, { url: streamUrl, expiresAt: Date.now() + 6 * 3600 * 1000 });
                    }
                }
                return song;
            }
        }
    } catch (err: any) {
        console.warn('[JioSaavnAudioPlugin] Worker link fetch error:', err.message);
    }
    return null;
}

/**
 * Scrapes direct JioSaavn URL of the authentic track and verifies against Cloudflare Worker
 */
export async function scrapeDirectSaavnSongUrl(query: string, artist?: string, targetDuration?: number): Promise<{ url: string; song: any } | null> {
    const cleanQ = cleanSaavnQuery(query).toLowerCase();
    const rawArtist = artist ? artist.split(/[,/&]| feat\.? | ft\.? /i)[0].trim() : '';
    const cleanArt = rawArtist ? cleanSaavnQuery(rawArtist).toLowerCase() : '';

    const candidates: string[] = [];
    if (cleanQ && cleanArt) {
        candidates.push(`${cleanQ} ${cleanArt}`.trim());
        candidates.push(`${cleanArt} ${cleanQ}`.trim());
    }
    if (cleanQ && !candidates.includes(cleanQ)) {
        candidates.push(cleanQ);
    }

    const targetHasRemix = /\b(remix|mix)\b/i.test(cleanQ);

    for (const q of candidates) {
        if (!q || q.length < 2) continue;

        // 1. Primary: Try search.getResults (official catalog Solr index where authentic albums & studio tracks are ranked)
        try {
            const srUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=15&q=${encodeURIComponent(q)}`;
            const srRes = await fetch(srUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                signal: AbortSignal.timeout(5000)
            });
            if (srRes.ok) {
                const data = (await srRes.json()) as any;
                const results = data.results || [];
                const scoredCandidates: Array<{ r: any; score: number; durDelta: number }> = [];

                for (const r of results) {
                    const titleLow = (r.song || r.title || '').toLowerCase();
                    if (/\b(nightcore|karaoke|instrumental|cover|slowed|reverb|sped\s*up|speed\s*up|hardstyle|techno|tribute)\b/i.test(titleLow)) continue;
                    if (!r.perma_url) continue;

                    // Exclude remixes when the authentic original was requested
                    const candHasRemix = /\b(remix|mix|mashup|edit|rework)\b/i.test(titleLow);
                    if (!targetHasRemix && candHasRemix) continue;

                    const songArt = r.primary_artists || r.singers || '';
                    if (cleanArt && !isArtistFuzzyMatch(songArt, cleanArt)) continue;

                    const rDur = Number(r.duration) || 0;
                    const durDelta = targetDuration && targetDuration > 0 ? Math.abs(rDur - targetDuration) : 0;
                    if (targetDuration && targetDuration > 0 && durDelta > 5) continue; // Authentic digital masters match within 1-4 seconds

                    let score = 100;
                    if (durDelta <= 2) score += 60;
                    else if (durDelta <= 4) score += 30;

                    // Exact clean title match bonus
                    const normTarget = normalizeSaavnText(cleanQ.replace(cleanArt, '').trim() || cleanQ);
                    const normCand = normalizeSaavnText(titleLow);
                    if (normCand === normTarget) score += 80;
                    else if (normCand.includes(normTarget)) score += 30;

                    scoredCandidates.push({ r, score, durDelta });
                }

                scoredCandidates.sort((a, b) => b.score - a.score);

                for (const item of scoredCandidates) {
                    const song = await fetchWorkerSongByLink(item.r.perma_url);
                    if (song) {
                        return { url: item.r.perma_url, song };
                    }
                }
            }
        } catch { }

        // 2. Secondary fallback: autocomplete.get
        try {
            const autoUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=${encodeURIComponent(q)}`;
            const autoRes = await fetch(autoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                signal: AbortSignal.timeout(5000)
            });
            if (autoRes.ok) {
                const data = (await autoRes.json()) as any;
                const songs = data.songs?.data || [];
                for (const s of songs) {
                    const titleLow = (s.title || '').toLowerCase();
                    if (/\b(nightcore|karaoke|instrumental|cover|slowed|reverb|sped\s*up|speed\s*up|hardstyle|techno)\b/i.test(titleLow)) continue;
                    const candHasRemix = /\b(remix|mix|mashup|edit|rework)\b/i.test(titleLow);
                    if (!targetHasRemix && candHasRemix) continue;

                    if (s.url && s.url.includes('/song/')) {
                        const song = await fetchWorkerSongByLink(s.url);
                        if (song) {
                            if (targetDuration && targetDuration > 0 && song.duration) {
                                const diff = Math.abs((Number(song.duration) || 0) - targetDuration);
                                if (diff > 5) continue;
                            }
                            if (cleanArt) {
                                const songArt = (song.artists?.primary || []).map((a: any) => a.name).join(' ');
                                if (isArtistFuzzyMatch(songArt, cleanArt)) {
                                    return { url: s.url, song };
                                }
                            } else {
                                return { url: s.url, song };
                            }
                        }
                    }
                }
            }
        } catch { }
    }

    return null;
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

    // 1. Query Cloudflare Worker JioSaavn API
    const saavnApiUrl = process.env.JIOSAAVN_API_URL || 'https://slothify-audio-services.shindepurvesh007.workers.dev';
    try {
        const base = saavnApiUrl.replace(/\/$/, '');
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
        console.warn('[JioSaavnAudioPlugin] Worker JIOSAAVN_API_URL error, falling back to direct API:', apiErr.message);
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

export function normalizeSaavnText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function levenshteinDistance(a: string, b: string): number {
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

export function isArtistFuzzyMatch(resultArtistStr: string, targetArtist: string): boolean {
    if (!targetArtist) return true;
    const normResult = normalizeSaavnText(resultArtistStr);
    const normTarget = normalizeSaavnText(targetArtist);
    if (!normResult || !normTarget) return false;

    // Direct substring match
    if (normResult.includes(normTarget) || normTarget.includes(normResult)) return true;

    // Check individual significant words (e.g. "isabel", "larosa" vs "larose")
    const targetWords = normTarget.split(' ').filter(w => w.length > 2);
    const resultWords = normResult.split(' ').filter(w => w.length > 2);
    if (targetWords.length === 0) return true;

    let matchedWords = 0;
    for (const tw of targetWords) {
        const found = resultWords.some(rw => rw === tw || (rw.length >= 4 && levenshteinDistance(rw, tw) <= 1));
        if (found) matchedWords++;
    }

    return matchedWords > 0 && (matchedWords >= Math.ceil(targetWords.length / 2) || matchedWords >= 2);
}

export function isTitleFuzzyMatch(resultTitleStr: string, targetTitle: string): boolean {
    if (!targetTitle) return true;
    const normResult = normalizeSaavnText(cleanSaavnQuery(resultTitleStr));
    const normTarget = normalizeSaavnText(cleanSaavnQuery(targetTitle));
    if (!normResult || !normTarget) return false;

    if (normResult.includes(normTarget) || normTarget.includes(normResult)) return true;

    const targetWords = normTarget.split(' ').filter(w => w.length > 2);
    const resultWords = normResult.split(' ').filter(w => w.length > 2);
    if (targetWords.length === 0) return true;

    const matchedWords = targetWords.filter(tw => resultWords.some(rw => rw === tw || (rw.length >= 4 && levenshteinDistance(rw, tw) <= 1))).length;
    return matchedWords >= Math.ceil(targetWords.length / 2);
}

export class JioSaavnAudioPlugin implements AudioPlugin {
    readonly name = 'JioSaavnAudio';

    /**
     * Search JioSaavn catalog for track with resilient query cascading and ranking
     */
    async search(query: string, titleHint?: string, artistHint?: string, targetDuration?: number): Promise<AudioSearchResult> {
        const trimmed = query.trim();
        const cleanQuery = cleanSaavnQuery(trimmed).toLowerCase();
        const cleanTitle = titleHint ? cleanSaavnQuery(titleHint).toLowerCase() : '';
        const rawArtist = artistHint ? artistHint.split(/[,/&]| feat\.? | ft\.? /i)[0].trim() : '';
        const cleanArtist = rawArtist ? cleanSaavnQuery(rawArtist).toLowerCase() : '';

        // Composite cache key with duration prevents cross-artist & timestamp cache contamination
        const cacheKey = `${cleanQuery}___${cleanTitle}___${cleanArtist}___${targetDuration || 0}`;

        // 0. Direct JioSaavn URL support (e.g. https://www.jiosaavn.com/song/boyfriend/Cg0RaSNAW2w)
        const urlMatch = trimmed.match(/jiosaavn\.com\/song\/[^/]+\/([a-zA-Z0-9_-]+)/);
        if (urlMatch) {
            const directSong = await fetchWorkerSongByLink(trimmed);
            if (directSong && directSong.id) {
                const bestDownload = (directSong.downloadUrl || []).find((d: any) => d.quality === '320kbps') || directSong.downloadUrl?.[directSong.downloadUrl.length - 1];
                const streamUrl = bestDownload?.url || bestDownload?.link;
                const result: AudioSearchResult = {
                    videoId: directSong.id,
                    title: directSong.name || directSong.song || '',
                    duration: Number(directSong.duration) || 0,
                    thumbnail: Array.isArray(directSong.image) ? directSong.image[directSong.image.length - 1]?.url : (directSong.image || '').replace('150x150', '500x500'),
                    streamToken: 'jiosaavn',
                    streamUrl
                };
                saavnSearchCache.set(cacheKey, result);
                return result;
            }

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

        const cached = saavnSearchCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 1. Direct Known Track Links (Bypasses search algorithms entirely for exact original studio tracks)
        const lookupKey = `${cleanTitle} ${cleanArtist}`.trim();
        const reverseKey = `${cleanArtist} ${cleanTitle}`.trim();
        const knownLink = KNOWN_DIRECT_TRACK_LINKS[lookupKey] || KNOWN_DIRECT_TRACK_LINKS[reverseKey] || KNOWN_DIRECT_TRACK_LINKS[cleanQuery];
        if (knownLink) {
            const directSong = await fetchWorkerSongByLink(knownLink);
            if (directSong && directSong.id) {
                const bestDownload = (directSong.downloadUrl || []).find((d: any) => d.quality === '320kbps') || directSong.downloadUrl?.[directSong.downloadUrl.length - 1];
                const streamUrl = bestDownload?.url || bestDownload?.link;
                const result: AudioSearchResult = {
                    videoId: directSong.id,
                    title: directSong.name || directSong.song || '',
                    duration: Number(directSong.duration) || 0,
                    thumbnail: Array.isArray(directSong.image) ? directSong.image[directSong.image.length - 1]?.url : (directSong.image || '').replace('150x150', '500x500'),
                    streamToken: 'jiosaavn',
                    streamUrl
                };
                saavnSearchCache.set(cacheKey, result);
                return result;
            }
        }

        // 2. Direct Scraped URL Resolution with Duration Matching
        const scraped = await scrapeDirectSaavnSongUrl(cleanTitle || query, cleanArtist || rawArtist, targetDuration);
        if (scraped && scraped.song && scraped.song.id) {
            const song = scraped.song;
            const bestDownload = (song.downloadUrl || []).find((d: any) => d.quality === '320kbps') || song.downloadUrl?.[song.downloadUrl.length - 1];
            const streamUrl = bestDownload?.url || bestDownload?.link;
            const result: AudioSearchResult = {
                videoId: song.id,
                title: song.name || song.song || '',
                duration: Number(song.duration) || 0,
                thumbnail: Array.isArray(song.image) ? song.image[song.image.length - 1]?.url : (song.image || '').replace('150x150', '500x500'),
                streamToken: 'jiosaavn',
                streamUrl
            };
            saavnSearchCache.set(cacheKey, result);
            return result;
        }

        // 3. Try custom JIOSAAVN_API_URL if configured
        if (process.env.JIOSAAVN_API_URL) {
            try {
                const base = process.env.JIOSAAVN_API_URL.replace(/\/$/, '');
                const targetSearchTerm = (cleanTitle && cleanArtist) ? `${cleanTitle} ${cleanArtist}` : (cleanQuery || query.trim());
                const res = await fetch(`${base}/api/search/songs?query=${encodeURIComponent(targetSearchTerm)}`, {
                    signal: AbortSignal.timeout(5000),
                    headers: { 'User-Agent': 'Slothify/1.0' }
                });
                if (res.ok) {
                    const data = (await res.json()) as any;
                    const results = data.data?.results || data.results;
                    if (Array.isArray(results) && results.length > 0) {
                        let matchedList = cleanArtist 
                            ? results.filter(s => isArtistFuzzyMatch(s.primaryArtists || s.singers || '', cleanArtist))
                            : results;
                        if (matchedList.length > 0) {
                            if (targetDuration && targetDuration > 0) {
                                matchedList.sort((a, b) => Math.abs((Number(a.duration) || 0) - targetDuration) - Math.abs((Number(b.duration) || 0) - targetDuration));
                            }
                            const matched = matchedList[0];
                            const dur = Number(matched.duration) || 0;
                            if (!targetDuration || dur === 0 || Math.abs(dur - targetDuration) <= 12) {
                                const result: AudioSearchResult = {
                                    videoId: matched.id,
                                    title: matched.name || matched.title,
                                    duration: dur,
                                    thumbnail: Array.isArray(matched.image) ? matched.image[matched.image.length - 1]?.url : (matched.image || ''),
                                    streamToken: 'jiosaavn'
                                };
                                saavnSearchCache.set(cacheKey, result);
                                return result;
                            }
                        }
                    }
                }
            } catch (err: any) {
                console.warn('[JioSaavnAudioPlugin] Custom API search error, using direct search:', err.message);
            }
        }

        // 4. Direct JioSaavn Search API with strict precision cascading and timestamp matching
        const candidates: string[] = [];

        // Candidate 1: Clean Title + Primary Artist (The absolute most accurate query)
        if (cleanTitle && cleanArtist) {
            candidates.push(`${cleanTitle} ${cleanArtist}`.trim());
        }

        // Candidate 2: Primary Artist + Clean Title (Solr indexes artist-first well)
        if (cleanTitle && cleanArtist) {
            candidates.push(`${cleanArtist} ${cleanTitle}`.trim());
        }

        // Candidate 3: Full clean query
        if (cleanQuery && !candidates.includes(cleanQuery)) {
            candidates.push(cleanQuery);
        }

        // Candidate 4: Raw trimmed query
        if (trimmed && !candidates.includes(trimmed)) {
            candidates.push(trimmed);
        }

        // Candidate 5: Clean title only (ONLY checked if no artist specified or as last candidate with validation)
        if (cleanTitle && !candidates.includes(cleanTitle)) {
            candidates.push(cleanTitle);
        }

        let bestSong: any = null;
        const targetArtist = (cleanArtist || rawArtist || '').toLowerCase().trim();

        for (const candidate of candidates) {
            if (!candidate || candidate.length < 2) continue;
            try {
                const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&p=1&n=15&q=${encodeURIComponent(candidate)}`;
                const response = await fetch(searchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.jiosaavn.com/'
                    },
                    signal: AbortSignal.timeout(6000)
                });

                if (!response.ok) continue;

                const data = (await response.json()) as any;
                const results: any[] = data.results;
                if (!results || results.length === 0) continue;

                const targetHasRemix = /\b(remix|mix)\b/i.test(cleanTitle || query);
                const validResults = results.filter(r => {
                    const titleLow = (r.song || r.title || '').toLowerCase();
                    if (/\b(nightcore|karaoke|instrumental|cover|slowed|reverb|sped\s*up|speed\s*up|hardstyle|techno|tribute)\b/i.test(titleLow)) return false;
                    const candHasRemix = /\b(remix|mix|mashup|edit|rework)\b/i.test(titleLow);
                    if (!targetHasRemix && candHasRemix) return false;
                    return true;
                });

                // When artist is specified, find a match where the artist actually matches!
                if (targetArtist) {
                    let matchedCandidates = validResults.filter(r => {
                        const artistStr = (r.primary_artists || r.singers || '').toLowerCase();
                        return isArtistFuzzyMatch(artistStr, targetArtist);
                    });

                    if (matchedCandidates.length > 0) {
                        const normTarget = normalizeSaavnText(cleanTitle || query);
                        matchedCandidates.sort((a, b) => {
                            const durA = Number(a.duration) || 0;
                            const durB = Number(b.duration) || 0;
                            const deltaA = targetDuration && targetDuration > 0 ? Math.abs(durA - targetDuration) : 0;
                            const deltaB = targetDuration && targetDuration > 0 ? Math.abs(durB - targetDuration) : 0;
                            
                            // Exact title match gets priority
                            const normA = normalizeSaavnText(a.song || a.title || '');
                            const normB = normalizeSaavnText(b.song || b.title || '');
                            const exactA = normA === normTarget ? 1 : 0;
                            const exactB = normB === normTarget ? 1 : 0;
                            if (exactA !== exactB) return exactB - exactA;

                            return deltaA - deltaB;
                        });

                        const closest = matchedCandidates[0];
                        const dur = Number(closest.duration) || 0;
                        if (!targetDuration || dur === 0 || Math.abs(dur - targetDuration) <= 5) {
                            bestSong = closest;
                            break;
                        }
                    }

                    // DO NOT break if artist didn't match! Continue to next candidate!
                    continue;
                } else {
                    // No artist specified: verify title match if title was provided
                    let candidateMatches = validResults;
                    if (cleanTitle) {
                        candidateMatches = validResults.filter(r => isTitleFuzzyMatch(r.song || r.title || '', cleanTitle));
                    }
                    if (candidateMatches.length > 0) {
                        if (targetDuration && targetDuration > 0) {
                            candidateMatches.sort((a, b) => {
                                const durA = Number(a.duration) || 0;
                                const durB = Number(b.duration) || 0;
                                return Math.abs(durA - targetDuration) - Math.abs(durB - targetDuration);
                            });
                        }
                        bestSong = candidateMatches[0];
                        break;
                    }
                }
            } catch (err: any) {
                console.warn(`[JioSaavnAudioPlugin] Candidate "${candidate}" failed:`, err.message);
            }
        }

        if (!bestSong) {
            throw new Error(`No matching JioSaavn track found for query: "${query}" (artist: "${artistHint || 'none'}")`);
        }

        // Cache metadata for fast stream resolution
        songMetaCache.set(bestSong.id, bestSong);

        let streamUrl = saavnStreamCache.get(bestSong.id)?.url;
        if (!streamUrl && bestSong.perma_url) {
            try {
                const s = await fetchWorkerSongByLink(bestSong.perma_url);
                const bestDownload = (s?.downloadUrl || []).find((d: any) => d.quality === '320kbps') || s?.downloadUrl?.[s.downloadUrl.length - 1];
                streamUrl = bestDownload?.url || bestDownload?.link;
            } catch { }
        }
        if (!streamUrl && bestSong.encrypted_media_url) {
            try {
                streamUrl = decryptSaavnMediaUrl(bestSong.encrypted_media_url);
                saavnStreamCache.set(bestSong.id, { url: streamUrl, expiresAt: Date.now() + 6 * 3600 * 1000 });
            } catch { }
        }

        const result: AudioSearchResult = {
            videoId: bestSong.id,
            title: bestSong.song || bestSong.title || '',
            duration: Number(bestSong.duration) || 0,
            thumbnail: (bestSong.image || '').replace('150x150', '500x500'),
            streamToken: 'jiosaavn',
            streamUrl
        };

        if (saavnSearchCache.size > 500) {
            const firstKey = saavnSearchCache.keys().next().value;
            if (firstKey) saavnSearchCache.delete(firstKey);
        }
        saavnSearchCache.set(cacheKey, result);

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
