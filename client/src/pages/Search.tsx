import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, ArrowLeft, Plus, Loader2, Music2, CheckCircle2, Disc } from 'lucide-react';
import { Track, Playlist } from '../types';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useCache } from '../context/CacheContext';
import PlaylistCover from '../components/PlaylistCover';
import { AudioService } from '../services/audioService';
import { useDebounce } from '../hooks/useDebounce';
import { getOptimizedImageUrl, getTrackThumbnail, getArtistAvatarUrl, handleArtistImageError } from '../utils/imageOptimizer';

interface CategoryItem {
  name: string;
  subtitle: string;
  tag: string;
  color: string;
  image: string;
  query?: string;
}

const OCEAN_CATEGORIES: CategoryItem[] = [
  {
    name: 'Deep Sea Ambient',
    subtitle: 'Calm depths & ethereal soundscapes',
    tag: 'Ambient',
    color: 'bg-gradient-to-br from-[#0c1f4a] via-[#1e3a8a] to-[#0284c7]',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500&auto=format&fit=crop&q=80',
    query: 'Deep Sea Ambient instrumental'
  },
  {
    name: 'Azure Waves',
    subtitle: 'Tropical vibes & chill summer rhythms',
    tag: 'Tropical',
    color: 'bg-gradient-to-br from-[#0369a1] via-[#0284c7] to-[#38bdf8]',
    image: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=500&auto=format&fit=crop&q=80',
    query: 'Tropical House summer chill'
  },
  {
    name: 'Electric Pop',
    subtitle: 'Synthwaves & neon dance anthems',
    tag: 'Electronic',
    color: 'bg-gradient-to-br from-[#312e81] via-[#2563eb] to-[#0ea5e9]',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=80',
    query: 'Top Pop Hits 2024'
  },
  {
    name: 'Midnight Chill',
    subtitle: 'Late night lofi & moonlit beats',
    tag: 'Lo-Fi',
    color: 'bg-gradient-to-br from-[#030712] via-[#0f172a] to-[#1e293b]',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    query: 'Midnight Lofi Chill beats'
  },
  {
    name: 'Ocean Rock',
    subtitle: 'Coastal riffs & alternative power',
    tag: 'Rock',
    color: 'bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#2563eb]',
    image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&auto=format&fit=crop&q=80',
    query: 'Modern Rock alternative'
  },
  {
    name: 'Coastal Acoustic',
    subtitle: 'Unplugged guitars & organic surf',
    tag: 'Acoustic',
    color: 'bg-gradient-to-br from-[#082f49] via-[#0369a1] to-[#38bdf8]',
    image: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=500&auto=format&fit=crop&q=80',
    query: 'Acoustic Guitar chill folk'
  },
];

const AUTUMN_CATEGORIES: CategoryItem[] = [
  {
    name: 'Indie & Folk',
    subtitle: 'Golden forest acoustic & storytelling',
    tag: 'Indie',
    color: 'bg-gradient-to-br from-[#451a03] via-[#78350f] to-[#b45309]',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&auto=format&fit=crop&q=80',
    query: 'Indie Folk acoustic'
  },
  {
    name: 'Warm Acoustic',
    subtitle: 'Handpicked strings & fireside melodies',
    tag: 'Unplugged',
    color: 'bg-gradient-to-br from-[#7c2d12] via-[#9a3412] to-[#ea580c]',
    image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop&q=80',
    query: 'Acoustic Morning chill'
  },
  {
    name: 'Pop Hits',
    subtitle: 'Golden hour anthems & top radio',
    tag: 'Trending',
    color: 'bg-gradient-to-br from-[#78350f] via-[#b45309] to-[#d97706]',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
    query: 'Top Hits Radio'
  },
  {
    name: 'Chill & Lofi',
    subtitle: 'Rainy window study & cozy coffee',
    tag: 'Study & Chill',
    color: 'bg-gradient-to-br from-[#291e17] via-[#432818] to-[#78350f]',
    image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=500&auto=format&fit=crop&q=80',
    query: 'Lofi Hip Hop chill beats'
  },
  {
    name: 'Rock & Classics',
    subtitle: 'Timeless vintage vinyl & legendary riffs',
    tag: 'Classics',
    color: 'bg-gradient-to-br from-[#422006] via-[#713f12] to-[#a16207]',
    image: 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=500&auto=format&fit=crop&q=80',
    query: 'Classic Rock legendary hits'
  },
  {
    name: 'Jazz & Soul',
    subtitle: 'Moody saxophone & amber lounges',
    tag: 'Jazz',
    color: 'bg-gradient-to-br from-[#3b120c] via-[#5c2419] to-[#991b1b]',
    image: 'https://images.unsplash.com/photo-1525994886773-080587e161c2?w=500&auto=format&fit=crop&q=80',
    query: 'Coffee Table Jazz soul'
  },
];

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

