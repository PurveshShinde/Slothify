import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, ArrowLeft, Plus, Loader2, Music2, CheckCircle2 } from 'lucide-react';
import { Track, Playlist } from '../types';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const OCEAN_CATEGORIES = [
  { name: 'Deep Sea Ambient', color: 'bg-gradient-to-br from-[#1e3a8a] to-[#0f172a]' },
  { name: 'Azure Waves', color: 'bg-gradient-to-br from-[#0284c7] to-[#0369a1]' },
  { name: 'Electric Pop', color: 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]' },
  { name: 'Midnight Chill', color: 'bg-gradient-to-br from-[#0c4a6e] to-[#082f49]' },
  { name: 'Ocean Rock', color: 'bg-gradient-to-br from-[#3b82f6] to-[#1e40af]' },
  { name: 'Coastal Acoustic', color: 'bg-gradient-to-br from-[#0ea5e9] to-[#0369a1]' },
];

const AUTUMN_CATEGORIES = [
  { name: 'Indie & Folk', color: 'bg-gradient-to-br from-[#c87d46] to-[#9c5929]' },
  { name: 'Acoustic', color: 'bg-gradient-to-br from-[#b86237] to-[#78391b]' },
  { name: 'Pop Hits', color: 'bg-gradient-to-br from-[#d49b6a] to-[#a36838]' },
  { name: 'Chill & Lofi', color: 'bg-gradient-to-br from-[#8a5d3b] to-[#4e341f]' },
  { name: 'Rock & Classics', color: 'bg-gradient-to-br from-[#a76d49] to-[#6d4025]' },
  { name: 'Jazz & Soul', color: 'bg-gradient-to-br from-[#be8056] to-[#884e2a]' },
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

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const updateQuery = (newQuery: string) => {
    setQuery(newQuery);
    if (newQuery) setSearchParams({ q: newQuery });
    else setSearchParams({});
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
        setResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const openPlaylistModal = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrack(track);

    if (!isAuthenticated) {
      setToastMessage("Sign in to save tracks to playlists!");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setShowPlaylistModal(true);
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
        track: selectedTrack
      });
      setShowPlaylistModal(false);
      setToastMessage(`Added "${selectedTrack.name}" to playlist!`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to add track to playlist');
    } finally {
      setIsAddingToPlaylist(false);
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

      {/* Search Input */}
      <div className="relative group">
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

      {/* Modal for Playlist Selection */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18151c] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add to Playlist</h3>
              <button
                onClick={() => setShowPlaylistModal(false)}
                className="text-[#8a8489] hover:text-white transition-colors"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-[#8a8489]">
              Select a playlist to add <span className="text-white font-medium">{selectedTrack?.name}</span>
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
              {myPlaylists.length === 0 ? (
                <p className="text-center text-[#8a8489] py-4 text-xs">No playlists found</p>
              ) : (
                myPlaylists.map(pl => (
                  <button
                    key={pl.id}
                    disabled={isAddingToPlaylist}
                    onClick={() => addToPlaylist(pl.id)}
                    className="w-full flex items-center space-x-3 p-2.5 hover:bg-white/5 rounded-xl transition-colors text-left group"
                  >
                    <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {pl.images?.[0]?.url ? (
                        <img src={pl.images[0].url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <Music2 size={16} className="text-white/40" />
                      )}
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
          <h2 className="text-sm font-bold tracking-wider text-[#8a8489] uppercase">
            {isOcean ? 'Browse Ocean Genres' : 'Browse Autumn Genres'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            {categories.map((cat) => (
              <div
                key={cat.name}
                onClick={() => updateQuery(cat.name)}
                className={`${cat.color} aspect-[16/9] rounded-2xl p-5 relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform shadow-lg border border-white/10`}
              >
                <span className="text-base md:text-lg font-bold text-white relative z-10 tracking-tight">
                  {cat.name}
                </span>
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
