import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ArrowLeft, Search as SearchIcon, ArrowUpDown, Heart, Trash2, Play, Pause,
  Clock3, MoreHorizontal, Download, Shuffle, MoreVertical, RefreshCw, ArrowDown, Plus, Music2
} from 'lucide-react';
import { Playlist, Track, User } from '../types';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';

const KNOWN_PLAYLIST_META: Record<string, { name: string; description: string; image: string }> = {
  'late-night-drive': {
    name: 'Late Night Drive',
    description: 'Chill songs for city nights',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500'
  },
  'acoustic-mornings': {
    name: 'Acoustic Mornings',
    description: 'Soft, calm & beautiful acoustic strings',
    image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500'
  },
  'heartbreak-diaries': {
    name: 'Heartbreak Diaries',
    description: 'Emotional melodies for quiet moments',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500'
  },
  'good-vibes': {
    name: 'Good Vibes',
    description: 'Feel-good anthems to lift your mood',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500'
  }
};

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
  onToggleLike: (id: string, track?: Track) => void;
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
  const { isOcean } = useTheme();
  const { id: paramId } = useParams();
  const id = isLikedView ? 'liked' : paramId || '';

  const { cache, setPlaylistDetail, removePlaylistFromCache } = useCache();

  // Cache check
  const cachedData = cache.playlistDetails[id];

  const [playlist, setPlaylist] = useState<Playlist | null>(cachedData?.playlist || null);
  const [tracks, setTracks] = useState<ExtendedTrack[]>(cachedData?.tracks || []);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('az');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [contributorProfiles, setContributorProfiles] = useState<Record<string, any>>({});
  const [localAvatar, setLocalAvatar] = useState<string>(() => {
    return localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
  });

  useEffect(() => {
    const handleAvatarUpdate = () => {
      setLocalAvatar(localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png');
    };
    window.addEventListener('slothify_avatar_changed', handleAvatarUpdate);
    window.addEventListener('storage', handleAvatarUpdate);
    return () => {
      window.removeEventListener('slothify_avatar_changed', handleAvatarUpdate);
      window.removeEventListener('storage', handleAvatarUpdate);
    };
  }, []);

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullMoveY, setPullMoveY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = async (isRefresh = false) => {
    if (!id) return;
    if (!isRefresh && cachedData && !isLikedView) return;

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
        const rawItems = res.data.items || [];
        let fetchedTracks: ExtendedTrack[] = rawItems.map((item: any) => {
          const t = item?.track || item;
          if (!t) return null;
          return {
            ...t,
            id: t.id,
            name: t.name || 'Unknown Track',
            artists: Array.isArray(t.artists) ? t.artists : [{ name: 'Unknown Artist' }],
            album: t.album && typeof t.album === 'object' ? t.album : { name: 'Single', images: [] },
            duration_ms: t.duration_ms || 180000,
            added_at: item?.added_at || t.added_at
          };
        }).filter(Boolean);

        if (fetchedTracks.length === 0) {
          try {
            const stored = localStorage.getItem('slothify_guest_likes');
            if (stored) {
              const localLikes = JSON.parse(stored);
              fetchedTracks = localLikes.map((t: any) => ({
                ...t,
                artists: Array.isArray(t.artists) ? t.artists : [{ name: 'Unknown Artist' }],
                album: t.album && typeof t.album === 'object' ? t.album : { name: 'Single', images: [] },
                duration_ms: t.duration_ms || 180000
              }));
            }
          } catch (e) { }
        }

        const fetchedPlaylist = {
          id: 'liked',
          name: 'Liked Songs',
          description: 'Your saved tracks',
          images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300' }],
          owner: { display_name: user?.display_name || 'Slothify Listener', id: user?.id || 'me' },
          tracks: { items: fetchedTracks.map((t: any) => ({ track: t })), total: fetchedTracks.length }
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
    if (isLikedView) {
      fetchData(true);
    } else if (id) {
      if (cachedData) {
        setPlaylist(cachedData.playlist);
        setTracks(cachedData.tracks);
        setIsLoading(false);
      } else {
        fetchData();
      }
    } else {
      setIsLoading(false);
    }
  }, [id, isLikedView, likedTrackIds.size]);

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

  const handleDeletePlaylist = async () => {
    if (!id || isLikedView) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/me/playlists/${id}`);
    } catch (err) {
      console.error('Failed to delete playlist on server:', err);
    } finally {
      removePlaylistFromCache(id);
      window.dispatchEvent(new Event('slothify_playlists_updated'));
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      navigate('/playlists');
    }
  };

  const sortedAndFilteredTracks = useMemo(() => {
    let list = [...tracks];
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.artists || []).some(a => (a?.name || '').toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'az': return (a.name || '').localeCompare(b.name || '');
        case 'za': return (b.name || '').localeCompare(a.name || '');
        case 'duration': return (a.duration_ms || 0) - (b.duration_ms || 0);
        case 'artist': return (a.artists?.[0]?.name || '').localeCompare(b.artists?.[0]?.name || '');
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
    if (playlist.owner.id) {
      uniqueIds.add(playlist.owner.id);
    }
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

  if (isLoading) return <div className="flex items-center justify-center h-screen bg-transparent"><div className={`w-12 h-12 border-4 ${isOcean ? 'border-blue-500' : 'border-[#f5d0b5]'} border-t-transparent rounded-full animate-spin`}></div></div>;

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
    // If it's Liked Songs or owned by the logged in user, always return the active local avatar
    if (isLikedView || isOwner || playlist?.owner?.id === user?.id || playlist?.owner?.id === 'me') {
      return localAvatar || localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
    }

    if (!playlist?.owner) return null;
    let img = (playlist.owner as any).images?.[0]?.url || (playlist.owner as any).photos?.[0]?.value;

    // If backend returned a generic dicebear robot avatar, fall back to user's local avatar or ghost
    if (img && typeof img === 'string' && img.includes('dicebear.com')) {
      return localAvatar || '/avatars/ghost.png';
    }

    return img || null;
  };
  const ownerImage = getOwnerImage();

  const displayName = isLikedView
    ? 'Liked Songs'
    : (playlist?.name && playlist.name !== 'Playlist' ? playlist.name : (KNOWN_PLAYLIST_META[id]?.name || playlist?.name || 'Playlist'));

  const displayDescription = isLikedView
    ? 'Your collection of loved tracks'
    : (playlist?.description && playlist.description !== 'Curated music playlist' ? playlist.description : (KNOWN_PLAYLIST_META[id]?.description || playlist?.description || 'Curated music playlist'));

  const displayImage = isLikedView
    ? null
    : (playlist?.images?.[0]?.url || KNOWN_PLAYLIST_META[id]?.image || `https://picsum.photos/seed/${id}/400`);

  return (
    <div
      ref={containerRef}
      className="flex flex-col animate-in fade-in duration-500 bg-transparent relative pb-20 px-2 md:px-6"
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
          {isRefreshing ? <RefreshCw className={`animate-spin ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`} size={24} /> : <ArrowDown className={`text-white transition-transform duration-300 ${pullMoveY > 80 ? (isOcean ? 'rotate-180 text-blue-400' : 'rotate-180 text-[#f5d0b5]') : ''}`} size={24} />}
        </div>
      </div>

      {/* TOP NAVIGATION BACK BUTTON */}
      <div className="max-w-6xl mx-auto w-full mb-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-black/40 hover:bg-white/10 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all text-xs font-semibold group shadow-md hover:scale-[1.02] active:scale-95"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back</span>
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

      {/* MAIN FROSTED GLASS PLAYLIST CONTAINER */}
      <div className="max-w-6xl mx-auto w-full bg-black/35 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 md:p-8 shadow-2xl">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 pb-8 border-b border-white/10">
          {/* Artwork */}
          <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 flex-shrink-0 shadow-2xl rounded-2xl overflow-hidden">
            {isLikedView ? (
              <div className={`w-full h-full flex items-center justify-center rounded-2xl shadow-2xl ${
                isOcean
                  ? 'bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#3b82f6] shadow-blue-600/30'
                  : 'bg-gradient-to-br from-[#c87d46] via-[#d97736] to-[#f5d0b5] shadow-[#c87d46]/25'
              }`}>
                <Heart size={80} className="text-white fill-white" />
              </div>
            ) : (
              <img src={displayImage || `https://picsum.photos/seed/${id}/400`} alt="" className="w-full h-full object-cover rounded-2xl shadow-2xl" />
            )}
          </div>

          {/* Title & Info */}
          <div className="flex-1 min-w-0 space-y-3 text-center md:text-left">
            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Playlist</span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">{displayName}</h1>
            <p className="text-sm text-slate-300 line-clamp-2 max-w-2xl">{displayDescription}</p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2 text-xs text-slate-400">
              {/* Creator info */}
              <div className="flex items-center space-x-2">
                {ownerImage ? (
                  <img src={ownerImage} className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20" alt="" />
                ) : (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isOcean ? 'bg-blue-600' : 'bg-[#c87d46]'}`}>
                    {(playlist?.owner?.display_name || 'S').charAt(0)}
                  </div>
                )}
                <span className="font-bold text-white">{playlist?.owner?.display_name || 'Slothify'}</span>
              </div>
              <span>•</span>
              <span>{tracks.length} song{tracks.length === 1 ? '' : 's'}</span>
              {tracks.length > 0 && (
                <>
                  <span>•</span>
                  <span>{formatTotalDuration(totalDurationMs)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ACTION CONTROLS ROW */}
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center space-x-5 text-slate-300">
            <button
              onClick={handleMainPlayClick}
              disabled={sortedAndFilteredTracks.length === 0}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${
                sortedAndFilteredTracks.length === 0
                  ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed opacity-50'
                  : isOcean
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30 hover:scale-105 active:scale-95'
                    : 'bg-[#f5d0b5] hover:bg-white text-black shadow-[#c87d46]/30 hover:scale-105 active:scale-95'
              }`}
            >
              {isThisPlaylistPlaying && isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-0.5" />}
            </button>

            <button
              onClick={onToggleShuffle}
              disabled={sortedAndFilteredTracks.length === 0}
              className={`transition-all active:scale-90 ${isShuffle ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-slate-400 hover:text-white'}`}
            >
              <Shuffle size={24} />
            </button>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            {!isLikedView && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete this playlist permanently"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600/90 border border-rose-500/20 shadow-sm transition-all duration-200 active:scale-95"
              >
                <Trash2 size={15} />
                <span>Delete Playlist</span>
              </button>
            )}
            <MoreHorizontal size={24} className="hover:text-white cursor-pointer transition-colors" />
          </div>
        </div>

        {/* TRACK LIST */}
        <div className="flex-1 pb-8">
          {sortedAndFilteredTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
              <div className={`p-5 rounded-full ${isOcean ? 'bg-blue-600/20 text-blue-400' : 'bg-[#c87d46]/20 text-[#f5d0b5]'}`}>
                <Music2 size={36} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">This playlist has no tracks</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Search for your favorite tracks or artists to add songs to your playlist.
                </p>
              </div>
              <button
                onClick={() => navigate('/search')}
                className={`px-6 py-2.5 rounded-full text-xs font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-95 ${
                  isOcean ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30' : 'bg-[#c87d46] hover:bg-[#d97736] shadow-[#c87d46]/30'
                }`}
              >
                Search Tracks
              </button>
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[auto_4fr_3fr_2fr_minmax(60px,auto)] gap-4 px-4 py-2 border-b border-white/10 text-slate-400 text-sm font-medium sticky top-0 backdrop-blur-md z-10">
                <span className="w-8 text-center">#</span><span>Title</span><span>Album</span><span>Date added</span><div className="flex justify-end pr-2"><Clock3 size={16} /></div>
              </div>
              <div className="space-y-0 md:space-y-1 mt-2">
                {sortedAndFilteredTracks.map((track, index) => {
                  const isCurrent = currentTrackId === track.id;
                  const isPlayingRow = isCurrent && isPlaying;
                  return (
                    <div key={track.id || `${track.name}_${index}`} onClick={() => onPlayTrack(track, sortedAndFilteredTracks)} className={`group grid md:grid-cols-[auto_4fr_3fr_2fr_minmax(60px,auto)] grid-cols-[auto_1fr_auto] gap-3 md:gap-4 items-center px-4 md:px-4 py-2 md:py-2.5 md:rounded-xl hover:bg-white/10 cursor-pointer transition-colors ${isCurrent ? (isOcean ? 'bg-blue-500/15' : 'bg-[#c87d46]/15') : ''}`}>
                      <div className="flex items-center">
                        <div className="hidden md:flex w-8 items-center justify-center text-slate-400 group-hover:text-white font-medium text-sm">
                          <span className={`block group-hover:hidden ${isCurrent ? (isOcean ? 'text-blue-400 font-bold' : 'text-[#f5d0b5] font-bold') : ''}`}>
                            {isCurrent ? (
                              <span className="flex space-x-0.5 items-end h-3.5">
                                <span className={`w-1 animate-pulse h-3 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                                <span className={`w-1 animate-pulse h-2 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                                <span className={`w-1 animate-pulse h-3.5 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                              </span>
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="hidden group-hover:block text-white">{isPlayingRow ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</span>
                        </div>
                        <div className="md:hidden relative w-12 h-12 flex-shrink-0"><img src={track.album?.images?.[0]?.url || 'https://picsum.photos/40'} className="w-full h-full rounded-md object-cover" alt="" /></div>
                      </div>
                      <div className="flex flex-col min-w-0 mr-2">
                        <div className="flex md:items-center md:space-x-4">
                          <img src={track.album?.images?.[0]?.url || 'https://picsum.photos/40'} className="hidden md:block w-10 h-10 rounded-lg shadow-sm object-cover" alt="" />
                          <div className="flex flex-col min-w-0">
                            <span className={`text-base md:text-sm font-semibold truncate ${isCurrent ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-white'}`}>{track.name}</span>
                            <div className="flex items-center text-xs text-slate-400 mt-0.5">
                              <span className="group-hover:text-white truncate transition-colors">{track.artists?.map(a => a?.name || '').join(', ') || 'Unknown Artist'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className="hidden md:block text-sm text-slate-400 group-hover:text-white truncate">{track.album?.name || 'Single'}</span>
                      <span className="hidden md:block text-sm text-slate-400 group-hover:text-white truncate">{formatDate(track.added_at)}</span>
                      <div className="flex items-center justify-end space-x-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLike(track.id, track);
                            if (isLikedView) {
                              setTracks(prev => prev.filter(t => t.id !== track.id));
                            }
                          }}
                          className={`hidden md:block opacity-0 group-hover:opacity-100 ${likedTrackIds.has(track.id) ? 'text-[#1ed760] opacity-100' : 'text-slate-400 hover:text-white'}`}
                        >
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
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <Trash2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Delete Playlist?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-semibold">&ldquo;{displayName}&rdquo;</span>? This will permanently remove it from your encrypted library and cloud database.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlaylist}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistDetail;