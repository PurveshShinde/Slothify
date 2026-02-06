
import React, { useEffect, useState, useMemo } from 'react';
import {
    Search as SearchIcon, ChevronLeft, ArrowUpDown, Heart, Trash2, Play, Pause,
    Clock3, MoreHorizontal, Download, Shuffle, MoreVertical
} from 'lucide-react';
import { Playlist, Track } from '../types/types';
import { SpotifyService } from '../services/SpotifyService';

type SortOption = 'az' | 'za' | 'newest' | 'oldest' | 'duration' | 'artist';

interface ExtendedTrack extends Track {
    added_at?: string;
}

interface PlaylistDetailProps {
    id: string;
    isLikedView?: boolean;
    onBack: () => void;
    onPlayTrack: (track: Track, fromQueue: Track[]) => void;
    // onDownloadRequest: (id: string) => void; // Removed - not implemented yet
    likedTrackIds?: Set<string>; // Made optional for now
    onToggleLike?: (id: string) => void; // Made optional

    // ✅ SYNCED PROPS
    isPlaying?: boolean;
    onPlayPause?: (playing: boolean) => void;
    isShuffle?: boolean;
    onToggleShuffle?: () => void;
    currentTrackId?: string;

    title?: string;
}

const PlaylistDetail: React.FC<PlaylistDetailProps> = ({
    id, isLikedView, onBack, onPlayTrack, likedTrackIds = new Set(), onToggleLike = () => { }, currentTrackId,
    isPlaying = false, onPlayPause = () => { }, isShuffle = false, onToggleShuffle = () => { }
}) => {
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [tracks, setTracks] = useState<ExtendedTrack[]>([]);
    const [filterQuery, setFilterQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('az');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                SpotifyService.getMe().then(u => setCurrentUser(u)).catch(() => { });

                if (!isLikedView) {
                    const data = await SpotifyService.getPlaylist(id);
                    setPlaylist(data);
                    if (data.tracks?.items) {
                        setTracks(data.tracks.items.filter((i: any) => i.track).map((i: any) => ({ ...i.track, added_at: i.added_at })));
                    }
                } else {
                    const saved = await SpotifyService.getSavedTracks();
                    setTracks(saved);
                    setPlaylist({ id: 'liked', name: 'Liked Songs', description: 'Your saved tracks', images: [], owner: { display_name: 'You', id: 'me' }, tracks: { items: [], total: 0 } } as any);
                }
            } catch (err) { console.error(err); } finally { setIsLoading(false); }
        };
        fetchData();
    }, [id, isLikedView]);

    const removeTrack = async (track: Track, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!playlist || isLikedView) return;

        if (confirm(`Remove "${track.name}" from this playlist?`)) {
            try {
                await SpotifyService.removeTracksFromPlaylist(playlist.id, [track.uri]);
                setTracks(prev => prev.filter(t => t.id !== track.id));
            } catch (err) {
                console.error("Failed to remove track", err);
            }
        }
    };

    const sortedAndFilteredTracks = useMemo(() => {
        let list = [...tracks];
        if (filterQuery.trim()) {
            const q = filterQuery.toLowerCase();
            list = list.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.artists.some(a => a.name.toLowerCase().includes(q))
            );
        }
        list.sort((a, b) => {
            switch (sortBy) {
                case 'az': return a.name.localeCompare(b.name);
                case 'za': return b.name.localeCompare(a.name);
                case 'duration': return a.duration_ms - b.duration_ms;
                case 'artist': return a.artists[0].name.localeCompare(b.artists[0].name);
                default: return 0;
            }
        });
        return list;
    }, [tracks, filterQuery, sortBy]);

    const formatDuration = (ms: number) => {
        const min = Math.floor(ms / 60000);
        const sec = Math.floor((ms % 60000) / 1000);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const isOwner = playlist?.owner?.id === currentUser?.id;
    const gradientColor = isLikedView ? 'from-purple-900/80' : 'from-slate-800/80';
    const isThisPlaylistPlaying = tracks.some(t => t.id === currentTrackId);

    // ✅ MAIN BUTTON LOGIC
    const handleMainPlayClick = () => {
        if (isThisPlaylistPlaying) {
            onPlayPause(!isPlaying); // Toggle global play/pause
        } else {
            if (tracks.length > 0) onPlayTrack(tracks[0], tracks);
        }
    };

    // Helper to safely get the owner image
    const getOwnerImage = () => {
        if (!playlist?.owner) return null;
        const img = (playlist.owner as any).images?.[0]?.url || (playlist.owner as any).photos?.[0]?.value;
        return img;
    };
    const ownerImage = getOwnerImage();

    return (
        <div className={`flex flex-col h-full animate-in fade-in duration-500 bg-gradient-to-b ${gradientColor} to-slate-950`}>
            {/* HEADER */}
            <div className="relative flex flex-col md:flex-row gap-6 p-6 pb-4 md:pb-8">
                <button onClick={onBack} className="absolute top-4 left-4 p-2 text-white z-20"><ChevronLeft size={28} /></button>
                <div className="flex-shrink-0 mx-auto md:mx-0 mt-8 md:mt-0 shadow-2xl">
                    {isLikedView ? (
                        <div className="w-64 h-64 md:w-60 md:h-60 bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center shadow-2xl">
                            <Heart size={80} className="text-white fill-white" />
                        </div>
                    ) : (
                        <img src={playlist?.images[0]?.url || `https://picsum.photos/seed/${id}/400`} alt="" className="w-64 h-64 md:w-60 md:h-60 object-cover shadow-2xl" />
                    )}
                </div>
                <div className="flex flex-col justify-end text-left space-y-2 z-10 px-2 md:px-0">
                    <h1 className="text-2xl md:text-7xl font-black text-white tracking-tighter leading-tight drop-shadow-md">{isLikedView ? 'Liked Songs' : playlist?.name}</h1>

                    {/* Mobile Meta (Always Visible) */}
                    <div className="flex flex-col space-y-1 mt-1">
                        {playlist?.owner && (
                            <div className="flex items-center space-x-2">
                                {ownerImage ? (
                                    <img src={ownerImage} className="w-6 h-6 rounded-full object-cover border border-white/10" alt="" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-black">
                                        {playlist.owner.display_name.charAt(0)}
                                    </div>
                                )}
                                <span className="font-bold text-sm text-white">{playlist.owner.display_name}</span>
                            </div>
                        )}
                        <span className="text-slate-400 text-xs">{isLikedView ? 'Playlist' : 'Private Playlist'} • 2024</span>
                    </div>
                </div>
            </div>

            {/* MOBILE CONTROLS (Always Visible) */}
            <div className="flex items-center justify-between px-4 pb-4">
                <div className="flex items-center space-x-6 text-slate-400">
                    <Heart size={26} className={isLikedView ? "text-green-500 fill-green-500" : ""} />
                    <Download size={26} />
                    <MoreVertical size={26} />
                </div>
                <button onClick={handleMainPlayClick} className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center text-black shadow-lg">
                    {isThisPlaylistPlaying && isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                </button>
            </div>

            {/* TRACK LIST */}
            <div className="flex-1 px-0 md:px-6 pb-32">
                {/* TRACK LIST - Mobile Optimized */}
                <div className="flex-1 px-0 pb-32">
                    {/* Removed Desktop Header */}
                    <div className="space-y-1 mt-2">
                        {sortedAndFilteredTracks.map((track, index) => {
                            const isCurrent = currentTrackId === track.id;
                            const isPlayingRow = isCurrent && isPlaying;
                            return (
                                <div key={track.id} onClick={() => onPlayTrack(track, sortedAndFilteredTracks)} className={`group flex items-center justify-between px-4 py-3 active:bg-white/10 ${isCurrent ? 'bg-white/10' : ''}`}>

                                    <div className="flex items-center flex-1 min-w-0 mr-4">
                                        {/* Index not usually shown on mobile lists, but maybe subtle? Left out for cleanliness or keep simplified */}
                                        <div className="flex flex-col min-w-0">
                                            <span className={`text-base font-medium truncate ${isCurrent ? 'text-[#1ed760]' : 'text-white'}`}>{track.name}</span>
                                            <div className="flex items-center text-sm text-slate-400 mt-1">
                                                {/* <span className="bg-[#c0c0c0] text-[9px] text-black px-1 rounded-[2px] font-bold mr-1.5 h-3.5 flex items-center">LYRICS</span> */}
                                                <span className="truncate">{track.artists.map(a => a.name).join(', ')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <button className="text-slate-400 p-2"><MoreVertical size={24} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlaylistDetail;
