import React from 'react';
import { Home, Library, Heart, Search, Settings, LogIn } from 'lucide-react';
import { User } from '../types';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  user: User | null;
  isAuthenticated: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ user, isAuthenticated }) => {
  // ROBUST IMAGE CHECK
  const userImage =
    user?.images?.[0]?.url ||
    (user as any)?.photos?.[0]?.value ||
    'https://i.pravatar.cc/100';

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`;

  return (
    <aside className="hidden md:flex w-64 flex-shrink-0 bg-black flex-col p-4 space-y-6 border-r border-white/5">
      <div className="flex items-center space-x-2 px-2 mb-2">
        <h1 className="text-3xl font-brand text-white">Nyx</h1>
      </div>

      <nav className="space-y-1">
        <NavLink to="/" className={navClass} end>
          <Home size={22} /><span className="font-bold text-sm">Home</span>
        </NavLink>
        <NavLink to="/search" className={navClass}>
          <Search size={22} /><span className="font-bold text-sm">Search</span>
        </NavLink>
        <NavLink to="/library" className={navClass}>
          <Library size={22} /><span className="font-bold text-sm">Library</span>
        </NavLink>
        <NavLink to="/settings" className={navClass}>
          <Settings size={22} /><span className="font-bold text-sm">Settings</span>
        </NavLink>
      </nav>

      <div className="pt-4 space-y-1">
        <NavLink to="/liked" className={({ isActive }) => `w-full flex items-center space-x-4 px-4 py-3 transition-colors ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
          <Heart size={22} className="text-blue-500 fill-blue-500" /><span className="font-bold text-sm">Liked Songs</span>
        </NavLink>
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