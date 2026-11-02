import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Search, Sparkles, Check, Plus, Play, Loader2, X } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useCache } from '../context/CacheContext';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface ArtistItem {
  id: string;
  name: string;
  images: { url: string }[];
  genres?: string[];
  followers?: { total: number };
  isFollowing?: boolean;
}

function stringSimilarity(s1: string, s2: string): number {
  let longer = s1.toLowerCase().trim();
  let shorter = s2.toLowerCase().trim();
  if (longer.length < shorter.length) {
    const tmp = longer;
    longer = shorter;
    shorter = tmp;
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longerLength - costs[shorter.length]) / parseFloat(longerLength.toString());
}

function isArtistNameMatch(artistName: string, query: string): boolean {
  if (!artistName || !query) return false;

  const normName = artistName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  const normQuery = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  if (!normName || !normQuery) return false;

  if (normName.includes(normQuery) || normQuery.includes(normName)) {
    return true;
  }

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  const nameTokens = normName.split(/\s+/).filter(Boolean);

  if (queryTokens.length > 0 && queryTokens.every(qTok => 
    nameTokens.some(nTok => nTok.startsWith(qTok) || nTok === qTok)
  )) {
    return true;
  }

  const condensedName = normName.replace(/\s+/g, '');
  const condensedQuery = normQuery.replace(/\s+/g, '');
  if (condensedName.startsWith(condensedQuery) || condensedQuery.startsWith(condensedName)) {
    return true;
  }

  // Typo tolerance: Levenshtein distance check for query length >= 3
  if (normQuery.length >= 3) {
    if (stringSimilarity(normName, normQuery) >= 0.72) return true;
    if (stringSimilarity(condensedName, condensedQuery) >= 0.72) return true;
    if (queryTokens.length === nameTokens.length) {
      if (queryTokens.every((qTok, i) => {
        const nTok = nameTokens[i];
        return nTok && (nTok.startsWith(qTok) || stringSimilarity(nTok, qTok) >= 0.7);
      })) return true;
    }
  }

  return false;
}

export interface ArtistsPageProps {
  isAuthenticated?: boolean;
  followedArtistIds?: Set<string>;
  onToggleFollow?: (artist: ArtistItem) => void;
  followedArtistsList?: ArtistItem[];
}

