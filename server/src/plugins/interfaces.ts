import type { Request, Response } from 'express';

export interface Track {
    id: string;
    uri: string;
    name: string;
    artists: { name: string }[];
    album: {
        name: string;
        images: { url: string }[];
    };
    duration_ms: number;
    preview_url?: string | null;
}

export interface Playlist {
    id: string;
    name: string;
    description: string;
    images: { url: string }[];
    owner: {
        id: string;
        display_name: string;
        images?: { url: string }[];
    };
    tracks: {
        total: number;
        items?: { track: Track; added_at?: string }[];
    };
}

export interface Artist {
    id: string;
    name: string;
    images: { url: string }[];
    genres: string[];
    followers?: { total: number };
}

export interface Category {
    id: string;
    name: string;
    icons: { url: string }[];
}

export interface AudioSearchResult {
    videoId: string;
    title: string;
    duration: number;
    thumbnail: string;
    streamToken?: string;
}

export interface MetadataPlugin {
    readonly name: string;
    searchTracks(query: string, limit?: number): Promise<Track[]>;
    getPlaylist(playlistId: string): Promise<Playlist>;
    getPlaylistTracks(playlistId: string): Promise<Track[]>;
    getFeaturedPlaylists(): Promise<Playlist[]>;
    getNewReleases(): Promise<any[]>;
    getTopArtists(limit?: number): Promise<Artist[]>;
    getTopTracks(): Promise<Track[]>;
    getCategories(): Promise<Category[]>;
    getCategoryPlaylists(categoryId: string): Promise<Playlist[]>;
    getRecommendations?(seedTracks: string[]): Promise<Track[]>;
    getSmartMoodSuggestions?(trackName: string, artistName: string): Promise<Track[]>;
    searchArtists?(query: string, limit?: number): Promise<Artist[]>;
    getArtistTracks?(artistId: string, artistName?: string): Promise<Track[]>;
}

export interface AudioPlugin {
    readonly name: string;
    search(query: string): Promise<AudioSearchResult>;
    stream(videoId: string, req: Request, res: Response): Promise<void>;
    preload?(videoId: string): Promise<void>;
}

