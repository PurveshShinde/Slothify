import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Playlist, User } from '../types';
import { ListMusic, Plus, Play, Search, Sparkles, X, Music2, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';
import PlaylistCover from '../components/PlaylistCover';

interface PlaylistsPageProps {
  isAuthenticated: boolean;
  user: User | null;
  onOpenAuth?: () => void;
}

const defaultPlaylists = [
  {
    id: 'late-night-drive',
    name: 'Late Night Drive',
    description: 'Chill songs for city nights',
    images: [{ url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500' }],
    tracks: { total: 24 }
  },
  {
    id: 'acoustic-mornings',
    name: 'Acoustic Mornings',
    description: 'Soft, calm & beautiful acoustic strings',
    images: [{ url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500' }],
    tracks: { total: 18 }
  },
  {
    id: 'heartbreak-diaries',
    name: 'Heartbreak Diaries',
    description: 'Emotional melodies for quiet moments',
    images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500' }],
    tracks: { total: 32 }
  },
  {
    id: 'good-vibes',
    name: 'Good Vibes',
    description: 'Feel-good anthems to lift your mood',
    images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500' }],
    tracks: { total: 29 }
  }
];

export const PlaylistsPage: React.FC<PlaylistsPageProps> = ({ isAuthenticated, user, onOpenAuth }) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const { cache, setLibraryPlaylists, removePlaylistFromCache } = useCache();
  const [playlists, setPlaylists] = useState<any[]>(() => {
    return isAuthenticated ? (cache.libraryPlaylists || []) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistToDelete, setPlaylistToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/me/playlists/${playlistToDelete.id}`);
    } catch (err) {
      console.error('Failed to delete playlist on server:', err);
    } finally {
      removePlaylistFromCache(playlistToDelete.id);
      setPlaylists(prev => prev.filter(p => p.id !== playlistToDelete.id));
      window.dispatchEvent(new Event('slothify_playlists_updated'));
      setIsDeleting(false);
      setPlaylistToDelete(null);
    }
  };

  const fetchPlaylists = async () => {
    if (!isAuthenticated) {
      setPlaylists([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await axios.get('/api/me/playlists');
      if (Array.isArray(res.data)) {
        setPlaylists(res.data);
        setLibraryPlaylists(res.data);
      } else {
        setPlaylists([]);
      }
    } catch (err) {
      setPlaylists([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlaylists();
    } else {
      setPlaylists([]);
    }
    const handleUpdate = () => {
      if (isAuthenticated) fetchPlaylists();
      else setPlaylists([]);
    };
    window.addEventListener('slothify_playlists_updated', handleUpdate);
    return () => {
      window.removeEventListener('slothify_playlists_updated', handleUpdate);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && cache.libraryPlaylists) {
      setPlaylists(cache.libraryPlaylists);
    } else if (!isAuthenticated) {
      setPlaylists([]);
    }
  }, [cache.libraryPlaylists, isAuthenticated]);

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim() || `My Playlist #${playlists.length + 1}`;
    try {
      await axios.post('/api/me/playlists', { name });
      fetchPlaylists();
      setIsModalOpen(false);
      setNewPlaylistName('');
    } catch (err) {
      // Local fallback
      const newP = {
        id: `local-${Date.now()}`,
        name,
        description: 'Created by you',
        images: [],
        tracks: { total: 0 }
      };
      const updated = [newP, ...playlists];
      setPlaylists(updated);
      setLibraryPlaylists(updated);
      setIsModalOpen(false);
      setNewPlaylistName('');
    }
  };

  const filteredPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <div className={`p-2 rounded-xl ${isOcean ? 'bg-blue-600/20 text-blue-400' : 'bg-[#c87d46]/20 text-[#f5d0b5]'}`}>
              <ListMusic size={22} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Playlists</h1>
          </div>
          <p className="text-xs text-slate-400">
            {playlists.length} curated soundscapes & custom collections
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search Bar */}
          <div className="relative flex items-center flex-1 sm:w-60">
            <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none">
              <Search size={14} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Filter playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-white/[0.04] text-xs text-white placeholder-slate-500 pl-8 pr-3 py-2 rounded-full border border-white/[0.08] outline-none transition-all leading-normal ${
                isOcean ? 'focus:border-blue-500/50' : 'focus:border-[#f5d0b5]/50'
              }`}
            />
          </div>

          {/* Create Button */}
          <button
            onClick={() => {
              setNewPlaylistName(`My Playlist #${playlists.length + 1}`);
              setIsModalOpen(true);
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0 ${
              isOcean
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                : 'bg-[#f5d0b5] hover:bg-white text-black shadow-[#f5d0b5]/20'
            }`}
          >
            <Plus size={16} />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* Grid of Playlists */}
      {filteredPlaylists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {filteredPlaylists.map((playlist) => {
            return (
              <div
                key={playlist.id}
                onClick={() => navigate(`/playlist/${playlist.id}`)}
                className={`group p-3 rounded-2xl cursor-pointer transition-all duration-300 border relative flex flex-col justify-between ${
                  isOcean
                    ? 'bg-[#0a152d]/40 hover:bg-[#0f1d38]/70 border-white/[0.04] hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-950/40'
                    : 'bg-[#181312]/40 hover:bg-[#231a18]/70 border-white/[0.04] hover:border-[#f5d0b5]/25 hover:shadow-xl hover:shadow-black/60'
                }`}
              >
                {/* Artwork */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-black/40 shadow-md">
                  <PlaylistCover
                    images={playlist.images}
                    tracks={playlist.tracks}
                    iconSize={40}
                    alt={playlist.name}
                    className="transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors pointer-events-none" />

                  {/* Hover Delete Button on top right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaylistToDelete(playlist);
                    }}
                    title="Delete Playlist"
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center bg-black/70 hover:bg-rose-600 text-white/80 hover:text-white shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 hover:scale-110 active:scale-90"
                  >
                    <Trash2 size={13} />
                  </button>

                  {/* Hover Play Button */}
                  <div
                    className={`absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full flex items-center justify-center shadow-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ${
                      isOcean
                        ? 'bg-blue-600 text-white shadow-blue-600/40'
                        : 'bg-[#f5d0b5] text-black shadow-black/80'
                    }`}
                  >
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>

                {/* Meta */}
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-sm truncate group-hover:text-white transition-colors">
                    {playlist.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {playlist.tracks?.total !== undefined ? `${playlist.tracks.total} songs` : playlist.description || 'Playlist'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="p-4 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400">
            <Music2 size={32} />
          </div>
          <p className="text-white font-bold text-base">
            {!isAuthenticated ? 'Sign In to View Playlists' : 'No playlists found'}
          </p>
          <p className="text-slate-400 text-xs max-w-sm">
            {!isAuthenticated
              ? 'Log in to create, save, and sync your personalized music collections.'
              : (searchQuery ? `No results matching "${searchQuery}"` : "You haven't created any playlists yet.")}
          </p>
          {!isAuthenticated && onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className={`mt-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg ${
                isOcean
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-blue-500/25 hover:from-blue-500 hover:to-cyan-400'
                  : 'bg-[#f5d0b5] text-black shadow-[#f5d0b5]/20 hover:bg-[#ebd0bc]'
              }`}
            >
              Sign In / Register
            </button>
          )}
        </div>
      )}

      {/* Create Playlist Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center space-x-2">
                <Sparkles size={18} className={isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} />
                <h3 className="font-bold text-white text-base">New Playlist</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-medium">Playlist Name</label>
              <input
                type="text"
                autoFocus
                placeholder="Give your playlist a title"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePlaylist();
                }}
                className={`w-full bg-white/[0.05] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${
                  isOcean ? 'focus:border-blue-500' : 'focus:border-[#f5d0b5]'
                }`}
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 ${
                  isOcean
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                    : 'bg-[#f5d0b5] hover:bg-white text-black shadow-[#f5d0b5]/20'
                }`}
              >
                Create Playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <Trash2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Delete Playlist?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-semibold">&ldquo;{playlistToDelete.name}&rdquo;</span>? This will permanently remove it from your account and cloud database.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPlaylistToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePlaylist}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistsPage;
