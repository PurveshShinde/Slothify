import express from 'express';
import { spotifyService } from '../services/spotifyService.js';

const router = express.Router();

router.get('/login', (req, res) => {
    res.redirect(spotifyService.getAuthorizeUrl());
});

router.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const data = await spotifyService.exchangeCode(String(code));
        // Store tokens in session
        (req.session as any).access_token = data.access_token;
        (req.session as any).refresh_token = data.refresh_token;

        // Save session before redirect to ensure cookies are set
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).send('Session Error');
            }
            res.redirect('http://127.0.0.1:3000/');
        });
    } catch (err) {
        console.error('Auth callback error:', err);
        res.status(500).send('Authentication Error');
    }
});

// Debug endpoint - check auth state without calling Spotify
router.get('/me', (req, res) => {
    const session = req.session as any;
    res.json({
        authenticated: !!session.access_token,
        hasAccessToken: !!session.access_token,
        hasRefreshToken: !!session.refresh_token
    });
});

router.get('/status', async (req, res) => {
    const token = (req.session as any).access_token;
    if (!token) return res.json({ authenticated: false });

    try {
        const user = await spotifyService.getMe(token);
        res.json({ authenticated: true, user });
    } catch {
        res.json({ authenticated: false });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.clearCookie('nyx.sid');
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

export default router;
