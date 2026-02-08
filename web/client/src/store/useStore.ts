import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Track, Playlist, Artist, Category } from '../types';

interface HomeData {
    recentlyPlayed: Track[];
    featuredPlaylists: Playlist[];
    userPlaylists: Playlist[];
    newReleases: any[];
    topArtists: Artist[];
    topTracks: Track[];
    categories: Category[];
    recommendations: Track[];
    timestamp: number;
}

interface AppState {
    // Auth & User
    isAuthenticated: boolean;
    user: User | null;
    setIsAuthenticated: (status: boolean) => void;
    setUser: (user: User | null) => void;

    // Playback State
    currentTrack: Track | null;
    queue: Track[];
    originalQueue: Track[]; // For un-shuffling
    isPlaying: boolean;
    volume: number;
    isMuted: boolean;
    isShuffle: boolean;
    repeatMode: 'off' | 'all' | 'one';

    // UI State
    isPlayerExpanded: boolean;
    isQueueVisible: boolean;
    progress: number;
    duration: number;
    homeData: HomeData;

    // Actions
    setCurrentTrack: (track: Track | null) => void;
    setQueue: (queue: Track[]) => void;
    setIsPlaying: (playing: boolean) => void;
    setVolume: (volume: number) => void;
    setProgress: (progress: number) => void;
    setDuration: (duration: number) => void;
    setIsMuted: (muted: boolean) => void;
    toggleShuffle: () => void;
    setRepeatMode: (mode: 'off' | 'all' | 'one') => void;
    setIsPlayerExpanded: (expanded: boolean) => void;
    setIsQueueVisible: (visible: boolean) => void;
    playTrack: (track: Track, newQueue?: Track[]) => void;
    skipForward: () => void;
    skipBack: () => void;
    setHomeData: (data: Partial<HomeData>) => void;

    // Liked
    likedTrackIds: Set<string>;
    toggleLike: (trackId: string) => void;

    // Seek
    seekRequest: number | null;
    requestSeek: (time: number | null) => void;
    isSeeking: boolean;
    setIsSeeking: (seeking: boolean) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            isAuthenticated: false,
            user: null,
            setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
            setUser: (user) => set({ user }),

            currentTrack: null,
            queue: [],
            originalQueue: [],
            isPlaying: false,
            volume: 0.8,
            isMuted: false,
            isShuffle: false,
            repeatMode: 'off',
            isPlayerExpanded: false,
            isQueueVisible: false,
            progress: 0,
            duration: 0,
            homeData: {
                recentlyPlayed: [],
                featuredPlaylists: [],
                userPlaylists: [],
                newReleases: [],
                topArtists: [],
                topTracks: [],
                categories: [],
                recommendations: [],
                timestamp: 0
            },

            setCurrentTrack: (track) => set({ currentTrack: track }),
            setQueue: (queue) => set({ queue, originalQueue: queue }),
            setIsPlaying: (isPlaying) => set({ isPlaying }),
            setVolume: (volume) => set({ volume }),
            setProgress: (progress) => set({ progress }),
            setDuration: (duration) => set({ duration }),
            setIsMuted: (isMuted) => set({ isMuted }),
            setIsPlayerExpanded: (isPlayerExpanded) => set({ isPlayerExpanded }),
            setIsQueueVisible: (isQueueVisible) => set({ isQueueVisible }),
            setHomeData: (data) => set((state) => ({ homeData: { ...state.homeData, ...data } })),

            toggleShuffle: () => set((state) => {
                const newShuffle = !state.isShuffle;
                if (newShuffle) {
                    // Shuffle Logic
                    const shuffled = [...state.queue];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    return { isShuffle: true, queue: shuffled, originalQueue: state.queue };
                } else {
                    // Un-shuffle (Restore original queue order)
                    return { isShuffle: false, queue: state.originalQueue };
                }
            }),

            setRepeatMode: (repeatMode) => set({ repeatMode }),

            playTrack: (track, newQueue) => {
                set((state) => ({
                    currentTrack: track,
                    isPlaying: true,
                    queue: newQueue ? newQueue : state.queue,
                    originalQueue: newQueue ? newQueue : state.originalQueue
                }));
            },

            skipForward: () => {
                const { queue, currentTrack, repeatMode } = get();
                if (!currentTrack || queue.length === 0) return;

                const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
                let nextIndex = (currentIndex + 1) % queue.length;

                // If repeat is off and we're at the end, stop
                if (repeatMode === 'off' && currentIndex === queue.length - 1) {
                    set({ isPlaying: false });
                    return;
                }

                set({ currentTrack: queue[nextIndex], isPlaying: true });
            },

            skipBack: () => {
                const { queue, currentTrack } = get();
                if (!currentTrack || queue.length === 0) return;

                const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
                const prevIndex = (currentIndex - 1 + queue.length) % queue.length;

                set({ currentTrack: queue[prevIndex], isPlaying: true });
            },

            // Liked Tracks
            likedTrackIds: new Set(),
            toggleLike: (trackId) => set((state) => {
                const newSet = new Set(state.likedTrackIds);
                if (newSet.has(trackId)) newSet.delete(trackId);
                else newSet.add(trackId);
                return { likedTrackIds: newSet };
            }),

            // Global Seek Control
            seekRequest: null,
            requestSeek: (time) => set({ seekRequest: time }),

            isSeeking: false,
            setIsSeeking: (isSeeking) => set({ isSeeking }),
        }),
        {
            name: 'nyx-storage', // unique name
            partialize: (state) => ({
                volume: state.volume,
                isShuffle: state.isShuffle,
                repeatMode: state.repeatMode
            }), // Only persist preferences
        }
    )
);