export const ArtistsPage: React.FC<ArtistsPageProps> = ({
  isAuthenticated,
  followedArtistIds: propFollowedIds,
  onToggleFollow: propToggleFollow,
  followedArtistsList: propFollowedList
}) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const { cache, setArtistsData } = useCache();

  // Local fallback followed artist IDs if not passed via props
  const [localFollowedIds, setLocalFollowedIds] = useState<Set<string>>(() => {
    try {
      localStorage.removeItem('slothify_followed_artists');
      const saved = localStorage.getItem('slothify_user_followed_artist_ids');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set<string>();
  });

  const followedIds = propFollowedIds || localFollowedIds;

  const [localFollowedProfiles, setLocalFollowedProfiles] = useState<Record<string, ArtistItem>>(() => {
    try {
      const saved = localStorage.getItem('slothify_followed_artist_profiles');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const followedProfiles = React.useMemo(() => {
    if (propFollowedList && propFollowedList.length > 0) {
      const map: Record<string, ArtistItem> = {};
      propFollowedList.forEach(a => { if (a && a.id) map[a.id] = a; });
      return map;
    }
    return localFollowedProfiles;
  }, [propFollowedList, localFollowedProfiles]);

  // Authentic artists from API or cache (instant, zero loading delay if visited before)
  const [topArtists, setTopArtists] = useState<ArtistItem[]>(() => {
    if (Array.isArray(cache.artistsData)) {
      const hasStale = cache.artistsData.some(a => 
        a.followers?.total === 12500000 || 
        a.images?.[0]?.url?.includes('5b95c0c9aaefc8eb741369cfbb0498b5')
      );
      if (!hasStale && cache.artistsData.length > 0) {
        return cache.artistsData;
      }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => topArtists.length === 0);
  const [searchResults, setSearchResults] = useState<ArtistItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'following'>('all');

  // Initial load: Always fetch 50 authentic top artists from backend (Stale-While-Revalidate)
  useEffect(() => {
    if (topArtists.length === 0) {
      setIsLoading(true);
    }

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
          apiArtists.sort((a, b) => (b.followers?.total || 0) - (a.followers?.total || 0));
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
  }, [setArtistsData]);

  // Real-time live search with 300ms debouncing and AbortController to prevent race conditions
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const abortController = new AbortController();
    setIsSearching(true);
    const timer = setTimeout(() => {
      axios.get('/api/artists/search', {
        params: { q, limit: 30 },
        signal: abortController.signal
      })
        .then(res => {
          if (!abortController.signal.aborted && Array.isArray(res.data)) {
            const items: ArtistItem[] = res.data
              .filter((item: any) => isArtistNameMatch(item.name, q))
              .map((item: any) => ({
                id: item.id || `artist-${item.name}`,
                name: item.name,
                images: item.images && item.images.length > 0
                  ? item.images
                  : [{ url: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=181824&color=f5d0b5&size=300&bold=true` }],
                genres: item.genres || ['Artist'],
                followers: item.followers || { total: 0 },
                isFollowing: false
              }));
            // Strictly rank by popularity / follower count descending
            items.sort((a, b) => (b.followers?.total || 0) - (a.followers?.total || 0));
            setSearchResults(items);
          }
        })
        .catch(err => {
          if (!axios.isCancel(err) && err.name !== 'CanceledError') {
            console.error('Failed to search artists', err);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [searchQuery]);

  const toggleFollow = (artist: ArtistItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (propToggleFollow) {
      propToggleFollow(artist);
      return;
    }

    const id = artist.id;
    setLocalFollowedIds(prev => {
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

    setLocalFollowedProfiles(prev => {
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

  const formatFollowers = (count?: number | { total: number }) => {
    const num = typeof count === 'object' && count !== null ? (count as any).total : typeof count === 'number' ? count : 0;
    if (!num || num <= 0) return 'Popular Artist';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M followers`;
    if (num >= 10000) return `${(num / 1000).toFixed(0)}K followers`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K followers`;
    return `${num} followers`;
  };

  // Determine which list to render:
  // If search active: show search results
  const activeBaseList = (searchQuery.trim().length >= 2
    ? searchResults.filter(a => isArtistNameMatch(a.name, searchQuery))
    : topArtists
  ).slice().sort((a, b) => (b.followers?.total || 0) - (a.followers?.total || 0));

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
    })
    .sort((a, b) => (b.followers?.total || 0) - (a.followers?.total || 0));

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
            const avatar = getOptimizedImageUrl(artist.images?.[0]?.url, '150') || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=181824&color=f5d0b5&size=150&bold=true`;

            return (
              <div
                key={artist.id}
                className={`artist-card group p-4 rounded-3xl transition-all duration-300 border flex flex-col items-center text-center relative ${
                  isOcean
                    ? 'bg-[#0a152d]/40 hover:bg-[#0f1d38]/70 border-white/[0.04] hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-950/40'
                    : 'bg-[#181312]/40 hover:bg-[#231a18]/70 border-white/[0.04] hover:border-[#f5d0b5]/25 hover:shadow-xl hover:shadow-black/60'
                }`}
              >
                {/* Clickable Area to Open Artist Profile */}
                <Link
                  to={`/artist/${artist.id}`}
                  state={{ artist: { ...artist, coverImage: avatar } }}
                  className="w-full flex flex-col items-center cursor-pointer"
                >
                  {/* Circular Avatar with Ambient Ring (150px lazy-loaded) */}
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-3 bg-black/40 shadow-xl flex-shrink-0">
                    <img
                      src={avatar}
                      loading="lazy"
                      alt={artist.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=181824&color=f5d0b5&size=150&bold=true`;
                      }}
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
                </Link>

                {/* Follow Button - Outside Link to completely prevent artist opening */}
                <button
                  type="button"
                  onClick={(e) => toggleFollow(artist, e)}
                  className={`mt-3 px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 border active:scale-95 cursor-pointer z-10 ${
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
