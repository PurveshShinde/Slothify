import express from 'express';
import axios from 'axios';
import { pluginRegistry } from '../plugins/registry.js';
import { localLibrary } from '../store/localLibrary.js';
import { optionalAuth } from '../middleware/auth.js';
import { isDbConnected } from '../db/connection.js';
import { EncryptedPlaylist } from '../models/EncryptedPlaylist.js';
import { EncryptedLikedTrack } from '../models/EncryptedLikedTrack.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { FollowedArtist } from '../models/FollowedArtist.js';
import { encryptPayload, decryptPayload } from '../utils/crypto.js';
import type { Playlist, Track } from '../plugins/interfaces.js';
import { isArtistNameMatch, calculateArtistRelevanceScore } from '../plugins/metadata/SpotifyScraperPlugin.js';
import {
    searchCacheMiddleware,
    artistSearchCacheMiddleware,
    albumSearchCacheMiddleware,
    artistProfileCacheMiddleware,
    artistTracksCacheMiddleware,
    albumDetailsCacheMiddleware
} from '../middleware/cache.js';

const router = express.Router();

// Apply optionalAuth so req.user is set whenever a JWT token is passed
router.use(optionalAuth);

// Fallback user profile
const DEFAULT_USER = {
    id: 'guest',
    display_name: 'Slothify Guest',
    email: 'guest@slothify.local',
    images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }]
};

// Auth status endpoint
router.get('/auth/status', (req, res) => {
    if (req.user) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.userId,
                display_name: req.user.username,
                username: req.user.username,
                images: [{ url: `https://api.dicebear.com/7.x/bottts/svg?seed=${req.user.username}` }]
            }
        });
    } else {
        res.json({
            authenticated: false,
            user: DEFAULT_USER
        });
    }
});

router.post('/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Current user profile
router.get('/me', (req, res) => {
    if (req.user) {
        res.json({
            id: req.user.userId,
            display_name: req.user.username,
            username: req.user.username,
            images: [{ url: `https://api.dicebear.com/7.x/bottts/svg?seed=${req.user.username}` }]
        });
    } else {
        res.json(DEFAULT_USER);
    }
});

// User's playlists (Zero-knowledge encrypted if DB connected, local store otherwise)
router.get('/me/playlists', async (req, res) => {
    try {
        if (!req.user) {
            return res.json([]);
        }

        if (isDbConnected()) {
            const records = await EncryptedPlaylist.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
            const playlists: Playlist[] = [];
            for (const rec of records) {
                const decrypted = decryptPayload<Playlist>(rec.ciphertext, rec.iv, rec.tag, req.user.userId);
                if (decrypted) {
                    if (decrypted.tracks?.items) {
                        const albumArtList = decrypted.tracks.items
                            .map(i => i.track?.album?.images?.[0]?.url)
                            .filter(Boolean) as string[];
                        if (albumArtList.length >= 4) {
                            decrypted.images = albumArtList.slice(0, 4).map(url => ({ url }));
                        } else if (albumArtList.length > 0) {
                            decrypted.images = [{ url: albumArtList[0] }];
                        } else {
                            decrypted.images = [];
                        }
                    }
                    playlists.push(decrypted);
                }
            }
            return res.json(playlists);
        }

        // Offline mode: only return playlists created by this specific user
        const userId = req.user?.userId;
        const playlists = localLibrary.getPlaylists().filter(p => p.owner?.id === userId);
        res.json(playlists);
    } catch (err: any) {
        console.error('[/api/me/playlists] Error:', err);
        res.status(500).json({ error: 'Failed to fetch playlists', details: err.message });
    }
});

// Create new playlist (Encrypted with user key)
router.post('/me/playlists', async (req, res) => {
    try {
        const { name, description } = req.body;
        const playlistName = (name || 'New Playlist').trim();
        const playlistDesc = (description || 'Created in Slothify').trim();

        if (req.user && isDbConnected()) {
            const playlistId = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const newPlaylist: Playlist = {
                id: playlistId,
                name: playlistName,
                description: playlistDesc,
                images: [],
                owner: {
                    id: req.user.userId,
                    display_name: req.user.username
                },
                tracks: { total: 0, items: [] }
            };

            const encrypted = encryptPayload(newPlaylist, req.user.userId);
            await EncryptedPlaylist.create({
                userId: req.user.userId,
                playlistId,
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv,
                tag: encrypted.tag,
                updatedAt: new Date()
            });

            return res.json(newPlaylist);
        }

        const newPlaylist = localLibrary.createPlaylist(playlistName, playlistDesc);
        res.json(newPlaylist);
    } catch (err: any) {
        console.error('[/api/me/playlists POST] Error:', err);
        res.status(500).json({ error: 'Failed to create playlist', details: err.message });
    }
});

// Featured Playlists
router.get('/featured-playlists', async (req, res) => {
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const items = await metadataPlugin.getFeaturedPlaylists();
        res.json(items);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get featured playlists', details: err.message });
    }
});

// Search tracks (Cached in Redis for 2 hours)
router.get('/search', searchCacheMiddleware, async (req, res) => {
    const q = req.query.q;
    if (!q || typeof q !== 'string') {
        return res.json([]);
    }
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const items = await metadataPlugin.searchTracks(q);
        res.json(items);
    } catch (err: any) {
        res.status(500).json({ error: 'Search failed', details: err.message });
    }
});

// Playlist details (Checks encrypted DB -> local store -> public Spotify scraper)
router.get('/playlists/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Check encrypted database if logged in
        if (req.user && isDbConnected()) {
            const rec = await EncryptedPlaylist.findOne({ playlistId: id });
            if (rec) {
                const decrypted = decryptPayload<Playlist>(rec.ciphertext, rec.iv, rec.tag, rec.userId);
                if (decrypted) {
                    if (decrypted.tracks?.items) {
                        const albumArtList = decrypted.tracks.items
                            .map(i => i.track?.album?.images?.[0]?.url)
                            .filter(Boolean) as string[];
                        if (albumArtList.length >= 4) {
                            decrypted.images = albumArtList.slice(0, 4).map(url => ({ url }));
                        } else if (albumArtList.length > 0) {
                            decrypted.images = [{ url: albumArtList[0] }];
                        } else {
                            decrypted.images = [];
                        }
                    }
                    return res.json(decrypted);
                }
            }
        }

        // 2. Check local library
        const local = localLibrary.getPlaylist(id);
        if (local) {
            return res.json(local);
        }

        // 3. Fallback to Spotify scraper (public playlists)
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const playlist = await metadataPlugin.getPlaylist(id);
        res.json(playlist);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch playlist', details: err.message });
    }
});

