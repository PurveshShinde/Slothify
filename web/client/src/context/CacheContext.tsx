import React, { createContext, useContext, useState, ReactNode } from 'react';

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
    clearCache: () => void;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export const CacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [cache, setCache] = useState<CacheState>({
        homeData: null,
        libraryPlaylists: null,
        playlistDetails: {},
    });

    const setHomeData = (data: any) => setCache(prev => ({ ...prev, homeData: data }));
    const setLibraryPlaylists = (data: any[]) => setCache(prev => ({ ...prev, libraryPlaylists: data }));
    const setPlaylistDetail = (id: string, data: any) =>
        setCache(prev => ({ ...prev, playlistDetails: { ...prev.playlistDetails, [id]: data } }));

    const clearCache = () => setCache({
        homeData: null,
        libraryPlaylists: null,
        playlistDetails: {},
    });

    return (
        <CacheContext.Provider value={{ cache, setHomeData, setLibraryPlaylists, setPlaylistDetail, clearCache }}>
            {children}
        </CacheContext.Provider>
    );
};

export const useCache = () => {
    const context = useContext(CacheContext);
    if (!context) throw new Error("useCache must be used within a CacheProvider");
    return context;
};
