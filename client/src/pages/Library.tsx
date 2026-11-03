import React, { useState, useEffect, useRef } from 'react';
import { Playlist, User } from '../types';
import { Music2, RefreshCw, ArrowDown, Plus, Search, ArrowUpDown, LayoutGrid, Heart, Pin, Trash2, CheckCircle2, ListMusic, Play } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';
import { useSpotify } from '../context/SpotifyContext';
import PlaylistCover from '../components/PlaylistCover';

interface LibraryProps {
  isAuthenticated: boolean;
  user: User | null;
  likedTrackIds: Set<string>;
  likedSongsTotal: number;
  onOpenAuth?: () => void;
  initialFilter?: FilterType | null;
}

export type FilterType = 'All' | 'In-App' | 'Spotify' | 'Playlists' | 'Albums' | 'Artists';

const Library: React.FC<LibraryProps> = ({ isAuthenticated, user, likedTrackIds, likedSongsTotal, onOpenAuth, initialFilter }) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const { cache, setLibraryPlaylists, removePlaylistFromCache } = useCache();
  const {
    isConnected: isSpotifyConnected,
    spotifyPlaylists,
    openConnectModal,
    openImportModal,
    removeImportedPlaylist,
    disconnectSpotify
  } = useSpotify();

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    if (!isAuthenticated) return [];
    if (cache.libraryPlaylists && cache.libraryPlaylists.length > 0) return cache.libraryPlaylists;
    try {
      const stored = localStorage.getItem('slothify_user_playlists_cache');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (!isAuthenticated) return false;
    if (cache.libraryPlaylists && cache.libraryPlaylists.length > 0) return false;
    try {
      const stored = localStorage.getItem('slothify_user_playlists_cache');
      if (stored) return false;
    } catch (e) {}
    return true;
  });

  const [activeFilter, setActiveFilter] = useState<FilterType | null>(initialFilter || null);
  const [playlistToDelete, setPlaylistToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    setIsDeleting(true);
    try {
      const isSpotifyPl = playlistToDelete.isSpotify || playlistToDelete.id?.startsWith('sp_') || spotifyPlaylists.some(p => p.id === playlistToDelete.id);
      if (isSpotifyPl) {
        removeImportedPlaylist(playlistToDelete.id);
      } else {
        await axios.delete(`/api/me/playlists/${playlistToDelete.id}`);
      }
    } catch (err) {
      console.error('Failed to delete playlist on server:', err);
    } finally {
      removePlaylistFromCache(playlistToDelete.id);
      setPlaylists(prev => {
        const next = prev.filter(p => p.id !== playlistToDelete.id);
        try { localStorage.setItem('slothify_user_playlists_cache', JSON.stringify(next)); } catch (e) {}
        return next;
      });
      window.dispatchEvent(new Event('slothify_playlists_updated'));
      window.dispatchEvent(new Event('slothify_spotify_playlists_updated'));
      setIsDeleting(false);
      setPlaylistToDelete(null);
    }
  };

  useEffect(() => {
    if (initialFilter !== undefined) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]);

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

  // Search & Add State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('My Playlist #' + (playlists.length + 1));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter & Search Logic
  const filteredInAppPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.owner?.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSpotifyPlaylists = spotifyPlaylists.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.owner?.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim()) {
      try {
        await axios.post('/api/me/playlists', { name: newPlaylistName });
        fetchPlaylists(true); // Refresh list
        setIsModalOpen(false);
      } catch (err) {
        console.error("Failed to create playlist", err);
        alert("Failed to create playlist");
      }
    }
  };

  const fetchPlaylists = (isRefresh = false) => {
    if (!isAuthenticated) {
      setPlaylists([]);
      setIsLoading(false);
      return;
    }
    if (!isRefresh && cache.libraryPlaylists) return;

    if (!playlists.length) {
      setIsLoading(!isRefresh);
    }
    axios.get('/api/me/playlists')
      .then(res => {
        if (Array.isArray(res.data)) {
          setPlaylists(res.data);
          setLibraryPlaylists(res.data);
          try {
            localStorage.setItem('slothify_user_playlists_cache', JSON.stringify(res.data));
          } catch (e) {}
        }
      })
      .catch(err => {
        console.error('Failed to fetch library playlists:', err);
      })
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
        setPullMoveY(0);
      });
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setPlaylists([]);
      setIsLoading(false);
      return;
    }
    if (!cache.libraryPlaylists) {
      fetchPlaylists();
    } else {
      setIsLoading(false);
    }
    const handleUpdate = () => {
      if (isAuthenticated) {
        fetchPlaylists(true);
      } else {
        setPlaylists([]);
      }
    };
    window.addEventListener('slothify_playlists_updated', handleUpdate);
    return () => {
      window.removeEventListener('slothify_playlists_updated', handleUpdate);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPlaylists([]);
      return;
    }
    if (cache.libraryPlaylists) {
      setPlaylists(cache.libraryPlaylists);
    }
  }, [cache.libraryPlaylists, isAuthenticated]);

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
      if (diff > 0) setPullMoveY(Math.min(diff, 150));
    }
  };

  const handleTouchEnd = () => {
    if (pullMoveY > 80) {
      setIsRefreshing(true);
      fetchPlaylists(true);
    } else {
      setPullMoveY(0);
      setPullStartY(0);
    }
  };

  // Modal Component for In-App Playlist creation
  const CreatePlaylistModal = () => {
    if (!isModalOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 transition-all duration-300 opacity-100 scale-100">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
        <div className="relative bg-[#282828] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="p-8 flex flex-col items-center text-center space-y-8">
            <h2 className="text-2xl font-bold text-white">Give your playlist a name</h2>
            <div className="w-full border-b-2 border-white/10 focus-within:border-white/40 transition-colors pb-2 px-2">
              <input
                type="text"
                autoFocus
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full bg-transparent text-center text-2xl font-bold text-white outline-none placeholder-white/20"
                placeholder="My Playlist"
              />
            </div>
            <div className="flex flex-col w-full space-y-3 pt-4">
              <button
                onClick={handleCreatePlaylist}
                className={`w-full py-3.5 rounded-full font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all ${
                  isOcean ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-[#f5d0b5] hover:bg-white text-black shadow-lg shadow-[#c87d46]/25'
                }`}
              >
                Create
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full py-3.5 text-white/70 hover:text-white rounded-full font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated && (!isSpotifyConnected || spotifyPlaylists.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6 px-4">
        <div className={`p-6 border rounded-full shadow-xl ${
          isOcean ? 'bg-[#0f172a] border-blue-500/20 text-blue-400' : 'bg-[#18151c] border-white/5 text-[#f5d0b5]'
        }`}>
          <Music2 size={56} />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-2xl font-bold text-white">Your library is ready</h2>
          <p className="text-slate-400 text-sm">
            Sign in to create and sync your private playlists, or import any public Spotify playlist via link.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onOpenAuth}
            className={`px-6 py-3 rounded-full font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all border cursor-pointer ${
              isOcean
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/40 shadow-blue-500/30'
                : 'bg-[#f5d0b5] hover:bg-[#ebd0bc] text-black border-[#f5d0b5]/25 shadow-[#c87d46]/20'
            }`}
          >
            Log In / Sign Up
          </button>
          <button
            onClick={openConnectModal}
            className="px-6 py-3 rounded-full font-bold text-sm bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-lg shadow-[#1DB954]/20 hover:scale-105 active:scale-95 transition-all flex items-center space-x-2 cursor-pointer font-display"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
            </svg>
            <span>Import Spotify Playlist</span>
          </button>
        </div>
      </div>
    );
  }

  // Header Component
  const Header = () => (
    <div className="flex items-center justify-between px-4 py-4 pt-safe sticky top-0 bg-transparent backdrop-blur-md z-20 h-16">
      {isSearchOpen ? (
        <div className="flex items-center flex-1 space-x-3 animate-in fade-in slide-in-from-right duration-200">
          <Search size={20} className="text-slate-400" />
          <input
            autoFocus
            type="text"
            placeholder="Find in playlists..."
            className="bg-transparent border-none outline-none text-white flex-1 placeholder-slate-500 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="text-white font-medium text-sm">Cancel</button>
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-3">
            <img
              src={localAvatar || '/avatars/ghost.png'}
              alt={user?.display_name || user?.username || 'User'}
              className={`w-8 h-8 rounded-full object-cover ring-1 ${isOcean ? 'ring-blue-500/40' : 'ring-[#f5d0b5]/30'}`}
            />
            <h1 className="text-2xl font-bold text-white">Your Library</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSearchOpen(true)} className="text-slate-300 hover:text-white transition-colors" title="Search Library"><Search size={22} /></button>
            <button onClick={() => {
              setNewPlaylistName('My Playlist #' + (playlists.length + 1));
              setIsModalOpen(true);
            }} className="text-slate-300 hover:text-white transition-colors" title="Create Playlist"><Plus size={26} /></button>
          </div>
        </>
      )}
    </div>
  );

  // Filter Chips including In-App & Spotify tabs
  const FilterChips = () => {
    const filters: { key: FilterType | null; label: string; badge?: string; isSpotify?: boolean }[] = [
      { key: null, label: 'All' },
      { key: 'In-App', label: 'In-App', badge: String(playlists.length + 1) },
      { key: 'Spotify', label: 'Spotify', isSpotify: true, badge: isSpotifyConnected ? String(spotifyPlaylists.length) : undefined },
      { key: 'Albums', label: 'Albums' },
      { key: 'Artists', label: 'Artists' },
    ];

    return (
      <div className="flex items-center space-x-2 px-4 mb-4 overflow-x-auto scrollbar-hide">
        {filters.map(({ key, label, badge, isSpotify }) => {
          const isActive = activeFilter === key || (key === null && activeFilter === null);
          return (
            <button
              key={label}
              onClick={() => {
                if (key === 'Albums') navigate('/albums');
                else if (key === 'Artists') navigate('/artists');
                else setActiveFilter(activeFilter === key ? null : key);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                isActive
                  ? isSpotify
                    ? 'bg-[#1DB954] text-black shadow-md shadow-[#1DB954]/25 font-bold'
                    : isOcean
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-[#f5d0b5] text-black shadow-md shadow-[#f5d0b5]/20'
                  : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
              }`}
            >
              {isSpotify && (
                <svg className={`w-3.5 h-3.5 fill-current ${isActive ? 'text-black' : 'text-[#1DB954]'}`} viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                </svg>
              )}
              <span>{label}</span>
              {badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? (isSpotify ? 'bg-black/20 text-black' : 'bg-white/20 text-white') : 'bg-white/10 text-neutral-400'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // Sort & View Toggle
  const SortBar = () => (
    <div className="flex items-center justify-between px-4 sm:px-6 mb-3 text-neutral-400">
      <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        <span>Playlists & Collections</span>
      </div>
      <div className="flex items-center space-x-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/5">
        <button
          onClick={() => setViewMode('grid')}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            viewMode === 'grid' ? 'bg-white/15 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
          title="Grid view"
        >
          <LayoutGrid size={15} />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            viewMode === 'list' ? 'bg-white/15 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
          title="List view"
        >
          <ListMusic size={15} />
        </button>
      </div>
    </div>
  );

  // Robust liked songs count resolution
  const cachedLikedTracks = cache.playlistDetails?.['liked']?.tracks;
  const cachedLikedCount = Array.isArray(cachedLikedTracks)
    ? cachedLikedTracks.length
    : (cache.playlistDetails?.['liked']?.playlist?.tracks?.total || 0);
  const displayLikedCount = likedSongsTotal || likedTrackIds.size || cachedLikedCount || 0;

  // Dual-section visibility toggles
  const showInAppSection = activeFilter === null || activeFilter === 'All' || activeFilter === 'In-App' || activeFilter === 'Playlists';
  const showSpotifySection = activeFilter === null || activeFilter === 'All' || activeFilter === 'Spotify' || activeFilter === 'Playlists';

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto relative animate-in fade-in duration-500 pb-32"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Refresh Indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-all duration-300 z-50"
        style={{ height: pullMoveY > 0 ? `${pullMoveY}px` : '0px', opacity: pullMoveY > 0 ? 1 : 0 }}
      >
        <div className="bg-slate-800 p-2 rounded-full shadow-lg mt-16">
          {isRefreshing ? <RefreshCw className={`animate-spin ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`} size={24} /> : <ArrowDown className={`text-white transition-transform duration-300 ${pullMoveY > 80 ? (isOcean ? 'rotate-180 text-blue-400' : 'rotate-180 text-[#f5d0b5]') : ''}`} size={24} />}
        </div>
      </div>

      <Header />
      <FilterChips />
      <SortBar />

      <div className="space-y-6 px-4 sm:px-6">
        {/* SECTION 1: IN-APP PLAYLISTS */}
        {showInAppSection && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-display">In-App Playlists</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                  {playlists.length + 1}
                </span>
              </div>
              <button
                onClick={() => {
                  setNewPlaylistName('My Playlist #' + (playlists.length + 1));
                  setIsModalOpen(true);
                }}
                className={`text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
                  isOcean ? 'text-blue-400 hover:text-blue-300' : 'text-[#f5d0b5] hover:text-white'
                }`}
              >
                <Plus size={14} />
                <span>New</span>
              </button>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {/* Liked Songs - Pinned Grid Card */}
                <div
                  onClick={() => navigate('/liked')}
                  className="group relative p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer flex flex-col space-y-2.5"
                >
                  <div className={`aspect-square w-full rounded-xl flex items-center justify-center relative overflow-hidden shadow-lg ${
                    isOcean
                      ? 'bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#3b82f6]'
                      : 'bg-gradient-to-br from-[#c87d46] via-[#d97736] to-[#f5d0b5]'
                  }`}>
                    <Heart size={44} className="text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white flex items-center space-x-1">
                      <Pin size={10} className="rotate-45" />
                      <span>Pinned</span>
                    </div>
                    <div className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 ${
                      isOcean ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-[#f5d0b5] text-black shadow-[#c87d46]/30'
                    }`}>
                      <Play size={18} fill="currentColor" className="ml-0.5" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-sm truncate group-hover:text-blue-400 transition-colors">Liked Songs</h3>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">Playlist • {displayLikedCount} songs</p>
                  </div>
                </div>

                {/* In-App Playlists Grid Cards */}
                {isLoading ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                      <div className="aspect-square bg-white/5 rounded-xl animate-pulse" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 bg-white/5 rounded w-3/4 animate-pulse" />
                        <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : (
                  filteredInAppPlaylists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => navigate(`/playlist/${playlist.id}`)}
                      className="group relative p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer flex flex-col space-y-2.5"
                    >
                      <div className="aspect-square w-full rounded-xl overflow-hidden relative shadow-lg bg-[#181818]">
                        <PlaylistCover images={playlist.images} tracks={playlist.tracks} iconSize={36} alt={playlist.name} />
                        <div className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 ${
                          isOcean ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-[#f5d0b5] text-black shadow-[#c87d46]/30'
                        }`}>
                          <Play size={18} fill="currentColor" className="ml-0.5" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlaylistToDelete(playlist);
                          }}
                          title="Delete Playlist"
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-rose-600 text-white/80 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm truncate group-hover:text-blue-400 transition-colors">{playlist.name}</h3>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          Playlist • {playlist.tracks?.total || 0} songs
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* List View for In-App Playlists */
              <div className="space-y-1">
                {/* Liked Songs Row */}
                <div onClick={() => navigate('/liked')} className="flex items-center space-x-3.5 p-2 rounded-xl hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors cursor-pointer group">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                    isOcean
                      ? 'bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#3b82f6]'
                      : 'bg-gradient-to-br from-[#c87d46] via-[#d97736] to-[#f5d0b5]'
                  }`}>
                    <Heart size={22} className="text-white fill-white" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="font-bold text-white text-sm truncate group-hover:text-blue-400 transition-colors">Liked Songs</h3>
                    <div className="flex items-center text-xs text-neutral-400 mt-0.5 space-x-1.5">
                      <Pin size={11} className={`${isOcean ? 'text-blue-400 fill-blue-400' : 'text-[#f5d0b5] fill-[#f5d0b5]'} rotate-45`} />
                      <span className="truncate">Playlist • {displayLikedCount} songs</span>
                    </div>
                  </div>
                </div>

                {isLoading ? (
                  [1, 2].map(i => (
                    <div key={i} className="flex items-center space-x-3.5 p-2">
                      <div className="w-12 h-12 bg-white/5 rounded-xl animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-white/5 rounded w-1/3 animate-pulse" />
                        <div className="h-3 bg-white/5 rounded w-1/4 animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : (
                  filteredInAppPlaylists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => navigate(`/playlist/${playlist.id}`)}
                      className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                          <PlaylistCover images={playlist.images} tracks={playlist.tracks} iconSize={20} alt={playlist.name} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h3 className="font-semibold text-white text-sm truncate group-hover:text-blue-400 transition-colors">{playlist.name}</h3>
                          <p className="text-xs text-neutral-400 truncate mt-0.5">
                            Playlist • {playlist.tracks?.total || 0} songs • {playlist.owner?.display_name || 'Slothify'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlaylistToDelete(playlist);
                        }}
                        title="Delete Playlist"
                        className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-2 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: SPOTIFY PLAYLISTS */}
        {showSpotifySection && (
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded-full bg-[#1DB954] flex items-center justify-center shadow-sm shadow-[#1DB954]/25 flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-black fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                  </svg>
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-display">Spotify Playlists</h2>
                {isSpotifyConnected && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1DB954]/20 text-[#1DB954]">
                    {spotifyPlaylists.length}
                  </span>
                )}
              </div>

              {isSpotifyConnected && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={openImportModal}
                    className="text-xs font-semibold text-[#1DB954] hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Import More</span>
                  </button>
                  <button
                    onClick={disconnectSpotify}
                    className="text-xs text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remove all imported Spotify playlists from this session"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {isSpotifyConnected ? (
              filteredSpotifyPlaylists.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {filteredSpotifyPlaylists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => navigate(`/playlist/${pl.id}`)}
                        className="group relative p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer flex flex-col space-y-2.5"
                      >
                        <div className="aspect-square w-full rounded-xl overflow-hidden relative shadow-lg bg-[#181818]">
                          <img
                            src={pl.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400'}
                            alt={pl.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md flex items-center space-x-1">
                            <svg className="w-3 h-3 text-[#1DB954] fill-current" viewBox="0 0 24 24">
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                            </svg>
                            <span className="text-[10px] font-bold text-white">Spotify</span>
                          </div>
                          <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-xl flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                            <Play size={18} fill="currentColor" className="ml-0.5" />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImportedPlaylist(pl.id);
                            }}
                            title="Remove from session"
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-rose-600 text-white/80 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-white text-sm truncate group-hover:text-[#1DB954] transition-colors">{pl.name}</h3>
                          <p className="text-xs text-neutral-400 truncate mt-0.5">
                            Spotify • {pl.tracks?.total || pl.tracks?.items?.length || 0} songs
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* List View for Spotify Playlists */
                  <div className="space-y-1">
                    {filteredSpotifyPlaylists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => navigate(`/playlist/${pl.id}`)}
                        className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative">
                            <img
                              src={pl.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'}
                              alt={pl.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-[#1DB954] flex items-center justify-center shadow-md">
                              <svg className="w-2 h-2 text-black fill-current" viewBox="0 0 24 24">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h3 className="font-semibold text-white text-sm truncate group-hover:text-[#1DB954] transition-colors">{pl.name}</h3>
                            <p className="text-xs text-neutral-400 truncate mt-0.5">
                              Spotify Playlist • {pl.tracks?.total || pl.tracks?.items?.length || 0} songs • {pl.owner?.display_name || 'Spotify'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImportedPlaylist(pl.id);
                          }}
                          title="Remove from Library (session only)"
                          className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-2 cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                  <p className="text-xs text-neutral-400">
                    No imported Spotify playlists match this filter.
                  </p>
                  <button
                    onClick={openImportModal}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black transition-all shadow-md shadow-[#1DB954]/20 font-display cursor-pointer"
                  >
                    Import Spotify Playlist
                  </button>
                </div>
              )
            ) : (
              /* Disconnected Invitation Card */
              <div className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/30 flex items-center justify-center flex-shrink-0 shadow-md">
                    <svg className="w-5 h-5 text-[#1DB954] fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Import Spotify Playlists via Link</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Paste any public link to import playlists or albums. Kept in local session without account login.</p>
                  </div>
                </div>
                <button
                  onClick={openImportModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black transition-all shadow-md shadow-[#1DB954]/20 flex-shrink-0 font-display cursor-pointer"
                >
                  Import Playlist
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && <CreatePlaylistModal />}

      {/* Delete Confirmation Modal for In-App Playlists */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <Trash2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Delete Playlist?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {playlistToDelete?.isSpotify || playlistToDelete?.id?.startsWith('sp_')
                  ? <>Are you sure you want to remove <span className="text-white font-semibold">&ldquo;{playlistToDelete.name}&rdquo;</span> from your library? It will be removed from this session.</>
                  : <>Are you sure you want to delete <span className="text-white font-semibold">&ldquo;{playlistToDelete.name}&rdquo;</span>? This will permanently remove it from your account and cloud database.</>}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPlaylistToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePlaylist}
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

export default Library;
