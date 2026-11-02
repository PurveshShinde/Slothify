import type { IncomingMessage, ServerResponse } from 'http';
import { searchJioSaavn } from './_saavn.js';

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
        const link = (req.query?.link as string) || (req.query?.url as string) || url.searchParams.get('link') || url.searchParams.get('url') || '';
        const q = (req.query?.q as string) || url.searchParams.get('q') || '';
        const title = (req.query?.title as string) || url.searchParams.get('title') || '';
        const artist = (req.query?.artist as string) || url.searchParams.get('artist') || '';

        const target = link || q || title;
        if (!target) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Search query parameter (link, q, or title) is required' }));
            return;
        }

        const result = await searchJioSaavn(target, title, artist);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        res.end(JSON.stringify(result));
    } catch (err: any) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Track not found on JioSaavn' }));
    }
}
