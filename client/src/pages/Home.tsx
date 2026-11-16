import React, { useState, useEffect, useRef } from 'react';
import { Track, Playlist } from '../types';
import axios from 'axios';
import {
  Play, Pause, Heart, MoreHorizontal,
  Search, Bell, Sparkles, RefreshCw, ArrowDown, Settings,
  Music2, Compass, Radio, Shuffle
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';
import VinylRecord from '../components/VinylRecord';
import AudioWaveform from '../components/AudioWaveform';
import TrackRow from '../components/TrackRow';
import { getOptimizedImageUrl, getTrackThumbnail } from '../utils/imageOptimizer';
import {
  type HeroShowcaseTrack,
  type FeaturedArtistItem,
  FEATURED_HERO_TRACKS,
  DEFAULT_HERO_TRACK,
  GUEST_INTERNATIONAL_TRACKS,
  GUEST_HINDI_TRACKS,
  GUEST_OTHER_TRACKS,
  shuffleArray,
  GUEST_MIX_CARDS,
  generateGuestFeed,
  DEFAULT_POPULAR_TRACKS,
  DEFAULT_MADE_FOR_YOU,
  DEFAULT_RECENT_TRACKS,
  GLOBAL_FEATURED_ARTISTS,
  INDIA_FEATURED_ARTISTS,
  EYES_DONT_LIE_TRACK,
  TEENAGE_DREAM_TRACK,
  ALL_THAT_I_NEED_TRACK,
  GOLDEN_HOUR_TRACK,
  SAHIBA_TRACK,
  FAVORITE_TRACK,
  KESARIYA_TRACK,
  HUSN_TRACK,
  TAUBA_TAUBA_TRACK,
  DO_RE_MI_TRACK,
  IM_YOURS_TRACK,
  INDIA_FRESH_RELEASES,
  GLOBAL_FRESH_RELEASES,
  detectUserRegion,
  STYLISH_FALLBACK_COVERS,
  handleImageError,
  formatTime
} from '../data/homeFixtures';

export {
  type HeroShowcaseTrack,
  type FeaturedArtistItem,
  GUEST_INTERNATIONAL_TRACKS,
  GUEST_HINDI_TRACKS,
  GUEST_OTHER_TRACKS,
  generateGuestFeed
} from '../data/homeFixtures';

interface HomeProps {
  isAuthenticated: boolean;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  onPlayPause?: (playing: boolean) => void;
  onToggleLike?: (id: string, track?: Track) => void;
  likedTrackIds?: Set<string>;
  onOpenTurntable?: () => void;
  followedArtistIds?: Set<string>;
  followedArtists?: any[];
  onToggleFollow?: (artist: any) => void;
}

const Home: React.FC<HomeProps> = ({
  isAuthenticated,
  onPlayTrack,
  currentTrack,
  isPlaying = false,
  onPlayPause,
  onToggleLike,
  likedTrackIds,
  onOpenTurntable,
  followedArtistIds,
  followedArtists = [],
  onToggleFollow
}) => {
  const navigate = useNavigate();
  const { cache, setHomeData, setRecommendations } = useCache();
  const { isOcean } = useTheme();

  // Search input state in top bar
  const [searchQuery, setSearchQuery] = useState('');

  // API State from cache or fresh
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>(cache.homeData?.recentlyPlayed || []);
  const [topTracks, setTopTracks] = useState<Track[]>(cache.homeData?.topTracks || []);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<Playlist[]>(cache.homeData?.featuredPlaylists || []);

  // Guest randomized feed state (International, Hindi, and Other sort songs)
  const [guestFeed, setGuestFeed] = useState(generateGuestFeed);

  // Authenticated recommendations state
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>(() => cache.recommendations || []);
  const [recommendationInfo, setRecommendationInfo] = useState<{ personalizedFor?: string; source?: string } | null>(() => cache.recommendationInfo || null);
  const [isLoadingPersonalized, setIsLoadingPersonalized] = useState<boolean>(() => Boolean(isAuthenticated && (!cache.recommendations || cache.recommendations.length === 0)));

  // Guard refs to prevent duplicate concurrent fetching (e.g., React 18 StrictMode or rapid re-renders)
  const isFetchingRef = useRef<boolean>(false);
  const hasFetchedRef = useRef<boolean>(false);

  // Randomizes all feed sections for guest listeners (International, Hindi, and Other sort)
  const randomizeGuestFeed = () => {
    setGuestFeed(generateGuestFeed());
  };

  const randomizeDiscoveries = () => {
    setGuestFeed(prev => ({
      ...prev,
      discoveryTracks: generateGuestFeed().discoveryTracks
    }));
  };

  const randomizePopularTracks = () => {
    setGuestFeed(prev => ({
      ...prev,
      popularTracks: generateGuestFeed().popularTracks
    }));
  };

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullMoveY, setPullMoveY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAllData = async (isRefresh = false) => {
    // When NOT logged in: check if guest has local likes/follows for instant personalization
    if (!isAuthenticated) {
      randomizeGuestFeed();
      setIsRefreshing(false);
      setPullMoveY(0);

      // Extract guest liked/followed artist names to tailor recommendations without saving anything to server
      const guestSeedArtists: string[] = [];
      try {
        const guestLikes = localStorage.getItem('slothify_guest_likes');
        if (guestLikes) {
          const parsed = JSON.parse(guestLikes);
          if (Array.isArray(parsed)) {
            parsed.forEach((t: any) => {
              const aName = t.artists?.[0]?.name;
              if (aName && aName !== 'Unknown Artist' && !guestSeedArtists.includes(aName)) {
                guestSeedArtists.push(aName);
              }
            });
          }
        }
        const guestFollows = localStorage.getItem('slothify_followed_artist_profiles');
        if (guestFollows) {
          const parsed = JSON.parse(guestFollows);
          Object.values(parsed).forEach((a: any) => {
            if (a.name && !guestSeedArtists.includes(a.name)) {
              guestSeedArtists.unshift(a.name);
            }
          });
        }
      } catch (e) {}

      if (guestSeedArtists.length > 0 && (isRefresh || !cache.recommendations || cache.recommendations.length === 0)) {
        setIsLoadingPersonalized(true);
        axios.get(`/api/recommendations?seed_artists=${encodeURIComponent(guestSeedArtists.slice(0, 5).join(','))}`)
          .then(res => {
            if (Array.isArray(res.data?.tracks) && res.data.tracks.length > 0) {
              const info = {
                personalizedFor: res.data.personalizedFor || guestSeedArtists[0],
                source: 'guest_likes'
              };
              setRecommendedTracks(res.data.tracks);
              setRecommendationInfo(info);
              setRecommendations(res.data.tracks, info);
            }
          })
          .catch(() => {})
          .finally(() => {
            setIsLoadingPersonalized(false);
          });
      } else {
        setIsLoadingPersonalized(false);
      }
      return;
    }

    // If already fetched in this session or cached (and not an explicit user pull-to-refresh), do NOT re-fetch!
    if (!isRefresh && (hasFetchedRef.current || (cache.recommendations && cache.recommendations.length > 0))) {
      if (recommendedTracks.length === 0 && cache.recommendations?.length) {
        setRecommendedTracks(cache.recommendations);
        if (cache.recommendationInfo) setRecommendationInfo(cache.recommendationInfo);
      }
      setIsLoadingPersonalized(false);
      return;
    }

    // Prevent concurrent duplicate requests from firing in parallel
    if (isFetchingRef.current && !isRefresh) {
      return;
    }
    isFetchingRef.current = true;

    try {
      if (recommendedTracks.length === 0 && (!cache.recommendations || cache.recommendations.length === 0)) {
        setIsLoadingPersonalized(true);
      }

      const [recentRes, featuredRes, topTracksRes, recRes] = await Promise.allSettled([
        axios.get('/api/me/recent'),
        axios.get('/api/featured-playlists'),
        axios.get('/api/me/top/tracks'),
        axios.get('/api/recommendations')
      ]);

      const newData: any = { ...cache.homeData };

      if (recentRes.status === 'fulfilled' && Array.isArray(recentRes.value.data) && recentRes.value.data.length > 0) {
        newData.recentlyPlayed = recentRes.value.data;
        setRecentlyPlayed(newData.recentlyPlayed);
      }
      if (featuredRes.status === 'fulfilled' && Array.isArray(featuredRes.value.data) && featuredRes.value.data.length > 0) {
        newData.featuredPlaylists = featuredRes.value.data;
        setFeaturedPlaylists(newData.featuredPlaylists);
      }
      if (topTracksRes.status === 'fulfilled' && Array.isArray(topTracksRes.value.data) && topTracksRes.value.data.length > 0) {
        newData.topTracks = topTracksRes.value.data;
        setTopTracks(newData.topTracks);
      }
      if (recRes.status === 'fulfilled' && recRes.value.data?.authenticated && Array.isArray(recRes.value.data.tracks)) {
        const info = {
          personalizedFor: recRes.value.data.personalizedFor,
          source: recRes.value.data.source
        };
        setRecommendedTracks(recRes.value.data.tracks);
        setRecommendationInfo(info);
        setRecommendations(recRes.value.data.tracks, info);
      }

      setHomeData(newData);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Failed to fetch home data', error);
    } finally {
      isFetchingRef.current = false;
      setIsLoadingPersonalized(false);
      setIsRefreshing(false);
      setPullMoveY(0);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (recommendedTracks.length === 0 && (!cache.recommendations || cache.recommendations.length === 0)) {
        setIsLoadingPersonalized(true);
      }
      if (!hasFetchedRef.current) {
        fetchAllData();
      }
    } else {
      hasFetchedRef.current = false;
      setIsLoadingPersonalized(false);
      setRecommendedTracks([]);
      setRecommendationInfo(null);
      randomizeGuestFeed();
    }
  }, [isAuthenticated]);

  // Pull-to-Refresh Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY > 0 && containerRef.current?.scrollTop === 0) {
      const diff = e.touches[0].clientY - pullStartY;
      if (diff > 0) setPullMoveY(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = () => {
    if (pullMoveY > 70) {
      setIsRefreshing(true);
      fetchAllData(true);
    } else {
      setPullMoveY(0);
      setPullStartY(0);
    }
  };

  // Top Showcase 5 Songs Index
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Auto-advance songs on MOBILE ONLY (NOT on Windows/desktop view)
  useEffect(() => {
    const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;
    if (!isMobile()) return; // Moving songs for mobile only, not Windows/desktop view!

    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % FEATURED_HERO_TRACKS.length);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  // Lock hero song on Windows/desktop view (no song change in windows view, mobile only)
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && featuredIndex !== 0) {
        setFeaturedIndex(0);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [featuredIndex]);

  const handlePrevHeroSong = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFeaturedIndex((prev) => (prev === 0 ? FEATURED_HERO_TRACKS.length - 1 : prev - 1));
  };

  const handleNextHeroSong = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFeaturedIndex((prev) => (prev + 1) % FEATURED_HERO_TRACKS.length);
  };

  // Touch swipe gesture handlers for mobile hero card with real-time gliding
  const [heroTouchStartX, setHeroTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleHeroTouchStart = (e: React.TouchEvent) => {
    // Only allow swipe on mobile view (< 768px)
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
    setHeroTouchStartX(e.touches[0].clientX);
    setTouchDeltaX(0);
    setIsDragging(true);
  };

  const handleHeroTouchMove = (e: React.TouchEvent) => {
    if (heroTouchStartX === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - heroTouchStartX;
    // Damping resistance at ends
    if ((featuredIndex === 0 && diff > 0) || (featuredIndex === FEATURED_HERO_TRACKS.length - 1 && diff < 0)) {
      setTouchDeltaX(diff * 0.3);
    } else {
      setTouchDeltaX(diff);
    }
  };

  const handleHeroTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(touchDeltaX) > 45) {
      if (touchDeltaX < 0) {
        handleNextHeroSong();
      } else {
        handlePrevHeroSong();
      }
    }
    setTouchDeltaX(0);
    setHeroTouchStartX(null);
  };

  // Active showcase track from the 5 curated songs (on Windows view always index 0, on mobile rotates)
  const heroTrack: HeroShowcaseTrack = FEATURED_HERO_TRACKS[featuredIndex] || FEATURED_HERO_TRACKS[0];
  const isHeroLiked = heroTrack.id ? likedTrackIds?.has(heroTrack.id) : false;

  // Made for you cards:
  // When logged in: use API featured playlists or default reference cards
  // When NOT logged in: dynamic mix cards (Hindi Soul, Dark Pop, Punjabi Fire, Marathi Classics, etc.)
  const madeForYouCards = isAuthenticated
    ? DEFAULT_MADE_FOR_YOU.map((card, idx) => {
      if (featuredPlaylists[idx]) {
        return {
          id: featuredPlaylists[idx].id,
          name: featuredPlaylists[idx].name,
          subtitle: featuredPlaylists[idx].description || card.subtitle,
          image: featuredPlaylists[idx].images?.[0]?.url || card.image,
          query: featuredPlaylists[idx].name,
          isPlaylist: true
        };
      }
      return { ...card, isPlaylist: false };
    })
    : guestFeed.madeForYou.map(mix => ({
      id: mix.id,
      name: mix.name,
      subtitle: mix.subtitle,
      image: mix.image,
      query: mix.query,
      isPlaylist: false
    }));

  // Recently played tracks list:
  // When logged in: actual user listening history
  // When NOT logged in: random discovery songs (mix of International, Hindi, and Other sort)
  const recentTracksList: Track[] = isAuthenticated
    ? (recentlyPlayed.length >= 5
      ? recentlyPlayed.slice(0, 5)
      : [...recentlyPlayed, ...guestFeed.discoveryTracks.slice(recentlyPlayed.length, 5)])
    : guestFeed.discoveryTracks;

  // Popular tracks list:
  // When logged in: user's top tracks
  // When NOT logged in: random popular tracks (mix of International, Hindi, and Other sort)
  const popularTracksList: Track[] = isAuthenticated
    ? (topTracks.length >= 4
      ? topTracks.slice(0, 4)
      : [...topTracks, ...guestFeed.popularTracks.slice(topTracks.length, 4)])
    : guestFeed.popularTracks;

  // User streaming region state (default detected via timezone/locale, refined via fast IP lookup if guest)
  const [streamRegion, setStreamRegion] = useState<{ code: 'IN' | 'GLOBAL'; name: string }>(() => detectUserRegion());

  // Refine region dynamically via IP when not logged in
  useEffect(() => {
    if (isAuthenticated) return;
    let isMounted = true;
    fetch('https://api.country.is/', { signal: AbortSignal.timeout(2500) })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data?.country === 'IN') {
          setStreamRegion({ code: 'IN', name: 'India' });
        } else if (data?.country) {
          setStreamRegion({ code: 'GLOBAL', name: 'Global' });
        }
      })
      .catch(() => {
        // Silently preserve timezone-based detection on network timeout or offline
      });
    return () => { isMounted = false; };
  }, [isAuthenticated]);

  // Featured artists & fresh releases:
  // When logged in: region-tailored drops
  // When NOT logged in: random fresh releases (mix of International, Hindi, and Other sort)
  const activeFeaturedArtists = streamRegion.code === 'IN' ? INDIA_FEATURED_ARTISTS : GLOBAL_FEATURED_ARTISTS;
  const activeFreshReleases = streamRegion.code === 'IN' ? INDIA_FRESH_RELEASES : GLOBAL_FRESH_RELEASES;

  return (
    <div
      ref={containerRef}
      className="space-y-6 md:space-y-7 animate-in fade-in duration-500 select-none pb-14 text-white"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Refresh Indicator */}
      <div
        className="flex justify-center items-center pointer-events-none transition-all duration-300 -mt-2"
        style={{ height: pullMoveY > 0 ? `${pullMoveY}px` : '0px', opacity: pullMoveY > 0 ? 1 : 0 }}
      >
        <div className="bg-[#1c1922]/80 border border-white/10 p-2 rounded-full shadow-lg backdrop-blur-md">
          {isRefreshing ? (
            <RefreshCw className={`animate-spin ${isOcean ? 'text-cyan-400' : 'text-[#f5d0b5]'}`} size={20} />
          ) : (
            <ArrowDown className={`text-white transition-transform duration-200 ${pullMoveY > 70 ? (isOcean ? 'rotate-180 text-cyan-400' : 'rotate-180 text-[#f5d0b5]') : ''}`} size={20} />
          )}
        </div>
      </div>

      {/* 1. TOP BAR: Center Pill Search and Actions */}
      <div className="flex items-center justify-between gap-3 md:gap-4 select-none">
        {/* Pill Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute left-3.5 inset-y-0 flex items-center pointer-events-none text-slate-400">
            <Search size={14} />
          </div>
          <input
            type="text"
            placeholder="Search songs, artists, playlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                navigate('/search', { state: { q: searchQuery.trim() } });
              }
            }}
            className="w-full bg-black/25 hover:bg-black/35 focus:bg-black/50 text-xs text-white placeholder-slate-400 pl-9 pr-4 py-2 rounded-full border border-white/10 outline-none transition-all backdrop-blur-xl shadow-inner focus:border-white/25"
          />
        </div>

        {/* Action Icons */}
        <div className="flex items-center space-x-2.5 flex-shrink-0">
          <button
            onClick={() => { }}
            className="w-8 h-8 rounded-full bg-black/25 hover:bg-black/45 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-white/10 backdrop-blur-xl shadow-sm"
            title="Notifications"
          >
            <Bell size={15} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="w-8 h-8 rounded-full bg-black/25 hover:bg-black/45 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/10 backdrop-blur-xl shadow-sm"
            title="Settings & Audio Engine"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 2. FEATURED HERO SHOWCASE CARD (FROSTED GLASS, AUTO-MOVING ON MOBILE, SMOOTH GLIDING CAROUSEL) */}
      <div
        onTouchStart={handleHeroTouchStart}
        onTouchMove={handleHeroTouchMove}
        onTouchEnd={handleHeroTouchEnd}
        className="relative w-full rounded-[32px] p-6 sm:p-8 md:p-9 lg:p-10 overflow-hidden shadow-2xl flex flex-col justify-between transition-all duration-300 backdrop-blur-2xl bg-black/25 hover:bg-black/35 border border-white/10 hover:border-white/20 shadow-black/70"
      >
        {/* Subtle ambient glow reactive to active theme */}
        <div
          className={`absolute -top-24 left-1/3 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${isOcean ? 'bg-cyan-500/[0.08]' : 'bg-[#eab690]/[0.04]'
            }`}
        />

        {/* LEFT & CENTER: Sliding Gliding Carousel Container (Strictly bounded so next song cannot peek) */}
        <div className="flex-1 min-w-0 w-full md:max-w-[calc(100%-14rem)] lg:max-w-[calc(100%-16rem)] overflow-hidden relative">
          <div
            className="w-full flex items-center will-change-transform"
            style={{
              transform: `translateX(calc(-${featuredIndex * 100}% + ${touchDeltaX}px))`,
              transition: isDragging ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            {FEATURED_HERO_TRACKS.map((track, idx) => {
              const isSameTrack = Boolean(currentTrack) && (
                currentTrack?.id === track.id ||
                (Boolean(currentTrack?.name && track.name) &&
                  currentTrack?.name.toLowerCase() === track.name.toLowerCase() &&
                  currentTrack?.artists?.[0]?.name?.toLowerCase() === track.artists?.[0]?.name?.toLowerCase())
              );
              const isTrackPlaying = Boolean(isPlaying && isSameTrack);
              const isTrackLiked = track.id ? likedTrackIds?.has(track.id) : false;
              const isVisibleSlide = isDragging || touchDeltaX !== 0 || idx === featuredIndex;

              return (
                <div
                  key={track.id || idx}
                  className={`w-full min-w-full flex-shrink-0 flex flex-col sm:flex-row items-center gap-6 md:gap-8 select-none transition-opacity duration-300 ${isVisibleSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                >
                  {/* Left: Square Album Artwork */}
                  <div className="flex-shrink-0 w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 relative rounded-2xl overflow-hidden shadow-2xl shadow-black/90 ring-1 ring-white/10 group-hover:scale-[1.01] transition-transform duration-500">
                    <img
                      src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600'}
                      alt={track.name}
                      onError={(e) => handleImageError(e)}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>

                  {/* Center: Track Details & Action Buttons matching reference */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center items-center sm:items-start text-center sm:text-left z-10">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[11px] font-semibold tracking-[0.28em] uppercase transition-colors duration-500 ${isOcean ? 'text-cyan-400' : 'text-[#a8907e]'
                          }`}
                      >
                        NOW PLAYING
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenTurntable) onOpenTurntable();
                        }}
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 tracking-wider uppercase border border-blue-500/30 cursor-pointer active:scale-95 transition-all"
                        title="Open Fullscreen Turntable Player"
                      >
                        FULLSCREEN PLAYER
                      </button>
                    </div>

                    {/* Reference Serif Display Title */}
                    <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal text-[#faf6f0] tracking-tight leading-none mt-2.5 truncate max-w-full group-hover:text-white transition-colors">
                      {track.name}
                    </h1>

                    {/* Reference Italic Artist */}
                    <p
                      className={`font-serif italic text-lg sm:text-xl md:text-2xl mt-2 truncate max-w-full font-light transition-colors duration-500 ${isOcean ? 'text-cyan-100/90' : 'text-[#d4c6b8]'
                        }`}
                    >
                      {track.artists?.map(a => a.name).join(', ') || 'Artist'}
                    </p>

                    {/* Reference Stats Line */}
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-3 font-light">
                      <Heart size={13} className="text-slate-400" />
                      <span>{track.stats}</span>
                    </div>

                    {/* Reference Subtitle Quote */}
                    <p className="text-xs text-slate-400 mt-2 max-w-md line-clamp-1 italic font-light">
                      {track.quote}
                    </p>

                    {/* Reference Action Buttons: Play Pill, Heart Circle, More Circle */}
                    <div className="flex items-center space-x-3.5 mt-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSameTrack && onPlayPause) {
                            onPlayPause(!isPlaying);
                          } else {
                            onPlayTrack(track);
                          }
                        }}
                        className={`px-7 py-2.5 rounded-full font-semibold text-xs md:text-sm flex items-center space-x-2 active:scale-95 transition-colors duration-200 text-slate-950 shadow-md ${isOcean
                            ? 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-500/20'
                            : 'bg-[#eab690] hover:bg-[#f3cbb0] shadow-[#eab690]/20'
                          }`}
                      >
                        {isTrackPlaying ? (
                          <>
                            <Pause size={15} fill="currentColor" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play size={15} fill="currentColor" className="ml-0.5" />
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleLike && track.id) {
                            onToggleLike(track.id, track);
                          }
                        }}
                        className="w-10 h-10 rounded-full border border-white/15 hover:border-white/30 text-slate-300 hover:text-white flex items-center justify-center transition-colors bg-white/[0.04] hover:bg-white/[0.08]"
                        title="Save to Liked Songs"
                      >
                        <Heart
                          size={16}
                          className={
                            isTrackLiked
                              ? isOcean
                                ? 'fill-cyan-400 text-cyan-400'
                                : 'fill-[#eab690] text-[#eab690]'
                              : ''
                          }
                        />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/search', { state: { q: track.name } });
                        }}
                        className="w-10 h-10 rounded-full border border-white/15 hover:border-white/30 text-slate-300 hover:text-white flex items-center justify-center transition-colors bg-white/[0.04] hover:bg-white/[0.08]"
                        title="More Options"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Moving Songs Pagination Dots */}
          <div className="flex md:hidden items-center justify-center space-x-1.5 mt-5 z-20">
            {FEATURED_HERO_TRACKS.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setFeaturedIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-500 ${featuredIndex === i
                    ? isOcean
                      ? 'w-6 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]'
                      : 'w-6 bg-[#eab690] shadow-[0_0_8px_rgba(234,182,144,0.7)]'
                    : 'w-1.5 bg-white/20'
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Right: Whole Uncropped Vinyl Disc with Song Poster, right above the music lines */}
        <div className="hidden md:flex flex-col items-center justify-center absolute right-8 md:right-10 lg:right-12 top-1/2 -translate-y-1/2 z-20 space-y-2 pointer-events-auto">
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenTurntable) onOpenTurntable();
            }}
            className="w-36 h-36 sm:w-40 sm:h-40 md:w-44 md:h-44 lg:w-48 lg:h-48 cursor-pointer select-none active:scale-95"
            title="Click to open Fullscreen Vintage Turntable"
          >
            <VinylRecord
              image={heroTrack.album?.images?.[0]?.url}
              isPlaying={isPlaying}
              className="w-full h-full"
            />
          </div>

          {/* Music lines directly below the whole disc */}
          <div className="pointer-events-none flex justify-center w-full">
            <AudioWaveform isPlaying={isPlaying} barCount={26} color={isOcean ? 'cyan' : 'amber'} className="h-3.5" />
          </div>
        </div>
      </div>

      {/* GUEST BANNER: Explains random songs and prompts sign-in for personalized recommendation system */}
      {!isAuthenticated && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-black/40 border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl shadow-lg">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10 ${isOcean ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#eab690]/20 text-[#eab690]'}`}>
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white leading-tight">
                  Guest Mode: Shuffled Songs Active
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  Random Mix
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-light leading-snug">
                Enjoy random International, Hindi, and regional tracks. Log in to activate the personalized recommendation engine based on your listening history and likes.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={randomizeGuestFeed}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center space-x-1.5 active:scale-95"
              title="Shuffle all songs on the home feed"
            >
              <Shuffle size={13} className={isOcean ? 'text-cyan-400' : 'text-[#eab690]'} />
              <span>Shuffle</span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-md ${isOcean
                  ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                  : 'bg-[#eab690] hover:bg-[#f3cbb0] text-slate-950'
                }`}
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* 2.5 FOLLOWED ARTISTS QUICK ROW (Active whenever user follows artists) */}
      {followedArtists && followedArtists.length > 0 && (
        <div className="space-y-3.5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center space-x-2">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Artists You Follow</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {followedArtists.length}
                </span>
              </h2>
            </div>
            <button
              onClick={() => navigate('/artists')}
              className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors cursor-pointer"
            >
              See all
            </button>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide pt-1">
            {followedArtists.map((artist: any) => {
              const artistId = artist.id || artist.artistId;
              const imgUrl = artist.images?.[0]?.url || artist.image || artist.artistImage;
              return (
                <div
                  key={artistId}
                  onClick={() => navigate(`/artist/${encodeURIComponent(artistId)}`, { state: { artist } })}
                  className="flex flex-col items-center flex-shrink-0 group cursor-pointer w-20 md:w-24 text-center select-none"
                >
                  <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-black/40 border border-white/10 transition-all p-0.5 shadow-lg group-hover:scale-105 ${
                    isOcean ? 'group-hover:border-cyan-400/60' : 'group-hover:border-[#f5d0b5]/60'
                  }`}>
                    <img
                      src={getOptimizedImageUrl(imgUrl, '150')}
                      alt={artist.name || artist.artistName}
                      onError={(e) => handleImageError(e, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200')}
                      className="w-full h-full rounded-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <span className={`mt-2 text-xs font-medium text-white truncate w-full transition-colors ${
                    isOcean ? 'group-hover:text-cyan-300' : 'group-hover:text-[#f5d0b5]'
                  }`}>
                    {artist.name || artist.artistName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-light truncate w-full">
                    Artist
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. "MADE FOR YOU" / "RECOMMENDED FOR YOU" SECTION */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
              {isAuthenticated ? 'Recommended for you' : 'Made for you'}
            </h2>
            {isLoadingPersonalized || (isAuthenticated && recommendedTracks.length === 0) ? (
              <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-semibold text-cyan-300 animate-pulse">
                <Sparkles size={11} className="text-cyan-400 animate-spin" />
                <span>Tailoring your music...</span>
              </span>
            ) : isAuthenticated && recommendedTracks.length > 0 ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-semibold text-cyan-300">
                <Sparkles size={11} className="text-cyan-400" />
                <span>{recommendationInfo?.personalizedFor ? `Based on ${recommendationInfo.personalizedFor}` : 'Tailored Recommendations'}</span>
              </span>
            ) : !isAuthenticated ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 hidden sm:inline-block">
                Random Mixes • International & Hindi
              </span>
            ) : null}
          </div>

          <div className="flex items-center space-x-2">
            {!isAuthenticated && (
              <button
                onClick={randomizeGuestFeed}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-slate-300 hover:text-white transition-all border border-white/10 active:scale-95 cursor-pointer"
                title="Shuffle feed"
              >
                <Shuffle size={12} className={isOcean ? 'text-cyan-400' : 'text-[#eab690]'} />
                <span>Shuffle Feed</span>
              </button>
            )}
            <button
              onClick={() => navigate(isAuthenticated ? '/library' : '/search')}
              className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
            >
              See all
            </button>
          </div>
        </div>

        {/* Content: Skeleton when loading personalized, songs when loaded, or made-for-you when guest */}
        {isLoadingPersonalized || (isAuthenticated && recommendedTracks.length === 0) ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 animate-in fade-in duration-200">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={`rec-skeleton-${idx}`}
                className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-black/30 border border-white/[0.08] backdrop-blur-xl p-3 flex flex-col justify-end"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                <div className="h-3.5 bg-white/[0.08] rounded-full w-3/4 mb-1.5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
                <div className="h-2.5 bg-white/[0.04] rounded-full w-1/2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : isAuthenticated && recommendedTracks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {recommendedTracks.slice(0, 5).map((track, idx) => (
              <div
                key={track.id || idx}
                onClick={() => onPlayTrack(track, recommendedTracks)}
                className="group relative rounded-2xl overflow-hidden aspect-[16/10] bg-black/25 border border-white/[0.08] cursor-pointer hover:border-white/20 transition-all shadow-md select-none backdrop-blur-xl"
              >
                <img
                  src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500'}
                  alt={track.name}
                  onError={(e) => handleImageError(e)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-10">
                  <h3 className="font-semibold text-xs md:text-sm text-white truncate leading-tight">
                    {track.name}
                  </h3>
                  <p className="text-[10px] md:text-[11px] text-[#c4beb6] truncate mt-0.5 leading-tight font-light">
                    {track.artists?.[0]?.name || 'Artist'}
                  </p>
                </div>
                <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110">
                  <Play size={12} fill="currentColor" className="ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {madeForYouCards.map((card, idx) => (
              <div
                key={card.id || idx}
                onClick={() => {
                  if (card.isPlaylist) {
                    navigate(`/playlist/${card.id}`);
                  } else {
                    navigate('/search', { state: { q: card.query || card.name } });
                  }
                }}
                className="group relative rounded-2xl overflow-hidden aspect-[16/10] bg-black/25 border border-white/[0.08] cursor-pointer hover:border-white/20 transition-all shadow-md select-none backdrop-blur-xl"
              >
                <img
                  src={card.image}
                  alt={card.name}
                  onError={(e) => handleImageError(e)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-10">
                  <h3 className="font-semibold text-xs md:text-sm text-white truncate leading-tight">
                    {card.name}
                  </h3>
                  <p className="text-[10px] md:text-[11px] text-[#c4beb6] truncate mt-0.5 leading-tight font-light">
                    {card.subtitle}
                  </p>
                </div>
                <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110">
                  <Play size={12} fill="currentColor" className="ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. BOTTOM SPLIT: "Recently played" / "Random Discoveries" (Left) + "Popular tracks" (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 md:gap-8 pt-1">
        {/* Left Column: Recently played / Random Discoveries (approx 60% on desktop) */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center space-x-2">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
                {isAuthenticated ? 'Recently played' : 'Random Discoveries'}
              </h2>
              {isLoadingPersonalized || (isAuthenticated && recentlyPlayed.length === 0) ? (
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 animate-pulse">
                  Syncing history...
                </span>
              ) : !isAuthenticated && (
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 hidden sm:inline-block">
                  International & Hindi Mix
                </span>
              )}
            </div>
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/history')}
                className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
              >
                See all
              </button>
            ) : (
              <button
                onClick={randomizeDiscoveries}
                className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors flex items-center space-x-1 active:scale-95 cursor-pointer"
                title="Shuffle discoveries"
              >
                <Shuffle size={11} className={isOcean ? 'text-cyan-400' : 'text-[#eab690]'} />
                <span>Shuffle</span>
              </button>
            )}
          </div>

          {isLoadingPersonalized || (isAuthenticated && recentlyPlayed.length === 0) ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3.5 animate-in fade-in duration-200">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={`recent-skeleton-${idx}`} className="flex flex-col space-y-2">
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/30 border border-white/[0.08]">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                  <div className="h-3.5 bg-white/[0.08] rounded-full w-3/4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                  <div className="h-2.5 bg-white/[0.04] rounded-full w-1/2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3.5">
              {recentTracksList.map((track, idx) => (
                <div
                  key={track.id || idx}
                  onClick={() => onPlayTrack(track, recentTracksList)}
                  className="group flex flex-col space-y-2 cursor-pointer select-none"
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/30 border border-white/[0.08] shadow-md shadow-black/50">
                    <img
                      src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400'}
                      alt={track.name}
                      onError={(e) => handleImageError(e)}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Hover Floating Play Button */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform duration-200">
                        <Play size={14} fill="currentColor" className="ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="px-0.5">
                    <h3 className={`font-medium text-xs text-white truncate leading-tight transition-colors ${isOcean ? 'group-hover:text-cyan-400' : 'group-hover:text-[#e6c8a2]'}`}>
                      {track.name}
                    </h3>
                    <p className="text-[10px] text-[#8a8489] truncate mt-0.5 leading-tight font-light">
                      {track.artists?.[0]?.name || 'Artist'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Popular tracks (approx 40% on desktop) */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center space-x-2">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Popular tracks</h2>
              {isLoadingPersonalized || (isAuthenticated && topTracks.length === 0) ? (
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 animate-pulse">
                  Loading top hits...
                </span>
              ) : !isAuthenticated && (
                <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                  Shuffled
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {!isAuthenticated && (
                <button
                  onClick={randomizePopularTracks}
                  className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors flex items-center space-x-1 active:scale-95 cursor-pointer"
                  title="Shuffle popular tracks"
                >
                  <Shuffle size={11} className={isOcean ? 'text-cyan-400' : 'text-[#eab690]'} />
                  <span>Shuffle</span>
                </button>
              )}
              <button
                onClick={() => navigate('/search')}
                className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
              >
                See all
              </button>
            </div>
          </div>

          {isLoadingPersonalized || (isAuthenticated && topTracks.length === 0) ? (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`pop-skeleton-${idx}`} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-5 h-3 bg-white/[0.05] rounded-full" />
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] relative overflow-hidden flex-shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="h-3 bg-white/[0.08] rounded-full w-2/3 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                      </div>
                      <div className="h-2.5 bg-white/[0.04] rounded-full w-1/3 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-3 bg-white/[0.04] rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {popularTracksList.slice(0, 4).map((track, idx) => (
                <TrackRow
                  key={track.id || idx}
                  track={track}
                  index={idx}
                  variant="table"
                  showIndex={true}
                  showCover={true}
                  isCurrent={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  isLiked={likedTrackIds?.has(track.id)}
                  isOcean={isOcean}
                  onPlay={() => onPlayTrack(track, popularTracksList)}
                  onToggleLike={onToggleLike}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. ADDITIONAL SECTION 1: FEATURED ARTISTS (Tailored by Streaming Region when guest) */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Featured Artists</h2>
            {!isAuthenticated && (
              <button
                onClick={() => setStreamRegion(prev => prev.code === 'IN' ? { code: 'GLOBAL', name: 'Global' } : { code: 'IN', name: 'India' })}
                className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-black/30 hover:bg-black/50 border border-white/10 text-[10px] font-medium text-slate-300 transition-all backdrop-blur-xl group cursor-pointer"
                title="Click to toggle streaming region"
              >
                <span>{streamRegion.code === 'IN' ? '🇮🇳 India' : '🌐 Global'}</span>
                <span className="text-[9px] text-slate-500 group-hover:text-slate-300 ml-0.5 font-light">Switch</span>
              </button>
            )}
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {activeFeaturedArtists.map((artist, idx) => (
            <Link
              key={artist.name || idx}
              to={`/artist/sp_art_${encodeURIComponent(artist.name || artist.query)}`}
              className="artist-card p-3.5 rounded-2xl bg-black/20 hover:bg-black/35 border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer group flex flex-col items-center text-center space-y-2.5 backdrop-blur-xl shadow-md select-none"
            >
              <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-lg ring-2 ring-white/10 transition-all flex-shrink-0 ${isOcean ? 'group-hover:ring-cyan-400/50' : 'group-hover:ring-[#e6c8a2]/50'}`}>
                <img
                  src={getOptimizedImageUrl(artist.avatar, '150')}
                  alt={artist.name}
                  onError={(e) => handleImageError(e, 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150')}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                    <Play size={13} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="w-full px-1">
                <h4 className={`text-xs font-bold text-white truncate leading-tight transition-colors ${isOcean ? 'group-hover:text-cyan-400' : 'group-hover:text-[#e6c8a2]'}`}>
                  {artist.name}
                </h4>
                <p className="text-[10px] text-[#8a8489] truncate mt-0.5 leading-tight font-light">
                  {artist.role}
                </p>
                <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                  {artist.listeners}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 6. ADDITIONAL SECTION 2: FRESH RELEASES & DROPS (Tailored by Streaming Region when guest) */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Fresh Releases & Drops</h2>
            {!isAuthenticated && (
              <span className="hidden sm:inline-block text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {streamRegion.code === 'IN' ? 'Trending in India' : 'Trending Worldwide'}
              </span>
            )}
          </div>
          <span className="text-xs text-[#8a8489]">320kbps CD Quality</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {activeFreshReleases.map((track) => (
            <div
              key={track.id}
              onClick={() => onPlayTrack(track, activeFreshReleases)}
              className="p-3 rounded-2xl bg-black/20 hover:bg-black/35 border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer group flex items-center space-x-3 backdrop-blur-xl shadow-md select-none"
            >
              <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                <img
                  src={getTrackThumbnail(track, 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=150', '150')}
                  alt={track.name}
                  onError={(e) => handleImageError(e, 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=150')}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play size={13} fill="currentColor" className="text-white ml-0.5" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className={`text-xs font-semibold text-white truncate leading-tight transition-colors ${isOcean ? 'group-hover:text-cyan-400' : 'group-hover:text-[#e6c8a2]'}`}>
                  {track.name}
                </h4>
                <p className="text-[10px] text-[#8a8489] truncate mt-0.5 leading-tight font-light">
                  {track.artists[0]?.name}
                </p>
                <span className="text-[9px] font-mono text-emerald-400/90 mt-0.5 block">Lossless Master</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
