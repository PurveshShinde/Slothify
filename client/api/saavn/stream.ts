import type { IncomingMessage, ServerResponse } from 'http';
import { getJioSaavnStream } from './_saavn.js';

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    try {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        // Support query param ?id=... or path segment /api/saavn/stream/:id
        let songId = (req.query?.id as string) || url.searchParams.get('id');

        if (!songId) {
            // Check path segments if invoked as /api/saavn/stream/:id
            const parts = url.pathname.split('/').filter(Boolean);
            const lastPart = parts[parts.length - 1];
            if (lastPart && lastPart !== 'stream') {
                songId = lastPart;
            }
        }

        if (!songId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Song ID is required' }));
            return;
        }

        const streamUrl = await getJioSaavnStream(songId);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
        res.end(JSON.stringify({ success: true, url: streamUrl }));
    } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err.message || 'Failed to extract JioSaavn audio stream' }));
    }
}
