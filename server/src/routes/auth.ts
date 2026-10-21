import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { EncryptedPlaylist } from '../models/EncryptedPlaylist.js';
import { EncryptedLikedTrack } from '../models/EncryptedLikedTrack.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { signToken, requireAuth, optionalAuth } from '../middleware/auth.js';
import { generateRecoveryPassphrase } from '../utils/crypto.js';
import { isDbConnected } from '../db/connection.js';

const router = express.Router();

// In-memory fallback map for offline local development
interface LocalUser {
    passwordHash: string;
    recoveryKeyHash: string;
}
const localUserStore = new Map<string, LocalUser>();

/**
 * Register a new user account with a 12-word recovery passphrase (passkey)
 */
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || typeof username !== 'string' || username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        const cleanUsername = username.trim();

        // Check if database is connected
        if (!isDbConnected()) {
            if ([...localUserStore.keys()].some(k => k.toLowerCase() === cleanUsername.toLowerCase())) {
                return res.status(409).json({ error: 'Username is already taken. Please choose another one.' });
            }
            const recoveryPassphrase = generateRecoveryPassphrase();
            const passwordHash = await bcrypt.hash(password, 10);
            const recoveryKeyHash = await bcrypt.hash(recoveryPassphrase.toLowerCase().trim(), 10);
            localUserStore.set(cleanUsername, { passwordHash, recoveryKeyHash });

            const token = signToken({ userId: 'local_user_' + cleanUsername, username: cleanUsername });
            return res.status(201).json({
                token,
                user: {
                    id: 'local_user_' + cleanUsername,
                    username: cleanUsername,
                    display_name: cleanUsername,
                    images: [{ url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}` }]
                },
                recoveryPassphrase,
                warning: 'No email is attached to this account. Download or save your 12-word recovery passphrase to prevent account loss.'
            });
        }

        // Case-insensitive check to prevent duplicate username collisions
        const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existing = await User.findOne({ username: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        if (existing) {
            return res.status(409).json({ error: 'Username is already taken. Please choose another one.' });
        }

        // Generate 12-word recovery passphrase
        const recoveryPassphrase = generateRecoveryPassphrase();

        // Hash password and recovery key
        const passwordHash = await bcrypt.hash(password, 10);
        const recoveryKeyHash = await bcrypt.hash(recoveryPassphrase.toLowerCase().trim(), 10);

        const newUser = await User.create({
            username: cleanUsername,
            passwordHash,
            recoveryKeyHash
        });

        const token = signToken({ userId: String(newUser._id), username: newUser.username });

        res.status(201).json({
            token,
            user: {
                id: String(newUser._id),
                username: newUser.username,
                display_name: newUser.username,
                images: [{ url: `https://api.dicebear.com/7.x/bottts/svg?seed=${newUser.username}` }]
            },
            recoveryPassphrase,
            warning: 'No email is attached to this account. Download or save your 12-word recovery passphrase to prevent account loss.'
        });
    } catch (err: any) {
        console.error('[/api/auth/register] Error:', err);
        res.status(500).json({ error: 'Registration failed', details: err.message });
    }
});

/**
 * Login with username and password
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const cleanUsername = username.trim();

        if (!isDbConnected()) {
            const localUser = localUserStore.get(cleanUsername);
            if (!localUser) {
                return res.status(401).json({ error: 'Invalid username or password.' });
            }
            const isMatch = await bcrypt.compare(password, localUser.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid username or password.' });
            }
            const token = signToken({ userId: 'local_user_' + cleanUsername, username: cleanUsername });
            return res.json({
                token,
                user: {
                    id: 'local_user_' + cleanUsername,
                    username: cleanUsername,
                    display_name: cleanUsername,
                    images: [{ url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}` }]
                }
            });
        }

        const user = await User.findOne({ username: cleanUsername });
        // Strict case-sensitive match
        if (!user || user.username !== cleanUsername) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const token = signToken({ userId: String(user._id), username: user.username });

        res.json({
            token,
            user: {
                id: String(user._id),
                username: user.username,
                display_name: user.username,
                images: [{ url: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}` }]
            }
        });
    } catch (err: any) {
        console.error('[/api/auth/login] Error:', err);
        res.status(500).json({ error: 'Login failed', details: err.message });
    }
});

/**
 * Recover account using the 12-word recovery passphrase if password is forgotten
 */
