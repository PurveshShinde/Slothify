import { Track } from '../types/types';
import NyxMusic from '../plugins/NyxMusic';

export const MusicService = {
    getTrending: async (): Promise<Track[]> => {
        return [];
    },

    search: async (query: string): Promise<Track[]> => {
        return [];
    },

    // ✅ STEP 1: Search via Native Layer (Invidious)
    searchVideoId: async (query: string): Promise<string | null> => {
        try {
            console.log(`[MusicService] Searching Native: ${query}`);

            const result = await NyxMusic.search({ query: query + " audio" });

            if (result && result.videoId) {
                console.log(`[MusicService] Found Video ID: ${result.videoId}`);
                return result.videoId;
            }

            console.warn(`[MusicService] No results found for: ${query}`);
            return null;
        } catch (error) {
            console.error("[MusicService] Search Exception:", error);
            return null;
        }
    },

    // ✅ STEP 2: Delegated to Native Layer
    getStreamUrl: async (videoId: string): Promise<string | null> => {
        if (!videoId) return null;
        // Pass a standard YouTube URL that will be intercepted by the native resolver
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
};
