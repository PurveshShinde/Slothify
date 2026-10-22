import type { Request, Response } from 'express';
import yts from 'yt-search';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import type { AudioPlugin, AudioSearchResult } from '../interfaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Caches (RAM only - 0 disk storage used)
const searchCache = new Map<string, AudioSearchResult>();
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();
const pendingExtractions = new Map<string, Promise<string>>();

/**
 * Extract audio stream URL using Cobalt API with Piped & binary fallbacks
 */
export async function getStreamUrl(videoId: string): Promise<string> {
    const now = Date.now();
    const cached = streamUrlCache.get(videoId);
    if (cached && cached.expiresAt > now) {
        return cached.url;
    }

    if (pendingExtractions.has(videoId)) {
        return pendingExtractions.get(videoId)!;
    }

    const extractionPromise = (async () => {
        const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // 1. Cobalt API Extraction
        try {
            console.log(`[YouTubeAudioPlugin] Attempting Cobalt extraction for: ${videoId}`);
            const cobaltBase = process.env.COBALT_API_URL || 'https://api.cobalt.tools';
            const headers: Record<string, string> = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            };
            if (process.env.COBALT_API_KEY) {
                headers['Authorization'] = `Bearer ${process.env.COBALT_API_KEY}`;
            }

            const response = await fetch(cobaltBase, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    url: targetUrl,
                    downloadMode: 'audio',
                    audioFormat: 'mp3',
                    audioBitrate: '320'
                })
            });

            if (response.ok) {
                const data = (await response.json()) as any;
                if (data.url) {
                    console.log(`[YouTubeAudioPlugin] ✅ Cobalt extraction succeeded for ${videoId}`);
                    streamUrlCache.set(videoId, {
                        url: data.url,
                        expiresAt: Date.now() + 3.5 * 60 * 60 * 1000
                    });
                    return data.url;
                }
            } else {
                const errText = await response.text();
                console.warn(`[YouTubeAudioPlugin] Cobalt API returned status ${response.status}:`, errText.substring(0, 150));
            }
        } catch (cobaltErr: any) {
            console.warn('[YouTubeAudioPlugin] Cobalt error:', cobaltErr.message);
        }

        // 2. Piped API Fallback (Multiple redundant instances)
        const pipedInstances = [
            'https://pipedapi.leptons.xyz',
            'https://pipedapi.drgns.space',
            'https://api.piped.privacydev.net',
            'https://piped-api.lunar.icu',
            'https://pipedapi.kavin.rocks',
            'https://pipedapi.adminforge.de'
        ];

        for (const instance of pipedInstances) {
            try {
                const response = await fetch(`${instance}/streams/${videoId}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(3500)
                });

                if (response.ok) {
                    const data = (await response.json()) as any;
                    const audioStreams = data.audioStreams;
                    if (audioStreams && audioStreams.length > 0) {
                        audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
                        const directUrl = audioStreams[0].url;
                        if (directUrl && directUrl.startsWith('http')) {
                            console.log(`[YouTubeAudioPlugin] ✅ Piped extraction succeeded via ${instance}`);
                            streamUrlCache.set(videoId, {
                                url: directUrl,
                                expiresAt: Date.now() + 3.5 * 60 * 60 * 1000
                            });
                            return directUrl;
                        }
                    }
                }
            } catch {
                // Continue to next instance
            }
        }

        // 3. Invidious API Fallback (Proxied audio via local=true)
        const invidiousInstances = [
            'https://inv.nadeko.net',
            'https://invidious.nerdvpn.de',
            'https://invidious.private.coffee',
            'https://yt.artemislena.eu',
            'https://invidious.protokolla.fi'
        ];

        for (const instance of invidiousInstances) {
            try {
                const response = await fetch(`${instance}/api/v1/videos/${videoId}?local=true`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(3500)
                });

                if (response.ok) {
                    const data = (await response.json()) as any;
                    const formats = [...(data.adaptiveFormats || []), ...(data.formatStreams || [])];
                    const audioStreams = formats.filter((f: any) =>
                        (f.type && f.type.startsWith('audio')) ||
                        (f.mimeType && f.mimeType.startsWith('audio')) ||
                        f.itag === '140' || f.itag === 140
                    );

                    if (audioStreams.length > 0) {
                        audioStreams.sort((a: any, b: any) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));
                        let directUrl = audioStreams[0].url;
                        if (directUrl && directUrl.startsWith('/')) {
                            directUrl = `${instance}${directUrl}`;
                        }
                        if (directUrl && directUrl.startsWith('http')) {
                            console.log(`[YouTubeAudioPlugin] ✅ Invidious extraction succeeded via ${instance}`);
                            streamUrlCache.set(videoId, {
                                url: directUrl,
                                expiresAt: Date.now() + 3.5 * 60 * 60 * 1000
                            });
                            return directUrl;
                        }
                    }
                }
            } catch {
                // Continue to next instance
            }
        }

        // 3. Local yt-dlp binary fallback if available on host
        try {
            const isWindows = process.platform === 'win32';
            const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp_linux';
            const possiblePaths = [
                path.resolve(__dirname, '../../../', binaryName),
                path.resolve(process.cwd(), binaryName),
                path.join('/tmp', binaryName)
            ];
            const binPath = possiblePaths.find(p => fs.existsSync(p));

            if (binPath) {
                console.log(`[YouTubeAudioPlugin] Using local yt-dlp binary at: ${binPath}`);
                const url = await new Promise<string>((resolve, reject) => {
                    const child = spawn(binPath, [
                        targetUrl,
                        '-f', '140/251/bestaudio/ba/b',
                        '-g',
                        '--no-playlist',
                        '--quiet',
                        '--no-warnings'
                    ]);

                    let stdout = '';
                    let stderr = '';
                    child.stdout?.on('data', d => { stdout += d.toString(); });
                    child.stderr?.on('data', d => { stderr += d.toString(); });

                    child.on('close', code => {
                        const direct = stdout.trim();
                        if (code === 0 && direct && direct.startsWith('http')) {
                            resolve(direct);
                        } else {
                            reject(new Error(`yt-dlp failed: ${stderr || 'code ' + code}`));
                        }
                    });

                    child.on('error', reject);
                });

                console.log(`[YouTubeAudioPlugin] ✅ Local yt-dlp succeeded for ${videoId}`);
                streamUrlCache.set(videoId, {
                    url,
                    expiresAt: Date.now() + 3.5 * 60 * 60 * 1000
                });
                return url;
            }
        } catch (ytErr: any) {
            console.warn('[YouTubeAudioPlugin] yt-dlp fallback error:', ytErr.message);
        }

        throw new Error('All audio stream extraction methods failed');
    })();

    pendingExtractions.set(videoId, extractionPromise);

    try {
        return await extractionPromise;
    } finally {
        pendingExtractions.delete(videoId);
    }
}

export class YouTubeAudioPlugin implements AudioPlugin {
    readonly name = 'YouTubeAudio';

    /**
     * Search YouTube with in-memory caching for instant repeated queries
     */
    async search(query: string): Promise<AudioSearchResult> {
        const cleanQuery = query.trim().toLowerCase();

        const cached = searchCache.get(cleanQuery);
        if (cached) {
            return cached;
        }

        const r = await yts(query.trim());
        const videos = r.videos;

        if (!videos || videos.length === 0) {
            throw new Error(`No YouTube video found for query: ${query}`);
        }

        const video = videos[0];
        const result: AudioSearchResult = {
            videoId: video.videoId,
            title: video.title,
            duration: video.seconds,
            thumbnail: video.thumbnail || '',
            streamToken: 'direct-stream'
        };

        if (searchCache.size > 500) {
            const firstKey = searchCache.keys().next().value;
            if (firstKey) searchCache.delete(firstKey);
        }
        searchCache.set(cleanQuery, result);

        return result;
    }

    /**
     * Extract stream URL via Cobalt / Piped / yt-dlp
     */
    async extractStreamUrl(videoId: string): Promise<string> {
        return getStreamUrl(videoId);
    }

    /**
     * Preload / warm up the stream URL in memory before track finishes
     */
    async preload(videoId: string): Promise<void> {
        try {
            await getStreamUrl(videoId);
        } catch (err: any) {
            console.warn(`[YouTubeAudioPlugin] Preload failed for ${videoId}:`, err.message);
        }
    }

    /**
     * Stream audio directly / return direct stream URL
     */
    async stream(videoId: string, req: Request, res: Response): Promise<void> {
        try {
            const audioUrl = await getStreamUrl(videoId);
            if (!res.headersSent) {
                res.json({
                    success: true,
                    url: audioUrl
                });
            }
        } catch (err: any) {
            console.error('[YouTubeAudioPlugin] Stream failed:', err.message);
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
