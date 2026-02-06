import { CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// --- CONFIGURATION ---
const CLIENT_ID = '4d1e169a8d644f659264ed7f5b338c92'; // Hardcoded for safety
const CLIENT_SECRET = '5852aa65d611427e89db9193be801fb0'; // Hardcoded for safety
const REDIRECT_URI = 'com.nyx.app://callback'; // Deep Link
const AUTH_ENDPOINT = 'https://accounts.spotify.com';
const API_ENDPOINT = 'https://api.spotify.com/v1';

export const SpotifyService = {
    // 1. GENERATE LOGIN URL
    getAuthorizeUrl: () => {
        const scopes = [
            'playlist-read-private',
            'playlist-read-collaborative',
            'playlist-modify-public',
            'playlist-modify-private',
            'user-library-read',
            'user-read-email',
            'user-read-recently-played',
            'user-top-read',
            'user-read-private'
        ].join(' ');

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scopes,
            redirect_uri: REDIRECT_URI,
            show_dialog: 'true'
        });
        return `${AUTH_ENDPOINT}/authorize?${params.toString()}`;
    },

    // 2. EXCHANGE CODE FOR TOKEN
    exchangeCode: async (code: string) => {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        });

        const response = await CapacitorHttp.post({
            url: `${AUTH_ENDPOINT}/api/token`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: body.toString()
        });

        if (response.status !== 200) {
            throw new Error(`Token exchange failed: ${response.data.error_description}`);
        }
        return response.data;
    },

    // Refresh the access token using the refresh token
    refreshToken: async (): Promise<string | null> => {
        const { value: refreshToken } = await Preferences.get({ key: 'spotify_refresh_token' });
        if (!refreshToken) {
            console.log('No refresh token available');
            return null;
        }

        try {
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            });

            const response = await CapacitorHttp.post({
                url: `${AUTH_ENDPOINT}/api/token`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: body.toString()
            });

            if (response.status === 200 && response.data.access_token) {
                console.log('✅ Token refreshed successfully');
                await Preferences.set({ key: 'spotify_access_token', value: response.data.access_token });
                // Update refresh token if a new one is provided
                if (response.data.refresh_token) {
                    await Preferences.set({ key: 'spotify_refresh_token', value: response.data.refresh_token });
                }
                return response.data.access_token;
            }
        } catch (e) {
            console.error('Token refresh failed:', e);
        }
        return null;
    },

    // Helper to get token (refreshes if needed)
    getToken: async (): Promise<string | null> => {
        const { value } = await Preferences.get({ key: 'spotify_access_token' });
        return value;
    },

    // Logout - clears all tokens
    logout: async () => {
        console.log('🚪 Logging out user...');
        await Preferences.remove({ key: 'spotify_access_token' });
        await Preferences.remove({ key: 'spotify_refresh_token' });
        // Force page reload to reset app state
        window.location.reload();
    },

    // Make authenticated request with auto-refresh
    authRequest: async (url: string, options: any = {}): Promise<any> => {
        let token = await SpotifyService.getToken();
        if (!token) return null;

        const response = await CapacitorHttp.get({
            url,
            headers: { Authorization: `Bearer ${token}`, ...options.headers }
        });

        // If token expired, refresh and retry
        if (response.status === 401) {
            console.log('⚠️ Token expired, refreshing...');
            token = await SpotifyService.refreshToken();

            // If refresh failed, logout user
            if (!token) {
                console.log('❌ Refresh failed - logging out user');
                await SpotifyService.logout();
                return null;
            }

            const retryResponse = await CapacitorHttp.get({
                url,
                headers: { Authorization: `Bearer ${token}`, ...options.headers }
            });
            return retryResponse;
        }
        return response;
    },

    // 3. FETCH DATA (Example: User Profile)
    getMe: async () => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/me`);
        return response?.data || null;
    },

    // 4. FETCH PLAYLISTS
    getMyPlaylists: async () => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/me/playlists`);
        return response?.data?.items || [];
    },

    // 5. FETCH TOP ARTISTS
    getTopArtists: async () => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/me/top/artists?limit=10`);
        return response?.data?.items || [];
    },

    // 6. FETCH RECENTLY PLAYED
    getRecentlyPlayed: async () => {
        try {
            const response = await SpotifyService.authRequest(`${API_ENDPOINT}/me/player/recently-played?limit=20`);
            return (response?.data?.items || []).map((item: any) => item.track);
        } catch (e) {
            return []; // Fail silently for new users
        }
    },

    // 7. FETCH NEW RELEASES
    getNewReleases: async () => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/browse/new-releases?country=IN&limit=10`);
        return response?.data?.albums?.items || [];
    },

    // 8. SEARCH
    searchTracks: async (query: string) => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/search?q=${encodeURIComponent(query)}&type=track&limit=20`);
        return response?.data?.tracks?.items || [];
    },

    getTopTracks: async () => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/me/top/tracks?limit=20`);
        return response?.data?.items || [];
    },

    getCategories: async () => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/browse/categories?limit=20`);
        return response?.data?.categories?.items || [];
    },

    getFeaturedPlaylists: async () => {
        try {
            const response = await SpotifyService.authRequest(`${API_ENDPOINT}/browse/featured-playlists?country=IN&limit=10`);
            return response?.data?.playlists?.items || [];
        } catch (e) {
            return []; // Fail silently
        }
    },

    getRecommendations: async (seedTracks: string[]) => {
        const seeds = seedTracks.slice(0, 5).join(',');
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/recommendations?seed_tracks=${seeds}&limit=20`);
        return response?.data?.tracks || [];
    },

    getPlaylist: async (id: string) => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/playlists/${id}`);
        return response?.data || null;
    },

    getSavedTracks: async () => {
        const response = await SpotifyService.authRequest(`${API_ENDPOINT}/me/tracks?limit=50`);
        return response?.data?.items ? response.data.items.map((i: any) => ({ ...i.track, added_at: i.added_at })) : [];
    },

    removeTracksFromPlaylist: async (playlistId: string, uris: string[]) => {
        const token = await SpotifyService.getToken();
        if (!token) return;
        await CapacitorHttp.delete({
            url: `${API_ENDPOINT}/playlists/${playlistId}/tracks`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: { tracks: uris.map(uri => ({ uri })) }
        });
    },

    addTracksToPlaylist: async (playlistId: string, uris: string[]) => {
        const token = await SpotifyService.getToken();
        if (!token) return;
        await CapacitorHttp.post({
            url: `${API_ENDPOINT}/playlists/${playlistId}/tracks`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: { uris }
        });
    },

    toggleLike: async (id: string, isLiked: boolean) => {
        const token = await SpotifyService.getToken();
        if (!token) return;
        if (isLiked) {
            await CapacitorHttp.delete({
                url: `${API_ENDPOINT}/me/tracks?ids=${id}`,
                headers: { Authorization: `Bearer ${token}` }
            });
        } else {
            await CapacitorHttp.put({
                url: `${API_ENDPOINT}/me/tracks`,
                headers: { Authorization: `Bearer ${token}` },
                data: { ids: [id] }
            });
        }
    }
};
