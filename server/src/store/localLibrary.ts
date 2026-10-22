import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Playlist, Track } from '../plugins/interfaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../local_library.json');

interface LibraryData {
    playlists: Playlist[];
    likedTracks: Track[];
}

const CURATED_DEFAULT_PLAYLISTS: Playlist[] = [
    {
        id: 'late-night-drive',
        name: 'Late Night Drive',
        description: 'Chill songs for city nights',
        images: [{ url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500' }],
        owner: { id: 'slothify', display_name: 'Slothify' },
        tracks: {
            total: 3,
            items: [
                {
                    track: {
                        id: 'track_midnight_city',
                        uri: 'spotify:track:track_midnight_city',
                        name: 'Midnight City',
                        artists: [{ name: 'M83' }],
                        album: { name: "Hurry Up, We're Dreaming", images: [{ url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500' }] },
                        duration_ms: 243000
                    },
                    added_at: new Date().toISOString()
                },
                {
                    track: {
                        id: 'track_nightcall',
                        uri: 'spotify:track:track_nightcall',
                        name: 'Nightcall',
                        artists: [{ name: 'Kavinsky' }],
                        album: { name: 'OutRun', images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' }] },
                        duration_ms: 259000
                    },
                    added_at: new Date().toISOString()
                },
                {
                    track: {
                        id: 'track_starboy',
                        uri: 'spotify:track:track_starboy',
                        name: 'Starboy',
                        artists: [{ name: 'The Weeknd & Daft Punk' }],
                        album: { name: 'Starboy', images: [{ url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' }] },
                        duration_ms: 230000
                    },
                    added_at: new Date().toISOString()
                }
            ]
        }
    },
    {
        id: 'acoustic-mornings',
        name: 'Acoustic Mornings',
        description: 'Soft, calm & beautiful acoustic strings',
        images: [{ url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500' }],
        owner: { id: 'slothify', display_name: 'Slothify' },
        tracks: {
            total: 3,
            items: [
                {
                    track: {
                        id: 'track_coastline',
                        uri: 'spotify:track:track_coastline',
                        name: 'Coastline',
                        artists: [{ name: 'Hollow Coves' }],
                        album: { name: 'Wanderlust', images: [{ url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500' }] },
                        duration_ms: 235000
                    },
                    added_at: new Date().toISOString()
                },
                {
                    track: {
                        id: 'track_another_love',
                        uri: 'spotify:track:track_another_love',
                        name: 'Another Love',
                        artists: [{ name: 'Tom Odell' }],
                        album: { name: 'Long Way Down', images: [{ url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500' }] },
                        duration_ms: 244000
                    },
                    added_at: new Date().toISOString()
                },
                {
                    track: {
                        id: 'track_heading_home',
                        uri: 'spotify:track:track_heading_home',
                        name: 'Heading Home',
                        artists: [{ name: 'Zach Bryan' }],
                        album: { name: 'Quiet Heavy Dreams', images: [{ url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500' }] },
                        duration_ms: 215000
                    },
                    added_at: new Date().toISOString()
                }
            ]
        }
    },
    {
        id: 'heartbreak-diaries',
        name: 'Heartbreak Diaries',
        description: 'Emotional melodies for quiet moments',
        images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' }],
        owner: { id: 'slothify', display_name: 'Slothify' },
        tracks: {
            total: 2,
            items: [
                {
                    track: {
                        id: 'track_video_games',
                        uri: 'spotify:track:track_video_games',
                        name: 'Video Games',
                        artists: [{ name: 'Lana Del Rey' }],
                        album: { name: 'Born to Die', images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' }] },
                        duration_ms: 282000
                    },
                    added_at: new Date().toISOString()
                },
                {
                    track: {
                        id: 'track_when_the_party',
                        uri: 'spotify:track:track_when_the_party',
                        name: "when the party's over",
                        artists: [{ name: 'Billie Eilish' }],
                        album: { name: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', images: [{ url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500' }] },
                        duration_ms: 196000
                    },
                    added_at: new Date().toISOString()
                }
            ]
        }
    },
    {
        id: 'good-vibes',
        name: 'Good Vibes',
        description: 'Feel-good anthems to lift your mood',
        images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500' }],
        owner: { id: 'slothify', display_name: 'Slothify' },
        tracks: {
            total: 2,
            items: [
                {
                    track: {
                        id: 'track_sunflower',
                        uri: 'spotify:track:track_sunflower',
                        name: 'Sunflower',
                        artists: [{ name: 'Post Malone & Swae Lee' }],
                        album: { name: 'Spider-Man: Into the Spider-Verse', images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500' }] },
                        duration_ms: 158000
                    },
                    added_at: new Date().toISOString()
                },
                {
                    track: {
                        id: 'track_blinding_lights',
                        uri: 'spotify:track:track_blinding_lights',
                        name: 'Blinding Lights',
                        artists: [{ name: 'The Weeknd' }],
                        album: { name: 'After Hours', images: [{ url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' }] },
                        duration_ms: 200000
                    },
                    added_at: new Date().toISOString()
                }
            ]
        }
    }
];

class LocalLibraryStore {
    private data: LibraryData = {
        playlists: [
            {
                id: 'local_favorites',
                name: 'My Favorites',
                description: 'Personal favorite songs collection',
                images: [],
                owner: { id: 'me', display_name: 'Slothify Listener' },
                tracks: { total: 0, items: [] }
            }
        ],
        likedTracks: []
    };

    constructor() {
        this.load();
    }

    private load() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const raw = fs.readFileSync(DATA_FILE, 'utf-8');
                this.data = JSON.parse(raw);
            }
        } catch (e) {
            console.warn('[LocalLibraryStore] Could not load local library file, using in-memory store:', e);
        }
    }

    private save() {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (e) {
            console.warn('[LocalLibraryStore] Could not save local library file:', e);
        }
    }

    getPlaylists(): Playlist[] {
        return this.data.playlists;
    }

    getPlaylist(id: string): Playlist | undefined {
        const found = this.data.playlists.find(p => p.id === id);
        if (found) return found;
        return CURATED_DEFAULT_PLAYLISTS.find(p => p.id === id);
    }

    createPlaylist(name: string, description: string = 'Created in Slothify'): Playlist {
        const newPlaylist: Playlist = {
            id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name,
            description,
            images: [], // No initial poster!
            owner: { id: 'me', display_name: 'Slothify Listener' },
            tracks: { total: 0, items: [] }
        };
        this.data.playlists.push(newPlaylist);
        this.save();
        return newPlaylist;
    }

    importPlaylist(playlist: Playlist): Playlist {
        const id = playlist.id || `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const existingIndex = this.data.playlists.findIndex(p => p.id === id || p.name.toLowerCase() === playlist.name.toLowerCase());

        const imported: Playlist = {
            id,
            name: playlist.name || 'Imported Playlist',
            description: playlist.description || 'Imported from Spotify',
            images: playlist.images && playlist.images.length > 0
                ? playlist.images
                : [],
            owner: playlist.owner || { id: 'spotify', display_name: 'Spotify' },
            tracks: {
                total: playlist.tracks?.items?.length || playlist.tracks?.total || 0,
                items: (playlist.tracks?.items || []).map(i => ({
                    track: i.track,
                    added_at: i.added_at || new Date().toISOString()
                }))
            }
        };

        if (existingIndex >= 0) {
            this.data.playlists[existingIndex] = imported;
        } else {
            this.data.playlists.unshift(imported);
        }
        this.save();
        return imported;
    }

    addTracksToPlaylist(playlistId: string, tracksOrUris: string[], passedTrack?: Track): Playlist | null {
        const playlist = this.getPlaylist(playlistId);
        if (!playlist) return null;

        if (!playlist.tracks.items) {
            playlist.tracks.items = [];
        }

        const rawUris = (tracksOrUris || []).filter(Boolean);
        if (passedTrack && passedTrack.id && !rawUris.some(u => u.includes(passedTrack.id))) {
            rawUris.unshift(passedTrack.uri || `spotify:track:${passedTrack.id}`);
        }

        for (const uri of rawUris) {
            if (!uri || typeof uri !== 'string') continue;
            const trackId = uri.replace('spotify:track:', '');
            // Check if track already in playlist
            const exists = playlist.tracks.items.some(i => i.track.id === trackId);
            if (!exists) {
                const trackItem: Track = (passedTrack && passedTrack.id === trackId) ? passedTrack : {
                    id: trackId,
                    uri: `spotify:track:${trackId}`,
                    name: 'Track ' + trackId,
                    artists: [{ name: 'Artist' }],
                    album: {
                        name: 'Album',
                        images: []
                    },
                    duration_ms: 180000
                };
                playlist.tracks.items.push({ track: trackItem, added_at: new Date().toISOString() });
            }
        }

        playlist.tracks.total = playlist.tracks.items.length;

        // Spotify style poster: 4-song collage when >= 4 tracks, 1st song art when 1-3, empty when 0
        const albumArtList = playlist.tracks.items
            .map(i => i.track?.album?.images?.[0]?.url)
            .filter(Boolean) as string[];

        if (albumArtList.length >= 4) {
            playlist.images = albumArtList.slice(0, 4).map(url => ({ url }));
        } else if (albumArtList.length > 0) {
            playlist.images = [{ url: albumArtList[0] }];
        } else {
            playlist.images = [];
        }

        this.save();
        return playlist;
    }

    removeTracksFromPlaylist(playlistId: string, uris: string[]): Playlist | null {
        const playlist = this.getPlaylist(playlistId);
        if (!playlist || !playlist.tracks.items) return null;

        const rawUris = (uris || []).filter(Boolean);
        const idsToRemove = new Set(rawUris.map(u => typeof u === 'string' ? u.replace('spotify:track:', '') : ''));
        playlist.tracks.items = playlist.tracks.items.filter(item => !idsToRemove.has(item.track.id));
        playlist.tracks.total = playlist.tracks.items.length;

        // Update poster: 4-cover collage if >= 4, 1st song if 1-3, empty if 0
        const albumArtList = playlist.tracks.items
            .map(i => i.track?.album?.images?.[0]?.url)
            .filter(Boolean) as string[];

        if (albumArtList.length >= 4) {
            playlist.images = albumArtList.slice(0, 4).map(url => ({ url }));
        } else if (albumArtList.length > 0) {
            playlist.images = [{ url: albumArtList[0] }];
        } else {
            playlist.images = [];
        }

        this.save();
        return playlist;
    }

    deletePlaylist(id: string): boolean {
        const initialLen = this.data.playlists.length;
        this.data.playlists = this.data.playlists.filter(p => p.id !== id);
        if (this.data.playlists.length !== initialLen) {
            this.save();
            return true;
        }
        return false;
    }

    getLikedTracks(): { items: Track[]; total: number } {
        return {
            items: this.data.likedTracks,
            total: this.data.likedTracks.length
        };
    }

    toggleLikedTrack(track: Track): { liked: boolean; total: number } {
        const index = this.data.likedTracks.findIndex(t => t.id === track.id);
        let liked = false;
        if (index >= 0) {
            this.data.likedTracks.splice(index, 1);
            liked = false;
        } else {
            this.data.likedTracks.unshift(track);
            liked = true;
        }
        this.save();
        return { liked, total: this.data.likedTracks.length };
    }
}

export const localLibrary = new LocalLibraryStore();
