import type { Request, Response } from 'express';
import yts from 'yt-search';
import path from 'path';
import fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import https from 'https';
import axios from 'axios';
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
    private downloadPromise: Promise<string> | null = null;

    constructor() {
        const isWindows = process.platform === 'win32';
        const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp_linux';
        const localPath = path.resolve(__dirname, '../../../', binaryName);

        if (fs.existsSync(localPath)) {
            this.ytdlpPath = localPath;
        } else {
            const cwdPath = path.resolve(process.cwd(), binaryName);
            if (fs.existsSync(cwdPath)) {
                this.ytdlpPath = cwdPath;
            } else {
                this.ytdlpPath = isWindows ? binaryName : path.join('/tmp', binaryName);
            }
        }
    }

    private async ensureBinary(): Promise<string> {
        if (fs.existsSync(this.ytdlpPath)) {
            return this.ytdlpPath;
        }

        const isWindows = process.platform === 'win32';
        const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp_linux';

        const possiblePaths = [
            path.resolve(process.cwd(), binaryName),
            path.resolve(__dirname, '../../../', binaryName),
            isWindows ? '' : path.join('/tmp', binaryName)
        ].filter(Boolean);

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                this.ytdlpPath = p;
                return p;
            }
        }

        if (this.downloadPromise) {
            return this.downloadPromise;
        }

        const targetPath = isWindows
            ? path.resolve(__dirname, '../../../', binaryName)
            : path.join('/tmp', binaryName);

        const downloadUrl = isWindows
            ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
            : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

        this.downloadPromise = (async () => {
            console.log(`[YouTubeAudioPlugin] Downloading standalone ${binaryName} to ${targetPath}...`);

            await new Promise<void>((resolve, reject) => {
                const file = fs.createWriteStream(targetPath);
                const getWithRedirect = (url: string) => {
                    https.get(url, (res) => {
                        if (res.statusCode === 301 || res.statusCode === 302) {
                            getWithRedirect(res.headers.location!);
                        } else if (res.statusCode === 200) {
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
                        } else {
                            reject(new Error(`Download failed with status ${res.statusCode}`));
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
        })();

        try {
            return await this.downloadPromise;
        } finally {
            this.downloadPromise = null;
        }
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

        // Store in cache (capped at 500 items)
        if (searchCache.size > 500) {
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
                    '-f', '140/251/bestaudio/ba/b',
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
            try {
                const clientRange = req.headers.range;
                const response = await axios({
                    method: 'GET',
                    url: directUrl,
                    responseType: 'stream',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        ...(clientRange ? { 'Range': clientRange } : {})
                    },
                    validateStatus: (status) => status < 400
                });

                res.status(response.status);
                res.setHeader('Content-Type', String(response.headers['content-type'] || 'audio/mp4'));
                res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
                res.setHeader('Accept-Ranges', 'bytes');

                if (response.headers['content-range']) {
                    res.setHeader('Content-Range', String(response.headers['content-range']));
                }
                if (response.headers['content-length']) {
                    res.setHeader('Content-Length', String(response.headers['content-length']));
                }

                response.data.pipe(res);

                req.on('close', () => {
                    try { response.data.destroy(); } catch (e) { }
                });

                return;
            } catch (proxyErr: any) {
                console.warn(`[YouTubeAudioPlugin] Proxy stream failed, falling back to pipe:`, proxyErr.message);
            }
        }

        // OPTION B: Fallback stdout pipe if direct extraction fails
        const binPath = await this.ensureBinary();
        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

        res.setHeader('Content-Type', 'audio/mp4');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('Accept-Ranges', 'none');

        const ytdlpArgs = [
            ytUrl,
            '-f', '140/251/bestaudio/ba/b',
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
