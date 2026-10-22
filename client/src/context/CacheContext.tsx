import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CacheState {
    homeData: any | null;
    recommendations: any[] | null;
    recommendationInfo?: { personalizedFor?: string; source?: string } | null;
    libraryPlaylists: any[] | null;
    playlistDetails: Record<string, any>; // Cache by ID
    albumsData: any[] | null;
    albumDetails: Record<string, any>;
    artistsData: any[] | null;
}

interface CacheContextType {
    cache: CacheState;
    setHomeData: (data: any) => void;
    setRecommendations: (data: any[] | null, info?: { personalizedFor?: string; source?: string } | null) => void;
    setLibraryPlaylists: (data: any[]) => void;
    setPlaylistDetail: (id: string, data: any) => void;
    removePlaylistFromCache: (id: string) => void;
    setAlbumsData: (data: any[]) => void;
    setAlbumDetail: (id: string, data: any) => void;
    setArtistsData: (data: any[]) => void;
    clearRecommendations: () => void;
    clearCache: () => void;
}

const STORAGE_KEY = 'slothify_browser_cache_v5';

// Check if current session started from a browser reload/F5
const checkIsReload = (): boolean => {
    try {
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
            const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
            return nav?.type === 'reload';
        }
    } catch (e) {}
    return false;
};

const getInitialCache = (): CacheState => {
    const isReload = checkIsReload();

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // If the user refreshed the page, bust recommendations so they get new ones!
            if (isReload) {
                return {
                    ...parsed,
                    homeData: null,
                    recommendations: null,
                };
            }
            return parsed;
        }
    } catch (e) {
        console.warn('Failed to read browser cache from localStorage:', e);
    }

    return {
        homeData: null,
        recommendations: null,
        libraryPlaylists: null,
        playlistDetails: {},
        albumsData: null,
        albumDetails: {},
        artistsData: null,
    };
};

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export const CacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [cache, setCache] = useState<CacheState>(getInitialCache);

    // Persist cache to browser localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        } catch (e) {
            console.warn('Failed to save browser cache to localStorage:', e);
        }
    }, [cache]);

    const setHomeData = (data: any) => setCache(prev => ({ ...prev, homeData: data }));
    const setRecommendations = (data: any[] | null, info?: { personalizedFor?: string; source?: string } | null) =>
        setCache(prev => ({
            ...prev,
            recommendations: data,
            recommendationInfo: info !== undefined ? info : prev.recommendationInfo
        }));
    const setLibraryPlaylists = (data: any[]) => setCache(prev => ({ ...prev, libraryPlaylists: data }));
    const setPlaylistDetail = (id: string, data: any) =>
        setCache(prev => ({ ...prev, playlistDetails: { ...prev.playlistDetails, [id]: data } }));
    const setAlbumsData = (data: any[]) => setCache(prev => ({ ...prev, albumsData: data }));
    const setAlbumDetail = (id: string, data: any) =>
        setCache(prev => ({ ...prev, albumDetails: { ...prev.albumDetails, [id]: data } }));
    const setArtistsData = (data: any[]) => setCache(prev => ({ ...prev, artistsData: data }));

    const removePlaylistFromCache = (id: string) => {
        setCache(prev => {
            const nextDetails = { ...prev.playlistDetails };
            delete nextDetails[id];
            const nextLibrary = prev.libraryPlaylists ? prev.libraryPlaylists.filter(p => p.id !== id) : null;
            return {
                ...prev,
                playlistDetails: nextDetails,
                libraryPlaylists: nextLibrary
            };
        });
    };

    const clearRecommendations = () => {
        setCache(prev => ({ ...prev, homeData: null, recommendations: null, recommendationInfo: null }));
    };

    const clearCache = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('slothify_browser_cache_v2');
            localStorage.removeItem('slothify_video_cache_v3');
            localStorage.removeItem('slothify_saavn_cache_v3');
        } catch (e) {}
        setCache({
            homeData: null,
            recommendations: null,
            recommendationInfo: null,
            libraryPlaylists: null,
            playlistDetails: {},
            albumsData: null,
            albumDetails: {},
            artistsData: null,
        });
    };

    return (
        <CacheContext.Provider
            value={{
                cache,
                setHomeData,
                setRecommendations,
                setLibraryPlaylists,
                setPlaylistDetail,
                removePlaylistFromCache,
                setAlbumsData,
                setAlbumDetail,
                setArtistsData,
                clearRecommendations,
                clearCache
            }}
        >
            {children}
        </CacheContext.Provider>
    );
};

export const useCache = () => {
    const context = useContext(CacheContext);
    if (!context) throw new Error("useCache must be used within a CacheProvider");
    return context;
};
