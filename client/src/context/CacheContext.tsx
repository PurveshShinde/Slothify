import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CacheState {
    homeData: any | null;
    libraryPlaylists: any[] | null;
    playlistDetails: Record<string, any>; // Cache by ID
}

interface CacheContextType {
    cache: CacheState;
    setHomeData: (data: any) => void;
    setLibraryPlaylists: (data: any[]) => void;
    setPlaylistDetail: (id: string, data: any) => void;
    removePlaylistFromCache: (id: string) => void;
    clearCache: () => void;
}

const STORAGE_KEY = 'slothify_browser_cache_v2';

const getInitialCache = (): CacheState => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to read browser cache from localStorage:', e);
    }
    return {
        homeData: null,
        libraryPlaylists: null,
        playlistDetails: {},
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
            console.warn('Failed to save browser cache to localStorage (quota exceeded?):', e);
        }
    }, [cache]);

    const setHomeData = (data: any) => setCache(prev => ({ ...prev, homeData: data }));
    const setLibraryPlaylists = (data: any[]) => setCache(prev => ({ ...prev, libraryPlaylists: data }));
    const setPlaylistDetail = (id: string, data: any) =>
        setCache(prev => ({ ...prev, playlistDetails: { ...prev.playlistDetails, [id]: data } }));

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

    const clearCache = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('slothify_video_cache');
            localStorage.removeItem('slothify_saavn_cache');
        } catch (e) { }
        setCache({
            homeData: null,
            libraryPlaylists: null,
            playlistDetails: {},
        });
    };

    return (
        <CacheContext.Provider value={{ cache, setHomeData, setLibraryPlaylists, setPlaylistDetail, removePlaylistFromCache, clearCache }}>
            {children}
        </CacheContext.Provider>
    );
};

export const useCache = () => {
    const context = useContext(CacheContext);
    if (!context) throw new Error("useCache must be used within a CacheProvider");
    return context;
};
