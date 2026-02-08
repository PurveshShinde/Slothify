
import React from 'react';
import { Home, Search, Library, BarChart2, Download } from 'lucide-react';

interface BottomNavProps {
  activeView: string;
  onNavigateHome: () => void;
  onNavigateSearch: () => void;
  onNavigateLibrary: () => void;
  onNavigateDownloads: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeView, onNavigateHome, onNavigateSearch, onNavigateLibrary, onNavigateDownloads }) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/95 border-t border-white/5 flex items-center justify-around px-4 z-[60]">
      <button onClick={onNavigateHome} className={`p-2 transition-colors ${activeView === 'home' ? 'text-white' : 'text-slate-600'}`}>
        <Home size={26} strokeWidth={activeView === 'home' ? 2.5 : 2} />
      </button>
      <button onClick={onNavigateSearch} className={`p-2 transition-colors ${activeView === 'search' ? 'text-white' : 'text-slate-600'}`}>
        <Search size={26} strokeWidth={activeView === 'search' ? 2.5 : 2} />
      </button>
      <button onClick={onNavigateDownloads} className={`p-2 transition-colors ${activeView === 'downloads' ? 'text-white' : 'text-slate-600'}`}>
        <Download size={26} strokeWidth={activeView === 'downloads' ? 2.5 : 2} />
      </button>
      <button onClick={onNavigateLibrary} className={`p-2 transition-colors ${activeView === 'library' ? 'text-white' : 'text-slate-600'}`}>
        <BarChart2 size={26} className="rotate-90" strokeWidth={activeView === 'library' ? 2.5 : 2} />
      </button>
    </nav>
  );
};

export default BottomNav;
