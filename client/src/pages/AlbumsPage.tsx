import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Track } from '../types';
import { Disc, Play, Heart, Search, Sparkles, Music } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

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

const DEFAULT_ALBUMS: AlbumItem[] = [
  {
    id: 'album-zach-bryan',
    name: 'Young Manhood and Other Donatable Organs',
    artists: [{ name: 'Zach Bryan & Lana Del Rey' }],
    images: [{ url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600' }],
    release_date: '2024',
    total_tracks: 14,
    isLiked: false
  },
  {
    id: 'album-golden-hour',
    name: 'Golden Hour Memories',
    artists: [{ name: 'Hollow Coves' }],
    images: [{ url: 'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=600' }],
    release_date: '2023',
    total_tracks: 11,
    isLiked: false
  },
  {
    id: 'album-midnight-sun',
    name: 'Midnight Sun & City Echoes',
    artists: [{ name: 'Aiden Vale' }],
    images: [{ url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600' }],
    release_date: '2024',
    total_tracks: 12,
    isLiked: false
  },
  {
    id: 'album-monsters-odell',
    name: 'Monsters of Solitude',
    artists: [{ name: 'Tom Odell' }],
    images: [{ url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600' }],
    release_date: '2022',
    total_tracks: 16,
    isLiked: false
  },
  {
    id: 'album-ocean-whispers',
    name: 'Pacific Swells & Acoustic Tides',
    artists: [{ name: 'Coastal Ambient Collective' }],
    images: [{ url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600' }],
    release_date: '2024',
    total_tracks: 9,
    isLiked: false
  },
  {
    id: 'album-nostalgia-ultra',
    name: 'Autumn Leaves & Vintage Tape',
    artists: [{ name: 'Lofi Coffee Roasters' }],
    images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' }],
    release_date: '2023',
    total_tracks: 15,
    isLiked: false
  }
];

export const AlbumsPage: React.FC<AlbumsPageProps> = ({ onPlayTrack }) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();

  // Clean liked album IDs (strictly user-driven, 0 by default)
  const [likedAlbumIds, setLikedAlbumIds] = useState<Set<string>>(() => {
    try {
      // Clear legacy polluted storage if present
      localStorage.removeItem('slothify_liked_albums');
      const saved = localStorage.getItem('slothify_user_liked_album_ids');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set<string>();
  });

  const [albums, setAlbums] = useState<AlbumItem[]>(() => DEFAULT_ALBUMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'liked'>('all');

  useEffect(() => {
    // Also fetch new releases from server API to enrich album selection
    axios.get('/api/browse/new-releases')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const apiAlbums: AlbumItem[] = res.data.map((item: any) => ({
            id: item.id || `album-${Math.random()}`,
            name: item.name,
            artists: item.artists || [{ name: 'Various Artists' }],
            images: item.images || [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' }],
            release_date: item.release_date?.substring(0, 4) || '2024',
            total_tracks: item.total_tracks || 10,
            isLiked: false
          }));

          setAlbums(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const fresh = apiAlbums.filter(a => !existingIds.has(a.id));
            return [...prev, ...fresh];
          });
        }
      })
      .catch(() => {});
  }, []);

  const toggleLikeAlbum = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
  };

  const handlePlayAlbum = (album: AlbumItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlayTrack) {
      const albumTrack: Track = {
        id: `track-${album.id}`,
        name: album.name,
        uri: `spotify:album:${album.id}`,
        artists: album.artists,
        album: {
          name: album.name,
          images: album.images
        },
        duration_ms: 210000
      };
      onPlayTrack(albumTrack);
    }
  };

  const filteredAlbums = albums.map(a => ({
    ...a,
    isLiked: likedAlbumIds.has(a.id)
  })).filter(a => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.artists.some(art => art.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filterType === 'liked') {
      return matchesSearch && a.isLiked;
    }
    return matchesSearch;
  });

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
            {likedAlbumIds.size} liked albums • {albums.length} in your catalog
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
              Liked ({albums.filter(a => a.isLiked).length})
            </button>
          </div>

          {/* Search */}
          <div className="relative w-44 sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-white/[0.04] text-xs text-white placeholder-slate-500 pl-8 pr-3 py-2 rounded-full border border-white/[0.08] outline-none transition-all ${
                isOcean ? 'focus:border-blue-500/50' : 'focus:border-[#f5d0b5]/50'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Grid of Albums */}
      {filteredAlbums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {filteredAlbums.map((album) => {
            const coverImage = album.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';

            return (
              <div
                key={album.id}
                onClick={(e) => handlePlayAlbum(album, e)}
                className={`group p-3 rounded-2xl cursor-pointer transition-all duration-300 border relative flex flex-col justify-between ${
                  isOcean
                    ? 'bg-[#0a152d]/40 hover:bg-[#0f1d38]/70 border-white/[0.04] hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-950/40'
                    : 'bg-[#181312]/40 hover:bg-[#231a18]/70 border-white/[0.04] hover:border-[#f5d0b5]/25 hover:shadow-xl hover:shadow-black/60'
                }`}
              >
                {/* Artwork Container with Vinyl Record peeking effect */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-black/40 shadow-md">
                  <img
                    src={coverImage}
                    alt={album.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors" />

                  {/* Play Button */}
                  <div
                    onClick={(e) => handlePlayAlbum(album, e)}
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
                    onClick={(e) => toggleLikeAlbum(album.id, e)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:scale-110 transition-transform"
                    title={album.isLiked ? "Unlike Album" : "Like Album"}
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
              : `No albums matching "${searchQuery}".`}
          </p>
        </div>
      )}
    </div>
  );
};

export default AlbumsPage;
