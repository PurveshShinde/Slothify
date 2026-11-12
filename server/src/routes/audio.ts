import express from 'express';
import { pluginRegistry } from '../plugins/registry.js';
import { getStreamUrl } from '../plugins/audio/YouTubeAudioPlugin.js';
import { getJioSaavnStreamUrl } from '../plugins/audio/JioSaavnAudioPlugin.js';

const router = express.Router();

export interface AudioResolveResult {
    success: boolean;
    provider: 'jiosaavn' | 'youtube';
    title: string;
    thumbnail?: string;
    duration?: number;
    url: string;
}

export interface AudioResolveOptions {
    q: string;
    title?: string;
    artist?: string;
    provider?: string;
}

export interface AudioResolvers {
    resolveJioSaavn: (q: string, title?: string, artist?: string) => Promise<AudioResolveResult>;
    resolveYouTube: (q: string, title?: string, artist?: string) => Promise<AudioResolveResult>;
}

export const defaultResolvers: AudioResolvers = {
    resolveJioSaavn: async (q: string, title?: string, artist?: string) => {
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
    },
    resolveYouTube: async (q: string, title?: string, artist?: string) => {
        const yt = pluginRegistry.getAudioPluginByName('YouTubeAudio');
        if (!yt) throw new Error('YouTube plugin not loaded');
        const ytQuery = (title && artist) ? `${title} ${artist} audio`.trim() : q;
        const searchRes = await yt.search(ytQuery);
        const url = await getStreamUrl(searchRes.videoId);
        return {
            success: true,
            provider: 'youtube',
            title: searchRes.title,
            thumbnail: searchRes.thumbnail,
            duration: searchRes.duration,
            url
        };
    }
};

/**
 * Resolves a track query to an audio stream URL.
 * Strictly stateless and deterministic:
 * - If provider is explicitly 'jiosaavn', attempts JioSaavn with YouTube fallback.
 * - If provider is explicitly 'youtube', attempts YouTube with JioSaavn fallback.
 * - If provider is 'auto' (or omitted), deterministically attempts high-bitrate JioSaavn (320kbps master)
 *   first with YouTube fallback.
 * - Purely stateless: does NOT read, depend on, or mutate any shared process-wide state.
 */
export async function resolveAudioStream(
    options: AudioResolveOptions,
    resolvers: AudioResolvers = defaultResolvers
): Promise<AudioResolveResult> {
    const { q, title, artist } = options;
    if (!q) {
        throw new Error('Missing query parameter q');
    }

    const requested = (options.provider || 'auto').toLowerCase();

    if (requested === 'jiosaavn') {
        try {
            return await resolvers.resolveJioSaavn(q, title, artist);
        } catch (err: any) {
            console.warn('[/api/audio/resolve] JioSaavn failed, falling back to YouTube:', err?.message || err);
            return await resolvers.resolveYouTube(q, title, artist);
        }
    } else if (requested === 'youtube') {
        try {
            return await resolvers.resolveYouTube(q, title, artist);
        } catch (err: any) {
            console.warn('[/api/audio/resolve] YouTube failed, falling back to JioSaavn:', err?.message || err);
            return await resolvers.resolveJioSaavn(q, title, artist);
        }
    } else {
        // Auto mode: strictly deterministic 320kbps CD-quality (JioSaavn) first, falling back to YouTube.
        // Purely stateless: zero dependency on shared mutable state.
        try {
            return await resolvers.resolveJioSaavn(q, title, artist);
        } catch {
            return await resolvers.resolveYouTube(q, title, artist);
        }
    }
}

// List available audio providers & deterministic auto resolution strategy
router.get('/providers', (_req, res) => {
    res.json({
        active: 'jiosaavn',
        activePlugin: 'JioSaavnAudio', // Retained as deprecated compatibility field representing primary auto-fallback engine
        defaultEngine: 'jiosaavn',
        strategy: 'deterministic-fallback',
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

// Acknowledge client provider preference for backward compatibility without mutating process-wide state
router.post('/provider', (req, res) => {
    const { provider } = req.body;
    try {
        if (provider === 'jiosaavn' || provider === 'JioSaavnAudio') {
            return res.json({ success: true, active: 'jiosaavn', scope: 'client-managed' });
        } else if (provider === 'youtube' || provider === 'YouTubeAudio') {
            return res.json({ success: true, active: 'youtube', scope: 'client-managed' });
        } else if (provider === 'auto') {
            return res.json({ success: true, active: 'auto', scope: 'client-managed' });
        }
        res.status(400).json({ success: false, error: 'Invalid provider. Must be "youtube" or "jiosaavn"' });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Smart Unified Resolver: resolves track query to direct audio stream with auto-fallback per request
router.get('/resolve', async (req, res) => {
    const q = req.query.q as string;
    const title = req.query.title as string | undefined;
    const artist = req.query.artist as string | undefined;
    const requestedProvider = (req.query.provider as string) || (req.headers['x-audio-provider'] as string) || 'auto';

    if (!q) {
        return res.status(400).json({ success: false, error: 'Missing query parameter q' });
    }

    try {
        const result = await resolveAudioStream({
            q,
            title,
            artist,
            provider: requestedProvider
        });
        return res.json(result);
    } catch (finalErr: any) {
        console.error('[/api/audio/resolve] All audio sources failed:', finalErr?.message || finalErr);
        return res.status(500).json({ success: false, error: 'Playback resolution failed across all providers' });
    }
});

export default router;
