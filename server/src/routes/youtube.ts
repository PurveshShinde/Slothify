import express from 'express';
import { pluginRegistry } from '../plugins/registry.js';

const router = express.Router();

// Search YouTube/Audio for track
router.get('/search', async (req, res) => {
    const q = req.query.q;
    if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Missing query' });
    }

    try {
        const ytPlugin = pluginRegistry.getAudioPluginByName('YouTubeAudio') || pluginRegistry.getAudioPlugin();
        const result = await ytPlugin.search(q);
        res.json(result);
    } catch (err: any) {
        console.error('[/api/youtube/search] Error:', err.message);
        res.status(500).json({ error: 'Audio search failed', details: err.message });
    }
});

// Stream audio directly (NO DISK STORAGE / SERVER CACHE)
// Direct stdout piped streaming compatible with Render hosting
router.get('/stream/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        return res.status(400).json({ success: false, error: 'Missing videoId' });
    }

    try {
        const ytPlugin = pluginRegistry.getAudioPluginByName('YouTubeAudio') || pluginRegistry.getAudioPlugin();
        await ytPlugin.stream(videoId, req, res);
    } catch (err: any) {
        console.error('[/api/youtube/stream] Error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Audio stream failed', details: err.message });
        }
    }
});

// Preload audio URL in memory before playback begins
router.get('/preload/:videoId', async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

    try {
        const ytPlugin = pluginRegistry.getAudioPluginByName('YouTubeAudio') || pluginRegistry.getAudioPlugin();
        if (ytPlugin.preload) {
            ytPlugin.preload(videoId).catch(() => {});
        }
        res.json({ status: 'preloading', videoId });
    } catch (err: any) {
        res.status(500).json({ error: 'Preload failed', details: err.message });
    }
});

export default router;