// Playlist tracks
router.get('/playlists/:id/tracks', async (req, res) => {
    const { id } = req.params;
    try {
        if (req.user && isDbConnected()) {
            const rec = await EncryptedPlaylist.findOne({ playlistId: id });
            if (rec) {
                const decrypted = decryptPayload<Playlist>(rec.ciphertext, rec.iv, rec.tag, rec.userId);
                if (decrypted) {
                    return res.json((decrypted.tracks.items || []).map(i => i.track));
                }
            }
        }

        const local = localLibrary.getPlaylist(id);
        if (local) {
            return res.json((local.tracks.items || []).map(i => i.track));
        }

        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const tracks = await metadataPlugin.getPlaylistTracks(id);
        res.json(tracks);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch playlist tracks', details: err.message });
    }
});

// Add tracks to playlist
router.post('/playlists/:id/tracks', async (req, res) => {
    const { id } = req.params;
    const { uris, track } = req.body;
    try {
        if (req.user && isDbConnected()) {
            const rec = await EncryptedPlaylist.findOne({ playlistId: id, userId: req.user.userId });
            if (rec) {
                const decrypted = decryptPayload<Playlist>(rec.ciphertext, rec.iv, rec.tag, req.user.userId);
                if (decrypted) {
                    if (!decrypted.tracks.items) decrypted.tracks.items = [];

                    const tracksToAdd: Track[] = [];
                    if (track && track.id) {
                        tracksToAdd.push(track);
                    }
                    if (uris) {
                        const rawUris = (Array.isArray(uris) ? uris : [uris]).filter(Boolean);
                        for (const uri of rawUris) {
                            if (!uri || typeof uri !== 'string') continue;
                            const trackId = uri.replace('spotify:track:', '');
                            if (!tracksToAdd.some(t => t.id === trackId)) {
                                tracksToAdd.push({
                                    id: trackId,
                                    uri: `spotify:track:${trackId}`,
                                    name: 'Track ' + trackId,
                                    artists: [{ name: 'Artist' }],
                                    album: { name: 'Album', images: [] },
                                    duration_ms: 180000
                                });
                            }
                        }
                    }

                    for (const t of tracksToAdd) {
                        const exists = decrypted.tracks.items.some(i => i.track.id === t.id);
                        if (!exists) {
                            decrypted.tracks.items.push({ track: t, added_at: new Date().toISOString() });
                        }
                    }

                    decrypted.tracks.total = decrypted.tracks.items.length;

                    // Spotify style poster: only add when 4 or more tracks, showing the 4 album arts!
                    const albumArtList = decrypted.tracks.items
                        .map(i => i.track?.album?.images?.[0]?.url)
                        .filter(Boolean) as string[];

                    if (albumArtList.length >= 4) {
                        decrypted.images = albumArtList.slice(0, 4).map(url => ({ url }));
                    } else if (albumArtList.length > 0) {
                        decrypted.images = [{ url: albumArtList[0] }];
                    } else {
                        decrypted.images = [];
                    }

                    const reencrypted = encryptPayload(decrypted, req.user.userId);
                    rec.ciphertext = reencrypted.ciphertext;
                    rec.iv = reencrypted.iv;
                    rec.tag = reencrypted.tag;
                    rec.updatedAt = new Date();
                    await rec.save();

                    return res.json(decrypted);
                }
            }
        }

        const fallbackUris = track ? [track.uri || `spotify:track:${track.id}`] : (Array.isArray(uris) ? uris : [uris]).filter(Boolean);
        const updated = localLibrary.addTracksToPlaylist(id, fallbackUris, track);
        if (!updated) {
            return res.status(404).json({ error: 'Playlist not found in library' });
        }
        res.json(updated);
    } catch (err: any) {
        console.error('[/playlists/:id/tracks POST] Error:', err);
        res.status(500).json({ error: 'Failed to add tracks', details: err.message });
    }
});

// Remove tracks from playlist
router.delete('/playlists/:id/tracks', async (req, res) => {
    const { id } = req.params;
    const { uris } = req.body;
    try {
        if (req.user && isDbConnected()) {
            const rec = await EncryptedPlaylist.findOne({ playlistId: id, userId: req.user.userId });
            if (rec) {
                const decrypted = decryptPayload<Playlist>(rec.ciphertext, rec.iv, rec.tag, req.user.userId);
                if (decrypted && decrypted.tracks.items) {
                    const rawUris = (Array.isArray(uris) ? uris : [uris]).filter(Boolean);
                    const idsToRemove = new Set(rawUris.map((u: string) => typeof u === 'string' ? u.replace('spotify:track:', '') : ''));
                    decrypted.tracks.items = decrypted.tracks.items.filter(item => !idsToRemove.has(item.track.id));
                    decrypted.tracks.total = decrypted.tracks.items.length;

                    // Update 4-cover poster if below 4 tracks
                    const albumArtList = decrypted.tracks.items
                        .map(i => i.track?.album?.images?.[0]?.url)
                        .filter(Boolean) as string[];

                    if (albumArtList.length >= 4) {
                        decrypted.images = albumArtList.slice(0, 4).map(url => ({ url }));
                    } else if (albumArtList.length > 0) {
                        decrypted.images = [{ url: albumArtList[0] }];
                    } else {
                        decrypted.images = [];
                    }

                    const reencrypted = encryptPayload(decrypted, req.user.userId);
                    rec.ciphertext = reencrypted.ciphertext;
                    rec.iv = reencrypted.iv;
                    rec.tag = reencrypted.tag;
                    rec.updatedAt = new Date();
                    await rec.save();

                    return res.json(decrypted);
                }
            }
        }

        const updated = localLibrary.removeTracksFromPlaylist(id, (Array.isArray(uris) ? uris : [uris]).filter(Boolean));
        if (!updated) {
            return res.status(404).json({ error: 'Playlist not found in library' });
        }
        res.json(updated);
    } catch (err: any) {
        console.error('[/playlists/:id/tracks DELETE] Error:', err);
        res.status(500).json({ error: 'Failed to remove tracks', details: err.message });
    }
});

