import express from 'express';
import { pluginRegistry } from '../plugins/registry.js';
import { getStreamUrl } from '../plugins/audio/YouTubeAudioPlugin.js';
import { getJioSaavnStreamUrl } from '../plugins/audio/JioSaavnAudioPlugin.js';

const router = express.Router();

// List available audio providers & current active engine
router.get('/providers', (_req, res) => {
    const active = pluginRegistry.getActiveAudioPluginName();
    res.json({
        active: active === 'JioSaavnAudio' ? 'jiosaavn' : 'youtube',
        activePlugin: active,
        providers: [
            {
                id: 'youtube',
                pluginName: 'YouTubeAudio',
                name: 'YouTube (Cobalt & Piped Engine)',
                description: 'Massive global catalog, music videos, covers & live recordings'
            },
            {
                id: 'jiosaavn',
                pluginName: 'JioSaavnAudio',
                name: 'JioSaavn (320kbps Master Quality)',
                description: 'Ultra-high-fidelity 320kbps AAC, blazing fast CDN delivery'
            }
        ]
    });
});

// Set active global default audio engine
router.post('/provider', (req, res) => {
    const { provider } = req.body;
    try {
        if (provider === 'jiosaavn' || provider === 'JioSaavnAudio') {
            pluginRegistry.setActiveAudioPlugin('JioSaavnAudio');
            return res.json({ success: true, active: 'jiosaavn' });
        } else if (provider === 'youtube' || provider === 'YouTubeAudio') {
            pluginRegistry.setActiveAudioPlugin('YouTubeAudio');
            return res.json({ success: true, active: 'youtube' });
        }
        res.status(400).json({ success: false, error: 'Invalid provider. Must be "youtube" or "jiosaavn"' });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Smart Unified Resolver: resolves track query to direct audio stream with auto-fallback
router.get('/resolve', async (req, res) => {
    const q = req.query.q as string;
    const title = req.query.title as string | undefined;
    const artist = req.query.artist as string | undefined;
    const requestedProvider = (req.query.provider as string) || 'auto';

    if (!q) {
        return res.status(400).json({ success: false, error: 'Missing query parameter q' });
    }

    const tryJioSaavn = async () => {
        const saavn = pluginRegistry.getAudioPluginByName('JioSaavnAudio') as any;
        if (!saavn) throw new Error('JioSaavn plugin not loaded');
        const searchRes = await saavn.search(q, title, artist);
        const url = await getJioSaavnStreamUrl(searchRes.videoId);
        return {
            success: true,
            provider: 'jiosaavn',
            title: searchRes.title,
            thumbnail: searchRes.thumbnail,
            duration: searchRes.duration,
            url
        };
    };

    const tryYouTube = async () => {
        const yt = pluginRegistry.getAudioPluginByName('YouTubeAudio');
        if (!yt) throw new Error('YouTube plugin not loaded');
        const searchRes = await yt.search(q);
        const url = await getStreamUrl(searchRes.videoId);
        return {
            success: true,
            provider: 'youtube',
            title: searchRes.title,
            thumbnail: searchRes.thumbnail,
            duration: searchRes.duration,
            url
        };
    };

    try {
        if (requestedProvider === 'jiosaavn') {
            try {
                return res.json(await tryJioSaavn());
            } catch (err: any) {
                console.warn('[/api/audio/resolve] JioSaavn failed, falling back to YouTube:', err.message);
                return res.json(await tryYouTube());
            }
        } else if (requestedProvider === 'youtube') {
            try {
                return res.json(await tryYouTube());
            } catch (err: any) {
                console.warn('[/api/audio/resolve] YouTube failed, falling back to JioSaavn:', err.message);
                return res.json(await tryJioSaavn());
            }
        } else {
            // Auto mode: check active plugin preference
            const active = pluginRegistry.getActiveAudioPluginName();
            if (active === 'JioSaavnAudio') {
                try {
                    return res.json(await tryJioSaavn());
                } catch {
                    return res.json(await tryYouTube());
                }
            } else {
                try {
                    return res.json(await tryYouTube());
                } catch {
                    return res.json(await tryJioSaavn());
                }
            }
        }
    } catch (finalErr: any) {
        console.error('[/api/audio/resolve] All audio sources failed:', finalErr.message);
        res.status(500).json({ success: false, error: 'Playback resolution failed across all providers' });
    }
});

export default router;
