import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CacheProvider } from './context/CacheContext';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistDetail from './pages/PlaylistDetail';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import BottomNav from './components/BottomNav';
import Player from './components/Player';
import { User, Track } from './types';
import axios from 'axios';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  // ✅ GLOBAL AUDIO STATE
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);


  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

  // ✅ BACK BUTTON HANDLING
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If back button is pressed and player is expanded, close it
      if (isPlayerExpanded) {
        setIsPlayerExpanded(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isPlayerExpanded]);

  const handleToggleExpand = useCallback(() => {
    if (!isPlayerExpanded) {
      // OPEN: Push state so back button works
      window.history.pushState({ expanded: true }, '', '#player');
      setIsPlayerExpanded(true);
    } else {
      // CLOSE: Go back in history (triggers popstate)
      window.history.back();
    }
  }, [isPlayerExpanded]);

  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [likedSongsTotal, setLikedSongsTotal] = useState<number>(0);

  // Check for #player on mount (in case of refresh)
  useEffect(() => {
    if (window.location.hash === '#player') {
      setIsPlayerExpanded(true);
    }
  }, []);

  const handlePlayTrack = useCallback((track: Track, trackQueue?: Track[]) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    if (trackQueue && trackQueue.length > 0) setQueue(trackQueue);
    else setQueue([track]);
  }, []);

  const handleTrackChange = useCallback((track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  }, []);

  const handlePlayPause = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleToggleLike = useCallback((trackId: string) => {
    setLikedTrackIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
        setLikedSongsTotal(t => Math.max(0, t - 1));
      } else {
        newSet.add(trackId);
        setLikedSongsTotal(t => t + 1);
      }
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

          // Fetch Liked Songs
          axios.get('/api/me/tracks').then(response => {
            const { items, total } = response.data;
            // Add IDs to Set
            const ids = new Set<string>();
            items.forEach((track: any) => ids.add(track.id));
            setLikedTrackIds(ids);
            setLikedSongsTotal(total);
          }).catch(err => console.error("Failed to fetch liked songs", err));
        }
      } catch (err) { } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  if (isCheckingAuth) return <div className="h-screen w-full bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <CacheProvider>
      <BrowserRouter>
        <div className="flex h-screen bg-black text-slate-100 overflow-hidden select-none flex-col md:flex-row font-sans">
          <Sidebar user={user} isAuthenticated={isAuthenticated} />

          <main className="flex-1 flex flex-col min-w-0 bg-black overflow-y-auto relative scrollbar-hide">
            <div className="p-4 md:p-8 pb-32">
              <Routes>
                <Route path="/" element={
                  <Home
                    isAuthenticated={isAuthenticated}
                    onPlayTrack={handlePlayTrack}
                  />
                } />
                <Route path="/search" element={
                  <Search
                    isAuthenticated={isAuthenticated}
                    onPlayTrack={handlePlayTrack}
                  />
                } />
                <Route path="/library" element={
                  <Library isAuthenticated={isAuthenticated} user={user} likedTrackIds={likedTrackIds} likedSongsTotal={likedSongsTotal} />
                } />
                <Route path="/downloads" element={<Downloads />} />
                <Route path="/playlist/:id" element={
                  <PlaylistDetail
                    user={user}
                    onPlayTrack={handlePlayTrack}
                    onDownloadRequest={() => { }}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    currentTrackId={currentTrack?.id}
                    isShuffle={isShuffle}
                    onToggleShuffle={() => setIsShuffle(!isShuffle)}
                  />
                } />
                <Route path="/liked" element={
                  <PlaylistDetail
                    user={user}
                    isLikedView={true}
                    onPlayTrack={handlePlayTrack}
                    onDownloadRequest={() => { }}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    currentTrackId={currentTrack?.id}
                    isShuffle={isShuffle}
                    onToggleShuffle={() => setIsShuffle(!isShuffle)}
                  />
                } />
                <Route path="/settings" element={<Settings user={user} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>

          <BottomNav />

          <Player
            currentTrack={currentTrack}
            queue={queue}
            onTrackChange={handleTrackChange}
            isExpanded={isPlayerExpanded}
            onToggleExpand={handleToggleExpand}
            likedTrackIds={likedTrackIds}
            onToggleLike={handleToggleLike}
            onToggleQueue={() => setIsQueueVisible(!isQueueVisible)}
            isQueueVisible={isQueueVisible}
            isPlaying={isPlaying}
            setIsPlaying={handlePlayPause}
            isShuffle={isShuffle}
            onToggleShuffle={() => setIsShuffle(!isShuffle)}
          />
        </div>
      </BrowserRouter>
    </CacheProvider>
  );
};

export default App;