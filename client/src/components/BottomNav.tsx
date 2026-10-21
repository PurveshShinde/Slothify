
import React from 'react';
import { Home, Search, Library, Clock, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const BottomNav: React.FC = () => {
  const { isOcean } = useTheme();
  const getNavClass = (isActive: boolean) =>
    `flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 ${
      isActive
        ? (isOcean ? 'text-blue-400 font-bold' : 'text-[#f5d0b5] font-bold')
        : 'text-[#8a8489] hover:text-white'
    }`;

  return (
    <nav className={`md:hidden fixed bottom-0 left-0 right-0 h-16 backdrop-blur-2xl border-t flex items-center justify-around px-3 z-[60] ${
      isOcean ? 'bg-[#070e1c]/95 border-blue-500/15' : 'bg-[#0c0b0f]/95 border-white/[0.05]'
    }`}>
      <NavLink to="/" className={({ isActive }) => getNavClass(isActive)} end>
        {({ isActive }) => (
          <div className="flex flex-col items-center space-y-0.5">
            <Home size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold">Home</span>
          </div>
        )}
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => getNavClass(isActive)}>
        {({ isActive }) => (
          <div className="flex flex-col items-center space-y-0.5">
            <Search size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold">Search</span>
          </div>
        )}
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => getNavClass(isActive)}>
        {({ isActive }) => (
          <div className="flex flex-col items-center space-y-0.5">
            <Library size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold">Library</span>
          </div>
        )}
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => getNavClass(isActive)}>
        {({ isActive }) => (
          <div className="flex flex-col items-center space-y-0.5">
            <Clock size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold">History</span>
          </div>
        )}
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => getNavClass(isActive)}>
        {({ isActive }) => (
          <div className="flex flex-col items-center space-y-0.5">
            <Settings size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold">Settings</span>
          </div>
        )}
      </NavLink>
    </nav>
  );
};

export default BottomNav;
