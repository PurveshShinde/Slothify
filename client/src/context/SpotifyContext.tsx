import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { Playlist } from '../types';
import { useCache } from './CacheContext';

interface SpotifyContextType {
    isConnected: boolean; // True if at least 1 Spotify playlist is imported
    spotifyPlaylists: Playlist[];
    isImporting: boolean;
    importError: string | null;
    isImportModalOpen: boolean;
    isConnectModalOpen: boolean; // Alias for isImportModalOpen
    openImportModal: () => void;
    closeImportModal: () => void;
    openConnectModal: () => void; // Alias
    closeConnectModal: () => void; // Alias
    importByPlaylistUrl: (urlOrId: string) => Promise<{ success: boolean; playlist?: Playlist; error?: string }>;
    removeImportedPlaylist: (playlistId: string) => void;
    clearAllSpotifyPlaylists: () => void;
    disconnectSpotify: () => void; // Alias for clearAllSpotifyPlaylists
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

const STORAGE_PLAYLISTS_KEY = 'slothify_spotify_imported_playlists';

export const SpotifyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { setPlaylistDetail, removePlaylistFromCache } = useCache();

    // 1. Local session persistence for imported Spotify playlists (Zero database sync)
    const [spotifyPlaylists, setSpotifyPlaylists] = useState<Playlist[]>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_PLAYLISTS_KEY) || sessionStorage.getItem(STORAGE_PLAYLISTS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // 2. Warm-up CacheContext with imported playlists so they load instantly
    useEffect(() => {
        spotifyPlaylists.forEach(p => {
            const tracks = (p.tracks?.items || []).map((i: any) => i.track || i).filter(Boolean);
            if (tracks.length > 0) {
                setPlaylistDetail(p.id, { playlist: p, tracks });
            }
        });
    }, []);

    const openImportModal = () => {
        setImportError(null);
        setIsImportModalOpen(true);
    };

    const closeImportModal = () => {
        setIsImportModalOpen(false);
        setImportError(null);
    };

    /**
     * Import public Spotify playlist, album, or track via URL
     * Free from rate limits and requires zero accounts/keys.
     */
    const importByPlaylistUrl = async (urlOrId: string): Promise<{ success: boolean; playlist?: Playlist; error?: string }> => {
        const clean = (urlOrId || '').trim();
        if (!clean) {
            const msg = 'Please enter a Spotify playlist, album, or track link.';
            setImportError(msg);
            return { success: false, error: msg };
        }

        setIsImporting(true);
        setImportError(null);

        try {
            const res = await axios.post('/api/spotify/fetch-playlists', {
                url: clean
            });

            if (res.data?.success && res.data.playlist) {
                const newPlaylist: Playlist = res.data.playlist;

                // Merge into current spotifyPlaylists (deduping by ID)
                setSpotifyPlaylists(prev => {
                    const filtered = prev.filter(p => p.id !== newPlaylist.id);
                    const next = [newPlaylist, ...filtered];
                    try {
                        localStorage.setItem(STORAGE_PLAYLISTS_KEY, JSON.stringify(next));
                    } catch {}
                    return next;
                });

                // Pre-cache tracks for instant 0ms playback
                const trks = (newPlaylist.tracks?.items || []).map((i: any) => i.track || i).filter(Boolean);
                setPlaylistDetail(newPlaylist.id, { playlist: newPlaylist, tracks: trks });

                window.dispatchEvent(new Event('slothify_spotify_playlists_updated'));
                closeImportModal();

                return { success: true, playlist: newPlaylist };
            } else {
                const msg = res.data?.error || 'Failed to import playlist. Make sure the link is public.';
                setImportError(msg);
                return { success: false, error: msg };
            }
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message || 'Import failed. Please check the link.';
            setImportError(msg);
            return { success: false, error: msg };
        } finally {
            setIsImporting(false);
        }
    };

    /**
     * Remove a single imported playlist from session
     */
    const removeImportedPlaylist = (playlistId: string) => {
        setSpotifyPlaylists(prev => {
            const next = prev.filter(p => p.id !== playlistId);
            try {
                localStorage.setItem(STORAGE_PLAYLISTS_KEY, JSON.stringify(next));
            } catch {}
            return next;
        });
        removePlaylistFromCache(playlistId);
        window.dispatchEvent(new Event('slothify_spotify_playlists_updated'));
    };

    /**
     * Clear all imported Spotify playlists.
     * Vanishes completely with zero database residue.
     */
    const clearAllSpotifyPlaylists = () => {
        spotifyPlaylists.forEach(p => {
            removePlaylistFromCache(p.id);
        });

        setSpotifyPlaylists([]);
        setImportError(null);
        setIsImportModalOpen(false);

        try {
            localStorage.removeItem(STORAGE_PLAYLISTS_KEY);
            sessionStorage.removeItem(STORAGE_PLAYLISTS_KEY);
        } catch {}

        window.dispatchEvent(new Event('slothify_spotify_playlists_updated'));
    };

    return (
        <SpotifyContext.Provider
            value={{
                isConnected: spotifyPlaylists.length > 0,
                spotifyPlaylists,
                isImporting,
                importError,
                isImportModalOpen,
                isConnectModalOpen: isImportModalOpen,
                openImportModal,
                closeImportModal,
                openConnectModal: openImportModal,
                closeConnectModal: closeImportModal,
                importByPlaylistUrl,
                removeImportedPlaylist,
                clearAllSpotifyPlaylists,
                disconnectSpotify: clearAllSpotifyPlaylists
            }}
        >
            {children}
        </SpotifyContext.Provider>
    );
};

export const useSpotify = (): SpotifyContextType => {
    const context = useContext(SpotifyContext);
    if (!context) {
        throw new Error('useSpotify must be used within a SpotifyProvider');
    }
    return context;
};

export default SpotifyContext;
