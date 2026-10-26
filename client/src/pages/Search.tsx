import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, ArrowLeft, Plus, Loader2, Music2, CheckCircle2 } from 'lucide-react';
import { Track, Playlist } from '../types';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import PlaylistCover from '../components/PlaylistCover';
import { AudioService } from '../services/audioService';

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

interface SearchProps {
  isAuthenticated: boolean;
  onPlayTrack: (track: Track, queue: Track[]) => void;
}

const Search: React.FC<SearchProps> = ({ isAuthenticated, onPlayTrack }) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Playlist Management State
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [isAddingToPlaylist, setIsAddingToPlaylist] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Create Playlist States
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [showSearchBarCreateModal, setShowSearchBarCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const updateQuery = (newQuery: string) => {
    setQuery(newQuery);
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchParams({}, { replace: true });
      return;
    }

    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      setSearchParams({ q: trimmed }, { replace: true });
      setIsLoading(true);

      // 1. First search directly via Cloudflare AudioService (JioSaavn)
      try {
        const saavnRes = await AudioService.searchSongs(trimmed);
        if (saavnRes?.data?.results && saavnRes.data.results.length > 0) {
          const mappedTracks = saavnRes.data.results.map(AudioService.toSlothifyTrack);
          setResults(mappedTracks);
          setIsLoading(false);
          return;
        }
      } catch (saavnErr) {
        console.warn('AudioService search failed, falling back to local search:', saavnErr);
      }

      // 2. Fallback to local API search
      try {
        const res = await axios.get(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: abortController.signal
        });
        if (Array.isArray(res.data)) {
          setResults(res.data);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError' && !axios.isCancel(err)) {
          console.error('Search request failed:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [query, setSearchParams]);

  const openPlaylistModal = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrack(track);

    if (!isAuthenticated) {
      setToastMessage("Sign in to save tracks to playlists!");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setShowPlaylistModal(true);
    setShowInlineCreate(false);
    try {
      const res = await axios.get('/api/me/playlists');
      setMyPlaylists(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!selectedTrack) return;
    setIsAddingToPlaylist(true);

    try {
      await axios.post(`/api/playlists/${playlistId}/tracks`, {
        track: selectedTrack,
        uris: [selectedTrack.uri || `spotify:track:${selectedTrack.id}`]
      });
      setShowPlaylistModal(false);
      setToastMessage(`Added "${selectedTrack.name}" to playlist!`);
      setTimeout(() => setToastMessage(null), 3000);
      window.dispatchEvent(new Event('slothify_playlists_updated'));
    } catch (err) {
      console.error(err);
      alert('Failed to add track to playlist');
    } finally {
      setIsAddingToPlaylist(false);
    }
  };

  const handleCreatePlaylist = async (trackToAdd?: Track | null) => {
    const targetTrack = trackToAdd !== undefined ? trackToAdd : selectedTrack;
    const name = newPlaylistName.trim() || `My Playlist #${myPlaylists.length + 1}`;
    setIsCreatingPlaylist(true);

    try {
      const res = await axios.post('/api/me/playlists', {
        name,
        description: 'Created in Slothify'
      });
      const created: Playlist = res.data;
      setMyPlaylists(prev => [created, ...prev]);

      if (targetTrack) {
        await axios.post(`/api/playlists/${created.id}/tracks`, {
          track: targetTrack,
          uris: [targetTrack.uri || `spotify:track:${targetTrack.id}`]
        });
        setToastMessage(`Created "${created.name}" and added "${targetTrack.name}"!`);
      } else {
        setToastMessage(`Created playlist "${created.name}"!`);
      }

      setShowPlaylistModal(false);
      setShowSearchBarCreateModal(false);
      setShowInlineCreate(false);
      setNewPlaylistName('');
      setTimeout(() => setToastMessage(null), 3000);
      window.dispatchEvent(new Event('slothify_playlists_updated'));
    } catch (err) {
      console.error(err);
      alert('Failed to create playlist');
    } finally {
      setIsCreatingPlaylist(false);
    }
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
        <div className="space-y-2">
          {results.map((track) => (
            <div
              key={track.id}
              onClick={() => onPlayTrack(track, results)}
              className="flex items-center space-x-3.5 p-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] rounded-2xl cursor-pointer transition-all group"
            >
              <div className="relative w-11 h-11 flex-shrink-0 rounded-xl overflow-hidden bg-[#18151c]">
                <img
                  src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                  className="w-full h-full object-cover"
                  alt=""
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
                  {track.artists?.map(a => a.name).join(', ') || 'Artist'}
                </p>
              </div>

              <button
                onClick={(e) => openPlaylistModal(track, e)}
                className={`p-2 text-[#8a8489] rounded-full transition-colors flex-shrink-0 hover:bg-white/5 ${
                  isOcean ? 'hover:text-blue-400' : 'hover:text-[#f5d0b5]'
                }`}
                title="Add to Playlist"
              >
                <Plus size={18} />
              </button>
            </div>
          ))}
          {!isLoading && results.length === 0 && (
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