// Delete playlist permanently (from encrypted MongoDB and local library)
router.delete('/me/playlists/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Playlist ID is required' });
    }

    try {
        let deletedFromDb = false;
        if (req.user && isDbConnected()) {
            const delResult = await EncryptedPlaylist.deleteOne({
                playlistId: id,
                userId: req.user.userId
            });
            deletedFromDb = (delResult.deletedCount ?? 0) > 0;
        }

        const deletedFromLocal = localLibrary.deletePlaylist(id);

        return res.json({
            success: true,
            message: 'Playlist permanently deleted',
            id,
            deletedFromDb,
            deletedFromLocal
        });
    } catch (err: any) {
        console.error('[/api/me/playlists/:id DELETE] Error:', err);
        res.status(500).json({ error: 'Failed to delete playlist', details: err.message });
    }
});

// Alias DELETE /playlists/:id for direct calls
router.delete('/playlists/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Playlist ID is required' });
    }

    try {
        let deletedFromDb = false;
        if (req.user && isDbConnected()) {
            const delResult = await EncryptedPlaylist.deleteOne({
                playlistId: id,
                userId: req.user.userId
            });
            deletedFromDb = (delResult.deletedCount ?? 0) > 0;
        }

        const deletedFromLocal = localLibrary.deletePlaylist(id);

        return res.json({
            success: true,
            message: 'Playlist permanently deleted',
            id,
            deletedFromDb,
            deletedFromLocal
        });
    } catch (err: any) {
        console.error('[/api/playlists/:id DELETE] Error:', err);
        res.status(500).json({ error: 'Failed to delete playlist', details: err.message });
    }
});

// Recently played / Listening History / Trending
router.get('/me/recent', async (req, res) => {
    try {
        // If logged-in account, return their actual listening history!
        if (req.user && isDbConnected()) {
            const history = await ListeningHistory.find({ userId: req.user.userId })
                .sort({ playedAt: -1 })
                .limit(25);

            if (history && history.length > 0) {
                const historyTracks: Track[] = history.map(h => ({
                    id: h.trackId,
                    uri: `spotify:track:${h.trackId}`,
                    name: h.trackName,
                    artists: [{ name: h.artistName }],
                    album: {
                        name: h.albumName || h.trackName,
                        images: [{ url: h.albumImage || '' }]
                    },
                    duration_ms: h.duration_ms || 180000,
                    preview_url: h.preview_url || null
                }));
                return res.json(historyTracks);
            }
        }

        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const trending = await metadataPlugin.searchTracks('Trending Hits', 25);
        if (trending && trending.length > 0) {
            return res.json(trending);
        }
        const tracks = await metadataPlugin.getTopTracks();
        res.json(tracks);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get recent tracks', details: err.message });
    }
});

// Record played song to user's listening history (registered accounts only!)
router.post('/me/history', async (req, res) => {
    try {
        // Only for accounts created / authenticated users
        if (!req.user || !isDbConnected()) {
            return res.json({ recorded: false, message: 'Listening history only tracked for registered accounts' });
        }

        const { track } = req.body;
        if (!track || !track.id) {
            return res.status(400).json({ error: 'Missing track data' });
        }

        const userId = req.user.userId;
        const trackId = String(track.id);
        const trackName = track.name || 'Unknown Track';
        const artistName = track.artists?.[0]?.name || 'Unknown Artist';
        const albumName = track.album?.name || '';
        const albumImage = track.album?.images?.[0]?.url || '';
        const duration_ms = track.duration_ms || 180000;
        const preview_url = track.preview_url || '';

        // Upsert so most recent play of track jumps to top
        await ListeningHistory.deleteMany({ userId, trackId });
        await ListeningHistory.create({
            userId,
            trackId,
            trackName,
            artistName,
            albumName,
            albumImage,
            duration_ms,
            preview_url,
            playedAt: new Date()
        });

        // Keep maximum latest 100 history tracks per user
        const total = await ListeningHistory.countDocuments({ userId });
        if (total > 100) {
            const excess = await ListeningHistory.find({ userId }).sort({ playedAt: 1 }).limit(total - 100);
            if (excess.length) {
                await ListeningHistory.deleteMany({ _id: { $in: excess.map(e => e._id) } });
            }
        }

        res.json({ recorded: true });
    } catch (err: any) {
        console.error('[/api/me/history POST] Error:', err);
        res.status(500).json({ error: 'Failed to record listening history', details: err.message });
    }
});

// Get user listening history
router.get('/me/history', async (req, res) => {
    try {
        if (req.user && isDbConnected()) {
            const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
            const history = await ListeningHistory.find({ userId: req.user.userId })
                .sort({ playedAt: -1 })
                .limit(limit);

            const tracks: (Track & { playedAt?: string })[] = history.map(h => ({
                id: h.trackId,
                uri: `spotify:track:${h.trackId}`,
                name: h.trackName,
                artists: [{ name: h.artistName }],
                album: {
                    name: h.albumName || h.trackName,
                    images: [{ url: h.albumImage || '' }]
                },
                duration_ms: h.duration_ms || 180000,
                preview_url: h.preview_url || null,
                playedAt: h.playedAt ? h.playedAt.toISOString() : undefined
            }));

            return res.json(tracks);
        }

        res.json([]);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch history', details: err.message });
    }
});

// Clear all listening history
router.delete('/me/history', async (req, res) => {
    try {
        if (!req.user || !isDbConnected()) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        await ListeningHistory.deleteMany({ userId: req.user.userId });
        res.json({ success: true, message: 'Listening history cleared successfully' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to clear history', details: err.message });
    }
});

// Remove individual track from listening history
router.delete('/me/history/:trackId', async (req, res) => {
    try {
        if (!req.user || !isDbConnected()) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { trackId } = req.params;
        await ListeningHistory.deleteMany({ userId: req.user.userId, trackId });
        res.json({ success: true, trackId });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to remove track from history', details: err.message });
    }
});

// New releases
router.get('/browse/new-releases', async (req, res) => {
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const releases = await metadataPlugin.getNewReleases();
        res.json(releases);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get new releases', details: err.message });
    }
});

// Real-time Albums Search (Spotify + Apple Music - Cached for 2 hours)
router.get(['/albums/search', '/browse/albums/search'], albumSearchCacheMiddleware, async (req, res) => {
    const q = req.query.q;
    if (!q || typeof q !== 'string' || !q.trim()) {
        return res.json([]);
    }
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        if (metadataPlugin.searchAlbums) {
            const albums = await metadataPlugin.searchAlbums(q, 25);
            return res.json(albums);
        }
        res.json([]);
    } catch (err: any) {
        console.error('[/api/albums/search] Error:', err.message);
        res.status(500).json({ error: 'Album search failed', details: err.message });
    }
});

