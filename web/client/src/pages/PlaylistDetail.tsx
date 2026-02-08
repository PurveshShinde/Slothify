import React, { useEffect, useState, useMemo } from 'react';
import {
  Search as SearchIcon, ChevronLeft, ArrowUpDown, Heart, Trash2, Play, Pause,
  Clock3, MoreHorizontal, Download, Shuffle, MoreVertical
} from 'lucide-react';
import { Playlist, Track } from '../types';
import axios from 'axios';

import { useStore } from '../store/useStore';

type SortOption = 'az' | 'za' | 'newest' | 'oldest' | 'duration' | 'artist';

interface ExtendedTrack extends Track {
  added_at?: string;
}

interface PlaylistDetailProps {
  id: string;
  isLikedView?: boolean;
  onBack: () => void;
  onDownloadRequest: (id: string) => void;
}

const PlaylistDetail: React.FC<PlaylistDetailProps> = ({
  id, isLikedView, onBack
}) => {
  const {
    user,
    playTrack,
    isPlaying,
    setIsPlaying,
    isShuffle,
    toggleShuffle,
    currentTrack,
    likedTrackIds,
    toggleLike
  } = useStore();
  const currentTrackId = currentTrack?.id;
  const onPlayPause = setIsPlaying;
  const onToggleShuffle = toggleShuffle;
  const onPlayTrack = playTrack;
  const onToggleLike = toggleLike;
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<ExtendedTrack[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('az');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  /* const [currentUser, setCurrentUser] = useState<any>(null); -- Removed, using store */

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {

        if (!isLikedView) {
          const res = await axios.get(`/api/playlists/${id}`);
          setPlaylist(res.data);
          if (res.data.tracks?.items) {
            setTracks(res.data.tracks.items.filter((i: any) => i.track).map((i: any) => ({ ...i.track, added_at: i.added_at })));
          }
        } else {
          const res = await axios.get('/api/me/tracks');
          setTracks(Array.isArray(res.data) ? res.data.map((t: any) => ({ ...t, added_at: new Date().toISOString() })) : []);
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
        await axios.delete(`/api/playlists/${playlist.id}/tracks`, {
          data: { uris: [track.uri] },
          withCredentials: true
        });
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

  const isOwner = playlist?.owner?.id === user?.id;
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
    <div className={`flex flex-col h-full animate-in fade-in duration-500 bg-gradient-to-b ${gradientColor} to-black`}>
      {/* HEADER */}
      <div className="relative flex flex-col md:flex-row gap-6 p-6 pb-4 md:pb-8">
        <button onClick={onBack} className="absolute top-4 left-4 p-2 text-white z-20 md:hidden"><ChevronLeft size={28} /></button>
        <button onClick={onBack} className="hidden md:block absolute top-4 left-4 p-2 bg-black/20 rounded-full text-white z-20"><ChevronLeft size={24} /></button>
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
          <span className="hidden md:block text-xs font-bold uppercase tracking-wider text-white">{isLikedView ? 'Playlist' : 'Private Playlist'}</span>
          <h1 className="text-2xl md:text-7xl font-black text-white tracking-tighter leading-tight drop-shadow-md">{isLikedView ? 'Liked Songs' : playlist?.name}</h1>
          <p className="hidden md:block text-slate-300 opacity-80">{playlist?.description}</p>

          {/* Desktop Meta */}
          <div className="hidden md:flex items-center space-x-2 text-sm text-white font-medium pt-2">
            {playlist?.owner && <span className="font-bold">{playlist.owner.display_name}</span>}
            <span>• {tracks.length} songs</span>
            <span className="text-slate-300">, about {Math.floor(tracks.reduce((acc, t) => acc + t.duration_ms, 0) / 60000)} min</span>
          </div>

          {/* Mobile Meta */}
          <div className="md:hidden flex flex-col space-y-1 mt-1">
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

      {/* MOBILE CONTROLS */}
      <div className="md:hidden flex items-center justify-between px-4 pb-4">
        <div className="flex items-center space-x-6 text-slate-400">
          <Heart size={26} className={isLikedView ? "text-green-500 fill-green-500" : ""} />
          <Download size={26} />
          <MoreVertical size={26} />
        </div>
        <button onClick={handleMainPlayClick} className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center text-black shadow-lg">
          {isThisPlaylistPlaying && isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
        </button>
      </div>

      {/* DESKTOP CONTROLS */}
      <div className="hidden md:flex px-6 py-4 flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button onClick={handleMainPlayClick} className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center text-black shadow-lg hover:scale-105 transition-all">
              {isThisPlaylistPlaying && isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={onToggleShuffle} className={`transition-colors ${isShuffle ? 'text-green-500' : 'text-slate-400 hover:text-white'}`}><Shuffle size={28} /></button>
            <button className="text-slate-400 hover:text-white"><Download size={24} /></button>
            <button className="text-slate-400 hover:text-white"><MoreHorizontal size={28} /></button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative group">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" placeholder="Search in playlist" onChange={(e) => setFilterQuery(e.target.value)} className="bg-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white w-48" />
            </div>
            <button onClick={() => setShowSortMenu(!showSortMenu)} className="flex items-center space-x-1 text-slate-400 hover:text-white text-sm font-medium">
              <span>Custom order</span>
              <ArrowUpDown size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* TRACK LIST */}
      <div className="flex-1 px-0 md:px-6 pb-32">
        <div className="hidden md:grid grid-cols-[auto_4fr_3fr_2fr_minmax(60px,auto)] gap-4 px-4 py-2 border-b border-white/10 text-slate-400 text-sm font-medium sticky top-0 backdrop-blur-md z-10">
          <span className="w-8 text-center">#</span><span>Title</span><span>Album</span><span>Date added</span><div className="flex justify-end pr-2"><Clock3 size={16} /></div>
        </div>
        <div className="space-y-0 md:space-y-1 mt-2">
          {sortedAndFilteredTracks.map((track, index) => {
            const isCurrent = currentTrackId === track.id;
            const isPlayingRow = isCurrent && isPlaying;
            return (
              <div key={track.id} onClick={() => onPlayTrack(track, sortedAndFilteredTracks)} className={`group grid md:grid-cols-[auto_4fr_3fr_2fr_minmax(60px,auto)] grid-cols-[auto_1fr_auto] gap-3 md:gap-4 items-center px-4 md:px-4 py-2 md:py-2.5 md:rounded-md hover:bg-white/10 cursor-pointer ${isCurrent ? 'bg-white/10' : ''}`}>
                <div className="flex items-center">
                  <div className="hidden md:flex w-8 items-center justify-center text-slate-400 group-hover:text-white font-medium text-sm">
                    <span className={`block group-hover:hidden ${isCurrent ? 'text-[#1ed760]' : ''}`}>{isCurrent ? <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="h-3.5" alt="playing" /> : index + 1}</span>
                    <span className="hidden group-hover:block text-white">{isPlayingRow ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</span>
                  </div>
                  <div className="md:hidden relative w-12 h-12 flex-shrink-0"><img src={track.album.images[0]?.url || 'https://picsum.photos/40'} className="w-full h-full rounded-sm object-cover" alt="" /></div>
                </div>
                <div className="flex flex-col min-w-0 mr-2">
                  <div className="flex md:items-center md:space-x-4">
                    <img src={track.album.images[0]?.url || 'https://picsum.photos/40'} className="hidden md:block w-10 h-10 rounded shadow-sm object-cover" alt="" />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-base md:text-sm font-medium truncate ${isCurrent ? 'text-[#1ed760]' : 'text-white'}`}>{track.name}</span>
                      <div className="flex items-center text-sm text-slate-400 mt-0.5">
                        <span className="md:hidden bg-[#c0c0c0] text-[9px] text-black px-1 rounded-[2px] font-bold mr-1.5 h-3.5 flex items-center">LYRICS</span>
                        <span className="group-hover:text-white truncate transition-colors">{track.artists.map(a => a.name).join(', ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="hidden md:block text-sm text-slate-400 group-hover:text-white truncate">{track.album.name}</span>
                <span className="hidden md:block text-sm text-slate-400 group-hover:text-white truncate">{formatDate(track.added_at)}</span>
                <div className="flex items-center justify-end space-x-4">
                  <button onClick={(e) => { e.stopPropagation(); onToggleLike(track.id); }} className={`hidden md:block opacity-0 group-hover:opacity-100 ${likedTrackIds.has(track.id) ? 'text-[#1ed760] opacity-100' : 'text-slate-400 hover:text-white'}`}>
                    <Heart size={16} fill={likedTrackIds.has(track.id) ? "currentColor" : "none"} />
                  </button>
                  <span className="hidden md:block text-sm text-slate-400 tabular-nums pr-2">{formatDuration(track.duration_ms)}</span>
                  <button className="md:hidden text-slate-400 p-2"><MoreVertical size={24} /></button>
                  {isOwner && !isLikedView && (
                    <button onClick={(e) => removeTrack(track, e)} className="hidden md:block p-1 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlaylistDetail;