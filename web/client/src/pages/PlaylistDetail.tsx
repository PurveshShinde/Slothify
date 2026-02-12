import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ArrowLeft, Search as SearchIcon, ArrowUpDown, Heart, Trash2, Play, Pause,
  Clock3, MoreHorizontal, Download, Shuffle, MoreVertical, RefreshCw, ArrowDown, Plus
} from 'lucide-react';
import { Playlist, Track, User } from '../types';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useCache } from '../context/CacheContext';

type SortOption = 'az' | 'za' | 'newest' | 'oldest' | 'duration' | 'artist';

interface ExtendedTrack extends Track {
  added_at?: string;
  added_by?: { id: string; display_name?: string;[key: string]: any };
}

interface PlaylistDetailProps {
  id?: string;
  isLikedView?: boolean;
  onPlayTrack: (track: Track, fromQueue: Track[]) => void;
  onDownloadRequest: (id: string) => void;
  likedTrackIds: Set<string>;
  onToggleLike: (id: string) => void;
  currentTrackId?: string;

  // ✅ SYNCED PROPS
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  title?: string;
  user?: User | null;
}

const PlaylistDetail: React.FC<PlaylistDetailProps> = ({
  isLikedView, onPlayTrack, likedTrackIds, onToggleLike, currentTrackId,
  isPlaying, onPlayPause, isShuffle, onToggleShuffle, user
}) => {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = isLikedView ? 'liked' : paramId || '';

  const { cache, setPlaylistDetail } = useCache();

  // Cache check
  const cachedData = cache.playlistDetails[id];

  const [playlist, setPlaylist] = useState<Playlist | null>(cachedData?.playlist || null);
  const [tracks, setTracks] = useState<ExtendedTrack[]>(cachedData?.tracks || []);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('az');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [contributorProfiles, setContributorProfiles] = useState<Record<string, any>>({});

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullMoveY, setPullMoveY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = async (isRefresh = false) => {
    if (!id) return;
    if (!isRefresh && cachedData) return;

    setIsLoading(!isRefresh);

    try {
      if (!isLikedView) {
        const res = await axios.get(`/api/playlists/${id}`);
        const fetchedPlaylist = res.data;
        let fetchedTracks: ExtendedTrack[] = [];

        if (res.data.tracks?.items) {
          fetchedTracks = res.data.tracks.items
            .filter((i: any) => i.track)
            .map((i: any) => ({ ...i.track, added_at: i.added_at, added_by: i.added_by }));
        }

        setPlaylist(fetchedPlaylist);
        setTracks(fetchedTracks);
        setPlaylistDetail(id, { playlist: fetchedPlaylist, tracks: fetchedTracks });

      } else {
        const res = await axios.get('/api/me/tracks');
        const fetchedTracks = res.data.items || [];
        const fetchedPlaylist = {
          id: 'liked',
          name: 'Liked Songs',
          description: 'Your saved tracks',
          images: [],
          owner: { display_name: user?.display_name || 'You', id: user?.id || 'me' },
          tracks: { items: [], total: res.data.total || fetchedTracks.length }
        } as any;

        setPlaylist(fetchedPlaylist);
        setTracks(fetchedTracks);
        setPlaylistDetail(id, { playlist: fetchedPlaylist, tracks: fetchedTracks });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setPullMoveY(0);
    }
  };

  useEffect(() => {
    if ((!cachedData || isLikedView) && id) { // Always fetch liked view to stay fresh or if no cache
      // If it's liked view, we probably want to fetch fresh or cache intelligently. 
      // For now, let's respect cache but maybe invalidate it easier? 
      // Actually adhering to user request "won't reload unless scroll down" implies rigorous caching.
      if (!cachedData) fetchData();
      else setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [id, isLikedView]);

  // Pull-to-Refresh Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY > 0 && containerRef.current?.scrollTop === 0) {
      const touchY = e.touches[0].clientY;
      const diff = touchY - pullStartY;
      if (diff > 0) setPullMoveY(Math.min(diff, 200));
    }
  };

  const handleTouchEnd = () => {
    if (pullMoveY > 180) {
      setIsRefreshing(true);
      fetchData(true);
    } else if (pullMoveY > 50) {
      setShowSearchBar(true);
      setPullMoveY(0);
      setPullStartY(0);
    } else {
      setPullMoveY(0);
      setPullStartY(0);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // We need to listen for scroll on the parent since the parent 'main' is the scroll container
    const scrollParent = container.parentElement?.parentElement; // App's <main>
    if (!scrollParent) return;

    const handleParentScroll = () => {
      const scrollPos = scrollParent.scrollTop;
      setIsScrolled(scrollPos > 40);

      // If user scrolls down slightly and search bar is empty, hide it
      if (scrollPos > 80 && showSearchBar && filterQuery.length === 0) {
        setShowSearchBar(false);
      }
    };

    scrollParent.addEventListener('scroll', handleParentScroll);
    return () => scrollParent.removeEventListener('scroll', handleParentScroll);
  }, [showSearchBar, filterQuery]);

  const handleScroll = () => {
    // Keep internal handleScroll for cases where this might be used directly
    if (containerRef.current) {
      const scrollPos = containerRef.current.scrollTop;
      if (scrollPos > 100 && showSearchBar && filterQuery.length === 0) {
        setShowSearchBar(false);
      }
    }
  };


  const removeTrack = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playlist || isLikedView) return;

    if (confirm(`Remove "${track.name}" from this playlist?`)) {
      try {
        await axios.delete(`/api/playlists/${playlist.id}/tracks`, {
          data: { uris: [track.uri] },
          withCredentials: true
        });
        const newTracks = tracks.filter(t => t.id !== track.id);
        setTracks(newTracks);
        // Update cache
        if (id) {
          setPlaylistDetail(id, { playlist: { ...playlist, tracks: { ...playlist.tracks, total: newTracks.length } }, tracks: newTracks });
        }

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

  const collaborators = useMemo(() => {
    if (!tracks.length || !playlist?.owner) return [];
    const uniqueIds = new Set<string>();
    const list: any[] = [];

    // Always put owner first
    uniqueIds.add(playlist.owner.id);
    list.push({ ...playlist.owner, isOwner: true });

    tracks.forEach(t => {
      if (t.added_by && t.added_by.id && !uniqueIds.has(t.added_by.id) && t.added_by.id !== 'spotify') {
        uniqueIds.add(t.added_by.id);
        const name = t.added_by.display_name || t.added_by.id;
        list.push({ ...t.added_by, display_name: name });
      }
    });
    return list;
  }, [tracks, playlist?.owner]);

  // ✅ FETCH FULL CONTRIBUTOR PROFILES
  useEffect(() => {
    collaborators.forEach(collab => {
      if (collab.id && !collab.isOwner && !contributorProfiles[collab.id]) {
        axios.get(`/api/users/${collab.id}`)
          .then(res => {
            setContributorProfiles(prev => ({ ...prev, [collab.id]: res.data }));
          })
          .catch(() => {
            // fallback: keep as is
            setContributorProfiles(prev => ({ ...prev, [collab.id]: collab }));
          });
      }
    });
  }, [collaborators]);

  if (isLoading) return <div className="flex items-center justify-center h-screen bg-black"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const totalDurationMs = tracks.reduce((acc, t) => acc + t.duration_ms, 0);
  const formatTotalDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}min`;
  };

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

  const isOwner = playlist?.owner?.id === user?.id;

  const isThisPlaylistPlaying = tracks.some(t => t.id === currentTrackId);

  // ✅ MAIN BUTTON LOGIC
  const handleMainPlayClick = () => {
    if (isThisPlaylistPlaying) {
      onPlayPause(!isPlaying); // Toggle global play/pause
    } else {
      if (sortedAndFilteredTracks.length > 0) {
        if (isShuffle) {
          const randomIndex = Math.floor(Math.random() * sortedAndFilteredTracks.length);
          onPlayTrack(sortedAndFilteredTracks[randomIndex], sortedAndFilteredTracks);
        } else {
          onPlayTrack(sortedAndFilteredTracks[0], sortedAndFilteredTracks);
        }
      }
    }
  };

  // Helper to safely get the owner image
  const getOwnerImage = () => {
    if (!playlist?.owner) return null;
    let img = (playlist.owner as any).images?.[0]?.url || (playlist.owner as any).photos?.[0]?.value;

    // Fallback to current user image if owner is the current user and playlist owner image is missing
    if (!img && isOwner && user?.images?.[0]?.url) {
      img = user.images[0].url;
    }

    return img;
  };
  const ownerImage = getOwnerImage();

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`flex flex-col h-full animate-in fade-in duration-500 bg-black overflow-y-auto relative`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Refresh Indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-all duration-300 z-50"
        style={{ height: pullMoveY > 0 ? `${pullMoveY}px` : '0px', opacity: pullMoveY > 0 ? 1 : 0 }}
      >
        <div className="bg-slate-800 p-2 rounded-full shadow-lg mt-4">
          {isRefreshing ? <RefreshCw className="animate-spin text-blue-500" size={24} /> : <ArrowDown className={`text-white transition-transform duration-300 ${pullMoveY > 80 ? 'rotate-180' : ''}`} size={24} />}
        </div>
      </div>

      {/* TOP NAVIGATION */}
      <div className={`sticky top-0 z-30 px-4 py-4 flex items-center transition-all duration-300 ${isScrolled ? 'bg-black shadow-lg translate-y-0' : 'bg-transparent -translate-y-1'}`}>
        <button onClick={() => navigate(-1)} className="p-1 text-white hover:opacity-70 transition-opacity">
          <ArrowLeft size={28} />
        </button>
      </div>

      {/* SEARCH BAR (Hidden until pull) */}
      <div
        className="px-4 overflow-hidden transition-all duration-300 ease-out"
        style={{
          height: (pullMoveY > 20 || showSearchBar) ? '64px' : '0px',
          opacity: (pullMoveY > 20 || showSearchBar) ? 1 : 0,
          marginBottom: (pullMoveY > 20 || showSearchBar) ? '8px' : '0px'
        }}
      >
        <div className="relative w-full">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Find on this page"
            value={filterQuery}
            onChange={(e) => {
              setFilterQuery(e.target.value);
              if (e.target.value.length > 0) setShowSearchBar(true);
            }}
            onBlur={() => {
              if (filterQuery.length === 0) setShowSearchBar(false);
            }}
            className="w-full bg-white/10 border-none rounded-md py-2.5 pl-9 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all text-sm font-semibold"
          />
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col items-start px-6 pt-2 pb-6 space-y-6">
        {/* Centered Artwork */}
        <div className="w-full flex justify-center py-4">
          <div className="w-[70vw] aspect-square max-w-[300px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-[1.02]">
            {isLikedView ? (
              <div className="w-full h-full bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center">
                <Heart size={80} className="text-white fill-white" />
              </div>
            ) : (
              <img src={playlist?.images[0]?.url || `https://picsum.photos/seed/${id}/400`} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        </div>

        {/* Title & Info */}
        <div className="w-full space-y-3">
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight">{isLikedView ? 'Liked Songs' : playlist?.name}</h1>

          <div className="flex items-center">
            {/* Multiple Avatars */}
            <div className="flex -space-x-2 mr-3">
              {(playlist as any)?.collaborative && (
                <div className="relative z-20">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-black flex items-center justify-center text-white">
                    <Plus size={12} strokeWidth={4} />
                  </div>
                </div>
              )}
              {collaborators.slice(0, 3).map((collab, i) => {
                const fullProfile = contributorProfiles[collab.id] || collab;
                const img = collab.isOwner ? ownerImage : (fullProfile.images?.[0]?.url || fullProfile.photos?.[0]?.value);
                const initial = fullProfile.display_name?.charAt(0) || fullProfile.id?.charAt(0) || 'U';
                return (
                  <div key={collab.id} className="relative" style={{ zIndex: 10 - i }}>
                    {img ? (
                      <img src={img} className="w-6 h-6 rounded-full object-cover border-2 border-black" alt="" />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black border-2 border-black"
                        style={{ backgroundColor: `hsl(${(collab.id.length * 45) % 360}, 65%, 60%)` }}
                      >
                        {initial.toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}
              {collaborators.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-black flex items-center justify-center text-[8px] font-bold text-white">
                  +{collaborators.length - 3}
                </div>
              )}
            </div>

            {/* Collaborator Names Text */}
            <div className="text-sm font-bold text-white truncate max-w-[200px]">
              {playlist?.owner?.display_name || 'You'}
              {collaborators.length > 1 && (
                <span className="text-zinc-400 font-normal"> + {collaborators.length - 1} other{collaborators.length > 2 ? 's' : ''}</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 text-slate-400 text-sm font-medium">
            <div className="p-0.5 border border-slate-500 rounded-sm">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-slate-400">
                <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 5c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7zm9 13H6v-8h12v8z" />
              </svg>
            </div>
            <span>{formatTotalDuration(totalDurationMs)}</span>
          </div>
        </div>

        {/* ACTION ROW */}
        <div className="w-full flex items-center justify-between py-2">
          <div className="flex items-center space-x-6 text-slate-300">
            <div className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-500 p-1">
              <Download size={18} />
            </div>
            <div className="flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>
            <MoreHorizontal size={28} className="text-slate-300" />
          </div>
          <div className="flex items-center space-x-6">
            <button onClick={onToggleShuffle} className={`transition-all active:scale-90 ${isShuffle ? 'text-[#1ed760]' : 'text-slate-400'}`}>
              <Shuffle size={28} />
            </button>
            <button onClick={handleMainPlayClick} className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center text-black shadow-lg hover:scale-105 active:scale-95 transition-all">
              {isThisPlaylistPlaying && isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
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