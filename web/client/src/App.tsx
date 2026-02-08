import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { useStore } from './store/useStore';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistDetail from './pages/PlaylistDetail';
import Settings from './pages/Settings';
import BottomNav from './components/BottomNav';
import Player from './components/Player';
import MobilePlayer from './pages/MobilePlayer';
import Downloads from './pages/Downloads';
import { User, Track } from './types';
import axios from 'axios';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

type ViewType = 'home' | 'playlist' | 'search' | 'library' | 'liked' | 'settings' | 'player' | 'downloads';

const App: React.FC = () => {
  // ✅ GLOBAL STATE
  const {
    isAuthenticated, user, setIsAuthenticated, setUser,
    playTrack,
    // UI
    setIsPlayerExpanded, setIsQueueVisible
  } = useStore();

  useKeyboardShortcuts();

  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Synced with Browser History
  useEffect(() => {
    // Initial state
    window.history.replaceState({ view: 'home' }, '', '#home');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setCurrentView(event.state.view);
      } else {
        // Fallback to home if no state
        setCurrentView('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: ViewType, playlistData?: any, query: string = '') => {
    if (playlistData) setSelectedPlaylist(playlistData);
    if (view === 'search' && query) setSearchQuery(query);

    // Prevent duplicate pushes
    if (view === currentView) {
      // Allow re-navigation for search updates or playlist switches if needed,
      // but for now simplest is to toggle player off if it was open (though view is same)
      // or just return.
      if (view === 'playlist' && selectedPlaylist && playlistData && selectedPlaylist.id !== playlistData.id) {
        // New playlist, proceed
      } else if (view === 'search' && query && query !== searchQuery) {
        // New search, proceed
      } else {
        return;
      }
    }

    window.history.pushState({ view, playlistId: playlistData?.id, query }, '', `#${view}`);
    setCurrentView(view);
    setIsPlayerExpanded(false);
  };

  const handleBack = () => {
    window.history.back();
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get('/api/auth/status');
        if (res.data.authenticated) {
          setIsAuthenticated(true);
          setUser(res.data.user);
        }
      } catch (err) { } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  if (isCheckingAuth) return <div className="h-screen w-full bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="flex h-screen bg-black text-slate-100 overflow-hidden select-none flex-col md:flex-row font-sans">
      <Sidebar
        user={user}
        isAuthenticated={isAuthenticated}
        onNavigateHome={() => navigateTo('home')}
        onNavigateSearch={() => navigateTo('search')}
        onNavigateLibrary={() => navigateTo('library')}
        onNavigateLiked={() => navigateTo('liked')}
        onNavigatePlaylist={(id) => navigateTo('playlist', { id })}
        onNavigateSettings={() => navigateTo('settings')}
        onCreatePlaylist={() => { }}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-black overflow-y-auto relative scrollbar-hide">
        <div className="p-4 md:p-8 pb-32">
          {currentView === 'home' && (
            <Home
              onPlaylistSelect={(id) => navigateTo('playlist', { id })}
              onSettingsClick={() => navigateTo('settings')}
              onSearch={(q) => navigateTo('search', null, q)}
            />
          )}
          {currentView === 'search' && (
            <Search
              onBack={handleBack}
              showBack={true} // Always allow back from search if needed, or check history. length is unreliable with pushState
              initialQuery={searchQuery}
            />
          )}
          {currentView === 'library' && (
            <Library onPlaylistSelect={(id) => navigateTo('playlist', { id })} />
          )}
          {currentView === 'playlist' && selectedPlaylist && (
            <PlaylistDetail
              id={selectedPlaylist.id || selectedPlaylist}
              onDownloadRequest={() => { }}
              onBack={handleBack}
            />
          )}
          {currentView === 'liked' && (
            <PlaylistDetail
              id="liked-songs"
              onDownloadRequest={() => { }}
              isLikedView={true}
              onBack={handleBack}
            />
          )}

          {currentView === 'settings' && (
            <Settings />
          )}
          {currentView === 'player' && (
            <MobilePlayer onBack={handleBack} />
          )}
          {currentView === 'downloads' && (
            <Downloads onBack={handleBack} />
          )}
        </div>
      </main>

      {currentView !== 'player' && (
        <BottomNav
          activeView={currentView}
          onNavigateHome={() => navigateTo('home')}
          onNavigateSearch={() => navigateTo('search')}
          onNavigateLibrary={() => navigateTo('library')}
          onNavigateDownloads={() => navigateTo('downloads')}
        />
      )}

      {/* ✅ PLAYER - ALWAYS MOUNTED (Preserves Audio) */}
      <div className={currentView === 'player' ? 'hidden' : 'block'}>
        <Player onMobileExpand={() => navigateTo('player')} />
      </div>
    </div>
  );
};

export default App;