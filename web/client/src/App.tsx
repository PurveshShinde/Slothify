import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistDetail from './pages/PlaylistDetail';
import Settings from './pages/Settings';
import BottomNav from './components/BottomNav';
import Player from './components/Player';
import { User, Track } from './types';
import axios from 'axios';

type ViewType = 'home' | 'playlist' | 'search' | 'library' | 'liked' | 'settings';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [viewHistory, setViewHistory] = useState<ViewType[]>(['home']);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ✅ GLOBAL AUDIO STATE (The missing piece)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false); // Shared playing state
  const [isShuffle, setIsShuffle] = useState(false); // Shared shuffle state

  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());

  const navigateTo = (view: ViewType, playlistId: string | null = null, query: string = '') => {
    if (view !== currentView) setViewHistory(prev => [...prev, view]);
    setCurrentView(view);
    if (playlistId) setActivePlaylistId(playlistId);
    if (view === 'search' && query) setSearchQuery(query);
    setIsPlayerExpanded(false);
  };

  const handleBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop();
      setCurrentView(newHistory[newHistory.length - 1]);
      setViewHistory(newHistory);
    }
  };

  const handlePlayTrack = useCallback((track: Track, trackQueue?: Track[]) => {
    setCurrentTrack(track);
    setIsPlaying(true); // Auto-play new track
    if (trackQueue && trackQueue.length > 0) setQueue(trackQueue);
    else setQueue([track]);
  }, []);

  const handleTrackChange = useCallback((track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  // ✅ Central Play/Pause Handler
  const handlePlayPause = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleToggleLike = useCallback((trackId: string) => {
    setLikedTrackIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) newSet.delete(trackId);
      else newSet.add(trackId);
      return newSet;
    });
  }, []);

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
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden select-none flex-col md:flex-row font-sans">
      <Sidebar
        user={user}
        isAuthenticated={isAuthenticated}
        onNavigateHome={() => navigateTo('home')}
        onNavigateSearch={() => navigateTo('search')}
        onNavigateLibrary={() => navigateTo('library')}
        onNavigateLiked={() => navigateTo('liked')}
        onNavigatePlaylist={(id) => navigateTo('playlist', id)}
        onNavigateSettings={() => navigateTo('settings')}
        onCreatePlaylist={() => { }}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-slate-900 to-slate-950 overflow-y-auto relative scrollbar-hide">
        <div className="p-4 md:p-8 pb-32">
          {currentView === 'home' && (
            <Home
              isAuthenticated={isAuthenticated}
              onPlaylistSelect={(id) => navigateTo('playlist', id)}
              onSettingsClick={() => navigateTo('settings')}
              onSearch={(q) => navigateTo('search', null, q)}
              onPlayTrack={handlePlayTrack}
            />
          )}
          {currentView === 'search' && (
            <Search
              isAuthenticated={isAuthenticated}
              onPlayTrack={handlePlayTrack}
              onBack={handleBack}
              showBack={viewHistory.length > 1}
              initialQuery={searchQuery}
            />
          )}
          {currentView === 'library' && (
            <Library isAuthenticated={isAuthenticated} onPlaylistSelect={(id) => navigateTo('playlist', id)} />
          )}
          {currentView === 'playlist' && activePlaylistId && (
            <PlaylistDetail
              id={activePlaylistId}
              onPlayTrack={handlePlayTrack}
              onDownloadRequest={() => { }}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              onBack={handleBack}
              // Pass Sync Props
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              currentTrackId={currentTrack?.id}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
            />
          )}
          {currentView === 'liked' && (
            <PlaylistDetail
              id="liked-songs"
              title="Liked Songs"
              onPlayTrack={handlePlayTrack}
              onDownloadRequest={() => { }}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              isLikedView={true}
              onBack={handleBack}
              // Pass Sync Props
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              currentTrackId={currentTrack?.id}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
            />
          )}
          {currentView === 'settings' && (
            <Settings user={user} />
          )}
        </div>
      </main>

      <BottomNav
        activeView={currentView}
        onNavigateHome={() => navigateTo('home')}
        onNavigateSearch={() => navigateTo('search')}
        onNavigateLibrary={() => navigateTo('library')}
      />

      {/* ✅ PLAYER WITH SYNC PROPS */}
      <Player
        currentTrack={currentTrack}
        queue={queue}
        onTrackChange={handleTrackChange}
        isExpanded={isPlayerExpanded}
        onToggleExpand={() => setIsPlayerExpanded(!isPlayerExpanded)}
        likedTrackIds={likedTrackIds}
        onToggleLike={handleToggleLike}
        onToggleQueue={() => setIsQueueVisible(!isQueueVisible)}
        isQueueVisible={isQueueVisible}
        // Sync Logic
        isPlaying={isPlaying}
        setIsPlaying={handlePlayPause}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
      />
    </div>
  );
};

export default App;