// Album Details & Songs View (Spotify + YouTube metadata - Cached for 24 hours)
router.get(['/albums/:id', '/browse/albums/:id'], albumDetailsCacheMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const albumNameHint = (req.query.name as string) || '';
        const artistHint = (req.query.artist as string) || '';
        const metadataPlugin = pluginRegistry.getMetadataPlugin();

        // 0. If Spotify Playlist or Album ID (e.g. '37i9dQZF1DX4JAvHpjipBk' for New Music Friday, or 22-char Spotify album ID)
        if (id.startsWith('37i9dQZF') || (id.length === 22 && !/^\d+$/.test(id))) {
            try {
                // Try Spotify Album Embed first if not a playlist ID
                if (metadataPlugin.getAlbum && !id.startsWith('37i9dQZF')) {
                    const albumData = await metadataPlugin.getAlbum(id);
                    if (albumData && albumData.tracks?.length) {
                        return res.json(albumData);
                    }
                }

                // Try Spotify Playlist Embed
                const playlist = await metadataPlugin.getPlaylist(id);
                if (playlist && playlist.tracks?.items?.length) {
                    const tracks = playlist.tracks.items.map((i: any) => i.track).filter(Boolean);
                    const coverUrl = playlist.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f00000002b299b91ee0cfcac7d8c15f1c';
                    return res.json({
                        id,
                        name: playlist.name || albumNameHint || 'New Music Friday',
                        artists: [{ name: artistHint || 'Tate McRae' }],
                        images: [{ url: coverUrl }],
                        release_date: '2024',
                        total_tracks: playlist.tracks.total || tracks.length,
                        genres: ['Pop', 'New Releases'],
                        tracks
                    });
                }
            } catch (pErr: any) {
                console.warn('[Albums API] Spotify album/playlist fetch notice:', pErr.message);
            }
        }



        // 2. Search Spotify & YouTube for album tracks
        const queryTerm = (albumNameHint && artistHint)
            ? `${albumNameHint} ${artistHint}`
            : (albumNameHint || artistHint || id.replace(/^(sp_|album-|it_)/, '').replace(/-/g, ' '));

        const tracks = await metadataPlugin.searchTracks(queryTerm, 20);
        const coverImg = tracks[0]?.album?.images?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(albumNameHint || 'Album')}&background=181824&color=f5d0b5&size=500&bold=true`;

        return res.json({
            id,
            name: albumNameHint || (tracks[0]?.album?.name || 'Album'),
            artists: artistHint ? [{ name: artistHint }] : (tracks[0]?.artists || [{ name: 'Various Artists' }]),
            images: [{ url: coverImg }],
            release_date: '2024',
            total_tracks: tracks.length,
            genres: ['Pop', 'Music'],
            tracks
        });
    } catch (err: any) {
        console.error('[/api/albums/:id] Error:', err);
        res.status(500).json({ error: 'Failed to get album details', details: err.message });
    }
});

// Top artists (supports ?limit=50)
router.get(['/me/top/artists', '/artists/top'], async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const artists = await metadataPlugin.getTopArtists(limit);
        const sorted = (artists || []).slice().sort((a: any, b: any) => {
            const fA = typeof a.followers === 'object' && a.followers !== null ? a.followers.total : (Number(a.followers) || 0);
            const fB = typeof b.followers === 'object' && b.followers !== null ? b.followers.total : (Number(b.followers) || 0);
            return fB - fA;
        });
        res.json(sorted);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get top artists', details: err.message });
    }
});

// Live Worldwide Artist Search (Spotify + YouTube real-time catalog - Cached for 2 hours)
router.get('/artists/search', artistSearchCacheMiddleware, async (req, res) => {
    try {
        const query = (req.query.q as string) || '';
        const limit = parseInt(req.query.limit as string) || 30;
        const metadataPlugin = pluginRegistry.getMetadataPlugin();

        if (!query.trim()) {
            const artists = await metadataPlugin.getTopArtists(limit);
            return res.json(artists);
        }

        if (metadataPlugin.searchArtists) {
            const artists = await metadataPlugin.searchArtists(query, limit);
            const filtered = (artists || []).filter((a: any) => isArtistNameMatch(a.name, query));
            filtered.sort((a: any, b: any) => {
                const fA = typeof a.followers === 'object' && a.followers !== null ? a.followers.total : (Number(a.followers) || 0);
                const fB = typeof b.followers === 'object' && b.followers !== null ? b.followers.total : (Number(b.followers) || 0);
                if (fB !== fA) return fB - fA;
                return calculateArtistRelevanceScore(b, query) - calculateArtistRelevanceScore(a, query);
            });

            // Deduplicate by normalized name so caller never receives duplicate cards
            const deduplicated: any[] = [];
            const seen = new Set<string>();
            for (const a of filtered) {
                const norm = (a.name || '').trim().toLowerCase();
                if (!norm || seen.has(norm)) continue;
                seen.add(norm);
                deduplicated.push(a);
            }

            return res.json(deduplicated.slice(0, limit));
        }

        return res.json([]);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to search artists', details: err.message });
    }
});

// Security validator: ensure artistId only contains safe characters and blocks SQL / Script injection
function validateArtistId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    if (id.length > 150) return false;
    // Reject dangerous characters that could be SQL/command/script injection
    if (/[<>'"`\\;{}()|]/.test(id)) return false;
    // Explicit defense against SQL / Script injection signatures (e.g. DROP TABLE, DROP-TABLE, SELECT, <script>)
    if (/(drop[\s\-_]+table|select\b|insert\b|delete\b|update\b|union\b|exec\b|--|<script)/i.test(id)) {
        return false;
    }
    return true;
}

// Artist profile endpoint with parameter validation (Cached for 24 hours)
router.get('/artists/:id', artistProfileCacheMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!validateArtistId(id)) {
            return res.status(400).json({ error: 'Invalid artist ID format' });
        }

        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        if (metadataPlugin.getArtistDetails) {
            const profile = await metadataPlugin.getArtistDetails(id);
            if (profile) {
                return res.json(profile);
            }
        }

        return res.status(404).json({ error: 'Artist not found' });
    } catch (err: any) {
        return res.status(500).json({ error: 'Failed to get artist profile', details: err.message });
    }
});

