import express from 'express';
import yts from 'yt-search';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import https from 'https';
import { fileURLToPath } from 'url';

// -------------------------------------------------------------------------
// 🔧 CONFIG & SETUP
// -------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a 'cache' folder two levels up (in project root)
const CACHE_DIR = path.resolve(__dirname, '../../cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const router = express.Router();

// Track active downloads to prevent duplicate processes
const pendingDownloads = new Map<string, Promise<void>>();

// -------------------------------------------------------------------------
// 🔧 YT-DLP SETUP
// -------------------------------------------------------------------------
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
const YTDLP_PATH = path.resolve(__dirname, '../../yt-dlp.exe');

const ensureEngine = async () => {
    if (fs.existsSync(YTDLP_PATH)) return;
    console.log('[System] Downloading yt-dlp.exe...');

    return new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(YTDLP_PATH);
        https.get(YTDLP_URL, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                https.get(res.headers.location!, (r) => r.pipe(file).on('finish', () => {
                    file.close(); resolve();
                }));
            } else {
                res.pipe(file).on('finish', () => {
                    file.close(); resolve();
                });
            }
        }).on('error', reject);
    });
};

// -------------------------------------------------------------------------
// 🧹 CACHE CLEANUP (Simple LRU)
// -------------------------------------------------------------------------
const cleanOldCache = () => {
    fs.readdir(CACHE_DIR, (err, files) => {
        if (err || files.length < 20) return; // Keep last 20 songs

        // Sort by time modified (oldest first)
        const sorted = files.map(f => ({
            name: f,
            time: fs.statSync(path.join(CACHE_DIR, f)).mtime.getTime()
        })).sort((a, b) => a.time - b.time);

        // Delete the oldest 5
        const toDelete = sorted.slice(0, 5);
        toDelete.forEach(f => {
            fs.unlink(path.join(CACHE_DIR, f.name), () => { });
            console.log(`[Cache] Cleaned up: ${f.name}`);
        });
    });
};

/* -------------------------------------------------------------------------- */
/* 1. SEARCH ROUTE (Unchanged)                                                */
/* -------------------------------------------------------------------------- */
router.get('/search', async (req, res) => {
    const q = req.query.q;
    if (!q || typeof q !== 'string') return res.status(400).json({ error: 'Missing query' });

    try {
        const r = await yts(q);
        const videos = r.videos;
        if (!videos || videos.length === 0) return res.status(404).json({ error: 'No video found' });

        const video = videos[0];
        // We don't need stream tokens anymore because we serve static files!
        // But keeping it for compatibility if you want.

        res.json({
            videoId: video.videoId,
            title: video.title,
            duration: video.seconds,
            thumbnail: video.thumbnail,
            streamToken: "cached-mode"
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Search failed' });
    }
});

/* -------------------------------------------------------------------------- */
/* 2. SMART STREAM ROUTE (Download -> Cache -> Serve)                         */
/* -------------------------------------------------------------------------- */
router.get('/stream/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

    const filePath = path.join(CACHE_DIR, `${videoId}.webm`);

    try {
        // A. IF FILE EXISTS: Serve it immediately (Instant Seek Support!)
        if (fs.existsSync(filePath)) {
            // console.log(`[Cache] Hit: ${videoId}`);
            return res.sendFile(filePath);
        }

        // B. IF DOWNLOADING: Wait for it to finish, then serve
        if (pendingDownloads.has(videoId)) {
            console.log(`[Cache] Waiting for pending download: ${videoId}`);
            await pendingDownloads.get(videoId);
            return res.sendFile(filePath);
        }

        // C. IF MISSING: Download it
        await ensureEngine();

        const downloadPromise = new Promise<void>((resolve, reject) => {
            console.log(`[Cache] Downloading: ${videoId}`);
            const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

            const process = spawn(YTDLP_PATH, [
                ytUrl,
                '-f', 'bestaudio',     // Best audio quality
                '-o', filePath,        // Save to cache folder
                '--no-playlist'
            ]);

            process.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`yt-dlp exited with code ${code}`));
            });
        });

        // Store promise so other requests wait for this one
        pendingDownloads.set(videoId, downloadPromise);

        await downloadPromise;
        pendingDownloads.delete(videoId); // Remove lock

        // Cleanup old files asynchronously
        cleanOldCache();

        console.log(`[Cache] Ready to serve: ${videoId}`);
        res.sendFile(filePath);

    } catch (err: any) {
        pendingDownloads.delete(videoId);
        console.error('[Stream Error]', err);
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    }
});

export default router;