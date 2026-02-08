
import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, ArrowLeft, Plus, Loader2, Music2, CheckCircle2 } from 'lucide-react';
import { Track, Playlist } from '../types';
import axios from 'axios';

import { useStore } from '../store/useStore';

const CATEGORIES = [
  { name: 'Pop', color: 'bg-blue-600' },
  { name: 'Hip-Hop', color: 'bg-indigo-600' },
  { name: 'Rock', color: 'bg-slate-700' },
  { name: 'Jazz', color: 'bg-blue-800' },
];

interface SearchProps {
  onBack: () => void;
  showBack: boolean;
  initialQuery?: string;
}

const Search: React.FC<SearchProps> = ({ onBack, showBack, initialQuery = '' }) => {
  const { isAuthenticated, playTrack } = useStore();
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
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!isAuthenticated) return;
      setIsLoading(true);
      try {
        const res = await axios.get(`/api/search?q=${query}`);
        setResults(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, isAuthenticated]);

  const openPlaylistModal = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrack(track);
    setShowPlaylistModal(true);

    // Fetch user playlists if not already fetched
    if (myPlaylists.length === 0) {
      try {
        const res = await axios.get('/api/me/playlists', { withCredentials: true });
        // Filter only editable playlists (where user is owner) could be a nice enhancement, 
        // but for now we list all and let API reject if unauthorized.
        setMyPlaylists(res.data);
      } catch (error) {
        console.error("Failed to fetch playlists");
      }
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!selectedTrack) return;
    setIsAddingToPlaylist(true);
    try {
      await axios.post(`/api/playlists/${playlistId}/tracks`, {
        uris: [selectedTrack.uri]
      }, { withCredentials: true });

      setToastMessage(`Added to playlist`);
      setTimeout(() => setToastMessage(null), 3000);
      setShowPlaylistModal(false);
    } catch (error) {
      console.error("Failed to add track", error);
      setToastMessage("Failed to add track");
    } finally {
      setIsAddingToPlaylist(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
        <h2 className="text-2xl font-bold text-white">Login to search music</h2>
        <button onClick={() => window.location.href = '/api/auth/login'} className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold">Login</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-24 relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-[60] bg-green-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={20} />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-4">
        {showBack && (
          <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
        )}
        <h1 className="text-3xl font-bold">Search</h1>
      </div>

      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          {isLoading ? <Loader2 className="text-blue-500 animate-spin" size={20} /> : <SearchIcon className="text-slate-400 group-focus-within:text-blue-400 transition-colors" size={20} />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you want to listen to?"
          className="w-full bg-white/10 border-none rounded-full py-3.5 px-12 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>

      {/* Modal for Playlist Selection */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#1F2937] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Add to Playlist</h3>
              <button onClick={() => setShowPlaylistModal(false)} className="text-slate-400 hover:text-white">Close</button>
            </div>

            <p className="text-sm text-slate-400">Select a playlist to add <span className="text-white font-bold">{selectedTrack?.name}</span></p>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
              {myPlaylists.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No playlists found</p>
              ) : (
                myPlaylists.map(pl => (
                  <button
                    key={pl.id}
                    disabled={isAddingToPlaylist}
                    onClick={() => addToPlaylist(pl.id)}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
                  >
                    <div className="w-10 h-10 bg-slate-800 rounded-md flex items-center justify-center overflow-hidden">
                      {pl.images?.[0]?.url ? <img src={pl.images[0].url} className="w-full h-full object-cover" /> : <Music2 size={20} className="text-slate-500" />}
                    </div>
                    <span className="font-bold text-slate-300 group-hover:text-white truncate flex-1">{pl.name}</span>
                    {isAddingToPlaylist && <Loader2 size={16} className="animate-spin text-blue-500" />}
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
            <div key={track.id} onClick={() => playTrack(track, results)} className="flex items-center space-x-4 p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors group">
              <div className="relative w-12 h-12 flex-shrink-0">
                <img src={track.album.images[0]?.url || 'https://picsum.photos/100'} className="w-full h-full rounded-lg object-cover" alt="" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <Play size={20} fill="white" className="text-white ml-0.5" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold truncate text-sm">{track.name}</h3>
                <p className="text-xs text-slate-400 truncate">{track.artists.map(a => a.name).join(', ')}</p>
              </div>
              <button
                onClick={(e) => openPlaylistModal(track, e)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Add to Playlist"
              >
                <Plus size={20} />
              </button>
            </div>
          ))}
          {!isLoading && results.length === 0 && <p className="text-center text-slate-500 py-10">No results found for "{query}"</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          {CATEGORIES.map((cat) => (
            <div key={cat.name} onClick={() => setQuery(cat.name)} className={`${cat.color} aspect-square md:aspect-video rounded-2xl p-6 relative overflow-hidden cursor-pointer hover:scale-[1.03] transition-transform shadow-lg`}>
              <span className="text-xl font-black relative z-10">{cat.name}</span>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full rotate-12 blur-xl" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Search;
