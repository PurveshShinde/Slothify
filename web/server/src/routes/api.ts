import express from 'express';
import { spotifyService } from '../services/spotifyService.js';


const router = express.Router();

const checkAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req.session as any).access_token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

router.use(checkAuth);

router.get('/me/playlists', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.getMyPlaylists(token);
        res.json(items);
    } catch (err: any) {
        console.error('[/api/me/playlists] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/featured-playlists', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        // console.log('[/api/featured-playlists] Token present:', !!token);
        const items = await spotifyService.getFeaturedPlaylists(token);
        res.json(items);
    } catch (err: any) {
        // console.error('[/api/featured-playlists] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/search', async (req, res) => {
    const { q } = req.query;
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.searchTracks(token, String(q));
        res.json(items);
    } catch (err: any) {
        console.error('[/api/search] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/playlists/:id/tracks', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const tracks = await spotifyService.getPlaylistTracks(token, req.params.id);
        res.json(tracks);
    } catch (err: any) {
        console.error('[/api/playlists/:id/tracks] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/playlists/:id', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const playlist = await spotifyService.getPlaylist(token, req.params.id);
        res.json(playlist);
    } catch (err: any) {
        console.error('[/api/playlists/:id] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/me/recent', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.getMyRecentlyPlayedTracks(token);
        res.json(items);
    } catch (err: any) {
        // console.error('[/api/me/recent] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/browse/new-releases', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.getNewReleases(token);
        res.json(items);
    } catch (err: any) {
        console.error('[/api/browse/new-releases] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/me/top/artists', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.getMyTopArtists(token);
        res.json(items);
    } catch (err: any) {
        console.error('[/api/me/top/artists] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/me/top/tracks', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.getMyTopTracks(token);
        res.json(items);
    } catch (err: any) {
        console.error('[/api/me/top/tracks] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/browse/categories', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.getCategories(token);
        res.json(items);
    } catch (err: any) {
        console.error('[/api/browse/categories] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/browse/categories/:id/playlists', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.getCategoryPlaylists(token, req.params.id);
        res.json(items);
    } catch (err: any) {
        // console.error('[/api/browse/categories/:id/playlists] Error:', err.response?.data || err.message);
        // Note: some categories might not have playlists directly or might error 404, we handle gracefully.
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/me/tracks', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const items = await spotifyService.getMySavedTracks(token);
        res.json(items);
    } catch (err: any) {
        console.error('[/api/me/tracks] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.post('/playlists/:id/tracks', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const { uris } = req.body;
        const result = await spotifyService.addTracksToPlaylist(token, req.params.id, uris);
        res.json(result);
    } catch (err: any) {
        console.error('[/api/playlists/:id/tracks POST] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.delete('/playlists/:id/tracks', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const { uris } = req.body;
        const result = await spotifyService.removeTracksFromPlaylist(token, req.params.id, uris);
        res.json(result);
    } catch (err: any) {
        console.error('[/api/playlists/:id/tracks DELETE] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

router.get('/recommendations', async (req, res) => {
    try {
        const token = (req.session as any).access_token;
        const { seed_tracks, limit } = req.query;
        const tracks = await spotifyService.getRecommendations(
            token,
            String(seed_tracks).split(','),
        );
        res.json(tracks);
    } catch (err: any) {
        console.error('[/api/recommendations] Error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Spotify API Error', details: err.message });
    }
});

export default router;