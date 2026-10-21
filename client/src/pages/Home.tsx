import React, { useState, useEffect, useRef } from 'react';
import { Track, Playlist, Artist } from '../types';
import axios from 'axios';
import {
  Play, Pause, Heart, MoreHorizontal, ChevronLeft, ChevronRight,
  Search, Bell, Sparkles, RefreshCw, ArrowDown, Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';
import VinylRecord from '../components/VinylRecord';
import AudioWaveform from '../components/AudioWaveform';

interface HomeProps {
  isAuthenticated: boolean;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  onToggleLike?: (id: string, track?: Track) => void;
  likedTrackIds?: Set<string>;
  onOpenTurntable?: () => void;
}

// Curated default tracks (Pinned #1: Isabel LaRosa - Eyes Don't Lie ‧ 2023)
const DEFAULT_HERO_TRACK: Track = {
  id: 'isabel-larosa-eyes-dont-lie',
  uri: 'spotify:track:isabel-larosa-eyes-dont-lie',
  name: "Eyes Don't Lie",
  artists: [{ name: 'Isabel LaRosa' }],
  album: {
    name: "Eyes Don't Lie",
    images: [{ url: 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg' }]
  },
  duration_ms: 150000 // 2:30
};

const DEFAULT_MADE_FOR_YOU = [
  {
    id: 'late-night-drive',
    name: 'Late Night Drive',
    subtitle: 'Chill songs for city nights',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600'
  },
  {
    id: 'falling-in-love',
    name: 'Falling in Love',
    subtitle: 'Songs that hit different',
    image: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600'
  },
  {
    id: 'acoustic-mornings',
    name: 'Acoustic Mornings',
    subtitle: 'Soft, calm & beautiful',
    image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600'
  },
  {
    id: 'midnight-memories',
    name: 'Midnight Memories',
    subtitle: 'Nostalgic tunes for the soul',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'
  },
  {
    id: 'good-vibes',
    name: 'Good Vibes',
    subtitle: 'Feel good playlist',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600'
  }
];

const DEFAULT_RECENT_TRACKS: Track[] = [
  {
    id: 'dusk-till-dawn',
    uri: 'spotify:track:dusk-till-dawn',
    name: 'Dusk Till Dawn',
    artists: [{ name: 'Aiden Vale' }],
    album: {
      name: 'Dusk Till Dawn',
      images: [{ url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400' }]
    },
    duration_ms: 225000
  },
  {
    id: 'golden-hour',
    uri: 'spotify:track:golden-hour',
    name: 'Golden Hour',
    artists: [{ name: 'Hollow Coves' }],
    album: {
      name: 'Golden Hour',
      images: [{ url: 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=400' }]
    },
    duration_ms: 216000
  },
  {
    id: 'someone-like-you',
    uri: 'spotify:track:someone-like-you',
    name: 'Someone Like You',
    artists: [{ name: 'Adele' }],
    album: {
      name: '21',
      images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400' }]
    },
    duration_ms: 285000
  },
  {
    id: 'it-will-be-okay',
    uri: 'spotify:track:it-will-be-okay',
    name: 'It Will Be Okay',
    artists: [{ name: 'Tom Odell' }],
    album: {
      name: 'Monsters',
      images: [{ url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400' }]
    },
    duration_ms: 204000
  },
  {
    id: 'everything-i-wanted',
    uri: 'spotify:track:everything-i-wanted',
    name: 'Everything I Wanted',
    artists: [{ name: 'Billie Eilish' }],
    album: {
      name: 'Everything I Wanted',
      images: [{ url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400' }]
    },
    duration_ms: 245000
  }
];

const DEFAULT_POPULAR_TRACKS: Track[] = [
  {
    id: 'isabel-larosa-eyes-dont-lie',
    uri: 'spotify:track:isabel-larosa-eyes-dont-lie',
    name: "Eyes Don't Lie",
    artists: [{ name: 'Isabel LaRosa' }],
    album: {
      name: "Eyes Don't Lie",
      images: [{ url: 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg' }]
    },
    duration_ms: 150000 // 2:30
  },
  {
    id: 'popular-1',
    uri: 'spotify:track:popular-1',
    name: 'Dusk Till Dawn',
    artists: [{ name: 'Aiden Vale' }],
    album: {
      name: 'Dusk Till Dawn',
      images: [{ url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200' }]
    },
    duration_ms: 225000 // 3:45
  },
  {
    id: 'popular-2',
    uri: 'spotify:track:popular-2',
    name: 'Perfect',
    artists: [{ name: 'Aiden Vale' }],
    album: {
      name: 'Perfect',
      images: [{ url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=200' }]
    },
    duration_ms: 252000 // 4:12
  },
  {
    id: 'popular-3',
    uri: 'spotify:track:popular-3',
    name: 'Better With You',
    artists: [{ name: 'Aiden Vale' }],
    album: {
      name: 'Better With You',
      images: [{ url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=200' }]
    },
    duration_ms: 208000 // 3:28
  }
];

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const Home: React.FC<HomeProps> = ({
  isAuthenticated,
  onPlayTrack,
  currentTrack,
  isPlaying = false,
  onToggleLike,
  likedTrackIds,
  onOpenTurntable
}) => {
  const navigate = useNavigate();
  const { cache, setHomeData } = useCache();
  const { isOcean } = useTheme();

  // Search input state in top bar
  const [searchQuery, setSearchQuery] = useState('');

  // API State from cache or fresh
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>(cache.homeData?.recentlyPlayed || []);
  const [topTracks, setTopTracks] = useState<Track[]>(cache.homeData?.topTracks || []);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<Playlist[]>(cache.homeData?.featuredPlaylists || []);
  const [user, setUser] = useState<any>(null);

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullMoveY, setPullMoveY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAllData = async (isRefresh = false) => {
    if (!isRefresh && cache.homeData && cache.homeData.topTracks?.length > 0) return;

    try {
      const [recentRes, featuredRes, topTracksRes] = await Promise.allSettled([
        axios.get('/api/me/recent'),
        axios.get('/api/featured-playlists'),
        axios.get('/api/me/top/tracks')
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

      setHomeData(newData);
    } catch (error) {
      console.error('Failed to fetch home data', error);
    } finally {
      setIsRefreshing(false);
      setPullMoveY(0);
    }
  };

  useEffect(() => {
    axios.get('/api/auth/status').then(res => {
      if (res.data.authenticated) setUser(res.data.user);
    }).catch(() => {});

    if (!cache.homeData || !cache.homeData.topTracks || cache.homeData.topTracks.length === 0) {
      fetchAllData();
    }
  }, []);

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

  // Ensure "Eyes Don't Lie" by Isabel LaRosa stays pinned as track #1
  const tracksWithPinnedFirst: Track[] = (() => {
    const list = topTracks.length > 0 ? topTracks : DEFAULT_POPULAR_TRACKS;
    if (list[0]?.name.toLowerCase().includes('eyes don')) {
      return list;
    }
    const filtered = list.filter(t => !t.name.toLowerCase().includes('eyes don'));
    return [DEFAULT_HERO_TRACK, ...filtered];
  })();

  // Determine active hero track: use currentTrack if active, otherwise the pinned first track
  const heroTrack: Track = currentTrack || tracksWithPinnedFirst[0] || DEFAULT_HERO_TRACK;
  const isHeroLiked = heroTrack.id ? likedTrackIds?.has(heroTrack.id) : false;

  // Made for you cards: merge API featured playlists or use curated mockup defaults
  const madeForYouCards = DEFAULT_MADE_FOR_YOU.map((card, idx) => {
    if (featuredPlaylists[idx]) {
      return {
        id: featuredPlaylists[idx].id,
        name: featuredPlaylists[idx].name,
        subtitle: featuredPlaylists[idx].description || card.subtitle,
        image: featuredPlaylists[idx].images?.[0]?.url || card.image,
        isPlaylist: true
      };
    }
    return { ...card, isPlaylist: false };
  });

  // Recently played tracks list (guaranteed 5 items)
  const recentTracksList: Track[] = (recentlyPlayed.length >= 5
    ? recentlyPlayed.slice(0, 5)
    : [...recentlyPlayed, ...DEFAULT_RECENT_TRACKS.slice(recentlyPlayed.length, 5)]
  );

  // Popular tracks list (guaranteed 4 items with rankings 01, 02, 03, 04)
  const popularTracksList: Track[] = (tracksWithPinnedFirst.length >= 4
    ? tracksWithPinnedFirst.slice(0, 4)
    : [...tracksWithPinnedFirst, ...DEFAULT_POPULAR_TRACKS.slice(tracksWithPinnedFirst.length, 4)]
  );

  return (
    <div
      ref={containerRef}
      className="space-y-7 md:space-y-8 animate-in fade-in duration-500 select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Refresh Indicator */}
      <div
        className="flex justify-center items-center pointer-events-none transition-all duration-300 -mt-2"
        style={{ height: pullMoveY > 0 ? `${pullMoveY}px` : '0px', opacity: pullMoveY > 0 ? 1 : 0 }}
      >
        <div className="bg-[#1c1922] border border-white/10 p-2 rounded-full shadow-lg">
          {isRefreshing ? (
            <RefreshCw className={`animate-spin ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`} size={20} />
          ) : (
            <ArrowDown className={`text-white transition-transform duration-200 ${pullMoveY > 70 ? (isOcean ? 'rotate-180 text-blue-400' : 'rotate-180 text-[#f5d0b5]') : ''}`} size={20} />
          )}
        </div>
      </div>

      {/* 1. TOP BAR: History Navigation, Pill Search, Notification & User Badges */}
      <div className="flex items-center justify-between gap-3 md:gap-4 select-none">
        {/* Navigation History */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-black/35 hover:bg-black/50 text-[#8a8489] hover:text-white flex items-center justify-center transition-colors border border-white/10 backdrop-blur-md"
            title="Go Back"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 rounded-full bg-black/35 hover:bg-black/50 text-[#8a8489] hover:text-white flex items-center justify-center transition-colors border border-white/10 backdrop-blur-md"
            title="Go Forward"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Pill Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search songs, artists, playlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
              }
            }}
            className={`w-full bg-black/35 hover:bg-black/45 focus:bg-black/60 text-xs text-white placeholder-slate-400 pl-9 pr-4 py-2 rounded-full border border-white/10 outline-none transition-all backdrop-blur-md shadow-inner ${
              isOcean ? 'focus:border-cyan-400/50' : 'focus:border-[#f5d0b5]/40'
            }`}
          />
        </div>

        {/* Notification Bell & Profile Sparkle Action */}
        <div className="flex items-center space-x-2.5 flex-shrink-0">
          <button
            onClick={() => {}}
            className="w-8 h-8 rounded-full bg-black/35 hover:bg-black/50 text-[#8a8489] hover:text-white flex items-center justify-center transition-colors border border-white/10 backdrop-blur-md"
            title="Notifications (Coming Soon)"
          >
            <Bell size={15} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border shadow-sm backdrop-blur-md ${
              isOcean
                ? 'bg-black/35 hover:bg-black/50 text-cyan-300 border-white/10 hover:border-cyan-400/30'
                : 'bg-black/35 hover:bg-black/50 text-[#f5d0b5] border-white/10 hover:border-[#f5d0b5]/30'
            }`}
            title="Settings & Profile"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 2. FEATURED HERO SHOWCASE CARD ("NOW PLAYING") - TRANSPARENT GLASS BOX */}
      <div
        onClick={onOpenTurntable}
        className={`relative rounded-3xl p-5 sm:p-7 md:p-8 overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 cursor-pointer group transition-all duration-300 backdrop-blur-2xl ${
          isOcean
            ? 'bg-black/35 hover:bg-black/45 border border-white/10 hover:border-cyan-400/40 shadow-black/80'
            : 'bg-black/35 hover:bg-black/45 border border-white/10 hover:border-[#f5d0b5]/40 shadow-black/80'
        }`}
        title="Click box to open Fullscreen Vintage Turntable"
      >
        {/* Subtle ambient luxury background glow */}
        <div className={`absolute top-0 right-1/4 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
          isOcean ? 'bg-cyan-500/[0.08]' : 'bg-[#f5d0b5]/[0.04]'
        }`} />

        {/* Left: Album Artwork */}
        <div className="flex-shrink-0 w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 relative rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl shadow-black/90 ring-1 ring-white/10 group-hover:scale-[1.02] transition-transform duration-500">
          <img
            src={heroTrack.album?.images?.[0]?.url || 'https://c.saavncdn.com/998/eyes-don-t-lie-English-2023-20230628022336-500x500.jpg'}
            alt={heroTrack.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {isPlaying && currentTrack?.id === heroTrack.id && (
            <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center space-x-1.5 text-[10px] font-semibold ${
              isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
              <span>LIVE</span>
            </div>
          )}
        </div>

        {/* Center: Track Details & Playback Action Buttons */}
        <div className="flex-1 min-w-0 flex flex-col justify-center items-center md:items-start text-center md:text-left">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] md:text-[11px] font-semibold tracking-[0.25em] text-[#8a8489] uppercase">
              NOW PLAYING
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isOcean ? 'bg-blue-500/20 text-blue-300' : 'bg-[#f5d0b5]/10 text-[#f5d0b5]'
            }`}>
              Fullscreen Player
            </span>
          </div>

          <h1 className="font-serif-display text-3xl sm:text-4xl md:text-5xl font-bold text-[#faf6f0] tracking-tight leading-none mt-2 truncate max-w-full group-hover:text-white transition-colors">
            {heroTrack.name}
          </h1>

          <p className="font-serif-display italic text-lg sm:text-xl text-[#c4beb6] mt-1.5 truncate max-w-full">
            {heroTrack.artists?.map(a => a.name).join(', ') || 'Artist'}
          </p>

          {/* Stats Badge */}
          <div className="flex items-center space-x-2 text-xs text-[#8a8489] mt-2.5">
            <Heart size={13} className="text-[#8a8489]" />
            <span>5.2M • Dark Pop • 2023</span>
          </div>

          {/* Quote / Subtitle */}
          <p className="text-xs text-[#8a8489] mt-2 max-w-md line-clamp-1 italic font-light">
            You don't have to say a word, your eyes don't lie.
          </p>

          {/* Action Buttons: Play Pill, Heart Circle, More Circle */}
          <div className="flex items-center space-x-3 mt-5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayTrack(heroTrack);
              }}
              className={`px-6 py-2.5 rounded-full font-semibold text-xs md:text-sm flex items-center space-x-2 shadow-lg active:scale-95 transition-all ${
                isOcean
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25'
                  : 'bg-[#f5d0b5] hover:bg-[#ebd0bc] text-black shadow-[#f5d0b5]/15'
              }`}
            >
              <Play size={15} fill="currentColor" className="ml-0.5" />
              <span>Play</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleLike && heroTrack.id) {
                  onToggleLike(heroTrack.id, heroTrack);
                }
              }}
              className={`w-10 h-10 rounded-full border border-white/10 text-[#c4beb6] flex items-center justify-center transition-all bg-white/[0.02] ${
                isOcean
                  ? 'hover:border-blue-500/40 hover:text-blue-400'
                  : 'hover:border-[#f5d0b5]/40 hover:text-[#f5d0b5]'
              }`}
              title="Save to Liked Songs"
            >
              <Heart size={16} className={isHeroLiked ? (isOcean ? "fill-blue-500 text-blue-500" : "fill-[#f5d0b5] text-[#f5d0b5]") : ""} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/search?q=${encodeURIComponent(heroTrack.name)}`);
              }}
              className="w-10 h-10 rounded-full border border-white/10 hover:border-white/20 text-[#c4beb6] hover:text-white flex items-center justify-center transition-all bg-white/[0.02]"
              title="More Options"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Right: Realistic Vinyl Record slipping out & Audio Waveform spectrum bars */}
        <div className="hidden lg:flex flex-col items-end justify-between relative pl-4 flex-shrink-0 self-stretch min-w-[210px] xl:min-w-[240px]">
          {/* Vinyl Record emerging from the right - Click to open Fullscreen Vintage Turntable */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenTurntable) onOpenTurntable();
            }}
            className="absolute right-[-35px] top-3 xl:top-5 cursor-pointer group/disc select-none transition-all duration-300 hover:scale-105 active:scale-95"
            title="Click to open Fullscreen Vintage Turntable"
          >
            <VinylRecord
              image={heroTrack.album?.images?.[0]?.url}
              isPlaying={isPlaying}
              className={`w-48 h-48 xl:w-56 xl:h-56 transition-all ${
                isOcean
                  ? 'group-hover/disc:drop-shadow-[0_0_35px_rgba(37,99,235,0.35)]'
                  : 'group-hover/disc:drop-shadow-[0_0_30px_rgba(245,208,181,0.25)]'
              }`}
            />
            {/* Subtle minimalist badge on hover */}
            <div className={`absolute -bottom-2 right-10 text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-xl opacity-0 group-hover/disc:opacity-100 transition-opacity pointer-events-none flex items-center space-x-1 whitespace-nowrap border ${
              isOcean
                ? 'bg-black/90 text-blue-400 border-blue-600/30'
                : 'bg-[#1c181a]/95 text-[#f5d0b5] border-[#f5d0b5]/30'
            }`}>
              <Sparkles size={11} className={isOcean ? 'text-blue-500' : 'text-[#f5d0b5]'} />
              <span>Fullscreen Turntable</span>
            </div>
          </div>

          {/* Audio Waveform Spectrum Bars directly under the vinyl disc */}
          <div className="mt-auto z-10 pr-2 pb-1">
            <AudioWaveform isPlaying={isPlaying} barCount={28} />
          </div>
        </div>
      </div>

      {/* 3. "MADE FOR YOU" SECTION */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Made for you</h2>
          <button
            onClick={() => navigate('/library')}
            className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {madeForYouCards.map((card, idx) => (
            <div
              key={card.id || idx}
              onClick={() => {
                if (card.isPlaylist) {
                  navigate(`/playlist/${card.id}`);
                } else {
                  navigate(`/search?q=${encodeURIComponent(card.name)}`);
                }
              }}
              className="group relative rounded-2xl overflow-hidden aspect-[16/10] bg-[#16141b] border border-white/[0.05] cursor-pointer hover:border-white/15 transition-all shadow-md select-none"
            >
              <img
                src={card.image}
                alt={card.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />

              {/* Dark Vignette Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

              {/* Bottom Card Title & Subtitle */}
              <div className="absolute bottom-2.5 left-3 right-10">
                <h3 className="font-semibold text-xs md:text-sm text-white truncate leading-tight">
                  {card.name}
                </h3>
                <p className="text-[10px] md:text-[11px] text-[#c4beb6] truncate mt-0.5 leading-tight">
                  {card.subtitle}
                </p>
              </div>

              {/* Small Circular White Play Button in Bottom-Right Corner */}
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110">
                <Play size={12} fill="currentColor" className="ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. BOTTOM SPLIT SECTION: "Recently played" (Left) + "Popular tracks" (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 md:gap-8 pt-1">
        {/* Left Column: Recently played (approx 60% on desktop) */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Recently played</h2>
            {isAuthenticated && (
              <button
                onClick={() => navigate('/history')}
                className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
              >
                See all
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3.5">
            {recentTracksList.map((track, idx) => (
              <div
                key={track.id || idx}
                onClick={() => onPlayTrack(track)}
                className="group flex flex-col space-y-2 cursor-pointer select-none"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#141219] border border-white/[0.05] shadow-md shadow-black/50">
                  <img
                    src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400'}
                    alt={track.name}
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
                  <h3 className="font-medium text-xs text-white truncate leading-tight group-hover:text-[#f5d0b5] transition-colors">
                    {track.name}
                  </h3>
                  <p className="text-[10px] text-[#8a8489] truncate mt-0.5 leading-tight">
                    {track.artists?.[0]?.name || 'Artist'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Popular tracks (approx 40% on desktop) */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Popular tracks</h2>
            <button
              onClick={() => navigate('/search')}
              className="text-xs font-medium text-[#8a8489] hover:text-white transition-colors"
            >
              See all
            </button>
          </div>

          <div className="space-y-1.5">
            {popularTracksList.slice(0, 4).map((track, idx) => {
              const isTrackLiked = likedTrackIds?.has(track.id);
              return (
                <div
                  key={track.id || idx}
                  onClick={() => onPlayTrack(track)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer group select-none"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="text-xs font-mono text-[#6e686e] w-5 text-center group-hover:text-[#f5d0b5] transition-colors flex-shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <img
                      src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-white truncate group-hover:text-[#f5d0b5] transition-colors leading-tight">
                        {track.name}
                      </span>
                      <span className="text-[11px] text-[#8a8489] truncate mt-0.5 leading-tight">
                        {track.artists?.map(a => a.name).join(', ') || 'Artist'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0 pl-2">
                    <span className="text-xs font-mono text-[#8a8489]">
                      {formatTime(track.duration_ms ? track.duration_ms / 1000 : 210)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleLike) onToggleLike(track.id, track);
                      }}
                      className="text-[#6e686e] hover:text-[#f5d0b5] transition-colors p-1"
                      title="Like"
                    >
                      <Heart size={14} className={isTrackLiked ? "fill-[#f5d0b5] text-[#f5d0b5]" : ""} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
