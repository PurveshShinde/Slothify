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

// Search JioSaavn catalog
router.get('/search', async (req, res) => {
    const q = req.query.q as string;
    const title = req.query.title as string | undefined;
    const artist = req.query.artist as string | undefined;
    if (!q || typeof q !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing query parameter q' });
    }

    try {
        const saavn = getSaavnPlugin();
        const result = await saavn.search(q, title, artist);
        res.json({ success: true, ...result });
    } catch (err: any) {
        console.error('[/api/saavn/search] Error:', err.message);
        res.status(500).json({ success: false, error: 'JioSaavn search failed', details: err.message });
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
