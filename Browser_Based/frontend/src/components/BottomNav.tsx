
import React from 'react';
import { Home, Search, Library, BarChart2 } from 'lucide-react';

interface BottomNavProps {
  activeView: string;
  onNavigateHome: () => void;
  onNavigateSearch: () => void;
  onNavigateLibrary: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeView, onNavigateHome, onNavigateSearch, onNavigateLibrary }) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-950/95 border-t border-white/5 flex items-center justify-around px-4 z-[60]">
      <button onClick={onNavigateHome} className={`p-2 transition-colors ${activeView === 'home' ? 'text-white' : 'text-slate-600'}`}>
        <Home size={26} strokeWidth={activeView === 'home' ? 2.5 : 2} />
      </button>
      <button onClick={onNavigateSearch} className={`p-2 transition-colors ${activeView === 'search' ? 'text-white' : 'text-slate-600'}`}>
        <Search size={26} strokeWidth={activeView === 'search' ? 2.5 : 2} />
      </button>
      <button onClick={() => { }} className="p-2 text-slate-600">
        <div className="w-7 h-7 border-2 border-slate-600 rounded-md flex flex-col items-center justify-center space-y-0.5">
          <div className="w-4 h-0.5 bg-slate-600 rounded-full"></div>
          <div className="w-4 h-0.5 bg-slate-600 rounded-full"></div>
          <div className="w-4 h-0.5 bg-slate-600 rounded-full"></div>
        </div>
      </button>
      <button onClick={onNavigateLibrary} className={`p-2 transition-colors ${activeView === 'library' ? 'text-white' : 'text-slate-600'}`}>
        <BarChart2 size={26} className="rotate-90" strokeWidth={activeView === 'library' ? 2.5 : 2} />
      </button>
    </nav>
  );
};

export default BottomNav;
