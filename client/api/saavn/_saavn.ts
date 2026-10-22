import forge from 'node-forge';

// In-Memory cache for warm Vercel serverless function instances
const searchCache = new Map<string, any>();
const streamCache = new Map<string, { url: string; expiresAt: number }>();
const songMetaCache = new Map<string, any>();

/**
 * Decrypts JioSaavn encrypted_media_url using DES-ECB algorithm
 * Upgrades bitrate from 96kbps to 320kbps for pristine audio quality
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
    return decrypted
        .replace('_96.mp4', '_320.mp4')
        .replace('_96.m4a', '_320.mp4');
}

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

    if (normResult.includes(normTarget) || normTarget.includes(normResult)) return true;

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

/**
 * Searches JioSaavn for tracks using precision cascading and ranking
 */
export async function searchJioSaavn(query: string, titleHint?: string, artistHint?: string) {
    const trimmed = query.trim();
    const cleanQuery = cleanSaavnQuery(trimmed).toLowerCase();
    const cleanTitle = titleHint ? cleanSaavnQuery(titleHint).toLowerCase() : '';
    const rawArtist = artistHint ? artistHint.split(/[,/&]| feat\.? | ft\.? /i)[0].trim() : '';
    const cleanArtist = rawArtist ? cleanSaavnQuery(rawArtist).toLowerCase() : '';

    const cacheKey = `${cleanQuery}___${cleanTitle}___${cleanArtist}`;
    const cached = searchCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const candidates: string[] = [];
    if (cleanTitle && cleanArtist) {
        candidates.push(`${cleanTitle} ${cleanArtist}`.trim());
        candidates.push(`${cleanArtist} ${cleanTitle}`.trim());
    }
    if (cleanQuery && !candidates.includes(cleanQuery)) {
        candidates.push(cleanQuery);
    }
    if (trimmed && !candidates.includes(trimmed)) {
        candidates.push(trimmed);
    }
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

            if (targetArtist) {
                const matched = results.find(r => {
                    const artistStr = (r.primary_artists || r.singers || '').toLowerCase();
                    const titleStr = (r.song || r.title || '').toLowerCase();
                    return isArtistFuzzyMatch(artistStr, targetArtist) && (cleanTitle ? isTitleFuzzyMatch(titleStr, cleanTitle) : true);
                }) || results.find(r => {
                    const artistStr = (r.primary_artists || r.singers || '').toLowerCase();
                    return isArtistFuzzyMatch(artistStr, targetArtist);
                });

                if (matched) {
                    bestSong = matched;
                    break;
                }
                continue;
            } else {
                if (cleanTitle) {
                    const matched = results.find(r => isTitleFuzzyMatch(r.song || r.title || '', cleanTitle));
                    if (matched) {
                        bestSong = matched;
                        break;
                    }
                }
                bestSong = results[0];
                break;
            }
        } catch {
            // Try next candidate
        }
    }

    if (!bestSong) {
        throw new Error(`No matching JioSaavn track found for query: "${query}"`);
    }

    // Cache metadata
    songMetaCache.set(bestSong.id, bestSong);

    let streamUrl = '';
    if (bestSong.encrypted_media_url) {
        try {
            streamUrl = decryptSaavnMediaUrl(bestSong.encrypted_media_url);
            streamCache.set(bestSong.id, {
                url: streamUrl,
                expiresAt: Date.now() + 6 * 3600 * 1000
            });
        } catch {
            // Will decrypt on stream endpoint if needed
        }
    }

    const result = {
        videoId: bestSong.id,
        title: bestSong.song || bestSong.title || '',
        artist: bestSong.primary_artists || bestSong.singers || '',
        duration: Number(bestSong.duration) || 0,
        thumbnail: (bestSong.image || '').replace('150x150', '500x500'),
        streamToken: 'jiosaavn',
        streamUrl: streamUrl || undefined
    };

    if (searchCache.size > 500) {
        const first = searchCache.keys().next().value;
        if (first) searchCache.delete(first);
    }
    searchCache.set(cacheKey, result);

    return result;
}

/**
 * Resolves direct 320kbps stream URL for a JioSaavn song ID
 */
export async function getJioSaavnStream(songId: string): Promise<string> {
    const now = Date.now();
    const cached = streamCache.get(songId);
    if (cached && cached.expiresAt > now) {
        return cached.url;
    }

    let encryptedMediaUrl = songMetaCache.get(songId)?.encrypted_media_url;

    if (!encryptedMediaUrl) {
        const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0%3F_marker%3D0&_format=json&pids=${encodeURIComponent(songId)}`;
        const res = await fetch(detailsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://www.jiosaavn.com/'
            },
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
    streamCache.set(songId, {
        url: decryptedUrl,
        expiresAt: now + 6 * 3600 * 1000
    });

    return decryptedUrl;
}
