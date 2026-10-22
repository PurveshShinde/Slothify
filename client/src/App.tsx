import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CacheProvider } from './context/CacheContext';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistsPage from './pages/PlaylistsPage';
import AlbumsPage from './pages/AlbumsPage';
import ArtistsPage from './pages/ArtistsPage';
import PlaylistDetail from './pages/PlaylistDetail';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import History from './pages/History';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import BottomNav from './components/BottomNav';
import Player from './components/Player';
import ScrollToTop from './components/ScrollToTop';
import BrandLogo from './components/BrandLogo';
import { User, Track } from './types';
import axios from 'axios';
import { AuthModal } from './components/AuthModal';

const App: React.FC = () => {
  const { isOcean } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [localAvatar, setLocalAvatar] = useState<string>(() => {
    return localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
  });

  const [user, setUser] = useState<User | null>(() => {
    const avatar = localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
    return {
      id: 'guest',
      display_name: 'Slothify Guest',
      images: [{ url: avatar }]
    };
  });

  useEffect(() => {
    const handleAvatarUpdate = () => {
      const saved = localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
      setLocalAvatar(saved);
      setUser(prev => prev ? { ...prev, images: [{ url: saved }] } : null);
    };
    window.addEventListener('slothify_avatar_changed', handleAvatarUpdate);
    window.addEventListener('storage', handleAvatarUpdate);
    return () => {
      window.removeEventListener('slothify_avatar_changed', handleAvatarUpdate);
      window.removeEventListener('storage', handleAvatarUpdate);
    };
  }, []);

  // ✅ GLOBAL AUDIO STATE
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);


  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isTurntableOpen, setIsTurntableOpen] = useState(false);

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

    // Record listening history only for registered/authenticated accounts
    if (isAuthenticated && track && track.id) {
      axios.post('/api/me/history', { track }).catch(() => {});
    }
  }, [isAuthenticated]);

  const handleTrackChange = useCallback((track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);

    // Record listening history only for registered/authenticated accounts
    if (isAuthenticated && track && track.id) {
      axios.post('/api/me/history', { track }).catch(() => {});
    }
  }, [isAuthenticated]);

  const handlePlayPause = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleToggleLike = useCallback((trackOrId: string | Track, passedTrack?: Track) => {
    let trackId: string;
    let targetTrack: Track | undefined;

    if (typeof trackOrId === 'string') {
      trackId = trackOrId;
      targetTrack = passedTrack || (currentTrack?.id === trackId ? currentTrack : queue.find(t => t.id === trackId));
    } else {
      trackId = trackOrId.id;
      targetTrack = trackOrId;
    }

    if (!targetTrack) {
      targetTrack = {
        id: trackId,
        uri: `spotify:track:${trackId}`,
        name: 'Liked Track',
        artists: [{ name: 'Unknown Artist' }],
        album: { name: 'Single', images: [] },
        duration_ms: 180000
      };
    }

    const wasLiked = likedTrackIds.has(trackId);

    // Optimistically update UI
    setLikedTrackIds(prev => {
      const next = new Set(prev);
      if (wasLiked) {
        next.delete(trackId);
        setLikedSongsTotal(t => Math.max(0, t - 1));
      } else {
        next.add(trackId);
        setLikedSongsTotal(t => t + 1);
      }
      return next;
    });

    // Save locally in browser localStorage only for guest users (so guest likes survive restarts)
    if (!isAuthenticated) {
      try {
        const stored = localStorage.getItem('slothify_guest_likes');
        let localLikes: Track[] = stored ? JSON.parse(stored) : [];
        if (wasLiked) {
          localLikes = localLikes.filter(t => t.id !== trackId);
        } else {
          if (!localLikes.some(t => t.id === trackId)) {
            localLikes.unshift(targetTrack);
          }
        }
        localStorage.setItem('slothify_guest_likes', JSON.stringify(localLikes));
      } catch (e) {
        console.warn('LocalStorage like save error:', e);
      }
    }

    // Persist to backend (encrypted in DB if logged in, or local library store)
    axios.post('/api/me/tracks', { track: targetTrack, trackId })
      .then(response => {
        if (response.data.total !== undefined) {
          setLikedSongsTotal(response.data.total);
        }
        if (response.data.liked !== undefined) {
          setLikedTrackIds(prev => {
            const next = new Set(prev);
            if (response.data.liked) next.add(trackId);
            else next.delete(trackId);
            return next;
          });
        }
      })
      .catch(err => {
        console.error("Failed to persist liked song on server:", err);
      });
  }, [currentTrack, queue, likedTrackIds]);

  const fetchLikedSongs = useCallback(() => {
    axios.get('/api/me/tracks')
      .then(response => {
        const { items, total } = response.data;
        const ids = new Set<string>();
        if (Array.isArray(items)) {
          items.forEach((track: any) => {
            if (track && track.id) ids.add(track.id);
          });
        }

        // For unauthenticated guests only, check if they have locally cached likes in browser
        if (!isAuthenticated && ids.size === 0) {
          try {
            const stored = localStorage.getItem('slothify_guest_likes');
            if (stored) {
              const localLikes: Track[] = JSON.parse(stored);
              localLikes.forEach(t => ids.add(t.id));
              setLikedTrackIds(ids);
              setLikedSongsTotal(localLikes.length);
              return;
            }
          } catch (e) { }
        }

        setLikedTrackIds(ids);
        setLikedSongsTotal(total !== undefined ? total : ids.size);
      })
      .catch(err => {
        console.error("Failed to fetch liked songs from backend, checking browser cache:", err);
        try {
          const stored = localStorage.getItem('slothify_guest_likes');
          if (stored) {
            const localLikes: Track[] = JSON.parse(stored);
            const ids = new Set<string>(localLikes.map(t => t.id));
            setLikedTrackIds(ids);
            setLikedSongsTotal(ids.size);
          }
        } catch (e) { }
      });
  }, []);

  // Check stored auth token on mount
  useEffect(() => {
    const token = localStorage.getItem('slothify_auth_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get('/api/auth/me')
        .then(res => {
          if (res.data.authenticated) {
            setIsAuthenticated(true);
            const avatarUrl = localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
            setUser({
              ...res.data.user,
              images: [{ url: avatarUrl }]
            });
          }
        })
        .catch(() => {
          localStorage.removeItem('slothify_auth_token');
          delete axios.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          setIsCheckingAuth(false);
          fetchLikedSongs();
        });
    } else {
      setIsCheckingAuth(false);
      fetchLikedSongs();
    }
  }, [fetchLikedSongs]);

  // Ping backend every 8 minutes while browser tab is open to prevent Render free-tier spin-down
  useEffect(() => {
    const pingBackend = () => {
      axios.get('/api/auth/status').catch(() => {});
    };
    pingBackend();
    const interval = setInterval(pingBackend, 8 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);


  const handleAuthSuccess = (token: string, authUser: any) => {
    localStorage.setItem('slothify_auth_token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setIsAuthenticated(true);

    // Clear stale cached playlists from previous session so newly authenticated user starts fresh
    try {
      localStorage.removeItem('slothify_browser_cache_v2');
      localStorage.removeItem('slothify_browser_cache_v1');
    } catch (e) { }

    const avatarUrl = localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
    const normalizedUser = {
      ...authUser,
      display_name: authUser.display_name || authUser.username || 'Listener',
      username: authUser.username,
      images: [{ url: avatarUrl }]
    };
    setUser(normalizedUser);

    // Sync guest likes to newly authenticated account in background
    try {
      const stored = localStorage.getItem('slothify_guest_likes');
      if (stored) {
        const guestLikes: Track[] = JSON.parse(stored);
        if (guestLikes.length > 0) {
          Promise.all(guestLikes.map(track => axios.post('/api/me/tracks', { track })))
            .then(() => fetchLikedSongs())
            .catch(e => console.warn('Could not sync guest likes:', e));
        }
      }
    } catch (e) { }

    fetchLikedSongs();
    window.dispatchEvent(new Event('slothify_playlists_updated'));
  };

  const handleLogout = () => {
    localStorage.removeItem('slothify_auth_token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser({
      id: 'guest',
      display_name: 'Slothify Guest',
      images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }]
    });
    setLikedTrackIds(new Set());
    setLikedSongsTotal(0);
    try {
      localStorage.removeItem('slothify_guest_likes');
      localStorage.removeItem('slothify_browser_cache_v2');
      localStorage.removeItem('slothify_browser_cache_v1');
    } catch (e) { }
    window.dispatchEvent(new Event('slothify_playlists_updated'));
    fetchLikedSongs();
  };

  const handleDeleteAccount = async () => {
    await axios.delete('/api/auth/account');
    handleLogout();
  };

  const openAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  if (isCheckingAuth) {
    return (
      <div className={`h-screen w-full flex items-center justify-center relative overflow-hidden select-none ${
        isOcean ? 'bg-[#040e1a]' : 'bg-[#120905]'
      }`}>
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60 scale-105 pointer-events-none"
          style={{
            backgroundImage: isOcean
              ? "url('/Ocean.jpg')"
              : "url('/Autumn.jpg')",
            imageRendering: '-webkit-optimize-contrast' as any,
            filter: isOcean ? 'contrast(1.05) saturate(1.1)' : 'contrast(1.1) saturate(1.15) brightness(0.95)'
          }}
        />
        <div className={`absolute inset-0 pointer-events-none ${
          isOcean
            ? 'bg-gradient-to-b from-[#040e1a]/80 via-[#030d1c]/85 to-[#020710]/90'
            : 'bg-gradient-to-b from-[#140803]/50 via-[#1a0a04]/60 to-[#0d0502]/75'
        }`} />
        <div className={`relative z-10 w-12 h-12 border-4 ${
          isOcean ? 'border-cyan-400' : 'border-[#f5d0b5]'
        } border-t-transparent rounded-full animate-spin`} />
      </div>
    );
  }

  return (
    <CacheProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className={`flex h-screen text-slate-100 overflow-hidden select-none flex-col md:flex-row font-sans relative ${
          isOcean ? 'bg-[#040e1a]' : 'bg-[#120905]'
        }`}>
          {/* Ambient Thematic Scenery Background Layer (Ocean Waves vs Autumn Scenery) */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Scenery Background Image */}
            <div
              className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-105 ${
                isOcean ? 'opacity-70' : 'opacity-85'
              }`}
              style={{
                backgroundImage: isOcean
                  ? "url('/Ocean.jpg')"
                  : "url('/Autumn.jpg')",
                imageRendering: '-webkit-optimize-contrast' as any,
                filter: isOcean ? 'contrast(1.05) saturate(1.1)' : 'contrast(1.1) saturate(1.15) brightness(0.95)'
              }}
            />
            {/* Atmospheric Mood Vignette */}
            <div
              className={`absolute inset-0 transition-colors duration-1000 ${
                isOcean
                  ? 'bg-gradient-to-b from-[#020914]/50 via-[#030e1c]/60 to-[#020812]/75'
                  : 'bg-gradient-to-b from-[#140803]/35 via-[#1a0a04]/45 to-[#0d0502]/60'
              }`}
            />
            {/* Atmospheric Dynamic Radial Ambient Lights */}
            <div
              className={`absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[160px] opacity-25 transition-all duration-700 pointer-events-none ${
                isOcean ? 'bg-cyan-600' : 'bg-[#d97736]'
              }`}
            />
            <div
              className={`absolute top-1/2 -right-32 w-[550px] h-[550px] rounded-full blur-[180px] opacity-20 transition-all duration-700 pointer-events-none ${
                isOcean ? 'bg-blue-600' : 'bg-[#c87d46]'
              }`}
            />
          </div>

          <Sidebar
            user={user}
            isAuthenticated={isAuthenticated}
            onOpenAuth={() => openAuth('login')}
            onLogout={handleLogout}
          />

          <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto relative scrollbar-hide z-10">
            {/* Minimalist Mobile Brand Bar */}
            <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-xl border-b border-white/[0.06]">
              <BrandLogo size="sm" />
              <div className="flex items-center space-x-2">
                {!isAuthenticated ? (
                  <button
                    onClick={() => openAuth('login')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                      isOcean
                        ? 'bg-[#0e2236] hover:bg-[#15314d] text-cyan-300 border border-cyan-500/30'
                        : 'bg-[#241c19] hover:bg-[#2e2320] text-[#f5d0b5] border border-[#f5d0b5]/20'
                    }`}
                  >
                    Sign In
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                    <img
                      src={localAvatar || '/avatars/ghost.png'}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span className="text-[11px] font-bold text-white max-w-[90px] truncate">{user?.display_name || user?.username}</span>
                  </div>
                )}
              </div>
            </header>

            <div className="p-4 md:px-8 md:pt-6 md:pb-36">
              <Routes>
                <Route path="/" element={
                  <Home
                    isAuthenticated={isAuthenticated}
                    onPlayTrack={handlePlayTrack}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onToggleLike={handleToggleLike}
                    likedTrackIds={likedTrackIds}
                    onOpenTurntable={() => setIsTurntableOpen(true)}
                  />
                } />
                <Route path="/search" element={
                  <Search
                    isAuthenticated={isAuthenticated}
                    onPlayTrack={handlePlayTrack}
                  />
                } />
                <Route path="/library" element={
                  <Library
                    isAuthenticated={isAuthenticated}
                    user={user}
                    likedTrackIds={likedTrackIds}
                    likedSongsTotal={likedSongsTotal}
                    onOpenAuth={() => openAuth('login')}
                  />
                } />
                <Route path="/playlists" element={
                  <PlaylistsPage
                    isAuthenticated={isAuthenticated}
                    user={user}
                    onOpenAuth={() => openAuth('login')}
                  />
                } />
                <Route path="/albums" element={
                  <AlbumsPage
                    onPlayTrack={handlePlayTrack}
                  />
                } />
                <Route path="/artists" element={
                  <ArtistsPage />
                } />
                {/* Downloads route commented out for future use
                <Route path="/downloads" element={<Downloads />} />
                */}
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
                <Route path="/history" element={
                  <History
                    isAuthenticated={isAuthenticated}
                    onPlayTrack={handlePlayTrack}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    currentTrackId={currentTrack?.id}
                    onOpenAuth={() => openAuth('login')}
                  />
                } />
                <Route path="/settings" element={
                  <Settings
                    user={user}
                    isAuthenticated={isAuthenticated}
                    onOpenAuth={() => openAuth('login')}
                    onLogout={handleLogout}
                    onDeleteAccount={handleDeleteAccount}
                  />
                } />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
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
            onQueueChange={setQueue}
            isTurntableOpen={isTurntableOpen}
            setIsTurntableOpen={setIsTurntableOpen}
          />

          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onAuthSuccess={handleAuthSuccess}
            initialMode={authModalMode}
          />
        </div>
      </BrowserRouter>
    </CacheProvider>
  );
};

export default App;