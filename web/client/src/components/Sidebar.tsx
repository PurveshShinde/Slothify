import React from 'react';
import { Home, Library, Heart, Search, Settings, LogIn } from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  user: User | null;
  isAuthenticated: boolean;
  onNavigateHome: () => void;
  onNavigateSearch: () => void;
  onNavigateLibrary: () => void;
  onNavigateLiked: () => void;
  onNavigatePlaylist: (id: string) => void;
  onNavigateSettings: () => void;
  onCreatePlaylist: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user, isAuthenticated, onNavigateHome, onNavigateSearch, onNavigateLibrary,
  onNavigateLiked, onNavigateSettings, onNavigatePlaylist, onCreatePlaylist
}) => {

  // ROBUST IMAGE CHECK: Handles both Spotify raw API (images) and Passport.js (photos)
  const userImage =
    user?.images?.[0]?.url ||
    (user as any)?.photos?.[0]?.value ||
    'https://i.pravatar.cc/100';

  return (
    <aside className="hidden md:flex w-64 flex-shrink-0 bg-black flex-col p-4 space-y-6 border-r border-white/5">
      <div className="flex items-center space-x-2 px-2 mb-2">
        <h1 className="text-3xl font-brand text-white">Nyx</h1>
      </div>

      <nav className="space-y-1">
        <button onClick={onNavigateHome} className="w-full flex items-center space-x-4 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all">
          <Home size={22} /><span className="font-bold text-sm">Home</span>
        </button>
        <button onClick={onNavigateSearch} className="w-full flex items-center space-x-4 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all">
          <Search size={22} /><span className="font-bold text-sm">Search</span>
        </button>
        <button onClick={onNavigateLibrary} className="w-full flex items-center space-x-4 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all">
          <Library size={22} /><span className="font-bold text-sm">Library</span>
        </button>
        <button onClick={onNavigateSettings} className="w-full flex items-center space-x-4 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all">
          <Settings size={22} /><span className="font-bold text-sm">Settings</span>
        </button>
      </nav>

      <div className="pt-4 space-y-1">
        <button onClick={onNavigateLiked} className="w-full flex items-center space-x-4 px-4 py-3 text-slate-400 hover:text-white transition-colors">
          <Heart size={22} className="text-blue-500 fill-blue-500" /><span className="font-bold text-sm">Liked Songs</span>
        </button>
      </div>

      <div className="mt-auto pt-4 border-t border-white/5">
        {isAuthenticated ? (
          <div className="flex items-center space-x-3 px-3 py-2 bg-slate-900 rounded-xl">
            <img
              src={userImage}
              className="w-8 h-8 rounded-full border border-blue-500 object-cover"
              alt={user?.display_name || "User"}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black text-white truncate">{user?.display_name}</span>
              <span className="text-[10px] text-slate-500">Nyx Premium</span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => window.location.href = '/api/auth/login'}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            <LogIn size={18} />
            <span className="font-bold text-xs uppercase tracking-wider">Login to Spotify</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;