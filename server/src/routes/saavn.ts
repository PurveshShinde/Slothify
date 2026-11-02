import express from 'express';
import { pluginRegistry } from '../plugins/registry.js';
import { JioSaavnAudioPlugin } from '../plugins/audio/JioSaavnAudioPlugin.js';

const router = express.Router();

function getSaavnPlugin(): JioSaavnAudioPlugin {
    const plugin = pluginRegistry.getAudioPluginByName('JioSaavnAudio');
    if (plugin instanceof JioSaavnAudioPlugin) {
        return plugin;
    }
    return new JioSaavnAudioPlugin();
}

// Search or fetch JioSaavn track by query or direct link
router.get('/search', async (req, res) => {
    const link = (req.query.link || req.query.url) as string | undefined;
    const q = req.query.q as string | undefined;
    const title = req.query.title as string | undefined;
    const artist = req.query.artist as string | undefined;
    const duration = req.query.duration ? Number(req.query.duration) : undefined;

    const queryTerm = link || q || title;
    if (!queryTerm || typeof queryTerm !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing query parameter q, title, or link' });
    }

    try {
        const saavn = getSaavnPlugin();
        const result = await saavn.search(queryTerm, title, artist, duration);
        res.json({ success: true, ...result });
    } catch (err: any) {
        console.warn('[/api/saavn/search] No track found:', err.message);
        res.status(404).json({ success: false, error: 'JioSaavn search failed', details: err.message });
    }
});

// Fetch JioSaavn track directly by URL / link (sumitkolhe/jiosaavn-api direct link endpoint)
router.get('/link', async (req, res) => {
    const link = (req.query.link || req.query.url) as string | undefined;
    if (!link || typeof link !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing link/url parameter' });
    }

    try {
        const saavn = getSaavnPlugin();
        const result = await saavn.search(link);
        res.json({ success: true, ...result });
    } catch (err: any) {
        console.warn('[/api/saavn/link] Link resolution failed:', err.message);
        res.status(404).json({ success: false, error: 'Failed to resolve JioSaavn link', details: err.message });
    }
});

// Stream / get direct audio URL for JioSaavn track
router.get('/stream/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing track id' });
    }

    try {
        const saavn = getSaavnPlugin();
        await saavn.stream(id, req, res);
    } catch (err: any) {
        console.error('[/api/saavn/stream] Error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'JioSaavn stream failed', details: err.message });
        }
    }
});

export default router;
