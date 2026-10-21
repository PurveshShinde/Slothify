import React, { useState, useEffect, useRef } from 'react';
import { Playlist, User } from '../types';
import { Music2, RefreshCw, ArrowDown, Plus, Search, ArrowUpDown, LayoutGrid, Heart, Pin } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';

interface LibraryProps {
  isAuthenticated: boolean;
  user: User | null;
  likedTrackIds: Set<string>;
  likedSongsTotal: number;
  onOpenAuth?: () => void;
  initialFilter?: FilterType | null;
}

type FilterType = 'Playlists' | 'Albums' | 'Artists';

const Library: React.FC<LibraryProps> = ({ isAuthenticated, user, likedTrackIds, likedSongsTotal, onOpenAuth, initialFilter }) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const { cache, setLibraryPlaylists } = useCache();
  const [playlists, setPlaylists] = useState<Playlist[]>(cache.libraryPlaylists || []);
  const [isLoading, setIsLoading] = useState(!cache.libraryPlaylists);
  const [activeFilter, setActiveFilter] = useState<FilterType | null>(initialFilter || null);

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

  // Filter & Search Logic
  const filteredPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.owner.display_name.toLowerCase().includes(searchQuery.toLowerCase())
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
    if (!isRefresh && cache.libraryPlaylists) return;

    setIsLoading(!isRefresh);
    axios.get('/api/me/playlists')
      .then(res => {
        setPlaylists(res.data);
        setLibraryPlaylists(res.data);
      })
      .catch(err => console.error(err))
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
        setPullMoveY(0);
      });
  };

  useEffect(() => {
    if (!cache.libraryPlaylists) {
      fetchPlaylists();
    } else {
      setIsLoading(false);
    }
    const handleUpdate = () => {
      fetchPlaylists(true);
    };
    window.addEventListener('slothify_playlists_updated', handleUpdate);
    return () => {
      window.removeEventListener('slothify_playlists_updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (cache.libraryPlaylists) {
      setPlaylists(cache.libraryPlaylists);
    }
  }, [cache.libraryPlaylists]);

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

  // Modal Component
  const CreatePlaylistModal = () => (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-6 transition-all duration-300 ${isModalOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
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

  if (!isAuthenticated && playlists.length === 0 && likedSongsTotal === 0) {
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
            Log in to sync your playlists and liked songs with Zero-Knowledge encryption, or create playlists right here.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onOpenAuth}
            className={`px-6 py-3 rounded-full font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all border ${
              isOcean
                ? 'bg-[#1e293b] hover:bg-[#334155] text-blue-400 border-blue-500/30'
                : 'bg-[#241c19] hover:bg-[#2e2320] text-[#f5d0b5] border-[#f5d0b5]/25'
            }`}
          >
            Log In / Sign Up
          </button>
          <button
            onClick={() => {
              setNewPlaylistName('My Playlist #1');
              setIsModalOpen(true);
            }}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-sm transition-all"
          >
            Create Playlist
          </button>
        </div>
        <CreatePlaylistModal />
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
            placeholder="Find in playlists"
            className="bg-transparent border-none outline-none text-white flex-1 placeholder-slate-500"
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
            <button onClick={() => setIsSearchOpen(true)} className="text-slate-300 hover:text-white transition-colors"><Search size={22} /></button>
            <button onClick={() => {
              setNewPlaylistName('My Playlist #' + (playlists.length + 1));
              setIsModalOpen(true);
            }} className="text-slate-300 hover:text-white transition-colors"><Plus size={26} /></button>
          </div>
        </>
      )}
    </div>
  );

  // Filter Chips
  const FilterChips = () => (
    <div className="flex items-center space-x-2 px-4 mb-4 overflow-x-auto scrollbar-hide">
      {['Playlists', 'Albums', 'Artists'].map((filter) => {
        const isActive = activeFilter === filter;
        return (
          <button
            key={filter}
            onClick={() => setActiveFilter(activeFilter === filter ? null : filter as FilterType)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              isActive
                ? isOcean
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-[#f5d0b5] text-black shadow-md shadow-[#f5d0b5]/20'
                : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
            }`}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );

  // Sort & View Toggle
  const SortBar = () => (
    <div className="flex items-center justify-between px-4 mb-2 text-slate-400">
      <button className="flex items-center space-x-1 hover:text-white text-sm font-medium transition-colors">
        <ArrowUpDown size={16} />
        <span>Recents</span>
      </button>
      <LayoutGrid size={20} className="hover:text-white transition-colors cursor-pointer" />
    </div>
  );

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

      <div className="space-y-0 px-2">
        {/* Liked Songs - Pinned */}
        <div onClick={() => navigate('/liked')} className="flex items-center space-x-3 p-2 rounded-xl hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors cursor-pointer group">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
            isOcean
              ? 'bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#3b82f6] shadow-blue-600/25'
              : 'bg-gradient-to-br from-[#c87d46] via-[#d97736] to-[#f5d0b5] shadow-[#c87d46]/20'
          }`}>
            <Heart size={28} className="text-white fill-white" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="font-bold text-white text-base truncate group-hover:text-blue-400 transition-colors">Liked Songs</h3>
            <div className="flex items-center text-sm text-slate-400 mt-0.5 space-x-1.5">
              <Pin size={12} className={`${isOcean ? 'text-blue-400 fill-blue-400' : 'text-[#f5d0b5] fill-[#f5d0b5]'} rotate-45`} />
              <span className="truncate">Playlist • {likedSongsTotal} songs</span>
            </div>
          </div>
        </div>

        {/* Playlist List */}
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="flex items-center space-x-3 p-2">
              <div className="w-16 h-16 bg-[#282828] rounded-sm animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#282828] rounded w-1/2 animate-pulse" />
                <div className="h-3 bg-[#282828] rounded w-1/3 animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          filteredPlaylists.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => navigate(`/playlist/${playlist.id}`)}
              className="flex items-center space-x-3 p-2 rounded-md hover:bg-[#1a1a1a] active:bg-[#121212] transition-colors cursor-pointer"
            >
              <img
                src={playlist.images[0]?.url || `https://picsum.photos/seed/${playlist.id}/200`}
                className="w-16 h-16 rounded-sm object-cover flex-shrink-0"
                alt={playlist.name}
              />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-medium text-white text-base truncate">{playlist.name}</h3>
                <p className="text-sm text-[#b3b3b3] truncate mt-0.5">
                  Playlist • {playlist.owner.display_name}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Placeholder Artists/Albums for visual demo if empty */}
        {!isLoading && playlists.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <p>No playlists found.</p>
          </div>
        )}
      </div>

      <CreatePlaylistModal />
    </div>
  );
};

export default Library;
