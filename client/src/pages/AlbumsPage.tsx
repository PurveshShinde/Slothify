import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Track } from '../types';
import { Disc, Play, Heart, Search, Loader2, X } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useCache } from '../context/CacheContext';

interface AlbumItem {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  release_date?: string;
  total_tracks?: number;
  isLiked?: boolean;
}

interface AlbumsPageProps {
  onPlayTrack?: (track: Track, queue?: Track[]) => void;
}

// Guaranteed flagship New Music Friday release featuring Tate McRae
const NEW_MUSIC_FRIDAY: AlbumItem = {
  id: '37i9dQZF1DX4JAvHpjipBk',
  name: 'New Music Friday',
  artists: [{ name: 'Tate McRae' }],
  images: [{ url: 'https://i.scdn.co/image/ab67706f00000002b299b91ee0cfcac7d8c15f1c' }],
  release_date: '2024',
  total_tracks: 12
};

// Airtight deduplication: New Music Friday is strictly at index 0, no duplicates can ever occur
const deduplicateAlbums = (items: AlbumItem[]): AlbumItem[] => {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const results: AlbumItem[] = [];

  seenIds.add(NEW_MUSIC_FRIDAY.id);
  seenNames.add(NEW_MUSIC_FRIDAY.name.toLowerCase().trim());
  results.push(NEW_MUSIC_FRIDAY);

  for (const item of items) {
    if (!item) continue;
    const cleanId = String(item.id || '').trim();
    const cleanName = (item.name || '').trim();
    const norm = cleanName.toLowerCase();

    if (cleanId && cleanName && !seenIds.has(cleanId) && !seenNames.has(norm)) {
      seenIds.add(cleanId);
      seenNames.add(norm);
      results.push(item);
    }
  }

  return results;
};

