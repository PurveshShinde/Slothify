import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Sparkles, Check, Plus, Play, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

interface ArtistItem {
  id: string;
  name: string;
  images: { url: string }[];
  genres?: string[];
  followers?: { total: number };
  isFollowing?: boolean;
}

const DEFAULT_ARTISTS: ArtistItem[] = [
  {
    id: 'artist-taylor-swift',
    name: 'Taylor Swift',
    images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' }],
    genres: ['Pop', 'Country'],
    followers: { total: 110000000 },
    isFollowing: false
  },
  {
    id: 'artist-the-weeknd',
    name: 'The Weeknd',
    images: [{ url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500' }],
    genres: ['R&B', 'Pop'],
    followers: { total: 95000000 },
    isFollowing: false
  },
  {
    id: 'artist-billie-eilish',
    name: 'Billie Eilish',
    images: [{ url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500' }],
    genres: ['Alt-Pop', 'Electropop'],
    followers: { total: 92000000 },
    isFollowing: false
  },
  {
    id: 'artist-coldplay',
    name: 'Coldplay',
    images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500' }],
    genres: ['Alternative Rock', 'Pop Rock'],
    followers: { total: 53000000 },
    isFollowing: false
  },
  {
    id: 'artist-lana-del-rey',
    name: 'Lana Del Rey',
    images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' }],
    genres: ['Dream Pop', 'Baroque Pop'],
    followers: { total: 38000000 },
    isFollowing: false
  },
  {
    id: 'artist-drake',
    name: 'Drake',
    images: [{ url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500' }],
    genres: ['Hip-Hop', 'Rap'],
    followers: { total: 85000000 },
    isFollowing: false
  }
];

export const ArtistsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();

  // Clean followed artist IDs (strictly user-driven, 0 by default)
  const [followedIds, setFollowedIds] = useState<Set<string>>(() => {
    try {
      localStorage.removeItem('slothify_followed_artists');
      const saved = localStorage.getItem('slothify_user_followed_artist_ids');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set<string>();
  });

  const [followedProfiles, setFollowedProfiles] = useState<Record<string, ArtistItem>>(() => {
    try {
      const saved = localStorage.getItem('slothify_followed_artist_profiles');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const [topArtists, setTopArtists] = useState<ArtistItem[]>(() => DEFAULT_ARTISTS);
  const [searchResults, setSearchResults] = useState<ArtistItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'following'>('all');

  // Initial load: Fetch 50 top artists from backend
  useEffect(() => {
    axios.get('/api/me/top/artists?limit=50')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const apiArtists: ArtistItem[] = res.data.map((item: any) => ({
            id: item.id || `artist-${Math.random()}`,
            name: item.name,
            images: item.images || [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' }],
            genres: item.genres || ['Artist', 'Popular'],
            followers: item.followers || { total: 1200000 },
            isFollowing: false
          }));
          setTopArtists(apiArtists);
        }
      })
      .catch(() => {});
  }, []);

  // Real-time live search with debouncing
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      axios.get('/api/artists/search', { params: { q, limit: 30 } })
        .then(res => {
          if (Array.isArray(res.data)) {
            const items: ArtistItem[] = res.data.map((item: any) => ({
              id: item.id || `artist-${Math.random()}`,
              name: item.name,
              images: item.images || [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500' }],
              genres: item.genres || ['Music', 'Artist'],
              followers: item.followers || { total: 1000000 },
              isFollowing: false
            }));
            setSearchResults(items);
          }
        })
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleFollow = (artist: ArtistItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = artist.id;
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem('slothify_user_followed_artist_ids', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });

    setFollowedProfiles(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = artist;
      }
      try {
        localStorage.setItem('slothify_followed_artist_profiles', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const formatFollowers = (count?: number) => {
    if (!count) return 'Popular Artist';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M followers`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K followers`;
    return `${count} followers`;
  };

  // Determine which list to render:
  // If search active: show search results
  // Else: show 50 top artists
  const activeBaseList = searchQuery.trim().length >= 2 ? searchResults : topArtists;

  // Build map of all known artists (including followed ones from storage)
  const allKnownMap = new Map<string, ArtistItem>();
  Object.values(followedProfiles).forEach(p => allKnownMap.set(p.id, p));
  activeBaseList.forEach(a => allKnownMap.set(a.id, a));

  const filteredArtists = (filterType === 'following' ? Array.from(allKnownMap.values()) : activeBaseList)
    .map(a => ({
      ...a,
      isFollowing: followedIds.has(a.id)
    }))
    .filter(a => {
      if (filterType === 'following') {
        const matchesQuery = !searchQuery.trim() ||
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (a.genres && a.genres.some(g => g.toLowerCase().includes(searchQuery.toLowerCase())));
        return a.isFollowing && matchesQuery;
      }
      return true;
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <div className={`p-2 rounded-xl ${isOcean ? 'bg-blue-600/20 text-blue-400' : 'bg-[#c87d46]/20 text-[#f5d0b5]'}`}>
              <Users size={22} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Artists</h1>
          </div>
          <p className="text-xs text-slate-400">
            {followedIds.size} followed • {searchQuery.trim().length >= 2 ? `${searchResults.length} search results` : `${topArtists.length} trending artists`}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Filter Pills */}
          <div className="flex items-center bg-white/[0.05] p-1 rounded-full border border-white/[0.08]">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filterType === 'all'
                  ? isOcean
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#f5d0b5] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('following')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filterType === 'following'
                  ? isOcean
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#f5d0b5] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Following ({followedIds.size})
            </button>
          </div>

          {/* Real-time Search Input */}
          <div className="relative w-48 sm:w-64">
            {isSearching ? (
              <Loader2 size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 animate-spin ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`} />
            ) : (
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            )}
            <input
              type="text"
              placeholder="Search worldwide artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-white/[0.04] text-xs text-white placeholder-slate-500 pl-8 pr-3 py-2 rounded-full border border-white/[0.08] outline-none transition-all ${
                isOcean ? 'focus:border-blue-500/50' : 'focus:border-[#f5d0b5]/50'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Grid of Artists */}
      {filteredArtists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {filteredArtists.map((artist) => {
            const avatar = artist.images?.[0]?.url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';

            return (
              <div
                key={artist.id}
                onClick={() => navigate(`/search?q=${encodeURIComponent(artist.name)}`)}
                className={`group p-4 rounded-3xl cursor-pointer transition-all duration-300 border flex flex-col items-center text-center relative ${
                  isOcean
                    ? 'bg-[#0a152d]/40 hover:bg-[#0f1d38]/70 border-white/[0.04] hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-950/40'
                    : 'bg-[#181312]/40 hover:bg-[#231a18]/70 border-white/[0.04] hover:border-[#f5d0b5]/25 hover:shadow-xl hover:shadow-black/60'
                }`}
              >
                {/* Circular Avatar with Ambient Ring */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-3 bg-black/40 shadow-xl flex-shrink-0">
                  <img
                    src={avatar}
                    alt={artist.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />

                  {/* Play on Search hover badge */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-2xl ${
                      isOcean ? 'bg-blue-600 text-white' : 'bg-[#f5d0b5] text-black'
                    }`}>
                      <Play size={18} fill="currentColor" className="ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Artist Name */}
                <h3 className="font-bold text-white text-sm truncate w-full group-hover:text-white transition-colors">
                  {artist.name}
                </h3>

                <p className="text-[11px] text-slate-400 truncate w-full mt-0.5">
                  {artist.genres?.[0] || 'Artist'} • {formatFollowers(artist.followers?.total)}
                </p>

                {/* Follow Button */}
                <button
                  onClick={(e) => toggleFollow(artist, e)}
                  className={`mt-3 px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 border active:scale-95 ${
                    artist.isFollowing
                      ? isOcean
                        ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                        : 'bg-[#f5d0b5]/15 text-[#f5d0b5] border-[#f5d0b5]/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                      : isOcean
                        ? 'bg-white/5 hover:bg-blue-600 text-white border-white/10 hover:border-blue-500'
                        : 'bg-white/5 hover:bg-[#f5d0b5] text-white hover:text-black border-white/10 hover:border-[#f5d0b5]'
                  }`}
                >
                  {artist.isFollowing ? (
                    <>
                      <Check size={13} strokeWidth={3} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <Plus size={13} strokeWidth={3} />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="p-4 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400">
            <Users size={32} />
          </div>
          <p className="text-white font-bold text-base">No artists found</p>
          <p className="text-slate-400 text-xs max-w-sm">
            {filterType === 'following'
              ? 'You are not following any artists yet. Click Follow on any artist to see them here.'
              : `No artists matching "${searchQuery}".`}
          </p>
        </div>
      )}
    </div>
  );
};

export default ArtistsPage;
