import type { MetadataPlugin, Track, Playlist, Artist, Category } from '../interfaces.js';

import {
    scrapeSpotifyPlaylistEmbed,
    scrapeSpotifyAlbumEmbed
} from './spotify/scrapers/playlistAlbumScraper.js';
import { searchAlbums as searchSpotifyAlbums } from './spotify/search/albumSearch.js';
import { searchTracks as searchSpotifyTracks } from './spotify/search/trackSearch.js';
import { getNewReleases } from './spotify/discovery/newReleases.js';
import {
    getTopArtists,
    searchArtists,
    getArtistTracks,
    getArtistDetails,
    resolveArtistImage
} from './spotify/artists/artistExploration.js';
import {
    getFeaturedPlaylists,
    getTopTracks,
    getCategories,
    getCategoryPlaylists,
    getRecommendations,
    getSmartMoodSuggestions
} from './spotify/discovery/discovery.js';

// Curated popular Spotify playlists for home / featured views & import discovery
export { POPULAR_SPOTIFY_PLAYLISTS } from './spotify/catalogs/curatedPlaylists.js';
import { POPULAR_SPOTIFY_PLAYLISTS } from './spotify/catalogs/curatedPlaylists.js';

export {
    stringSimilarity,
    calculateSimilarity,
    isArtistNameMatch,
    calculateArtistRelevanceScore
} from './spotify/utils/similarityUtils.js';

export {
    normalizePlayCountToPopularity,
    scoreTrackRelevance,
    deduplicateTracks
} from './spotify/ranking/trackRanking.js';

export { getSpotubeSpotifyToken } from './spotify/auth/spotubeAuth.js';
export { searchYouTubeInnertubeTracks } from './spotify/scrapers/youtubeSearch.js';

export type { SpotifyArtistOverviewData } from './spotify/clients/spotifyGqlClient.js';
export {
    searchSpotubeSpotifyTracks,
    searchSpotifyArtists,
    fetchSpotifyArtistOverview
} from './spotify/clients/spotifyGqlClient.js';

export {
    resolveSpotifyTrackCover,
    scrapeSpotifyArtistEmbed
} from './spotify/scrapers/spotifyEmbedScraper.js';

export {
    resolveSpotifyArtistId
} from './spotify/artists/artistResolution.js';

/**
 * SpotifyScraperPlugin: Coordinator plugin delegating to focused, modular Spotify subsystems
 */
export class SpotifyScraperPlugin implements MetadataPlugin {
    readonly name = 'SpotifyScraper';

    getCuratedPlaylists(limit: number = 20) {
        return POPULAR_SPOTIFY_PLAYLISTS.slice(0, limit);
    }

    /**
     * Scrape playlist data from Spotify embed with in-memory caching and resilient local fallback
     */
    async getPlaylist(playlistId: string): Promise<Playlist> {
        return scrapeSpotifyPlaylistEmbed(playlistId);
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        const playlist = await this.getPlaylist(playlistId);
        return (playlist.tracks.items || []).map(item => item.track);
    }

    /**
     * Scrape album metadata and all tracks from Spotify embed
     */
    async getAlbum(albumId: string): Promise<any> {
        return scrapeSpotifyAlbumEmbed(albumId);
    }

    /**
     * Real-time search for albums across Spotify and Apple Music catalogs
     */
    async searchAlbums(query: string, limit: number = 20): Promise<any[]> {
        return searchSpotifyAlbums(query, limit);
    }

    /**
     * Search tracks using Dual-Engine Search (Spotify Pathfinder + JioSaavn)
     */
    async searchTracks(query: string, limit: number = 20): Promise<Track[]> {
        return searchSpotifyTracks(query, limit);
    }

    /**
     * Get featured playlists
     */
    async getFeaturedPlaylists(): Promise<Playlist[]> {
        return getFeaturedPlaylists();
    }

    /**
     * Get authentic, real-time new releases and top chart albums from live public APIs
     */
    async getNewReleases(): Promise<any[]> {
        return getNewReleases();
    }

    /**
     * Get top artists:
     * Flagship global chart artists each with their own unique official HD portrait.
     */
    async getTopArtists(limit: number = 50): Promise<Artist[]> {
        return getTopArtists(limit);
    }

    /**
     * Real-time Artist Search:
     * Strictly returns artists whose names match the search query, ranked by follower count descending
     */
    async searchArtists(query: string, limit: number = 25): Promise<Artist[]> {
        return searchArtists(query, limit);
    }

    /**
     * Get Artist Top Tracks:
     * Discovers an artist's top playable songs across Spotify & YouTube,
     * strictly verifying that tracks belong to the requested artist and eliminating
     * unrelated songs, tribute covers, and duplicate releases.
     */
    async getArtistTracks(artistId: string, artistName?: string): Promise<Track[]> {
        return getArtistTracks(artistId, artistName);
    }

    /**
     * Get Artist Profile Details:
     * Unified single source of truth for artist portrait, followers, and bio
     */
    async getArtistDetails(artistId: string, artistName?: string): Promise<any> {
        return getArtistDetails(artistId, artistName);
    }

    /**
     * Resolve artist image URL
     */
    async resolveArtistImage(artistName: string): Promise<string> {
        return resolveArtistImage(artistName);
    }

    /**
     * Get top tracks
     */
    async getTopTracks(): Promise<Track[]> {
        return getTopTracks();
    }

    /**
     * Browse categories
     */
    async getCategories(): Promise<Category[]> {
        return getCategories();
    }

    /**
     * Category playlists
     */
    async getCategoryPlaylists(categoryId: string): Promise<Playlist[]> {
        return getCategoryPlaylists(categoryId);
    }

    /**
     * Recommendations based on seed tracks
     */
    async getRecommendations(seedTracks: string[]): Promise<Track[]> {
        return getRecommendations(seedTracks);
    }

    /**
     * Smart Mood Suggestions:
     * Discovers songs matching the mood, style, and sonic cluster of the current track & artist using Spotify & YouTube
     */
    async getSmartMoodSuggestions(trackName: string, artistName: string): Promise<Track[]> {
        return getSmartMoodSuggestions(trackName, artistName);
    }
}