export const AlbumsPage: React.FC<AlbumsPageProps> = () => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const { cache, setAlbumsData } = useCache();

  // User-driven liked albums
  const [likedAlbumIds, setLikedAlbumIds] = useState<Set<string>>(() => {
    try {
      localStorage.removeItem('slothify_liked_albums');
      const saved = localStorage.getItem('slothify_user_liked_album_ids');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set<string>();
  });

  // Persisted liked album profiles
  const [likedProfiles, setLikedProfiles] = useState<Record<string, AlbumItem>>(() => {
    try {
      const saved = localStorage.getItem('slothify_user_liked_album_profiles');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  // Base albums catalog
  const [albums, setAlbums] = useState<AlbumItem[]>(() => {
    if (cache.albumsData && cache.albumsData.length > 0) {
      return deduplicateAlbums(cache.albumsData);
    }
    return [NEW_MUSIC_FRIDAY];
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => !cache.albumsData || cache.albumsData.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'liked'>('all');

  // Real-time Spotify search state
  const [searchResults, setSearchResults] = useState<AlbumItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cache.albumsData && cache.albumsData.length > 0) {
      setAlbums(deduplicateAlbums(cache.albumsData));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    axios.get('/api/browse/new-releases')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const apiAlbums: AlbumItem[] = [];
          for (const item of res.data) {
            const cleanId = String(item.id || `album-${Math.random()}`);
            const cleanName = (item.name || '').trim();
            if (cleanName) {
              apiAlbums.push({
                id: cleanId,
                name: cleanName,
                artists: item.artists && item.artists.length > 0 ? item.artists : [{ name: 'Various Artists' }],
                images: item.images && item.images.length > 0 && item.images[0]?.url
                  ? item.images
                  : [{ url: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=181824&color=f5d0b5&size=500&bold=true` }],
                release_date: item.release_date?.substring(0, 4) || '2024',
                total_tracks: item.total_tracks || 10,
                isLiked: false
              });
            }
          }

          const deduped = deduplicateAlbums(apiAlbums);
          setAlbums(deduped);
          setAlbumsData(deduped);
        }
      })
      .catch(err => {
        console.error('Failed to load new releases:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [cache.albumsData, setAlbumsData]);

  // Real-time Spotify Album Search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(() => {
      axios.get('/api/albums/search', { params: { q } })
        .then(res => {
          if (Array.isArray(res.data)) {
            const cleanResults: AlbumItem[] = res.data.map(item => ({
              id: String(item.id),
              name: item.name,
              artists: item.artists || [{ name: 'Artist' }],
              images: item.images || [{ url: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=181824&color=f5d0b5&size=500&bold=true` }],
              release_date: item.release_date?.substring(0, 4) || '2024',
              total_tracks: item.total_tracks || 10,
              isLiked: false
            }));
            setSearchResults(cleanResults);
          } else {
            setSearchResults([]);
          }
        })
        .catch(err => {
          console.warn('Real-time album search error:', err.message);
          setSearchResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 320);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  const toggleLikeAlbum = (album: AlbumItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = album.id;

    setLikedAlbumIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem('slothify_user_liked_album_ids', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });

    setLikedProfiles(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = album;
      }
      try {
        localStorage.setItem('slothify_user_liked_album_profiles', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleOpenAlbum = (album: AlbumItem) => {
    navigate(`/album/${album.id}`, { state: { album } });
  };

  // Build current displayed list with strict like filtering & deduplication
  const displayedAlbums = useMemo(() => {
    let source: AlbumItem[];

    if (filterType === 'liked') {
      const likedMap = new Map<string, AlbumItem>();
      Object.values(likedProfiles).forEach(p => {
        if (likedAlbumIds.has(p.id)) likedMap.set(p.id, p);
      });
      albums.forEach(a => {
        if (likedAlbumIds.has(a.id)) likedMap.set(a.id, a);
      });
      if (likedAlbumIds.has(NEW_MUSIC_FRIDAY.id)) {
        likedMap.set(NEW_MUSIC_FRIDAY.id, NEW_MUSIC_FRIDAY);
      }
      source = Array.from(likedMap.values());
    } else if (searchQuery.trim().length >= 2 && searchResults !== null) {
      source = searchResults;
    } else {
      source = deduplicateAlbums(albums);
    }

    return source
      .map(a => ({
        ...a,
        isLiked: likedAlbumIds.has(a.id)
      }))
      .filter(a => {
        if (!searchQuery.trim() || (searchQuery.trim().length >= 2 && searchResults !== null)) {
          return true;
        }
        const q = searchQuery.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.artists.some(art => art.name.toLowerCase().includes(q));
      });
  }, [albums, filterType, likedAlbumIds, likedProfiles, searchQuery, searchResults]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <div className={`p-2 rounded-xl ${isOcean ? 'bg-blue-600/20 text-blue-400' : 'bg-[#c87d46]/20 text-[#f5d0b5]'}`}>
              <Disc size={22} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Albums</h1>
          </div>
          <p className="text-xs text-slate-400">
            {likedAlbumIds.size} liked albums • {isLoading ? 'Loading albums...' : isSearching ? 'Searching Spotify albums...' : searchQuery.trim() ? `${displayedAlbums.length} results` : `${displayedAlbums.length} available`}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Filter Pills */}
          <div className="flex items-center bg-white/[0.05] p-1 rounded-full border border-white/[0.08]">
            <button
              onClick={() => {
                setFilterType('all');
                setSearchQuery('');
                setSearchResults(null);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filterType === 'all'
                  ? isOcean
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#f5d0b5] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Albums
            </button>
            <button
              onClick={() => setFilterType('liked')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filterType === 'liked'
                  ? isOcean
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#f5d0b5] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Liked ({likedAlbumIds.size})
            </button>
          </div>

          {/* Search Box with Real-time Spotify indicator */}
          <div className="relative flex items-center w-44 sm:w-64">
            <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none">
              {isSearching ? (
                <Loader2 size={14} className={`animate-spin ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`} />
              ) : (
                <Search size={14} className="text-slate-400" />
              )}
            </div>
            <input
              type="text"
              placeholder="Search Spotify albums..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim().length >= 2) {
                  setIsSearching(true);
                } else {
                  setIsSearching(false);
                  setSearchResults(null);
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
                    setSearchResults(null);
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

      {/* Grid of Albums */}
      {isLoading || isSearching ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 animate-in fade-in duration-200">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={`album-skeleton-${i}`}
              className={`p-3 rounded-2xl border relative overflow-hidden flex flex-col justify-between ${
                isOcean ? 'bg-[#0a152d]/40 border-white/[0.04]' : 'bg-[#181312]/40 border-white/[0.04]'
              }`}
            >
              <div>
                <div className="aspect-square w-full rounded-xl bg-white/[0.06] mb-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
                <div className="h-4 bg-white/[0.08] rounded-full w-3/4 mb-2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
                <div className="h-3 bg-white/[0.04] rounded-full w-1/2 mb-1.5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                </div>
              </div>
              <div className="h-2.5 bg-white/[0.03] rounded-full w-1/3 mt-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedAlbums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {displayedAlbums.map((album) => {
            const coverImage = album.images?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(album.name)}&background=181824&color=f5d0b5&size=500&bold=true`;

            return (
              <div
                key={album.id}
                onClick={() => handleOpenAlbum(album)}
                className={`group p-3 rounded-2xl cursor-pointer transition-all duration-300 border relative flex flex-col justify-between ${
                  isOcean
                    ? 'bg-[#0a152d]/40 hover:bg-[#0f1d38]/70 border-white/[0.04] hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-950/40'
                    : 'bg-[#181312]/40 hover:bg-[#231a18]/70 border-white/[0.04] hover:border-[#f5d0b5]/25 hover:shadow-xl hover:shadow-black/60'
                }`}
              >
                {/* Artwork Container */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-black/40 shadow-md">
                  <img
                    src={coverImage}
                    alt={album.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors" />

                  {/* Open Album Hover Indicator */}
                  <div
                    className={`absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full flex items-center justify-center shadow-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ${
                      isOcean
                        ? 'bg-blue-600 text-white shadow-blue-600/40'
                        : 'bg-[#f5d0b5] text-black shadow-black/80'
                    }`}
                  >
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </div>

                  {/* Like Album Heart Button */}
                  <button
                    onClick={(e) => toggleLikeAlbum(album, e)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:scale-110 transition-transform"
                    title={album.isLiked ? 'Unlike Album' : 'Like Album'}
                  >
                    <Heart
                      size={15}
                      className={
                        album.isLiked
                          ? isOcean
                            ? 'fill-blue-500 text-blue-500'
                            : 'fill-[#f5d0b5] text-[#f5d0b5]'
                          : 'text-white/80'
                      }
                    />
                  </button>
                </div>

                {/* Album Details */}
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-sm truncate group-hover:text-white transition-colors">
                    {album.name}
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate mt-0.5">
                    {album.artists?.[0]?.name || 'Artist'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {album.release_date} • {album.total_tracks || 10} tracks
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="p-4 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400">
            <Disc size={32} />
          </div>
          <p className="text-white font-bold text-base">No albums found</p>
          <p className="text-slate-400 text-xs max-w-sm">
            {filterType === 'liked'
              ? 'You have not liked any albums yet. Click the heart on any album to save it here.'
              : `No albums matching "${searchQuery}". Try searching for another album or artist.`}
          </p>
        </div>
      )}
    </div>
  );
};

export default AlbumsPage;