// Artist playable top tracks (supports /artists/:id/top-tracks and legacy /artists/:id/tracks - Cached for 24 hours)
router.get(['/artists/:id/top-tracks', '/artists/:id/tracks'], artistTracksCacheMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!validateArtistId(id)) {
            return res.status(400).json({ error: 'Invalid artist ID format' });
        }

        const decoded = decodeURIComponent(id);
        const cleanName = (req.query.name as string) || decoded
            .replace(/^(sp_art_|yt_art_|dz_|it_|artist-)/i, '')
            .replace(/[-_]/g, ' ')
            .trim();

        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        let rawTracks: Track[] = [];

        if (metadataPlugin.getArtistTracks) {
            rawTracks = await metadataPlugin.getArtistTracks(id, cleanName);
        } else {
            rawTracks = await metadataPlugin.searchTracks(cleanName, 25);
        }

        const formatDuration = (ms: number = 210000) => {
            const totalSec = Math.floor(ms / 1000);
            const min = Math.floor(totalSec / 60);
            const sec = totalSec % 60;
            return `${min}:${sec < 10 ? '0' : ''}${sec}`;
        };

        const tracks = (rawTracks || []).map((t, idx) => {
            const thumb = (t.album?.images?.[0]?.url && !t.album.images[0].url.includes('unsplash.com'))
                ? t.album.images[0].url
                : '';
            const dur = formatDuration(t.duration_ms || 210000);
            return {
                ...t,
                title: t.name,
                thumbnail: thumb,
                duration: dur,
                position: idx + 1
            };
        });

        return res.json(tracks);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get artist top tracks', details: err.message });
    }
});