router.post('/recover', async (req, res) => {
    try {
        const { username, recoveryPassphrase, newPassword } = req.body;

        if (!username || !recoveryPassphrase || !newPassword) {
            return res.status(400).json({ error: 'Username, recovery passphrase, and new password are required.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
        }

        const cleanUsername = username.trim();
        const cleanPassphrase = recoveryPassphrase.trim().toLowerCase();

        if (!isDbConnected()) {
            const localUser = localUserStore.get(cleanUsername);
            if (!localUser) {
                return res.status(404).json({ error: 'User not found in local session.' });
            }
            const isPassphraseValid = await bcrypt.compare(cleanPassphrase, localUser.recoveryKeyHash);
            if (!isPassphraseValid) {
                return res.status(401).json({ error: 'Invalid recovery passphrase. Please verify your 12 words.' });
            }
            const newRecoveryPassphrase = generateRecoveryPassphrase();
            localUser.passwordHash = await bcrypt.hash(newPassword, 10);
            localUser.recoveryKeyHash = await bcrypt.hash(newRecoveryPassphrase.toLowerCase().trim(), 10);
            const token = signToken({ userId: 'local_user_' + cleanUsername, username: cleanUsername });
            return res.json({
                token,
                user: { id: 'local_user_' + cleanUsername, username: cleanUsername },
                newRecoveryPassphrase,
                message: 'Password successfully reset! Save your new recovery passphrase.'
            });
        }

        const user = await User.findOne({ username: cleanUsername });
        if (!user || user.username !== cleanUsername) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const isPassphraseValid = await bcrypt.compare(cleanPassphrase, user.recoveryKeyHash);
        if (!isPassphraseValid) {
            return res.status(401).json({ error: 'Invalid recovery passphrase. Please verify your 12 words.' });
        }

        // Generate fresh recovery passphrase for security
        const newRecoveryPassphrase = generateRecoveryPassphrase();
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        const newRecoveryKeyHash = await bcrypt.hash(newRecoveryPassphrase.toLowerCase().trim(), 10);

        user.passwordHash = newPasswordHash;
        user.recoveryKeyHash = newRecoveryKeyHash;
        await user.save();

        const token = signToken({ userId: String(user._id), username: user.username });

        res.json({
            token,
            user: {
                id: String(user._id),
                username: user.username
            },
            newRecoveryPassphrase,
            message: 'Password successfully reset! Save your new recovery passphrase.'
        });
    } catch (err: any) {
        console.error('[/api/auth/recover] Error:', err);
        res.status(500).json({ error: 'Account recovery failed', details: err.message });
    }
});

/**
 * Get current authenticated user
 */
router.get('/me', optionalAuth, (req, res) => {
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
            user: {
                id: 'guest',
                display_name: 'Slothify Guest',
                username: 'guest',
                images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }]
            }
        });
    }
});

/**
 * Auth status endpoint (backwards compatibility)
 */
router.get('/status', optionalAuth, (req, res) => {
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
            user: {
                id: 'guest',
                display_name: 'Slothify Guest',
                username: 'guest',
                images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }]
            }
        });
    }
});

/**
 * Update username for the logged-in user
 */
router.put('/username', requireAuth, async (req, res) => {
    try {
        const { newUsername } = req.body;
        if (!newUsername || typeof newUsername !== 'string' || newUsername.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }
        const clean = newUsername.trim();

        if (isDbConnected()) {
            const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const existing = await User.findOne({ username: { $regex: new RegExp(`^${escaped}$`, 'i') } });
            if (existing && String(existing._id) !== req.user!.userId) {
                return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
            }
            await User.updateOne({ _id: req.user!.userId }, { username: clean });
        } else {
            const localUser = localUserStore.get(req.user!.username);
            if (localUser) {
                localUserStore.delete(req.user!.username);
                localUserStore.set(clean, localUser);
            }
        }

        const token = signToken({ userId: req.user!.userId, username: clean });
        res.json({
            token,
            user: {
                id: req.user!.userId,
                username: clean,
                display_name: clean,
                images: [{ url: `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}` }]
            },
            message: 'Username updated successfully!'
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to update username', details: err.message });
    }
});

/**
 * Permanently delete user account and all associated encrypted data
 */
router.delete('/account', requireAuth, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const username = req.user?.username;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
        }

        if (isDbConnected()) {
            await User.deleteOne({ _id: userId });
            await EncryptedPlaylist.deleteMany({ userId });
            await EncryptedLikedTrack.deleteMany({ userId });
            await ListeningHistory.deleteMany({ userId });
        } else if (username) {
            localUserStore.delete(username);
        }

        res.json({ success: true, message: 'Account, playlists, liked tracks, and listening history deleted permanently.' });
    } catch (err: any) {
        console.error('[/api/auth/account DELETE] Error:', err);
        res.status(500).json({ error: 'Failed to delete account', details: err.message });
    }
});

export default router;
