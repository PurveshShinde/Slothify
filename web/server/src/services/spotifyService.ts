import axios from 'axios';

const CLIENT_ID = '4d1e169a8d644f659264ed7f5b338c92';
const CLIENT_SECRET = '5852aa65d611427e89db9193be801fb0';
const REDIRECT_URI = 'http://127.0.0.1:5000/api/auth/callback';

// ✅ FIXED: Real Spotify API Endpoints
const AUTH_URL = 'https://accounts.spotify.com';
const API_URL = 'https://api.spotify.com/v1';

export const spotifyService = {
    getAuthorizeUrl: () => {
        const scopes = 'playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-library-read user-read-email user-read-recently-played user-top-read user-read-private';
        return `${AUTH_URL}/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    },

    exchangeCode: async (code: string) => {
        const response = await axios.post(`${AUTH_URL}/api/token`, new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
    },

    getMe: async (token: string) => {
        const response = await axios.get(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    getMyPlaylists: async (token: string) => {
        const response = await axios.get(`${API_URL}/me/playlists`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data?.items || [];
    },

    getFeaturedPlaylists: async (token: string) => {
        try {
            const response = await axios.get(
                `${API_URL}/browse/featured-playlists`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        limit: 20
                    }
                }
            );
            return response.data?.playlists?.items || [];
        } catch (err: any) {
            console.error('[Spotify] featured-playlists failed', err?.response?.data || err);
            return [];
        }
    },



    searchTracks: async (token: string, query: string) => {
        const response = await axios.get(`${API_URL}/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data?.tracks?.items || [];
    },

    getPlaylist: async (token: string, playlistId: string) => {
        const response = await axios.get(`${API_URL}/playlists/${playlistId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    getPlaylistTracks: async (token: string, playlistId: string) => {
        const response = await axios.get(`${API_URL}/playlists/${playlistId}/tracks`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return (response.data?.items || []).map((item: any) => item.track);
    },

    getMyRecentlyPlayedTracks: async (token: string) => {
        const response = await axios.get(`${API_URL}/me/player/recently-played?limit=20`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return (response.data?.items || []).map((item: any) => item.track);
    },

    getNewReleases: async (token: string) => {
        const response = await axios.get(`${API_URL}/browse/new-releases?limit=20`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data?.albums?.items || [];
    },

    getCategories: async (token: string) => {
        const response = await axios.get(`${API_URL}/browse/categories?limit=20`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data?.categories?.items || [];
    },

    getMyTopArtists: async (token: string) => {
        const response = await axios.get(`${API_URL}/me/top/artists?limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data?.items || [];
    },

    getMyTopTracks: async (token: string) => {
        const response = await axios.get(`${API_URL}/me/top/tracks?limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data?.items || [];
    },

    getCategoryPlaylists: async (token: string, categoryId: string) => {
        const response = await axios.get(`${API_URL}/browse/categories/${categoryId}/playlists?limit=20`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data?.playlists?.items || [];
    },

    getMySavedTracks: async (token: string) => {
        const response = await axios.get(`${API_URL}/me/tracks?limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return (response.data?.items || []).map((item: any) => item.track);
    },

    addTracksToPlaylist: async (token: string, playlistId: string, uris: string[]) => {
        const response = await axios.post(`${API_URL}/playlists/${playlistId}/tracks`, { uris }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    removeTracksFromPlaylist: async (token: string, playlistId: string, uris: string[]) => {
        const response = await axios.delete(`${API_URL}/playlists/${playlistId}/tracks`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { uris: uris.map(uri => ({ uri })) } // Spotify DELETE body format
        });
        return response.data;
    },
    getRecommendations: async (token: string, seedTracks: string[]) => {
        if (!seedTracks.length) return [];
        const response = await axios.get(`${API_URL}/recommendations`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                seed_tracks: seedTracks.slice(0, 5).join(','),
                limit: 20
            }
        });
        return response.data?.tracks || [];
    },
};