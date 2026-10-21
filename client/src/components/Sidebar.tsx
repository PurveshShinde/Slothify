import React, { useState, useEffect } from 'react';
import {
  Home, Search, Library, Heart, ListMusic, Disc, Users,
  Plus, ChevronDown, Sparkles, LogOut, LogIn, History
} from 'lucide-react';
import { User, Playlist } from '../types';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useCache } from '../context/CacheContext';
import axios from 'axios';

interface SidebarProps {
  user: User | null;
  isAuthenticated: boolean;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  playlists?: Playlist[];
}

const defaultPlaylists = [
  { id: 'late-night-drive', name: 'Late Night Drive', image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=100' },
  { id: 'acoustic-mornings', name: 'Acoustic Mornings', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100' },
  { id: 'heartbreak-diaries', name: 'Heartbreak Diaries', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100' },
  { id: 'good-vibes', name: 'Good Vibes', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100' },
];

const Sidebar: React.FC<SidebarProps> = ({ user, isAuthenticated, onOpenAuth, onLogout, playlists = [] }) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const { cache, setLibraryPlaylists } = useCache();
  const [sidebarPlaylists, setSidebarPlaylists] = useState<any[]>(() => {
    return isAuthenticated ? (cache.libraryPlaylists || []) : [];
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string>(() => {
    return localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
  });

  const fetchPlaylists = async () => {
    try {
      const res = await axios.get('/api/me/playlists');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSidebarPlaylists(res.data);
        setLibraryPlaylists(res.data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlaylists();
    } else {
      setSidebarPlaylists([]);
    }
    const handleUpdate = () => {
      if (isAuthenticated) {
        fetchPlaylists();
      } else {
        setSidebarPlaylists([]);
      }
    };
    window.addEventListener('slothify_playlists_updated', handleUpdate);
    return () => {
      window.removeEventListener('slothify_playlists_updated', handleUpdate);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && cache.libraryPlaylists) {
      setSidebarPlaylists(cache.libraryPlaylists);
    } else if (!isAuthenticated) {
      setSidebarPlaylists([]);
    }
  }, [cache.libraryPlaylists, isAuthenticated]);

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

  const userImage = localAvatar || '/avatars/ghost.png';

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-xl text-sm transition-all duration-150 ${
      isActive
        ? isOcean
          ? 'bg-[#131d33] text-[#60a5fa] font-medium border border-blue-500/25 shadow-sm'
          : 'bg-[#241c19] text-[#f5d0b5] font-medium border border-[#f5d0b5]/20 shadow-sm'
        : 'text-[#8a8489] hover:text-white hover:bg-white/[0.03]'
    }`;

  const currentList = isAuthenticated ? (playlists.length > 0 ? playlists : sidebarPlaylists) : [];

  const displayedPlaylists = isAuthenticated && currentList.length > 0
    ? currentList.map(p => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100'
      }))
    : [];

  return (
    <aside className={`hidden md:flex w-60 flex-shrink-0 flex-col p-4 space-y-5 border-r select-none transition-colors duration-300 z-20 bg-black/35 backdrop-blur-2xl border-white/10`}>
      {/* Brand Header: Clean Wordmark */}
      <div className="pt-3 pb-3 px-2 flex flex-col items-center justify-center">
        <h1 className="text-xs font-bold tracking-[0.35em] text-[#e8ded6] uppercase text-center pl-1">
          Slothify
        </h1>
      </div>

      {/* Main Navigation Menu */}
      <nav className="space-y-1">
        <NavLink to="/" className={navClass} end>
          <Home size={18} strokeWidth={1.8} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/search" className={navClass}>
          <Search size={18} strokeWidth={1.8} />
          <span>Search</span>
        </NavLink>
        <NavLink to="/library" className={navClass} end>
          <Library size={18} strokeWidth={1.8} />
          <span>Your Library</span>
        </NavLink>
        <NavLink to="/liked" className={navClass}>
          <Heart size={18} strokeWidth={1.8} />
          <span>Liked Songs</span>
        </NavLink>
        <NavLink to="/playlists" className={navClass}>
          <ListMusic size={18} strokeWidth={1.8} />
          <span>Playlists</span>
        </NavLink>
        <NavLink to="/albums" className={navClass}>
          <Disc size={18} strokeWidth={1.8} />
          <span>Albums</span>
        </NavLink>
        <NavLink to="/artists" className={navClass}>
          <Users size={18} strokeWidth={1.8} />
          <span>Artists</span>
        </NavLink>
        <NavLink to="/history" className={navClass}>
          <History size={18} strokeWidth={1.8} />
          <span>Listening History</span>
        </NavLink>
      </nav>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* Playlists Quick Access Section */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
        <div className="flex items-center justify-between px-2 text-[10px] font-bold tracking-[0.18em] text-[#8a8489] uppercase">
          <span>Your Playlists</span>
          <button
            onClick={() => navigate('/library')}
            className="hover:text-white transition-colors"
            title="Create Playlist"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-1">
          {displayedPlaylists.length > 0 ? (
            displayedPlaylists.map(item => (
              <div
                key={item.id}
                onClick={() => navigate(`/playlist/${item.id}`)}
                className="flex items-center space-x-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-5 h-5 rounded-md object-cover flex-shrink-0"
                />
                <span className="text-xs text-[#c4beb6] group-hover:text-white truncate">
                  {item.name}
                </span>
              </div>
            ))
          ) : (
            <div className="px-2 py-4 text-center">
              <p className="text-[11px] text-[#8a8489]">
                {isAuthenticated ? 'No playlists yet' : 'Sign in to create playlists'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* User Profile / Status at Bottom */}
      <div className="pt-3 border-t border-white/[0.04] relative">
        {isAuthenticated ? (
          <div>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.03] transition-colors group"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <img
                  src={userImage}
                  alt=""
                  className={`w-7 h-7 rounded-full object-cover ring-1 flex-shrink-0 ${
                    isOcean ? 'ring-blue-500/30' : 'ring-[#f5d0b5]/20'
                  }`}
                />
                <span className="text-xs font-medium text-[#c4beb6] group-hover:text-white truncate">
                  {user?.username || user?.display_name || 'madebyuser'}
                </span>
              </div>
              <ChevronDown size={14} className="text-[#8a8489] flex-shrink-0" />
            </button>

            {showProfileMenu && (
              <div className={`absolute bottom-14 left-2 right-2 border rounded-xl p-2 shadow-2xl space-y-1 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                isOcean ? 'bg-[#0f172a] border-blue-500/20' : 'bg-[#17151b] border-white/[0.08]'
              }`}>
                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg"
                >
                  Settings & Account
                </button>
                {onLogout && (
                  <button
                    onClick={() => { setShowProfileMenu(false); onLogout(); }}
                    className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center space-x-2"
                  >
                    <LogOut size={13} />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className={`w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
              isOcean
                ? 'bg-[#131d33] hover:bg-[#1a2744] text-[#60a5fa] border-blue-500/30 shadow-md shadow-blue-500/10'
                : 'bg-[#241c19] hover:bg-[#2e2320] text-[#f5d0b5] border-[#f5d0b5]/20'
            }`}
          >
            <LogIn size={14} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;