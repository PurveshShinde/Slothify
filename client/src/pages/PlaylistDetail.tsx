import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ArrowLeft, Search as SearchIcon, ArrowUpDown, Heart, Trash2, Play, Pause,
  Clock3, MoreHorizontal, Download, Shuffle, MoreVertical, RefreshCw, ArrowDown, Plus, Music2, Check
} from 'lucide-react';
import { Playlist, Track, User } from '../types';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';
import { useSpotify } from '../context/SpotifyContext';
import PlaylistCover from '../components/PlaylistCover';
import { getTrackThumbnail } from '../utils/imageOptimizer';

const KNOWN_PLAYLIST_META: Record<string, { name: string; description: string; image: string }> = {
  'late-night-drive': {
    name: 'Late Night Drive',
    description: 'Chill songs for city nights',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500'
  },
  'acoustic-mornings': {
    name: 'Acoustic Mornings',
    description: 'Soft, calm & beautiful acoustic strings',
    image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500'
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

type SortOption = 'custom' | 'az' | 'za' | 'artist' | 'duration';

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

const extractTracksArray = (data: any): ExtendedTrack[] => {
  if (!data) return [];
  if (Array.isArray(data.tracks)) return data.tracks;
  if (Array.isArray(data.tracks?.items)) {
    return data.tracks.items
      .filter((i: any) => i && (i.track || i.id))
      .map((i: any) => {
        const t = i.track || i;
        return { ...t, added_at: i.added_at, added_by: i.added_by };
      });
  }
  if (Array.isArray(data.items)) {
    return data.items.map((i: any) => i.track || i).filter(Boolean);
  }
  if (Array.isArray(data)) return data;
  return [];
};

const PlaylistDetail: React.FC<PlaylistDetailProps> = ({
  isLikedView, onPlayTrack, likedTrackIds, onToggleLike, currentTrackId,
  isPlaying, onPlayPause, isShuffle, onToggleShuffle, user
}) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const { id: paramId } = useParams();
  const id = isLikedView ? 'liked' : paramId || '';

  const { cache, setPlaylistDetail, removePlaylistFromCache } = useCache();
  const { removeImportedPlaylist, spotifyPlaylists } = useSpotify();

  // Cache check
  const cachedData = cache.playlistDetails[id];
  const cachedPlaylist = cachedData?.playlist || (cachedData?.name ? cachedData : null);
  const cachedTracks = extractTracksArray(cachedData);

  const [playlist, setPlaylist] = useState<Playlist | null>(cachedPlaylist);
  const [tracks, setTracks] = useState<ExtendedTrack[]>(cachedTracks);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('custom');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortMenu]);

  // Only show loading spinner if we have NO cached data at all
  const [isLoading, setIsLoading] = useState(!cachedPlaylist && cachedTracks.length === 0);
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

    // Check Spotify playlists in context first
    if (id.startsWith('sp_')) {
      const spPlaylist = spotifyPlaylists.find(p => p.id === id);
      if (spPlaylist) {
        const fetchedTracks = extractTracksArray(spPlaylist);
        setPlaylist(spPlaylist);
        setTracks(fetchedTracks);
        setPlaylistDetail(id, { playlist: spPlaylist, tracks: fetchedTracks });
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
    }

    // Use cache for ALL views including liked - skip fetch if cached and not refreshing
    if (!isRefresh && cachedData) return;

    // Only show full loading spinner if there's no cached data to display
    // This prevents the "no songs" flash when refreshing in the background
    const hasCachedContent = cachedData || (Array.isArray(tracks) && tracks.length > 0);
    setIsLoading(!isRefresh && !hasCachedContent);

    try {
      if (!isLikedView) {
        const res = await axios.get(`/api/playlists/${id}`);
        const fetchedPlaylist = res.data;
        const fetchedTracks = extractTracksArray(fetchedPlaylist);

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
        try {
          localStorage.setItem('slothify_liked_songs_total', String(fetchedTracks.length));
          localStorage.setItem('slothify_liked_track_ids', JSON.stringify(fetchedTracks.map((t: any) => t.id)));
          window.dispatchEvent(new Event('slothify_likes_updated'));
        } catch (e) {}
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
    if (id) {
      if (id.startsWith('sp_')) {
        const spPlaylist = spotifyPlaylists.find(p => p.id === id);
        if (spPlaylist) {
          const trks = extractTracksArray(spPlaylist);
          setPlaylist(spPlaylist);
          setTracks(trks);
          setPlaylistDetail(id, { playlist: spPlaylist, tracks: trks });
          setIsLoading(false);
          return;
        }
      }
      if (cachedData) {
        // Show cached data instantly for ALL views (including liked)
        const pl = cachedData.playlist || (cachedData.name ? cachedData : null);
        const trks = extractTracksArray(cachedData);
        setPlaylist(pl);
        setTracks(trks);
        setIsLoading(false);
        // For liked view, or if playlist has no tracks or needs refresh, fetch in background
        if (isLikedView || !pl || !trks.length) {
          fetchData(true);
        }
      } else {
        fetchData();
      }
    } else {
      setIsLoading(false);
    }
    // Only re-fetch liked view when likedTrackIds size actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isLikedView, spotifyPlaylists]);

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
      const isSpotifyPl = id.startsWith('sp_') || playlist?.isSpotify || spotifyPlaylists.some(p => p.id === id);
      if (isSpotifyPl) {
        removeImportedPlaylist(id);
      } else {
        await axios.delete(`/api/me/playlists/${id}`);
      }
    } catch (err) {
      console.error('Failed to delete playlist on server:', err);
    } finally {
      removePlaylistFromCache(id);
      window.dispatchEvent(new Event('slothify_playlists_updated'));
      window.dispatchEvent(new Event('slothify_spotify_playlists_updated'));
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      navigate('/library');
    }
  };

  const sortedAndFilteredTracks = useMemo(() => {
    const safeTracks = Array.isArray(tracks) ? tracks : [];
    let list = [...safeTracks];
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      list = list.filter(t =>
        (t?.name || '').toLowerCase().includes(q) ||
        (t?.artists || []).some(a => (a?.name || '').toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'custom': return 0;
        case 'az': return (a?.name || '').localeCompare(b?.name || '');
        case 'za': return (b?.name || '').localeCompare(a?.name || '');
        case 'duration': return (a?.duration_ms || 0) - (b?.duration_ms || 0);
        case 'artist': return (a?.artists?.[0]?.name || '').localeCompare(b?.artists?.[0]?.name || '');
        default: return 0;
      }
    });
    return list;
  }, [tracks, filterQuery, sortBy]);

  const collaborators = useMemo(() => {
    const safeTracks = Array.isArray(tracks) ? tracks : [];
    if (!safeTracks.length || !playlist?.owner) return [];
    const uniqueIds = new Set<string>();
    const list: any[] = [];

    // Always put owner first
    if (playlist.owner.id) {
      uniqueIds.add(playlist.owner.id);
    }
    list.push({ ...playlist.owner, isOwner: true });

    safeTracks.forEach(t => {
      if (t?.added_by && t.added_by.id && !uniqueIds.has(t.added_by.id) && t.added_by.id !== 'spotify') {
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

  const safeTracksList = Array.isArray(tracks) ? tracks : [];
  const totalDurationMs = safeTracksList.reduce((acc, t) => acc + (t?.duration_ms || 0), 0);
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

  const isThisPlaylistPlaying = safeTracksList.some(t => t?.id === currentTrackId);

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

  const isSpotifyPl = id.startsWith('sp_') || Boolean(playlist?.isSpotify) || spotifyPlaylists.some(p => p.id === id);

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
          className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-black/40 hover:bg-white/10 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all text-xs font-semibold group shadow-md hover:scale-[1.02] active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      {/* MAIN FROSTED GLASS PLAYLIST CONTAINER */}
      <div className="max-w-6xl mx-auto w-full bg-black/35 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 md:p-8 shadow-2xl">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 pb-8 border-b border-white/10">
          {/* Artwork */}
          <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 flex-shrink-0 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
            {isLikedView ? (
              <div className={`w-full h-full flex items-center justify-center rounded-2xl shadow-2xl ${
                isOcean
                  ? 'bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#3b82f6] shadow-blue-600/30'
                  : 'bg-gradient-to-br from-[#c87d46] via-[#d97736] to-[#f5d0b5] shadow-[#c87d46]/25'
              }`}>
                <Heart size={80} className="text-white fill-white" />
              </div>
            ) : (
              <PlaylistCover
                images={playlist?.images}
                tracks={playlist?.tracks || { items: safeTracksList.map(t => ({ track: t })) }}
                iconSize={64}
                alt={displayName}
              />
            )}
          </div>

          {/* Title & Info */}
          <div className="flex-1 min-w-0 space-y-3 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              {isSpotifyPl ? (
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/30 text-[#1DB954] text-[10px] font-bold tracking-wider font-display">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                  </svg>
                  <span>Spotify Playlist</span>
                </div>
              ) : (
                <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 font-display">
                  {isLikedView ? 'Liked Songs' : 'Playlist'}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight font-display">
              {displayName}
            </h1>
            {displayDescription && (
              <p className="text-sm text-slate-300 line-clamp-2 max-w-2xl leading-relaxed">
                {displayDescription}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2 text-xs text-slate-400 font-medium">
              <div className="flex items-center space-x-2">
                {ownerImage ? (
                  <img src={ownerImage} className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20" alt="" />
                ) : (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                    isSpotifyPl ? 'bg-[#1DB954] text-black' : (isOcean ? 'bg-blue-600' : 'bg-[#c87d46]')
                  }`}>
                    {(playlist?.owner?.display_name || 'S').charAt(0)}
                  </div>
                )}
                <span className="font-bold text-white">{playlist?.owner?.display_name || (isSpotifyPl ? 'Spotify' : 'Slothify')}</span>
              </div>
              <span>•</span>
              <span>{safeTracksList.length} song{safeTracksList.length === 1 ? '' : 's'}</span>
              {safeTracksList.length > 0 && (
                <>
                  <span>•</span>
                  <span>{formatTotalDuration(totalDurationMs)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ACTION CONTROLS ROW */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-6">
          <div className="flex items-center space-x-5 text-slate-300">
            <button
              onClick={handleMainPlayClick}
              disabled={sortedAndFilteredTracks.length === 0}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
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
              className={`transition-all active:scale-90 cursor-pointer ${isShuffle ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-slate-400 hover:text-white'}`}
              title={isShuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
            >
              <Shuffle size={24} />
            </button>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            {/* Inline Search Input */}
            <div className="relative">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Find in playlist..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="bg-white/10 focus:bg-white/15 border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none transition-all w-36 sm:w-48 focus:w-56"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu(prev => !prev)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  sortBy !== 'custom'
                    ? (isOcean ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-[#c87d46]/20 text-[#f5d0b5] border-[#c87d46]/30')
                    : 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10'
                }`}
                title="Sort tracks"
              >
                <ArrowUpDown size={14} />
                <span className="hidden sm:inline">
                  {sortBy === 'custom' ? 'Custom Order' :
                   sortBy === 'az' ? 'Title (A-Z)' :
                   sortBy === 'za' ? 'Title (Z-A)' :
                   sortBy === 'artist' ? 'Artist' : 'Duration'}
                </span>
              </button>

              {showSortMenu && (
                <div className={`absolute right-0 mt-2 w-52 rounded-2xl border p-1.5 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl ${
                  isOcean ? 'bg-[#0f172a]/95 border-blue-500/20' : 'bg-[#18151c]/95 border-white/10'
                }`}>
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display">
                    Sort by
                  </div>
                  {[
                    { key: 'custom', label: 'Custom / Spotify Order' },
                    { key: 'az', label: 'Title (A to Z)' },
                    { key: 'za', label: 'Title (Z to A)' },
                    { key: 'artist', label: 'Artist' },
                    { key: 'duration', label: 'Duration' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setSortBy(opt.key as SortOption);
                        setShowSortMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                        sortBy === opt.key
                          ? (isOcean ? 'bg-blue-600 text-white font-bold' : 'bg-[#f5d0b5] text-black font-bold')
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.key && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!isLikedView && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete this playlist"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600/90 border border-rose-500/20 shadow-sm transition-all duration-200 active:scale-95 cursor-pointer"
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
                className={`px-6 py-2.5 rounded-full text-xs font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
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
                        <div className="md:hidden relative w-12 h-12 flex-shrink-0"><img src={getTrackThumbnail(track, 'https://picsum.photos/40', '150')} loading="lazy" className="w-full h-full rounded-md object-cover" alt="" /></div>
                      </div>
                      <div className="flex flex-col min-w-0 mr-2">
                        <div className="flex md:items-center md:space-x-4">
                          <img src={getTrackThumbnail(track, 'https://picsum.photos/40', '150')} loading="lazy" className="hidden md:block w-10 h-10 rounded-lg shadow-sm object-cover" alt="" />
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
                          <button onClick={(e) => removeTrack(track, e)} className="hidden md:block p-1 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
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
                {id.startsWith('sp_') || playlist?.isSpotify
                  ? <>Are you sure you want to remove <span className="text-white font-semibold">&ldquo;{displayName}&rdquo;</span> from your library? It will be removed from this session.</>
                  : <>Are you sure you want to delete <span className="text-white font-semibold">&ldquo;{displayName}&rdquo;</span>? This will permanently remove it from your encrypted library and cloud database.</>}
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