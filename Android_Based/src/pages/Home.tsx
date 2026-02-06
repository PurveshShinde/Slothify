
import React, { useState, useEffect } from 'react';
import { Playlist, Track, Artist, Category } from '../types/types';
import { Music2, Settings } from 'lucide-react';
import { SpotifyService } from '../services/SpotifyService';

interface HomeProps {
    isAuthenticated: boolean;
    onPlaylistSelect: (id: string) => void;
    onSettingsClick: () => void;
    onSearch: (query: string) => void;
    onPlayTrack: (track: Track) => void;
}

interface SectionProps {
    title: string;
    items: any[];
    renderItem: (item: any) => React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, items, renderItem }) => {
    if (!items || items.length === 0) return null;
    return (
        <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight px-1 text-white">{title}</h2>
            <div className="flex space-x-4 md:space-x-6 overflow-x-auto pb-6 scrollbar-hide px-1 snap-x">
                {items.map((item, idx) => (
                    <div key={idx /* Use index to avoid duplicates from API */} className="snap-start flex-shrink-0">
                        {renderItem(item)}
                    </div>
                ))}
            </div>
        </section>
    );
};

const Home: React.FC<HomeProps> = ({ isAuthenticated, onPlaylistSelect, onSearch, onPlayTrack, onSettingsClick }) => {
    const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
    const [featuredPlaylists, setFeaturedPlaylists] = useState<Playlist[]>([]);
    const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
    const [newReleases, setNewReleases] = useState<any[]>([]); // Albums
    const [topArtists, setTopArtists] = useState<Artist[]>([]);
    const [topTracks, setTopTracks] = useState<Track[]>([]);
    const [recommendations, setRecommendations] = useState<Track[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        if (isAuthenticated) {
            setIsLoading(true);

            // 1. Get User Profile
            SpotifyService.getMe().then(u => setUser(u)).catch(err => console.warn('User fetch failed', err));

            const fetchAllData = async () => {
                try {
                    // We use allSettled to prevent one failure from blocking others
                    // Some failures (like recent-played 500) will just result in empty section
                    const [recentRes, featuredRes, userRes, newRes, artistsRes, catsRes, topTracksRes] = await Promise.allSettled([
                        SpotifyService.getRecentlyPlayed(),
                        SpotifyService.getFeaturedPlaylists(),
                        SpotifyService.getMyPlaylists(),
                        SpotifyService.getNewReleases(),
                        SpotifyService.getTopArtists(),
                        SpotifyService.getCategories(),
                        SpotifyService.getTopTracks(),
                    ]);

                    if (recentRes.status === 'fulfilled') setRecentlyPlayed(recentRes.value);
                    if (featuredRes.status === 'fulfilled') setFeaturedPlaylists(featuredRes.value);
                    if (userRes.status === 'fulfilled') setUserPlaylists(userRes.value);
                    if (newRes.status === 'fulfilled') setNewReleases(newRes.value);
                    if (artistsRes.status === 'fulfilled') setTopArtists(artistsRes.value);
                    if (catsRes.status === 'fulfilled') setCategories(catsRes.value);
                    if (topTracksRes.status === 'fulfilled') setTopTracks(topTracksRes.value);

                    let seedTracks: string[] = [];
                    if (recentRes.status === 'fulfilled' && recentRes.value.length) {
                        seedTracks = recentRes.value.slice(0, 3).map((t: Track) => t.id);
                    }

                    if (seedTracks.length > 0) {
                        SpotifyService.getRecommendations(seedTracks)
                            .then(res => setRecommendations(res))
                            .catch(console.error);
                    }

                } catch (error) {
                    console.error('Failed to fetch home data', error);
                } finally {
                    setIsLoading(false);
                }
            };

            fetchAllData();
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-in fade-in duration-700 px-4">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-4">
                    <Music2 size={40} className="text-white md:w-12 md:h-12" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white">Welcome to Nyx</h1>
                <p className="text-slate-400 max-w-sm text-sm md:text-base">Login to your Spotify account to sync your library.</p>
                <button
                    onClick={() => window.location.href = SpotifyService.getAuthorizeUrl()}
                    className="px-8 py-3.5 md:px-10 md:py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-600/20 text-sm md:text-base"
                >
                    Login with Spotify
                </button>
            </div>
        );
    }

    const renderCard = (image: string, title: string, subtitle: string, onClick?: () => void, roundImage = false) => (
        <div onClick={onClick} className="w-32 sm:w-36 md:w-44 flex flex-col space-y-2 md:space-y-3 group cursor-pointer">
            <div className={`relative aspect-square ${roundImage ? 'rounded-full' : 'rounded-xl md:rounded-2xl'} overflow-hidden card-shadow bg-[#1A1F2B] `}>
                <img
                    src={image || 'https://picsum.photos/400'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    alt={title}
                    loading="lazy"
                />
                <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none`} />
            </div>
            <div className="px-1 space-y-0.5 md:space-y-1">
                <h3 className={`font-bold text-xs md:text-sm truncate text-white leading-tight ${roundImage ? 'text-center' : ''}`}>{title}</h3>
                <p className={`text-[10px] md:text-[11px] text-slate-400 truncate leading-tight ${roundImage ? 'text-center' : ''}`}>{subtitle}</p>
            </div>
        </div>
    );

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="space-y-8 md:space-y-10 animate-in fade-in duration-500 pb-32 overflow-x-hidden">

            {/* 0. Greeting & Genre Chips */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{getGreeting()}</h1>
                    <button onClick={onSettingsClick} className="p-2 text-slate-400 hover:text-white">
                        <Settings size={28} />
                    </button>
                </div>

                {categories.length > 0 && (
                    <div className="flex space-x-2 md:space-x-3 overflow-x-auto pb-2 scrollbar-hide px-1">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => onSearch(`${cat.name}`)}
                                className="px-4 py-2 md:px-6 md:py-2.5 bg-[#1F2937] hover:bg-[#374151] rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap transition-colors border border-white/5 text-white"
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 1. Stats: Top Artists */}
            <Section
                title="Your Top Artists"
                items={topArtists}
                renderItem={(artist: Artist) => renderCard(
                    artist.images[0]?.url,
                    artist.name,
                    'Artist',
                    () => onSearch(artist.name),
                    true // Round image
                )}
            />

            {/* 1.5 Jump Back In (Top Tracks) */}
            <Section
                title="Jump Back In"
                items={topTracks}
                renderItem={(track: Track) => renderCard(
                    track.album?.images[0]?.url,
                    track.name,
                    track.artists[0].name,
                    () => onPlayTrack(track)
                )}
            />

            {/* 2. Recently Played */}
            <Section
                title="Recently Played"
                items={recentlyPlayed}
                renderItem={(track: Track) => renderCard(
                    track.album?.images[0]?.url,
                    track.name,
                    track.artists.map(a => a.name).join(', '),
                    () => onPlayTrack(track)
                )}
            />

            {/* 3. Made For You */}
            <Section
                title={user ? `Made for ${user.display_name}` : 'Made For You'}
                items={featuredPlaylists.slice(0, 10)}
                renderItem={(pl: Playlist) => renderCard(
                    pl.images[0]?.url,
                    pl.name,
                    pl.description || 'Spotify Mix',
                    () => onPlaylistSelect(pl.id)
                )}
            />

            {/* 3.5 Recommended */}
            <Section
                title="Recommended for You"
                items={recommendations}
                renderItem={(track: Track) => renderCard(
                    track.album?.images[0]?.url,
                    track.name,
                    track.artists[0].name,
                    () => onPlayTrack(track)
                )}
            />

            {/* 4. New Releases */}
            <Section
                title="New Releases"
                items={newReleases}
                renderItem={(album: any) => renderCard(
                    album.images[0]?.url,
                    album.name,
                    `${album.artists[0]?.name} • Album`,
                    () => onSearch(album.name)
                )}
            />

            {/* 5. Your Playlists */}
            <Section
                title="Your Playlists"
                items={userPlaylists}
                renderItem={(pl: Playlist) => renderCard(
                    pl.images[0]?.url,
                    pl.name,
                    `By ${pl.owner.display_name}`,
                    () => onPlaylistSelect(pl.id)
                )}
            />

            {isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-1">
                    {[1, 2, 3, 4].map(i => <div key={i} className="aspect-square bg-slate-900 rounded-2xl animate-pulse" />)}
                </div>
            )}
        </div>
    );
};

export default Home;
