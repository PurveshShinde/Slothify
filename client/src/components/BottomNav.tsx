
import React from 'react';
import { Home, Search, BarChart2, Download } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const getNavClass = (isActive: boolean) => `p-2 transition-colors ${isActive ? 'text-white' : 'text-slate-600'}`;
  const getStroke = (isActive: boolean) => isActive ? 2.5 : 2;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/95 border-t border-white/5 flex items-center justify-around px-4 z-[60]">
      <NavLink to="/" className={({ isActive }) => getNavClass(isActive)} end>
        {({ isActive }) => <Home size={26} strokeWidth={getStroke(isActive)} />}
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => getNavClass(isActive)}>
        {({ isActive }) => <Search size={26} strokeWidth={getStroke(isActive)} />}
      </NavLink>
      <NavLink to="/downloads" className={({ isActive }) => getNavClass(isActive)}>
        {({ isActive }) => <Download size={26} strokeWidth={getStroke(isActive)} />}
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => getNavClass(isActive)}>
        {({ isActive }) => <BarChart2 size={26} className="rotate-90" strokeWidth={getStroke(isActive)} />}
      </NavLink>
    </nav>
  );
};

export default BottomNav;
