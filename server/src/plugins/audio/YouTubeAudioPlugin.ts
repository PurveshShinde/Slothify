import type { Request, Response } from 'express';
import yts from 'yt-search';
import path from 'path';
import fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import type { AudioPlugin, AudioSearchResult } from '../interfaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Caches (RAM only - 0 disk storage used)
const searchCache = new Map<string, AudioSearchResult>();
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();
const pendingExtractions = new Map<string, Promise<string>>();

export class YouTubeAudioPlugin implements AudioPlugin {
    readonly name = 'YouTubeAudio';

    private ytdlpPath: string;

    constructor() {
        const isWindows = process.platform === 'win32';
        const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
        const localPath = path.resolve(__dirname, '../../../', binaryName);

        if (fs.existsSync(localPath)) {
            this.ytdlpPath = localPath;
        } else {
            this.ytdlpPath = binaryName;
        }
    }

    private async ensureBinary(): Promise<string> {
        if (fs.existsSync(this.ytdlpPath)) {
            return this.ytdlpPath;
        }

        const isWindows = process.platform === 'win32';
        const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
        const targetPath = path.resolve(__dirname, '../../../', binaryName);

        if (fs.existsSync(targetPath)) {
            this.ytdlpPath = targetPath;
            return targetPath;
        }

        const downloadUrl = isWindows
            ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
            : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

        console.log(`[YouTubeAudioPlugin] Downloading ${binaryName} for Render/Linux/Windows...`);

        await new Promise<void>((resolve, reject) => {
            const file = fs.createWriteStream(targetPath);
            const getWithRedirect = (url: string) => {
                https.get(url, (res) => {
                    if (res.statusCode === 301 || res.statusCode === 302) {
                        getWithRedirect(res.headers.location!);
                    } else {
                        res.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            if (!isWindows) {
                                try {
                                    fs.chmodSync(targetPath, '755');
                                } catch (e) { }
                            }
                            resolve();
                        });
                    }
                }).on('error', (err) => {
                    fs.unlink(targetPath, () => { });
                    reject(err);
                });
            };
            getWithRedirect(downloadUrl);
        });

        this.ytdlpPath = targetPath;
        return targetPath;
    }

    /**
     * Search YouTube with in-memory caching for instant repeated queries
     */
    async search(query: string): Promise<AudioSearchResult> {
        const cleanQuery = query.trim().toLowerCase();

        // Check memory cache first (0 ms response)
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

        // Cache result in RAM (cap at 1000 items)
        if (searchCache.size > 1000) {
            const firstKey = searchCache.keys().next().value;
            if (firstKey) searchCache.delete(firstKey);
        }
        searchCache.set(cleanQuery, result);

        return result;
    }

    /**
     * Extract direct audio stream URL with in-memory caching and lock deduplication
     */
    async extractStreamUrl(videoId: string): Promise<string> {
        const now = Date.now();
        const cached = streamUrlCache.get(videoId);
        if (cached && cached.expiresAt > now) {
            return cached.url;
        }

        // Deduplicate simultaneous requests for same videoId
        if (pendingExtractions.has(videoId)) {
            return pendingExtractions.get(videoId)!;
        }

        const extractionPromise = (async () => {
            const binPath = await this.ensureBinary();
            const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

            return new Promise<string>((resolve, reject) => {
                const child = spawn(binPath, [
                    ytUrl,
                    '-f', 'ba/bestaudio',
                    '-g',
                    '--no-playlist',
                    '--quiet',
                    '--no-warnings',
                    '--no-check-certificates'
                ]);

                let stdout = '';
                let stderr = '';

                child.stdout?.on('data', (d) => {
                    stdout += d.toString();
                });

                child.stderr?.on('data', (d) => {
                    stderr += d.toString();
                });

                child.on('close', (code) => {
                    pendingExtractions.delete(videoId);
                    const url = stdout.trim();
                    if (code === 0 && url && url.startsWith('http')) {
                        // Cache for 3.5 hours (Google video URLs typically expire after 6h)
                        streamUrlCache.set(videoId, {
                            url,
                            expiresAt: Date.now() + 3.5 * 60 * 60 * 1000
                        });
                        resolve(url);
                    } else {
                        reject(new Error(`Failed to extract stream URL: ${stderr || 'Unknown error'}`));
                    }
                });

                child.on('error', (err) => {
                    pendingExtractions.delete(videoId);
                    reject(err);
                });
            });
        })();

        pendingExtractions.set(videoId, extractionPromise);
        return extractionPromise;
    }

    /**
     * Preload / warm up the stream URL in memory before track finishes
     */
    async preload(videoId: string): Promise<void> {
        try {
            await this.extractStreamUrl(videoId);
        } catch (err: any) {
            console.warn(`[YouTubeAudioPlugin] Preload failed for ${videoId}:`, err.message);
        }
    }

    /**
     * Stream audio directly to client:
     * - Uses direct URL proxy with Range header forwarding for instant playback and seeking
     * - Falls back to piped stdout if needed
     * - NO DISK STORAGE / ZERO SERVER CACHE
     */
    async stream(videoId: string, req: Request, res: Response): Promise<void> {
        let directUrl: string | null = null;

        try {
            directUrl = await this.extractStreamUrl(videoId);
        } catch (extractErr: any) {
            console.warn(`[YouTubeAudioPlugin] URL extraction failed, falling back to direct pipe:`, extractErr.message);
        }

        // OPTION A: Fast HTTP Range Proxy via direct URL (Instant TTFB ~100ms)
        if (directUrl) {
            const parsedUrl = new URL(directUrl);
            const clientRange = req.headers.range;

            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            if (clientRange) {
                headers['Range'] = clientRange;
            }

            const proxyReq = https.request({
                protocol: parsedUrl.protocol,
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: `${parsedUrl.pathname}${parsedUrl.search}`,
                method: 'GET',
                headers
            }, (proxyRes) => {
                const statusCode = proxyRes.statusCode || 200;

                // Forward crucial headers
                res.status(statusCode);
                res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/webm');
                res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
                res.setHeader('Accept-Ranges', 'bytes');

                if (proxyRes.headers['content-range']) {
                    res.setHeader('Content-Range', proxyRes.headers['content-range']);
                }
                if (proxyRes.headers['content-length']) {
                    res.setHeader('Content-Length', proxyRes.headers['content-length']);
                }

                proxyRes.pipe(res);

                req.on('close', () => {
                    proxyReq.destroy();
                });
            });

            proxyReq.on('error', (err) => {
                console.error('[YouTubeAudioPlugin] Proxy request error:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to stream audio via proxy' });
                }
            });

            proxyReq.end();
            return;
        }

        // OPTION B: Fallback stdout pipe if direct extraction fails
        const binPath = await this.ensureBinary();
        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

        res.setHeader('Content-Type', 'audio/webm');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('Accept-Ranges', 'none');

        const ytdlpArgs = [
            ytUrl,
            '-f', 'ba/bestaudio',
            '-o', '-',
            '--no-playlist',
            '--no-warnings',
            '--quiet'
        ];

        let child: ChildProcess | null = null;
        try {
            child = spawn(binPath, ytdlpArgs);
            child.stdout?.pipe(res);

            req.on('close', () => {
                if (child && !child.killed) {
                    try { child.kill('SIGTERM'); } catch (e) { }
                }
            });

            res.on('close', () => {
                if (child && !child.killed) {
                    try { child.kill('SIGTERM'); } catch (e) { }
                }
            });
        } catch (err: any) {
            console.error('[YouTubeAudioPlugin] Pipe stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to initiate audio stream' });
            }
        }
    }
}