// 1. Discover Spotify Playlists (supports URLs, Tokens, sp_dc cookie, and Curated charts)
router.post('/spotify/discover-playlists', async (req, res) => {
    try {
        const { credential = '', limit = 10 } = req.body;
        const requestedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
        const input = (credential || '').trim();

        const metadataPlugin = pluginRegistry.getMetadataPlugin();

        // Mode A: Direct Spotify Playlist URLs or IDs
        const playlistIdMatches = input.match(/[a-zA-Z0-9]{22}/g);
        const looksLikePlaylistUrl = input.includes('spotify.com/playlist') || input.includes('spotify:playlist');
        const looksLikeToken = input.startsWith('BQ') || input.startsWith('AQ') || input.includes('sp_dc=') || input.toLowerCase().startsWith('bearer ');

        if (input && (looksLikePlaylistUrl || (playlistIdMatches && playlistIdMatches.length > 0 && !looksLikeToken))) {
            const rawIds: string[] = Array.from(new Set<string>(playlistIdMatches || [])).slice(0, requestedLimit);
            if (rawIds.length > 0) {
                const previews = await Promise.allSettled(
                    rawIds.map((id: string) => metadataPlugin.getPlaylist(id))
                );
                const results = previews
                    .filter((r): r is PromiseFulfilledResult<Playlist> => r.status === 'fulfilled' && !!r.value)
                    .map(r => ({
                        id: r.value.id,
                        name: r.value.name,
                        description: r.value.description,
                        image: r.value.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
                        trackCount: r.value.tracks?.total || r.value.tracks?.items?.length || 0,
                        owner: r.value.owner?.display_name || 'Spotify'
                    }));
                if (results.length > 0) {
                    return res.json({ playlists: results, source: 'urls' });
                }
            }
        }

        // Mode B: Spotify Access Token (starts with 'BQ' or 'Bearer ')
        if (input && (input.startsWith('BQ') || input.toLowerCase().startsWith('bearer '))) {
            const token = input.replace(/^bearer\s+/i, '').trim();
            try {
                const spotifyRes = await axios.get(`https://api.spotify.com/v1/me/playlists?limit=${requestedLimit}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 7000
                });
                if (spotifyRes.data?.items && spotifyRes.data.items.length > 0) {
                    const results = spotifyRes.data.items.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        description: item.description || '',
                        image: item.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
                        trackCount: item.tracks?.total || 0,
                        owner: item.owner?.display_name || 'Spotify User'
                    }));
                    return res.json({ playlists: results, source: 'token' });
                }
            } catch (err: any) {
                console.warn('[Spotify Token] Error fetching playlists:', err.response?.data || err.message);
            }
        }

        // Mode C: Spotube sp_dc cookie
        if (input && (input.startsWith('AQ') || input.includes('sp_dc='))) {
            const spDcValue = input.includes('sp_dc=') ? input.split('sp_dc=')[1].split(';')[0].trim() : input.trim();
            try {
                const tokenRes = await axios.get('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
                    headers: {
                        'Cookie': `sp_dc=${spDcValue}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 7000
                });
                if (tokenRes.data?.accessToken) {
                    const token = tokenRes.data.accessToken;
                    const spotifyRes = await axios.get(`https://api.spotify.com/v1/me/playlists?limit=${requestedLimit}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        timeout: 7000
                    });
                    if (spotifyRes.data?.items && spotifyRes.data.items.length > 0) {
                        const results = spotifyRes.data.items.map((item: any) => ({
                            id: item.id,
                            name: item.name,
                            description: item.description || '',
                            image: item.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
                            trackCount: item.tracks?.total || 0,
                            owner: item.owner?.display_name || 'Spotify'
                        }));
                        return res.json({ playlists: results, source: 'sp_dc' });
                    }
                }
            } catch (err: any) {
                console.warn('[Spotify sp_dc] Exchange error:', err.message);
            }
        }

        // Mode D: Curated / Popular Fallback
        const popular = (metadataPlugin as any).getCuratedPlaylists
            ? (metadataPlugin as any).getCuratedPlaylists(requestedLimit)
            : [];
            
        return res.json({
            playlists: popular.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description || 'Curated music playlist',
                image: p.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
                trackCount: 50,
                owner: 'Spotify'
            })),
            source: 'curated'
        });
    } catch (err: any) {
        console.error('[/api/spotify/discover-playlists] Error:', err);
        res.status(500).json({ error: 'Failed to discover playlists', details: err.message });
    }
});

// 2. Import Selected Playlists into Slothify Library
router.post('/spotify/import-playlists', async (req, res) => {
    try {
        const { playlistIds = [] } = req.body;
        if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
            return res.status(400).json({ error: 'No playlists selected for import' });
        }

        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const importedPlaylists: Playlist[] = [];

        for (const id of playlistIds) {
            try {
                // Scrape complete playlist with tracks
                const scraped = await metadataPlugin.getPlaylist(id);
                if (scraped) {
                    // Save to local library
                    const savedLocal = localLibrary.importPlaylist(scraped);

                    // If user is authenticated and DB is connected, save to EncryptedPlaylist
                    if (req.user && isDbConnected()) {
                        const existingRec = await EncryptedPlaylist.findOne({ playlistId: savedLocal.id, userId: req.user.userId });
                        const encrypted = encryptPayload(savedLocal, req.user.userId);
                        if (existingRec) {
                            existingRec.ciphertext = encrypted.ciphertext;
                            existingRec.iv = encrypted.iv;
                            existingRec.tag = encrypted.tag;
                            existingRec.updatedAt = new Date();
                            await existingRec.save();
                        } else {
                            await EncryptedPlaylist.create({
                                userId: req.user.userId,
                                playlistId: savedLocal.id,
                                ciphertext: encrypted.ciphertext,
                                iv: encrypted.iv,
                                tag: encrypted.tag,
                                updatedAt: new Date()
                            });
                        }
                    }

                    importedPlaylists.push(savedLocal);
                }
            } catch (pErr: any) {
                console.warn(`[Spotify Import] Error importing playlist ${id}:`, pErr.message);
            }
        }

        res.json({
            success: true,
            importedCount: importedPlaylists.length,
            playlists: importedPlaylists
        });
    } catch (err: any) {
        console.error('[/api/spotify/import-playlists] Error:', err);
        res.status(500).json({ error: 'Failed to import playlists', details: err.message });
    }
});

// Top tracks
router.get('/me/top/tracks', async (req, res) => {
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const tracks = await metadataPlugin.getTopTracks();
        res.json(tracks);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get top tracks', details: err.message });
    }
});

// Browse categories
router.get('/browse/categories', async (req, res) => {
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const categories = await metadataPlugin.getCategories();
        res.json(categories);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get categories', details: err.message });
    }
});

// Category playlists
router.get('/browse/categories/:id/playlists', async (req, res) => {
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const items = await metadataPlugin.getCategoryPlaylists(req.params.id);
        res.json(items);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get category playlists', details: err.message });
    }
});

// Liked tracks / Saved tracks (Encrypted per user in DB)
router.get('/me/tracks', async (req, res) => {
    try {
        if (req.user && isDbConnected()) {
            const { idsOnly } = req.query;
            if (idsOnly === 'true' || idsOnly === '1') {
                const records = await EncryptedLikedTrack.find(
                    { userId: req.user.userId },
                    { trackId: 1, addedAt: 1 }
                ).sort({ addedAt: -1 }).lean();
                const ids = records.map((r: any) => r.trackId).filter(Boolean);
                return res.json({ ids, total: ids.length, items: [] });
            }

            const records = await EncryptedLikedTrack.find({ userId: req.user.userId }).sort({ addedAt: -1 });
            const tracks: Track[] = [];
            for (const rec of records) {
                const decrypted = decryptPayload<Track>(rec.ciphertext, rec.iv, rec.tag, req.user.userId);
                if (decrypted) tracks.push(decrypted);
            }
            return res.json({ items: tracks, total: tracks.length, ids: records.map((r: any) => r.trackId) });
        }

        if (isDbConnected()) {
            return res.json({ items: [], total: 0, ids: [] });
        }

        const result = localLibrary.getLikedTracks();
        const ids = (result.items || []).map((t: any) => t.id).filter(Boolean);
        res.json({ ...result, ids });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get saved tracks', details: err.message });
    }
});

// Toggle liked track (POST)
router.post('/me/tracks', async (req, res) => {
    try {
        let track = req.body.track;
        const trackId = req.body.trackId || track?.id;

        if (!trackId) {
            return res.status(400).json({ error: 'Missing track or trackId data' });
        }

        if (!track) {
            track = {
                id: trackId,
                uri: `spotify:track:${trackId}`,
                name: req.body.name || 'Liked Track',
                artists: [{ name: req.body.artist || 'Unknown Artist' }],
                album: { name: req.body.album || 'Single', images: [] },
                duration_ms: req.body.duration_ms || 180000
            };
        }

        if (req.user && isDbConnected()) {
            const existing = await EncryptedLikedTrack.findOne({ userId: req.user.userId, trackId });
            if (existing) {
                await EncryptedLikedTrack.deleteOne({ _id: existing._id });
                const total = await EncryptedLikedTrack.countDocuments({ userId: req.user.userId });
                return res.json({ liked: false, total });
            } else {
                const encrypted = encryptPayload(track, req.user.userId);
                await EncryptedLikedTrack.create({
                    userId: req.user.userId,
                    trackId: track.id,
                    ciphertext: encrypted.ciphertext,
                    iv: encrypted.iv,
                    tag: encrypted.tag,
                    addedAt: new Date()
                });
                const total = await EncryptedLikedTrack.countDocuments({ userId: req.user.userId });
                return res.json({ liked: true, total });
            }
        }

        const result = localLibrary.toggleLikedTrack(track);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to toggle liked track', details: err.message });
    }
});

// Save liked track (PUT)
router.put('/me/tracks', async (req, res) => {
    try {
        let track = req.body.track;
        const trackId = req.body.trackId || (req.query.ids as string) || track?.id;
        if (!trackId) return res.status(400).json({ error: 'Missing track data' });
        if (!track) {
            track = {
                id: trackId,
                uri: `spotify:track:${trackId}`,
                name: 'Liked Track',
                artists: [{ name: 'Unknown Artist' }],
                album: { name: 'Single', images: [] },
                duration_ms: 180000
            };
        }

        if (req.user && isDbConnected()) {
            const existing = await EncryptedLikedTrack.findOne({ userId: req.user.userId, trackId });
            if (!existing) {
                const encrypted = encryptPayload(track, req.user.userId);
                await EncryptedLikedTrack.create({
                    userId: req.user.userId,
                    trackId: track.id,
                    ciphertext: encrypted.ciphertext,
                    iv: encrypted.iv,
                    tag: encrypted.tag,
                    addedAt: new Date()
                });
            }
            const total = await EncryptedLikedTrack.countDocuments({ userId: req.user.userId });
            return res.json({ liked: true, total });
        }

        const result = localLibrary.toggleLikedTrack(track);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to save liked track', details: err.message });
    }
});

// Remove liked track (DELETE)
router.delete('/me/tracks', async (req, res) => {
    try {
        const trackId = req.body.trackId || req.body.track?.id || (req.query.ids as string);
        if (!trackId) return res.status(400).json({ error: 'Missing track ID' });

        if (req.user && isDbConnected()) {
            await EncryptedLikedTrack.deleteOne({ userId: req.user.userId, trackId });
            const total = await EncryptedLikedTrack.countDocuments({ userId: req.user.userId });
            return res.json({ liked: false, total });
        }

        const result = localLibrary.toggleLikedTrack({ id: trackId } as any);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete liked track', details: err.message });
    }
});

// -------------------------------------------------------------
// Followed Artists Endpoints (Personalized Database Sync)
// -------------------------------------------------------------

// Get all followed artists
router.get(['/me/artists', '/me/following'], async (req, res) => {
    try {
        if (req.user && isDbConnected()) {
            const records = await FollowedArtist.find({ userId: req.user.userId }).sort({ followedAt: -1 });
            const items = records.map((r: any) => ({
                id: r.artistId,
                name: r.artistName,
                images: r.artistImage ? [{ url: r.artistImage }] : [],
                followers: { total: r.followers || 0 },
                isFollowing: true,
                followedAt: r.followedAt
            }));
            return res.json({ items, total: items.length });
        }

        if (isDbConnected() && !req.user) {
            return res.json({ items: [], total: 0 });
        }

        const result = localLibrary.getFollowedArtists();
        res.json(result);
    } catch (err: any) {
        console.error('[/api/me/artists GET] Error:', err);
        res.status(500).json({ error: 'Failed to get followed artists', details: err.message });
    }
});

// Toggle follow artist (POST)
router.post(['/me/artists', '/me/following'], async (req, res) => {
    try {
        const body = req.body || {};
        const artist = body.artist || {};
        const artistId = body.artistId || artist.id;
        const artistName = body.artistName || body.name || artist.name;
        const artistImage = body.artistImage || body.image || artist.images?.[0]?.url || '';
        const followers = body.followers !== undefined
            ? (typeof body.followers === 'object' ? body.followers.total : Number(body.followers))
            : (artist.followers?.total || 0);

        if (!artistId) {
            return res.status(400).json({ error: 'Missing artistId' });
        }

        if (req.user && isDbConnected()) {
            const userId = req.user.userId;
            const existing = await FollowedArtist.findOne({ userId, artistId });
            if (existing) {
                await FollowedArtist.deleteOne({ _id: existing._id });
                const total = await FollowedArtist.countDocuments({ userId });
                return res.json({ following: false, total, artistId });
            } else {
                await FollowedArtist.create({
                    userId,
                    artistId,
                    artistName: artistName || 'Unknown Artist',
                    artistImage,
                    followers: followers || 0,
                    followedAt: new Date()
                });
                const total = await FollowedArtist.countDocuments({ userId });
                return res.json({ following: true, total, artistId });
            }
        }

        const result = localLibrary.toggleFollowedArtist({
            id: artistId,
            name: artistName,
            artistImage,
            followers
        });
        res.json(result);
    } catch (err: any) {
        console.error('[/api/me/artists POST] Error:', err);
        res.status(500).json({ error: 'Failed to toggle followed artist', details: err.message });
    }
});

// Batch sync guest followed artists when user logs in / registers
router.post('/me/artists/sync', async (req, res) => {
    try {
        const artists = Array.isArray(req.body.artists) ? req.body.artists : [];
        if (!req.user || !isDbConnected()) {
            if (!isDbConnected()) {
                const count = localLibrary.syncFollowedArtists(artists);
                return res.json({ success: true, count });
            }
            return res.json({ success: false, message: 'Not authenticated' });
        }

        const userId = req.user.userId;
        let synced = 0;
        for (const art of artists) {
            const artistId = art.id || art.artistId;
            const artistName = art.name || art.artistName;
            if (!artistId || !artistName) continue;
            const artistImage = art.images?.[0]?.url || art.image || art.artistImage || '';
            const followers = typeof art.followers === 'object'
                ? (art.followers?.total || 0)
                : (Number(art.followers) || 0);

            await FollowedArtist.updateOne(
                { userId, artistId },
                {
                    $setOnInsert: {
                        userId,
                        artistId,
                        artistName,
                        artistImage,
                        followers,
                        followedAt: new Date()
                    }
                },
                { upsert: true }
            );
            synced++;
        }

        const total = await FollowedArtist.countDocuments({ userId });
        res.json({ success: true, synced, total });
    } catch (err: any) {
        console.error('[/api/me/artists/sync] Error:', err);
        res.status(500).json({ error: 'Failed to sync followed artists', details: err.message });
    }
});

// -------------------------------------------------------------
// Recommendations - Comprehensive Multi-Signal Personalization
// Blends:
// 1. Followed Artists (explicit user devotion, weight 4)
// 2. Liked Songs (curated favorites, weight 3)
// 3. User Playlists (deep catalog affinity, weight 2)
// 4. Listening History (recent plays, weight 2)
// 5. Guest seed fallback (zero DB writes)
// -------------------------------------------------------------
router.get('/recommendations', async (req, res) => {
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        const guestSeedParam = (req.query.seed_artists as string) || '';

        // Guest personalization path (zero database writes)
        if (!req.user && guestSeedParam) {
            const guestSeeds = guestSeedParam.split(',').map(s => s.trim()).filter(Boolean);
            if (guestSeeds.length > 0) {
                const chosenSeed = guestSeeds[Math.floor(Math.random() * Math.min(guestSeeds.length, 4))];
                const tracks = await metadataPlugin.searchTracks(chosenSeed, 25);
                if (tracks && tracks.length > 0) {
                    return res.json({
                        authenticated: false,
                        tracks,
                        personalizedFor: chosenSeed,
                        source: 'guest_likes',
                        sources: ['guest_likes']
                    });
                }
            }
        }

        if (!req.user) {
            return res.json({
                authenticated: false,
                message: 'Recommendation system starts working when logged in',
                tracks: []
            });
        }

        if (isDbConnected()) {
            const userId = req.user.userId;

            // 1. Fetch Followed Artists (explicit user follow, weight 4)
            const followedRecords = await FollowedArtist.find({ userId }).sort({ followedAt: -1 }).limit(15);
            const followedArtists = followedRecords.map((r: any) => r.artistName).filter(Boolean);

            // 2. Fetch Liked Songs (weight 3)
            const likedRecords = await EncryptedLikedTrack.find({ userId }).sort({ addedAt: -1 }).limit(20);
            const likedArtists: string[] = [];
            for (const rec of likedRecords) {
                const dec = decryptPayload<Track>(rec.ciphertext, rec.iv, rec.tag, userId);
                if (dec && dec.artists?.[0]?.name && dec.artists[0].name !== 'Unknown Artist') {
                    likedArtists.push(dec.artists[0].name);
                }
            }

            // 3. Fetch User Playlists (weight 2)
            const playlistRecords = await EncryptedPlaylist.find({ userId }).sort({ updatedAt: -1 }).limit(10);
            const playlistArtists: string[] = [];
            for (const pRec of playlistRecords) {
                const decPlaylist = decryptPayload<Playlist>(pRec.ciphertext, pRec.iv, pRec.tag, userId);
                if (decPlaylist && Array.isArray(decPlaylist.tracks?.items)) {
                    for (const item of decPlaylist.tracks.items) {
                        const aName = item.track?.artists?.[0]?.name;
                        if (aName && aName !== 'Unknown Artist' && !playlistArtists.includes(aName)) {
                            playlistArtists.push(aName);
                        }
                    }
                }
            }

            // 4. Fetch Listening History (weight 2)
            const historyRecords = await ListeningHistory.find({ userId }).sort({ playedAt: -1 }).limit(15);
            const historyArtists = historyRecords.map((h: any) => h.artistName).filter((a: any) => a && a !== 'Unknown Artist');

            // Build weighted affinity map across all signals
            const affinityScores = new Map<string, number>();
            const recordScore = (artist: string, weight: number) => {
                const clean = artist.trim();
                if (!clean) return;
                affinityScores.set(clean, (affinityScores.get(clean) || 0) + weight);
            };

            followedArtists.forEach((a: string) => recordScore(a, 4));
            likedArtists.forEach((a: string) => recordScore(a, 3));
            playlistArtists.forEach((a: string) => recordScore(a, 2));
            historyArtists.forEach((a: string) => recordScore(a, 2));

            const sortedSeeds = Array.from(affinityScores.entries())
                .sort((a, b) => b[1] - a[1])
                .map(e => e[0]);

            const activeSources: string[] = [];
            if (followedArtists.length > 0) activeSources.push('followed_artists');
            if (likedArtists.length > 0) activeSources.push('liked_songs');
            if (playlistArtists.length > 0) activeSources.push('playlists');
            if (historyArtists.length > 0) activeSources.push('listening_history');

            if (sortedSeeds.length > 0) {
                // Select up to 3 distinct seed artists to query for diverse, rich recommendations
                const topPicks = sortedSeeds.slice(0, 3);
                const targetSeed = topPicks[Math.floor(Math.random() * topPicks.length)];

                // Search tracks from top affinity seeds in parallel
                const searchResults = await Promise.allSettled(
                    topPicks.map(seed => metadataPlugin.searchTracks(seed, 12))
                );

                const candidateTracks: Track[] = [];
                for (const r of searchResults) {
                    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
                        candidateTracks.push(...r.value);
                    }
                }

                // Interleave and deduplicate results
                const seenIds = new Set<string>();
                const seenTitles = new Set<string>();
                const finalTracks: Track[] = [];

                for (const t of candidateTracks) {
                    if (!t || !t.id || !t.name) continue;
                    const cleanKey = `${t.name.toLowerCase().trim()}_${(t.artists?.[0]?.name || '').toLowerCase().trim()}`;
                    if (seenIds.has(t.id) || seenTitles.has(cleanKey)) continue;
                    seenIds.add(t.id);
                    seenTitles.add(cleanKey);
                    finalTracks.push(t);
                    if (finalTracks.length >= 25) break;
                }

                if (finalTracks.length > 0) {
                    let desc = targetSeed;
                    if (followedArtists.includes(targetSeed)) {
                        desc = `${targetSeed} (Followed Artist)`;
                    } else if (likedArtists.includes(targetSeed)) {
                        desc = `${targetSeed} (Liked Songs)`;
                    } else if (playlistArtists.includes(targetSeed)) {
                        desc = `${targetSeed} (Your Playlists)`;
                    }

                    return res.json({
                        authenticated: true,
                        tracks: finalTracks,
                        personalizedFor: desc,
                        source: activeSources[0] || 'history',
                        sources: activeSources,
                        stats: {
                            followedArtists: followedArtists.length,
                            likedSongs: likedRecords.length,
                            playlists: playlistRecords.length,
                            historyPlays: historyRecords.length
                        }
                    });
                }
            }
        }

        // Fallback for new authenticated account with no history or follows yet
        const tracks = await metadataPlugin.searchTracks('Global Pop Hits', 25);
        if (tracks && tracks.length > 0) {
            return res.json({ authenticated: true, tracks, personalizedFor: 'New Member Mix', sources: ['charts'] });
        }
        const fallback = await metadataPlugin.getTopTracks();
        res.json({ authenticated: true, tracks: fallback, personalizedFor: 'Top Charts', sources: ['charts'] });
    } catch (err: any) {
        console.error('[/api/recommendations] Error:', err);
        res.status(500).json({ error: 'Failed to get recommendations', details: err.message });
    }
});

// Smart Mood Suggestions based on playing track
router.get('/recommendations/smart', async (req, res) => {
    const track = String(req.query.track || '');
    const artist = String(req.query.artist || '');
    try {
        const metadataPlugin = pluginRegistry.getMetadataPlugin();
        if (metadataPlugin.getSmartMoodSuggestions) {
            const suggestions = await metadataPlugin.getSmartMoodSuggestions(track, artist);
            return res.json({ tracks: suggestions });
        }
        const fallback = await metadataPlugin.getTopTracks();
        res.json({ tracks: fallback });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to get smart mood suggestions', details: err.message });
    }
});

// User profile
router.get('/users/:id', (req, res) => {
    const isSpotify = req.params.id === 'spotify';
    const name = isSpotify ? 'Spotify' : (req.user?.username || req.params.id);
    res.json({
        id: req.params.id,
        display_name: name,
        images: [{ url: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}` }]
    });
});

export default router;