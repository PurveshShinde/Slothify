import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Playlist, User } from '../types';
import { ListMusic, Plus, Play, Search, Sparkles, X, Music2 } from 'lucide-react';
import axios from 'axios';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';

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
  const { cache, setLibraryPlaylists } = useCache();
  const [playlists, setPlaylists] = useState<any[]>(cache.libraryPlaylists || []);
  const [isLoading, setIsLoading] = useState(!cache.libraryPlaylists);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const fetchPlaylists = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/me/playlists');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setPlaylists(res.data);
        setLibraryPlaylists(res.data);
      } else {
        setPlaylists(defaultPlaylists);
      }
    } catch (err) {
      setPlaylists(defaultPlaylists);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    const handleUpdate = () => {
      fetchPlaylists();
    };
    window.addEventListener('slothify_playlists_updated', handleUpdate);
    return () => {
      window.removeEventListener('slothify_playlists_updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (cache.libraryPlaylists && cache.libraryPlaylists.length > 0) {
      setPlaylists(cache.libraryPlaylists);
    }
  }, [cache.libraryPlaylists]);

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
        images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' }],
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
          <div className="relative flex-1 sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-white/[0.04] text-xs text-white placeholder-slate-500 pl-8 pr-3 py-2 rounded-full border border-white/[0.08] outline-none transition-all ${
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
            const coverImage =
              playlist.images?.[0]?.url ||
              'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';

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
                  <img
                    src={coverImage}
                    alt={playlist.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />

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
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="p-4 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400">
            <Music2 size={32} />
          </div>
          <p className="text-white font-bold text-base">No playlists found</p>
          <p className="text-slate-400 text-xs max-w-sm">
            {searchQuery ? `No results matching "${searchQuery}"` : "You haven't created any playlists yet."}
          </p>
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
    </div>
  );
};

export default PlaylistsPage;
