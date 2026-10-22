import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Sparkles, Check, Plus, Play, Loader2, X } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useCache } from '../context/CacheContext';

interface ArtistItem {
  id: string;
  name: string;
  images: { url: string }[];
  genres?: string[];
  followers?: { total: number };
  isFollowing?: boolean;
}

export const ArtistsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const { cache, setArtistsData } = useCache();

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

  // Authentic artists from API or cache (instant, zero loading delay if visited before)
  const [topArtists, setTopArtists] = useState<ArtistItem[]>(() => cache.artistsData || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cache.artistsData || cache.artistsData.length === 0);
  const [searchResults, setSearchResults] = useState<ArtistItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'following'>('all');

  // Initial load: Fetch 50 real top artists from backend if not in cache
  useEffect(() => {
    if (cache.artistsData && cache.artistsData.length > 0) {
      setTopArtists(cache.artistsData);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    axios.get('/api/me/top/artists?limit=50')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const apiArtists: ArtistItem[] = res.data.map((item: any) => ({
            id: item.id || `artist-${item.name}`,
            name: item.name,
            images: item.images && item.images.length > 0
              ? item.images
              : [{ url: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=181824&color=f5d0b5&size=300&bold=true` }],
            genres: item.genres || ['Artist'],
            followers: item.followers || { total: 0 },
            isFollowing: false
          }));
          setTopArtists(apiArtists);
          setArtistsData(apiArtists);
        }
      })
      .catch(err => {
        console.error('Failed to load top artists', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [cache.artistsData, setArtistsData]);

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
              id: item.id || `artist-${item.name}`,
              name: item.name,
              images: item.images && item.images.length > 0
                ? item.images
                : [{ url: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=181824&color=f5d0b5&size=300&bold=true` }],
              genres: item.genres || ['Artist'],
              followers: item.followers || { total: 0 },
              isFollowing: false
            }));
            setSearchResults(items);
          }
        })
        .catch(err => {
          console.error('Failed to search artists', err);
        })
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
            {followedIds.size} followed • {isLoading ? 'Loading trending artists...' : searchQuery.trim().length >= 2 ? `${searchResults.length} search results` : `${topArtists.length} trending artists`}
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
          <div className="relative flex items-center w-48 sm:w-64">
            <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none">
              {isSearching ? (
                <Loader2 size={14} className={`animate-spin ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`} />
              ) : (
                <Search size={14} className="text-slate-400" />
              )}
            </div>
            <input
              type="text"
              placeholder="Search worldwide artists..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim().length >= 2) {
                  setIsSearching(true);
                } else {
                  setIsSearching(false);
                  setSearchResults([]);
                }
              }}
              className={`w-full bg-white/[0.04] text-xs text-white placeholder-slate-500 pl-8 pr-8 py-2 rounded-full border border-white/[0.08] outline-none transition-all leading-normal ${
                isOcean ? 'focus:border-blue-500/50' : 'focus:border-[#f5d0b5]/50'
              }`}
            />
            {searchQuery && (
              <div className="absolute right-2 inset-y-0 flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setIsSearching(false);
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded-full transition-colors flex items-center justify-center"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Artists */}
      {isLoading || isSearching ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 animate-in fade-in duration-200">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={`artist-skeleton-${i}`}
              className={`p-4 rounded-3xl border flex flex-col items-center text-center relative overflow-hidden ${
                isOcean ? 'bg-[#0a152d]/40 border-white/[0.04]' : 'bg-[#181312]/40 border-white/[0.04]'
              }`}
            >
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white/[0.06] mb-3 relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
              <div className="h-4 bg-white/[0.08] rounded-full w-24 mb-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
              <div className="h-3 bg-white/[0.04] rounded-full w-16 mb-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
              <div className="h-7 bg-white/[0.05] rounded-full w-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredArtists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {filteredArtists.map((artist) => {
            const avatar = artist.images?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=181824&color=f5d0b5&size=500&bold=true`;

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
