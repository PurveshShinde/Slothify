import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CacheProvider } from './context/CacheContext';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import PlaylistsPage from './pages/PlaylistsPage';
import AlbumsPage from './pages/AlbumsPage';
import AlbumDetail from './pages/AlbumDetail';
import ArtistsPage from './pages/ArtistsPage';
import ArtistProfile from './pages/ArtistProfile';
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
import Footer from './components/Footer';
import { User, Track } from './types';
import axios from 'axios';
import { AuthModal } from './components/AuthModal';
import { SpotifyProvider } from './context/SpotifyContext';
import SpotifyConnectModal from './components/SpotifyConnectModal';

const App: React.FC = () => {
  const { isOcean } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const token = localStorage.getItem('slothify_auth_token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return true;
      }
    } catch (e) {}
    return false;
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [localAvatar, setLocalAvatar] = useState<string>(() => {
    return localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('slothify_user_profile');
      if (savedUser) return JSON.parse(savedUser);
    } catch (e) {}
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

  const handleOpenFullPlayer = useCallback((mode: 'normal' | 'vintage' = 'normal') => {
    try {
      localStorage.setItem('slothify_mobile_player_style', mode);
      window.dispatchEvent(new CustomEvent('slothify_player_mode_change', { detail: mode }));
    } catch {}
    if (!isPlayerExpanded) {
      window.history.pushState({ expanded: true }, '', '#player');
      setIsPlayerExpanded(true);
    }
  }, [isPlayerExpanded]);

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
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('slothify_liked_track_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
      }
      const guestSaved = localStorage.getItem('slothify_guest_likes');
      if (guestSaved) {
        const guestParsed = JSON.parse(guestSaved);
        if (Array.isArray(guestParsed) && guestParsed.length > 0) {
          return new Set(guestParsed.map((t: any) => t?.id).filter(Boolean));
        }
      }
      const cacheSaved = localStorage.getItem('slothify_browser_cache_v11');
      if (cacheSaved) {
        const cacheParsed = JSON.parse(cacheSaved);
        const likedTracks = cacheParsed?.playlistDetails?.['liked']?.tracks;
        if (Array.isArray(likedTracks) && likedTracks.length > 0) {
          return new Set(likedTracks.map((t: any) => t?.id).filter(Boolean));
        }
      }
    } catch (e) {}
    return new Set();
  });
  const [likedSongsTotal, setLikedSongsTotal] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('slothify_liked_songs_total');
      if (saved !== null && saved !== undefined && saved !== '') {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val > 0) return val;
      }
      const idsSaved = localStorage.getItem('slothify_liked_track_ids');
      if (idsSaved) {
        const parsed = JSON.parse(idsSaved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.length;
      }
      const guestSaved = localStorage.getItem('slothify_guest_likes');
      if (guestSaved) {
        const guestParsed = JSON.parse(guestSaved);
        if (Array.isArray(guestParsed) && guestParsed.length > 0) return guestParsed.length;
      }
      const cacheSaved = localStorage.getItem('slothify_browser_cache_v11');
      if (cacheSaved) {
        const cacheParsed = JSON.parse(cacheSaved);
        const likedTracks = cacheParsed?.playlistDetails?.['liked']?.tracks;
        if (Array.isArray(likedTracks) && likedTracks.length > 0) return likedTracks.length;
        const total = cacheParsed?.playlistDetails?.['liked']?.playlist?.tracks?.total;
        if (typeof total === 'number' && total > 0) return total;
      }
    } catch (e) {}
    return 0;
  });

  // Global followed artists state (synchronized with MongoDB for authenticated accounts)
  const [followedArtistIds, setFollowedArtistIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('slothify_user_followed_artist_ids');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set();
  });
  const [followedArtistsList, setFollowedArtistsList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('slothify_followed_artist_profiles');
      if (saved) {
        const raw = Object.values(JSON.parse(saved));
        const byName = new Map<string, any>();
        raw.forEach((a: any) => {
          if (!a?.name) return;
          const norm = a.name.trim().toLowerCase();
          const existing = byName.get(norm);
          if (!existing) {
            byName.set(norm, a);
          } else {
            const fA = typeof a.followers === 'object' && a.followers !== null ? a.followers.total : (Number(a.followers) || 0);
            const fE = typeof existing.followers === 'object' && existing.followers !== null ? existing.followers.total : (Number(existing.followers) || 0);
            if (fA > fE) byName.set(norm, a);
          }
        });
        const deduped = Array.from(byName.values());
        const cleanMap: Record<string, any> = {};
        deduped.forEach(a => { cleanMap[a.id || a.artistId || a.name] = a; });
        localStorage.setItem('slothify_followed_artist_profiles', JSON.stringify(cleanMap));
        return deduped;
      }
    } catch (e) {}
    return [];
  });

  // Check for #player on mount (in case of refresh)
  useEffect(() => {
    if (window.location.hash === '#player') {
      setIsPlayerExpanded(true);
    }
  }, []);

  const handlePlayTrack = useCallback((track: Track, trackQueue?: Track[]) => {
    const isCurrent = Boolean(currentTrack) && (
      currentTrack?.id === track.id ||
      (Boolean(currentTrack?.name && track.name) &&
        currentTrack?.name.toLowerCase() === track.name.toLowerCase() &&
        currentTrack?.artists?.[0]?.name?.toLowerCase() === track.artists?.[0]?.name?.toLowerCase())
    );

    if (isCurrent) {
      setIsPlaying(prev => !prev);
      return;
    }

    setCurrentTrack(track);
    setIsPlaying(true);
    if (trackQueue && trackQueue.length > 0) setQueue(trackQueue);
    else setQueue([track]);

    // Record listening history only for registered/authenticated accounts
    if (isAuthenticated && track && track.id) {
      axios.post('/api/me/history', { track }).catch(() => {});
    }
  }, [currentTrack, isAuthenticated]);

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
        setLikedSongsTotal(t => {
          const newTotal = Math.max(0, t - 1);
          try { localStorage.setItem('slothify_liked_songs_total', String(newTotal)); } catch (e) {}
          return newTotal;
        });
      } else {
        next.add(trackId);
        setLikedSongsTotal(t => {
          const newTotal = t + 1;
          try { localStorage.setItem('slothify_liked_songs_total', String(newTotal)); } catch (e) {}
          return newTotal;
        });
      }
      try { localStorage.setItem('slothify_liked_track_ids', JSON.stringify(Array.from(next))); } catch (e) {}
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
          try { localStorage.setItem('slothify_liked_songs_total', String(response.data.total)); } catch (e) {}
        }
        if (response.data.liked !== undefined) {
          setLikedTrackIds(prev => {
            const next = new Set(prev);
            if (response.data.liked) next.add(trackId);
            else next.delete(trackId);
            try { localStorage.setItem('slothify_liked_track_ids', JSON.stringify(Array.from(next))); } catch (e) {}
            return next;
          });
        }
      })
      .catch(err => {
        console.error("Failed to persist liked song on server:", err);
      });
  }, [currentTrack, queue, likedTrackIds]);

  const fetchLikedSongs = useCallback(() => {
    // Ultra-fast query using idsOnly=true: zero decryption overhead on the server, instant response!
    axios.get('/api/me/tracks?idsOnly=true')
      .then(response => {
        const { ids: returnedIds, items, total } = response.data;
        const ids = new Set<string>();
        if (Array.isArray(returnedIds)) {
          returnedIds.forEach((id: string) => { if (id) ids.add(id); });
        } else if (Array.isArray(items)) {
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
              try {
                localStorage.setItem('slothify_liked_track_ids', JSON.stringify(Array.from(ids)));
                localStorage.setItem('slothify_liked_songs_total', String(localLikes.length));
              } catch (e) {}
              return;
            }
          } catch (e) { }
        }

        const finalTotal = total !== undefined ? total : ids.size;
        setLikedTrackIds(ids);
        setLikedSongsTotal(finalTotal);

        // Persist to localStorage so data survives hard refresh instantly
        try {
          localStorage.setItem('slothify_liked_track_ids', JSON.stringify(Array.from(ids)));
          localStorage.setItem('slothify_liked_songs_total', String(finalTotal));
        } catch (e) {}
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
            try {
              localStorage.setItem('slothify_liked_track_ids', JSON.stringify(Array.from(ids)));
              localStorage.setItem('slothify_liked_songs_total', String(ids.size));
            } catch (e) {}
          }
        } catch (e) { }
      });
  }, [isAuthenticated]);

  const fetchFollowedArtists = useCallback(() => {
    axios.get('/api/me/artists')
      .then(res => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const ids = new Set<string>();
        const byName = new Map<string, any>();
        items.forEach((a: any) => {
          if (a && (a.id || a.artistId)) {
            const rawId = a.id || a.artistId;
            const norm = (a.name || '').trim().toLowerCase();
            ids.add(rawId);
            if (norm) {
              ids.add(`sp_art_${encodeURIComponent(a.name)}`);
              ids.add(`sp_art_${norm}`);
              ids.add(norm);
              const existing = byName.get(norm);
              if (!existing) {
                byName.set(norm, a);
              } else {
                const fA = typeof a.followers === 'object' && a.followers !== null ? a.followers.total : (Number(a.followers) || 0);
                const fE = typeof existing.followers === 'object' && existing.followers !== null ? existing.followers.total : (Number(existing.followers) || 0);
                if (fA > fE) byName.set(norm, a);
              }
            }
          }
        });

        // For unauthenticated guests only, preserve locally cached followed artists
        if (!isAuthenticated && ids.size === 0) {
          try {
            const saved = localStorage.getItem('slothify_user_followed_artist_ids');
            if (saved) setFollowedArtistIds(new Set(JSON.parse(saved)));
            const savedProfiles = localStorage.getItem('slothify_followed_artist_profiles');
            if (savedProfiles) setFollowedArtistsList(Object.values(JSON.parse(savedProfiles)));
          } catch (e) {}
          return;
        }

        const dedupedItems = Array.from(byName.values());
        const profilesMap: Record<string, any> = {};
        dedupedItems.forEach(a => { profilesMap[a.id || a.artistId || a.name] = a; });

        setFollowedArtistIds(ids);
        setFollowedArtistsList(dedupedItems);
        try {
          localStorage.setItem('slothify_user_followed_artist_ids', JSON.stringify(Array.from(ids)));
          localStorage.setItem('slothify_followed_artist_profiles', JSON.stringify(profilesMap));
        } catch (e) {}
      })
      .catch(err => {
        console.warn("Could not fetch followed artists from backend, using local cache:", err);
      });
  }, [isAuthenticated]);

  const handleToggleFollowArtist = useCallback((artist: any) => {
    const rawId = artist.id || artist.artistId;
    const normName = (artist.name || '').trim().toLowerCase();
    if (!rawId && !normName) return;

    const enc = encodeURIComponent(artist.name || '');
    const aliases = [rawId, `sp_art_${enc}`, `sp_art_${normName}`, `artist-${normName}`, normName].filter(Boolean);

    // Check if any alias or matching name is currently followed
    const isCurrentlyFollowed = aliases.some(id => followedArtistIds.has(id)) ||
      followedArtistsList.some(a => (a.name || '').trim().toLowerCase() === normName);

    const willFollow = !isCurrentlyFollowed;

    // 1. Optimistic UI update: sync all ID aliases
    setFollowedArtistIds(prev => {
      const next = new Set(prev);
      if (willFollow) {
        aliases.forEach(id => next.add(id));
      } else {
        aliases.forEach(id => next.delete(id));
        followedArtistsList
          .filter(a => (a.name || '').trim().toLowerCase() === normName)
          .forEach(a => {
            if (a.id) next.delete(a.id);
            if (a.artistId) next.delete(a.artistId);
          });
      }
      try {
        localStorage.setItem('slothify_user_followed_artist_ids', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });

    // 2. Update followed artists list (Deduplicated strictly by normalized name)
    setFollowedArtistsList(prev => {
      let next: any[];
      if (willFollow) {
        const filtered = prev.filter(a => (a.name || '').trim().toLowerCase() !== normName);
        next = [artist, ...filtered];
      } else {
        next = prev.filter(a => (a.name || '').trim().toLowerCase() !== normName);
      }
      try {
        const map: Record<string, any> = {};
        next.forEach(a => { map[a.id || a.artistId || a.name] = a; });
        localStorage.setItem('slothify_followed_artist_profiles', JSON.stringify(map));
      } catch (e) {}
      return next;
    });

    // 3. Persist to MongoDB if authenticated
    if (isAuthenticated) {
      if (willFollow) {
        axios.post('/api/me/artists', {
          artistId: rawId || `sp_art_${enc}`,
          artistName: artist.name,
          artistImage: artist.images?.[0]?.url || artist.coverImage || artist.image || '',
          followers: artist.followers?.total || artist.followers || 0
        }).catch(err => {
          console.error("Failed to sync followed artist to database:", err);
        });
      } else {
        axios.delete(`/api/me/artists/${encodeURIComponent(rawId)}`).catch(err => {
          console.error("Failed to remove followed artist from database:", err);
        });
      }
    }
  }, [followedArtistIds, followedArtistsList, isAuthenticated]);

  // Check stored auth token on mount & fetch user library state in parallel
  useEffect(() => {
    const token = localStorage.getItem('slothify_auth_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Fetch liked songs & artists immediately in parallel — no waiting for /api/auth/me!
      fetchLikedSongs();
      fetchFollowedArtists();

      axios.get('/api/auth/me')
        .then(res => {
          if (res.data.authenticated) {
            setIsAuthenticated(true);
            const avatarUrl = localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
            const profile = {
              ...res.data.user,
              images: [{ url: avatarUrl }]
            };
            setUser(profile);
            try {
              localStorage.setItem('slothify_user_profile', JSON.stringify(profile));
            } catch (e) {}
          }
        })
        .catch(() => {
          localStorage.removeItem('slothify_auth_token');
          localStorage.removeItem('slothify_user_profile');
          delete axios.defaults.headers.common['Authorization'];
          setIsAuthenticated(false);
          setLikedTrackIds(new Set());
          setLikedSongsTotal(0);
        })
        .finally(() => {
          setIsCheckingAuth(false);
        });
    } else {
      setIsCheckingAuth(false);
      fetchLikedSongs();
      fetchFollowedArtists();
    }
  }, [fetchLikedSongs, fetchFollowedArtists]);

  // Synchronize liked songs count/IDs when any component modifies likes
  useEffect(() => {
    const handleLikesUpdated = () => {
      fetchLikedSongs();
    };
    window.addEventListener('slothify_likes_updated', handleLikesUpdated);
    return () => window.removeEventListener('slothify_likes_updated', handleLikesUpdated);
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
    try {
      localStorage.setItem('slothify_user_profile', JSON.stringify(normalizedUser));
    } catch (e) { }

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

    // Sync guest followed artists to newly authenticated account in background
    try {
      const savedProfiles = localStorage.getItem('slothify_followed_artist_profiles');
      if (savedProfiles) {
        const profilesMap = JSON.parse(savedProfiles);
        const list = Object.values(profilesMap);
        if (list.length > 0) {
          axios.post('/api/me/artists/sync', { artists: list })
            .then(() => fetchFollowedArtists())
            .catch(e => console.warn('Could not sync guest followed artists:', e));
        }
      }
    } catch (e) {}

    fetchFollowedArtists();
    window.dispatchEvent(new Event('slothify_playlists_updated'));
  };

  const handleLogout = () => {
    localStorage.removeItem('slothify_auth_token');
    localStorage.removeItem('slothify_user_profile');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser({
      id: 'guest',
      display_name: 'Slothify Guest',
      images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }]
    });
    setLikedTrackIds(new Set());
    setLikedSongsTotal(0);
    setFollowedArtistIds(new Set());
    setFollowedArtistsList([]);
    try {
      localStorage.removeItem('slothify_guest_likes');
      localStorage.removeItem('slothify_user_followed_artist_ids');
      localStorage.removeItem('slothify_followed_artist_profiles');
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
      <SpotifyProvider>
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
              <Suspense fallback={
                <div className="min-h-[50vh] flex items-center justify-center">
                  <div className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${
                    isOcean ? 'border-cyan-400' : 'border-[#f5d0b5]'
                  }`} />
                </div>
              }>
                <Routes>
                  <Route path="/" element={
                  <Home
                    isAuthenticated={isAuthenticated}
                    onPlayTrack={handlePlayTrack}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    onToggleLike={handleToggleLike}
                    likedTrackIds={likedTrackIds}
                    onOpenTurntable={() => handleOpenFullPlayer('vintage')}
                    followedArtistIds={followedArtistIds}
                    followedArtists={followedArtistsList}
                    onToggleFollow={handleToggleFollowArtist}
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
                <Route path="/album/:id" element={
                  <AlbumDetail
                    onPlayTrack={handlePlayTrack}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    currentTrackId={currentTrack?.id}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    isShuffle={isShuffle}
                    onToggleShuffle={() => setIsShuffle(!isShuffle)}
                  />
                } />
                <Route path="/artists" element={
                  <ArtistsPage
                    isAuthenticated={isAuthenticated}
                    followedArtistIds={followedArtistIds}
                    onToggleFollow={handleToggleFollowArtist}
                    followedArtistsList={followedArtistsList}
                  />
                } />
                <Route path="/artist/:artistId" element={
                  <ArtistProfile
                    onPlayTrack={handlePlayTrack}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    currentTrackId={currentTrack?.id}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    isAuthenticated={isAuthenticated}
                    followedArtistIds={followedArtistIds}
                    onToggleFollow={handleToggleFollowArtist}
                  />
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
            </Suspense>
          </div>
            <Footer />
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
          />

          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onAuthSuccess={handleAuthSuccess}
            initialMode={authModalMode}
          />

          {/* Spotify Playlist Importer Modal */}
          <SpotifyConnectModal />
        </div>
      </BrowserRouter>
      </SpotifyProvider>
    </CacheProvider>
  );
};

export default App;