interface SearchProps {
  isAuthenticated: boolean;
  onPlayTrack: (track: Track, playlist?: Track[]) => void;
}

const formatFollowers = (count?: number | { total: number }) => {
  const num = typeof count === 'object' && count !== null ? (count as any).total : typeof count === 'number' ? count : 0;
  if (!num || num <= 0) return 'Popular Artist';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M followers`;
  if (num >= 10000) return `${(num / 1000).toFixed(0)}K followers`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K followers`;
  return `${num} followers`;
};

export type SearchFilterTab = 'all' | 'songs' | 'artists' | 'albums';

// In-memory client search cache for instant return navigations (< 1ms)
const clientSearchCache = new Map<string, { results: Track[]; artists: any[]; albums: any[] }>();

const Search: React.FC<SearchProps> = ({ isAuthenticated, onPlayTrack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOcean } = useTheme();
  const { cache, setLibraryPlaylists, setPlaylistDetail } = useCache();

  // Keep search query strictly in local state (hidden from URL)
  const [query, setQuery] = useState<string>(() => {
    const stateQuery = (location.state as { q?: string } | null)?.q;
    const urlQuery = new URLSearchParams(location.search).get('q');
    return stateQuery || urlQuery || '';
  });

  const [activeTab, setActiveTab] = useState<SearchFilterTab>('all');

  const initialCached = query.trim() ? clientSearchCache.get(query.trim()) : null;
  const [results, setResults] = useState<Track[]>(() => initialCached?.results || []);
  const [artists, setArtists] = useState<any[]>(() => initialCached?.artists || []);
  const [albums, setAlbums] = useState<any[]>(() => initialCached?.albums || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialCached && !!query.trim());

  // Debounce the query by 300ms for optimal responsive typing without hammering API
  const debouncedQuery = useDebounce(query, 300);

  // Clean URL if navigated with query parameter so the address bar stays clean (/search)
  useEffect(() => {
    if (location.search) {
      navigate('/search', { replace: true, state: location.state });
    }
  }, [location.search, navigate, location.state]);

  // Playlist Management State (Pre-populated from cache for instant 0ms modal opening)
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>(() => cache.libraryPlaylists || []);
  const [isAddingToPlaylist, setIsAddingToPlaylist] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Create Playlist States
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [showSearchBarCreateModal, setShowSearchBarCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  const updateQuery = (newQuery: string) => {
    setQuery(newQuery);
  };

  // Instantly clear results when search input is empty
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setArtists([]);
      setAlbums([]);
      setIsLoading(false);
    }
  }, [query]);

  // Execute search when debounced query changes
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      setArtists([]);
      setAlbums([]);
      setIsLoading(false);
      return;
    }

    const cached = clientSearchCache.get(trimmed);
    if (cached) {
      setResults(cached.results);
      setArtists(cached.artists);
      setAlbums(cached.albums || []);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    const abortController = new AbortController();

    const performSearch = async () => {
      // 0. Search for artists matching query in parallel and sort by popularity / followers descending
      axios.get(`/api/artists/search?q=${encodeURIComponent(trimmed)}&limit=20`, {
        signal: abortController.signal
      }).then(res => {
        if (!abortController.signal.aborted && Array.isArray(res.data)) {
          const matched = res.data.filter((a: any) => isArtistNameMatch(a.name, trimmed));
          matched.sort((a: any, b: any) => {
            const fA = typeof a.followers === 'object' && a.followers !== null ? a.followers.total : (Number(a.followers) || 0);
            const fB = typeof b.followers === 'object' && b.followers !== null ? b.followers.total : (Number(b.followers) || 0);
            return fB - fA;
          });
          const topArtists = matched.slice(0, 12);
          setArtists(topArtists);
          const currentEntry = clientSearchCache.get(trimmed);
          clientSearchCache.set(trimmed, {
            results: currentEntry?.results || results,
            artists: topArtists,
            albums: currentEntry?.albums || albums
          });
        }
      }).catch(() => {});

      // 1. Search for albums matching query in parallel
      axios.get(`/api/albums/search?q=${encodeURIComponent(trimmed)}`, {
        signal: abortController.signal
      }).then(res => {
        if (!abortController.signal.aborted && Array.isArray(res.data)) {
          setAlbums(res.data);
          const currentEntry = clientSearchCache.get(trimmed);
          clientSearchCache.set(trimmed, {
            results: currentEntry?.results || results,
            artists: currentEntry?.artists || artists,
            albums: res.data
          });
        }
      }).catch(() => {});

      // 2. Primary: Search Slothify global catalog (Spotify + JioSaavn)
      try {
        const res = await axios.get(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: abortController.signal
        });
        if (abortController.signal.aborted) return;
        if (Array.isArray(res.data) && res.data.length > 0) {
          setResults(res.data);
          setIsLoading(false);
          const currentEntry = clientSearchCache.get(trimmed);
          clientSearchCache.set(trimmed, {
            results: res.data,
            artists: currentEntry?.artists || artists,
            albums: currentEntry?.albums || albums
          });
          return;
        }
      } catch (err: any) {
        if (!abortController.signal.aborted && err.name !== 'CanceledError' && !axios.isCancel(err)) {
          console.warn('Backend search notice, falling back:', err.message);
        }
      }

      // 3. Secondary fallback: Cloudflare AudioService (JioSaavn)
      try {
        const saavnRes = await AudioService.searchSongs(trimmed);
        if (abortController.signal.aborted) return;
        if (saavnRes?.data?.results && saavnRes.data.results.length > 0) {
          const mappedTracks = saavnRes.data.results.map(AudioService.toSlothifyTrack);
          setResults(mappedTracks);
          const currentEntry = clientSearchCache.get(trimmed);
          clientSearchCache.set(trimmed, {
            results: mappedTracks,
            artists: currentEntry?.artists || artists,
            albums: currentEntry?.albums || albums
          });
        }
      } catch (saavnErr) {
        if (!abortController.signal.aborted) {
          console.warn('AudioService fallback notice:', saavnErr);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    performSearch();

    return () => {
      abortController.abort();
    };
  }, [debouncedQuery]);

  const openPlaylistModal = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrack(track);

    if (!isAuthenticated) {
      setToastMessage("Sign in to save tracks to playlists!");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Instantly use cached playlists so modal opens with 0ms lag
    if (cache.libraryPlaylists && cache.libraryPlaylists.length > 0) {
      setMyPlaylists(cache.libraryPlaylists);
    }

    setShowPlaylistModal(true);
    setShowInlineCreate(false);

    // Revalidate in background
    axios.get('/api/me/playlists')
      .then(res => {
        if (Array.isArray(res.data)) {
          setMyPlaylists(res.data);
          setLibraryPlaylists(res.data);
        }
      })
      .catch(err => {
        console.error('Failed to refresh playlists:', err);
      });
  };

  const addToPlaylist = (playlistId: string) => {
    if (!selectedTrack) return;
    const trackToAdd = selectedTrack;
    const targetPlaylist = myPlaylists.find(p => p.id === playlistId);
    const playlistName = targetPlaylist?.name || 'playlist';

    // 1. INSTANT OPTIMISTIC UI: Dismiss modal and show success toast immediately (0ms delay)
    setShowPlaylistModal(false);
    setToastMessage(`Added "${trackToAdd.name}" to ${playlistName}!`);
    setTimeout(() => setToastMessage(null), 3000);

    // 2. Optimistically update local component state & library cache
    setMyPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        const total = (p.tracks?.total || 0) + 1;
        const currentItems = p.tracks?.items || [];
        const hasTrack = currentItems.some(i => i.track?.id === trackToAdd.id);
        return {
          ...p,
          tracks: {
            ...p.tracks,
            total,
            items: hasTrack ? currentItems : [...currentItems, { track: trackToAdd }]
          }
        };
      }
      return p;
    }));

    if (cache.libraryPlaylists) {
      const updatedLibrary = cache.libraryPlaylists.map(p => {
        if (p.id === playlistId) {
          const total = (p.tracks?.total || 0) + 1;
          const currentItems = p.tracks?.items || [];
          const hasTrack = currentItems.some(i => i.track?.id === trackToAdd.id);
          return {
            ...p,
            tracks: {
              ...p.tracks,
              total,
              items: hasTrack ? currentItems : [...currentItems, { track: trackToAdd }]
            }
          };
        }
        return p;
      });
      setLibraryPlaylists(updatedLibrary);
    }

    // 3. Immediately dispatch event so Sidebar & Playlists page update without waiting
    window.dispatchEvent(new Event('slothify_playlists_updated'));

    // 4. Perform network request in background (non-blocking)
    axios.post(`/api/playlists/${playlistId}/tracks`, {
      track: trackToAdd,
      uris: [trackToAdd.uri || `spotify:track:${trackToAdd.id}`]
    })
      .then(res => {
        if (res.data) {
          const rawPlaylist = res.data;
          const items = rawPlaylist.tracks?.items || [];
          const tracksArray = items.map((i: any) => i.track || i).filter(Boolean);
          setPlaylistDetail(playlistId, {
            playlist: rawPlaylist,
            tracks: tracksArray
          });
          window.dispatchEvent(new Event('slothify_playlists_updated'));
        }
      })
      .catch(err => {
        console.error('Failed to add track to playlist on server:', err);
        setToastMessage(`Could not save "${trackToAdd.name}" to ${playlistName}. Please check your connection.`);
        setTimeout(() => setToastMessage(null), 3500);
      });
  };

  const handleCreatePlaylist = async (trackToAdd?: Track | null) => {
    const targetTrack = trackToAdd !== undefined ? trackToAdd : selectedTrack;
    const name = newPlaylistName.trim() || `My Playlist #${myPlaylists.length + 1}`;
    setIsCreatingPlaylist(true);

    // Instantly close modals for responsive UX
    setShowPlaylistModal(false);
    setShowSearchBarCreateModal(false);
    setShowInlineCreate(false);
    setNewPlaylistName('');

    if (targetTrack) {
      setToastMessage(`Creating "${name}" with "${targetTrack.name}"...`);
    } else {
      setToastMessage(`Creating "${name}"...`);
    }

    try {
      const res = await axios.post('/api/me/playlists', {
        name,
        description: 'Created in Slothify'
      });
      const created: Playlist = res.data;
      setMyPlaylists(prev => [created, ...prev]);

      if (cache.libraryPlaylists) {
        setLibraryPlaylists([created, ...cache.libraryPlaylists]);
      }

      let createdTracks: Track[] = [];
      if (targetTrack) {
        const addRes = await axios.post(`/api/playlists/${created.id}/tracks`, {
          track: targetTrack,
          uris: [targetTrack.uri || `spotify:track:${targetTrack.id}`]
        });
        if (addRes.data) {
          const items = addRes.data.tracks?.items || [];
          createdTracks = items.map((i: any) => i.track || i).filter(Boolean);
        } else {
          createdTracks = [targetTrack];
        }
        setToastMessage(`Created "${created.name}" and added "${targetTrack.name}"!`);
      } else {
        setToastMessage(`Created playlist "${created.name}"!`);
      }

      setPlaylistDetail(created.id, {
        playlist: created,
        tracks: createdTracks
      });

      setTimeout(() => setToastMessage(null), 3000);
      window.dispatchEvent(new Event('slothify_playlists_updated'));
    } catch (err) {
      console.error(err);
      setToastMessage('Failed to create playlist');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const renderTrackRow = (track: Track, queue: Track[] = results) => {
    const thumbUrl = getTrackThumbnail(track, '', '150');
    return (
      <div
        key={track.id}
        onClick={() => onPlayTrack(track, queue)}
        className="flex items-center space-x-3.5 p-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] rounded-2xl cursor-pointer transition-all group"
      >
        <div className="relative w-11 h-11 flex-shrink-0 rounded-xl overflow-hidden bg-[#18151c]">
          <img
            src={thumbUrl}
            loading="lazy"
            className="w-full h-full object-cover"
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=150';
            }}
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={16} fill="white" className="text-white ml-0.5" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-xs md:text-sm text-white truncate transition-colors leading-tight ${
            isOcean ? 'group-hover:text-blue-400' : 'group-hover:text-[#f5d0b5]'
          }`}>
            {track.name}
          </h3>
          <p className="text-[11px] text-[#8a8489] truncate mt-0.5 leading-tight">
            {track.artists && track.artists.length > 0 ? (
              track.artists.map((a, i) => (
                <React.Fragment key={a.name || i}>
                  {i > 0 && ', '}
                  <Link
                    to={`/artist/sp_art_${encodeURIComponent(a.name)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline hover:text-white transition-colors"
                  >
                    {a.name}
                  </Link>
                </React.Fragment>
              ))
            ) : (
              'Artist'
            )}
          </p>
        </div>

        <button
          onClick={(e) => openPlaylistModal(track, e)}
          className={`p-2 text-[#8a8489] rounded-full transition-colors flex-shrink-0 hover:bg-white/5 cursor-pointer ${
            isOcean ? 'hover:text-blue-400' : 'hover:text-[#f5d0b5]'
          }`}
          title="Add to Playlist"
        >
          <Plus size={18} />
        </button>
      </div>
    );
  };

  const renderArtistCard = (artist: any) => {
    const imgUrl = getArtistAvatarUrl(artist, '300');
    return (
      <Link
        key={artist.id}
        to={`/artist/${artist.id}`}
        className="artist-card group p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/15 transition-all flex flex-col items-center text-center cursor-pointer shadow-sm hover:scale-[1.02]"
      >
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-md ring-2 ring-white/10 group-hover:ring-cyan-400/40 mb-2.5 bg-[#18151c] flex-shrink-0">
          <img
            src={imgUrl}
            loading="lazy"
            alt={artist.name}
            onError={(e) => handleArtistImageError(e, artist.name)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-white truncate w-full group-hover:text-cyan-300 transition-colors">
          {artist.name}
        </h3>
        <span className="text-[10px] text-cyan-300/80 font-medium mt-0.5">
          Artist • {formatFollowers(artist.followers)}
        </span>
      </Link>
    );
  };

  const renderAlbumCard = (album: any) => {
    const coverUrl = getOptimizedImageUrl(album.images?.[0]?.url, '300');
    const firstArtist = album.artists?.[0];
    let artistName = 'Artist';
    if (typeof firstArtist === 'string' && firstArtist.trim() && firstArtist !== '[object Object]') {
      artistName = firstArtist;
    } else if (typeof firstArtist?.name === 'string' && firstArtist.name.trim() && firstArtist.name !== '[object Object]') {
      artistName = firstArtist.name;
    } else if (typeof album.artist === 'string' && album.artist.trim() && album.artist !== '[object Object]') {
      artistName = album.artist;
    } else if (typeof album.subtitle === 'string' && album.subtitle.trim() && album.subtitle !== '[object Object]') {
      artistName = album.subtitle;
    }
    const year = album.release_date ? String(album.release_date).split('-')[0] : '';
    return (
      <div
        key={album.id}
        onClick={() => navigate(`/album/${album.id}`, { state: { album } })}
        className="group p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/15 transition-all flex flex-col cursor-pointer shadow-sm hover:scale-[1.02]"
      >
        <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-md mb-2.5 bg-[#18151c]">
          {coverUrl ? (
            <img
              src={coverUrl}
              loading="lazy"
              alt={album.name}
              onError={(e) => {
                // High quality fallback: replace broken image so broken image icon never renders
                (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(album.name)}&background=18151c&color=f5d0b5&size=500&bold=true`;
              }}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/5">
              <Disc size={28} className="text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className={`w-9 h-9 rounded-full ${isOcean ? 'bg-blue-500' : 'bg-[#c87d46]'} flex items-center justify-center shadow-lg`}>
              <Play size={15} fill="white" className="text-white ml-0.5" />
            </div>
          </div>
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-white truncate w-full group-hover:text-blue-400 transition-colors">
          {album.name}
        </h3>
        <p className="text-[11px] text-[#8a8489] truncate mt-0.5">
          {year ? `${year} • ${artistName}` : artistName}
        </p>
      </div>
    );
  };

  const categories = isOcean ? OCEAN_CATEGORIES : AUTUMN_CATEGORIES;

  return (
    <div className="space-y-6 pb-28 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-black/90 backdrop-blur-md text-white text-xs font-semibold rounded-full border border-white/10 shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 size={15} className={isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-3 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="md:hidden p-2 -ml-2 text-[#8a8489] hover:text-white transition-colors rounded-xl hover:bg-white/5"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Search</h1>
          <p className="text-xs text-[#8a8489] mt-0.5">
            {isOcean ? 'Explore tracks, albums, and oceanic moods' : 'Explore songs, artists, and autumn moods'}
          </p>
        </div>
      </div>

      {/* Search Input & Action */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        <div className="relative group flex-1">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 className={`${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} animate-spin`} size={18} />
            ) : (
              <SearchIcon className={`text-[#8a8489] group-focus-within:${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} transition-colors`} size={18} />
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className={`w-full bg-[#16141a] border border-white/[0.06] rounded-full py-3.5 pl-12 pr-6 text-sm text-white placeholder-[#6e686e] outline-none transition-all shadow-inner ${
              isOcean
                ? 'focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
                : 'focus:border-[#f5d0b5]/40 focus:ring-2 focus:ring-[#f5d0b5]/20'
            }`}
          />
        </div>

        {isAuthenticated && (
          <button
            onClick={() => {
              setNewPlaylistName(`My Playlist #${myPlaylists.length + 1}`);
              setShowSearchBarCreateModal(true);
            }}
            className={`flex items-center space-x-1.5 px-4 py-3.5 rounded-full font-semibold text-xs transition-all shadow-md active:scale-95 flex-shrink-0 cursor-pointer ${
              isOcean
                ? 'bg-blue-600/25 hover:bg-blue-600/40 text-cyan-300 border border-blue-500/35 hover:border-blue-400'
                : 'bg-[#3d271c] hover:bg-[#523425] text-[#f5d0b5] border border-[#f5d0b5]/30 hover:border-[#f5d0b5]/50'
            }`}
            title="Create a new playlist"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Playlist</span>
          </button>
        )}
      </div>

      {/* Filter Pills Bar (All, Songs, Artists, Albums) */}
      {query.trim() && (
        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide py-1 -mt-2">
          {(['all', 'songs', 'artists', 'albums'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const countLabel =
              tab === 'songs' && results.length > 0
                ? ` (${results.length})`
                : tab === 'artists' && artists.length > 0
                ? ` (${artists.length})`
                : tab === 'albums' && albums.length > 0
                ? ` (${albums.length})`
                : '';
            const labels: Record<SearchFilterTab, string> = {
              all: 'All',
              songs: `Songs${countLabel}`,
              artists: `Artists${countLabel}`,
              albums: `Albums${countLabel}`
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? isOcean
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                      : 'bg-[#f5d0b5] text-[#1c1410] shadow-md shadow-[#f5d0b5]/20 font-bold'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white border border-white/[0.06]'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      )}

      {/* Modal for Playlist Selection */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18151c] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add to Playlist</h3>
              <button
                onClick={() => {
                  setShowPlaylistModal(false);
                  setShowInlineCreate(false);
                }}
                className="text-[#8a8489] hover:text-white transition-colors"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-[#8a8489]">
              Select a playlist to add <span className="text-white font-medium">{selectedTrack?.name}</span>
            </p>

            {/* Quick inline create row inside modal */}
            <div className="pt-0.5 pb-1">
              {showInlineCreate ? (
                <div className="space-y-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="Playlist name..."
                    autoFocus
                    className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreatePlaylist(selectedTrack);
                    }}
                  />
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowInlineCreate(false)}
                      className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isCreatingPlaylist}
                      onClick={() => handleCreatePlaylist(selectedTrack)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold text-white transition-all flex items-center space-x-1 ${
                        isOcean ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#c87d46] hover:bg-[#d97736]'
                      }`}
                    >
                      {isCreatingPlaylist ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      <span>Create & Add</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNewPlaylistName(`My Playlist #${myPlaylists.length + 1}`);
                    setShowInlineCreate(true);
                  }}
                  className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs font-semibold text-white/90 hover:text-white transition-all cursor-pointer"
                >
                  <Plus size={14} className={isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} />
                  <span>Create New Playlist</span>
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
              {myPlaylists.length === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-[#8a8489] text-xs">No playlists available yet</p>
                  <p className="text-[11px] text-slate-500">Create your first playlist above to save this track!</p>
                </div>
              ) : (
                myPlaylists.map(pl => (
                  <button
                    key={pl.id}
                    disabled={isAddingToPlaylist}
                    onClick={() => addToPlaylist(pl.id)}
                    className="w-full flex items-center space-x-3 p-2.5 hover:bg-white/5 rounded-xl transition-colors text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                      <PlaylistCover images={pl.images} tracks={pl.tracks} iconSize={16} />
                    </div>
                    <span className="text-xs font-medium text-white truncate flex-1 group-hover:text-blue-400">
                      {pl.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Standalone Quick Create Playlist Modal (Triggered from Search Bar) */}
      {showSearchBarCreateModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18151c] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Create New Playlist</h3>
              <button
                onClick={() => setShowSearchBarCreateModal(false)}
                className="text-[#8a8489] hover:text-white transition-colors"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-[#8a8489]">
              Give your new playlist a name. Posters will automatically generate once you add 4 songs!
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreatePlaylist(null);
              }}
              className="space-y-4"
            >
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name..."
                autoFocus
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-400 transition-all"
              />

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSearchBarCreateModal(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPlaylist}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all flex items-center space-x-1.5 shadow-md ${
                    isOcean ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#c87d46] hover:bg-[#d97736]'
                  }`}
                >
                  {isCreatingPlaylist ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  <span>Create Playlist</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Results */}
      {query.trim() ? (
        <div className="space-y-6">
          {/* TAB: ALL */}
          {activeTab === 'all' && (
            <div className="space-y-6">
              {/* Songs List */}
              {results.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold tracking-wider text-[#8a8489] uppercase">
                      Songs
                    </h2>
                    {results.length > 5 && (
                      <button
                        onClick={() => setActiveTab('songs')}
                        className="text-xs font-semibold text-[#8a8489] hover:text-white transition-colors cursor-pointer"
                      >
                        See all ({results.length})
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {results.slice(0, 10).map((track) => renderTrackRow(track))}
                  </div>
                </div>
              )}

              {/* Albums List */}
              {albums.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold tracking-wider text-[#8a8489] uppercase">
                      Albums
                    </h2>
                    {albums.length > 6 && (
                      <button
                        onClick={() => setActiveTab('albums')}
                        className="text-xs font-semibold text-[#8a8489] hover:text-white transition-colors cursor-pointer"
                      >
                        See all
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {albums.slice(0, 6).map((album) => renderAlbumCard(album))}
                  </div>
                </div>
              )}

              {/* Additional songs if more than 10 */}
              {results.length > 10 && (
                <div className="space-y-2 pt-2">
                  <div className="space-y-1.5">
                    {results.slice(10, 25).map((track) => renderTrackRow(track))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: SONGS */}
          {activeTab === 'songs' && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold tracking-wider text-[#8a8489] uppercase mb-1">
                Songs {results.length > 0 && `(${results.length})`}
              </h2>
              {results.length > 0 ? (
                <div className="space-y-1.5">
                  {results.map((track) => renderTrackRow(track))}
                </div>
              ) : (
                !isLoading && (
                  <div className="text-center text-[#8a8489] py-16 text-xs">
                    No songs found matching &ldquo;{query}&rdquo;
                  </div>
                )
              )}
            </div>
          )}

          {/* TAB: ARTISTS */}
          {activeTab === 'artists' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold tracking-wider text-[#8a8489] uppercase mb-1">
                Artists {artists.length > 0 && `(${artists.length})`}
              </h2>
              {artists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {artists.map((artist) => renderArtistCard(artist))}
                </div>
              ) : (
                !isLoading && (
                  <div className="text-center text-[#8a8489] py-16 text-xs">
                    No artists found matching &ldquo;{query}&rdquo;
                  </div>
                )
              )}
            </div>
          )}

          {/* TAB: ALBUMS */}
          {activeTab === 'albums' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold tracking-wider text-[#8a8489] uppercase mb-1">
                Albums {albums.length > 0 && `(${albums.length})`}
              </h2>
              {albums.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {albums.map((album) => renderAlbumCard(album))}
                </div>
              ) : (
                !isLoading && (
                  <div className="text-center text-[#8a8489] py-16 text-xs">
                    No albums found matching &ldquo;{query}&rdquo;
                  </div>
                )
              )}
            </div>
          )}

          {/* Global Empty State */}
          {!isLoading && results.length === 0 && artists.length === 0 && albums.length === 0 && (
            <div className="text-center text-[#8a8489] py-16 text-xs">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider text-[#8a8489] uppercase">
              {isOcean ? 'Browse Ocean Genres' : 'Browse Autumn Genres'}
            </h2>
            <span className="text-[11px] text-[#6e686e] font-medium hidden sm:inline-block">
              Click any genre to explore curated tracks
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.name}
                onClick={() => updateQuery(cat.query || cat.name)}
                className={`group relative aspect-[16/10] sm:aspect-[16/9] rounded-2xl p-5 overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border border-white/10 ${cat.color}`}
              >
                {/* Ambient dynamic glow */}
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
                
                {/* Content Left */}
                <div className="relative z-10 flex flex-col justify-between h-full max-w-[62%] sm:max-w-[65%]">
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black/30 backdrop-blur-md text-white/90 border border-white/10 mb-2">
                      {cat.tag}
                    </span>
                    <h3 className="text-base sm:text-lg md:text-xl font-extrabold text-white tracking-tight leading-snug drop-shadow group-hover:text-white transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-white/70 mt-1 line-clamp-2 leading-relaxed">
                      {cat.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2">
                    <span className="p-1 rounded-full bg-white/20 backdrop-blur-md">
                      <Play size={10} fill="white" className="text-white ml-0.5" />
                    </span>
                    <span>Explore</span>
                  </div>
                </div>

                {/* Signature Tilted Artwork Cover (Spotify style) */}
                <div className="absolute -bottom-3 -right-3 w-28 h-28 sm:w-32 sm:h-32 rotate-[18deg] group-hover:rotate-[12deg] group-hover:scale-110 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 pointer-events-none">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
