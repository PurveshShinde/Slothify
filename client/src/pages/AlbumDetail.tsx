import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Heart, Shuffle, Clock3, Disc, Music } from 'lucide-react';
import { Track } from '../types';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useCache } from '../context/CacheContext';

interface AlbumDetailProps {
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  currentTrackId?: string;
  likedTrackIds: Set<string>;
  onToggleLike: (id: string, track?: Track) => void;
  isShuffle?: boolean;
  onToggleShuffle?: () => void;
}

interface AlbumData {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  release_date?: string;
  total_tracks?: number;
  genres?: string[];
  tracks: Track[];
}

export const AlbumDetail: React.FC<AlbumDetailProps> = ({
  onPlayTrack,
  isPlaying,
  onPlayPause,
  currentTrackId,
  likedTrackIds,
  onToggleLike,
  isShuffle,
  onToggleShuffle
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOcean } = useTheme();
  const { cache, setAlbumDetail } = useCache();

  // Instant fallback from navigation state or cache if available
  const passedAlbum = location.state?.album;
  const cachedAlbum = id && cache.albumDetails ? cache.albumDetails[id] : null;

  const [album, setAlbum] = useState<AlbumData | null>(() => {
    if (cachedAlbum) return cachedAlbum;
    if (passedAlbum) {
      return {
        id: passedAlbum.id || id || '',
        name: passedAlbum.name,
        artists: passedAlbum.artists || [{ name: 'Artist' }],
        images: passedAlbum.images || [],
        release_date: passedAlbum.release_date,
        total_tracks: passedAlbum.total_tracks || 10,
        tracks: []
      };
    }
    return null;
  });

  const [tracks, setTracks] = useState<Track[]>(() => cachedAlbum?.tracks || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedAlbum);
  const [isLikedAlbum, setIsLikedAlbum] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('slothify_user_liked_album_ids');
      if (saved && id) {
        const set = new Set<string>(JSON.parse(saved));
        return set.has(id);
      }
    } catch (e) {}
    return false;
  });

  useEffect(() => {
    if (!id) return;
    if (cache.albumDetails && cache.albumDetails[id]) {
      const saved = cache.albumDetails[id];
      setAlbum(saved);
      setTracks(saved.tracks || []);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const nameHint = passedAlbum?.name || '';
    const artistHint = passedAlbum?.artists?.[0]?.name || '';

    axios.get(`/api/albums/${id}`, {
      params: { name: nameHint, artist: artistHint }
    })
      .then(res => {
        if (res.data) {
          const albumObj: AlbumData = {
            id: res.data.id || id,
            name: res.data.name || nameHint || 'Album',
            artists: res.data.artists || (artistHint ? [{ name: artistHint }] : [{ name: 'Artist' }]),
            images: res.data.images || passedAlbum?.images || [],
            release_date: res.data.release_date || passedAlbum?.release_date || '2024',
            total_tracks: res.data.total_tracks || res.data.tracks?.length || 10,
            genres: res.data.genres || ['Music'],
            tracks: res.data.tracks || []
          };
          setAlbum(albumObj);
          setTracks(albumObj.tracks);
          setAlbumDetail(id, albumObj);
        }
      })
      .catch(err => {
        console.error('Failed to load album details:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, cache.albumDetails, setAlbumDetail]);

  const toggleLikeAlbum = () => {
    if (!id) return;
    setIsLikedAlbum(prev => {
      const next = !prev;
      try {
        const saved = localStorage.getItem('slothify_user_liked_album_ids');
        const set = new Set<string>(saved ? JSON.parse(saved) : []);
        if (next) set.add(id);
        else set.delete(id);
        localStorage.setItem('slothify_user_liked_album_ids', JSON.stringify(Array.from(set)));
      } catch (e) {}
      return next;
    });
  };

  const isCurrentAlbumPlaying = useMemo(() => {
    if (!isPlaying || !currentTrackId || tracks.length === 0) return false;
    return tracks.some(t => t.id === currentTrackId);
  }, [isPlaying, currentTrackId, tracks]);

  const handlePlayAlbum = () => {
    if (tracks.length === 0) return;
    if (isCurrentAlbumPlaying) {
      onPlayPause(false);
    } else {
      onPlayTrack(tracks[0], tracks);
    }
  };

  const handlePlaySong = (track: Track) => {
    if (currentTrackId === track.id) {
      onPlayPause(!isPlaying);
    } else {
      onPlayTrack(track, tracks);
    }
  };

  const totalDurationMin = useMemo(() => {
    const totalMs = tracks.reduce((acc, t) => acc + (t.duration_ms || 180000), 0);
    return Math.max(1, Math.round(totalMs / 60000));
  }, [tracks]);

  const formatDuration = (ms?: number) => {
    if (!ms) return '3:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const coverUrl = album?.images?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(album?.name || 'Album')}&background=181824&color=f5d0b5&size=500&bold=true`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-28 select-none">
      {/* Top Back Navigation */}
      <button
        onClick={() => navigate('/albums')}
        className="flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group mb-2"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span>Back to Albums</span>
      </button>

      {/* Album Header Banner */}
      <div className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden backdrop-blur-xl ${
        isOcean
          ? 'bg-gradient-to-br from-[#0e214d]/60 via-[#0a152d]/80 to-[#070d1e]/90 border-blue-500/20 shadow-2xl shadow-blue-950/40'
          : 'bg-gradient-to-br from-[#2a1b18]/60 via-[#181312]/80 to-[#0f0b0a]/90 border-[#f5d0b5]/15 shadow-2xl shadow-black/70'
      }`}>
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 relative z-10">
          {/* Artwork with Ambient Glow */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 group bg-black/40">
            <img
              src={coverUrl}
              alt={album?.name || 'Album'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors" />
          </div>

          {/* Album Info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 border border-white/10 bg-white/5 text-white/90">
              <Disc size={13} className={isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} />
              <span>Album</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight truncate leading-tight">
              {album?.name || (isLoading ? 'Loading Album...' : 'Unknown Album')}
            </h1>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-slate-300 mt-2">
              <span
                onClick={() => album?.artists?.[0]?.name && navigate(`/search?q=${encodeURIComponent(album.artists[0].name)}`)}
                className="font-bold text-white hover:underline cursor-pointer"
              >
                {album?.artists?.map(a => a.name).join(', ') || 'Various Artists'}
              </span>
              <span>•</span>
              <span className="font-mono text-slate-400">{album?.release_date || '2024'}</span>
              <span>•</span>
              <span className="text-slate-400">{tracks.length || album?.total_tracks || 0} songs, ~{totalDurationMin} min</span>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-center sm:justify-start space-x-3 mt-6">
              <button
                onClick={handlePlayAlbum}
                disabled={isLoading || tracks.length === 0}
                className={`px-6 py-3 rounded-full font-bold text-sm transition-all flex items-center space-x-2 shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 ${
                  isOcean
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                    : 'bg-[#f5d0b5] hover:bg-white text-black shadow-black/80'
                }`}
              >
                {isCurrentAlbumPlaying ? (
                  <>
                    <Pause size={18} fill="currentColor" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                    <span>Play All</span>
                  </>
                )}
              </button>

              {onToggleShuffle && (
                <button
                  onClick={onToggleShuffle}
                  className={`p-3 rounded-full border transition-all ${
                    isShuffle
                      ? isOcean
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                        : 'bg-[#f5d0b5]/20 text-[#f5d0b5] border-[#f5d0b5]/40'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
                  }`}
                  title="Shuffle"
                >
                  <Shuffle size={18} />
                </button>
              )}

              <button
                onClick={toggleLikeAlbum}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all hover:scale-105 active:scale-95"
                title={isLikedAlbum ? 'Remove from Liked Albums' : 'Save to Liked Albums'}
              >
                <Heart
                  size={18}
                  className={
                    isLikedAlbum
                      ? isOcean
                        ? 'fill-blue-500 text-blue-500'
                        : 'fill-[#f5d0b5] text-[#f5d0b5]'
                      : 'text-white'
                  }
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Songs Inside Album */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/[0.06]">
          <div className="flex items-center space-x-4">
            <span className="w-6 text-center">#</span>
            <span>Title</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock3 size={14} />
            <span className="hidden sm:inline">Duration</span>
          </div>
        </div>

        {/* Loading State Skeleton */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`song-skeleton-${i}`}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="w-6 h-4 bg-white/[0.06] rounded" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-white/[0.08] rounded w-1/3" />
                    <div className="h-3 bg-white/[0.04] rounded w-1/4" />
                  </div>
                </div>
                <div className="w-12 h-3 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        ) : tracks.length > 0 ? (
          <div className="space-y-1 pt-1">
            {tracks.map((track, index) => {
              const isCurrent = currentTrackId === track.id;
              const isTrackPlaying = isCurrent && isPlaying;
              const isLiked = likedTrackIds.has(track.id);

              return (
                <div
                  key={track.id || `track-${index}`}
                  onClick={() => handlePlaySong(track)}
                  className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                    isCurrent
                      ? isOcean
                        ? 'bg-blue-600/15 border-blue-500/30'
                        : 'bg-[#f5d0b5]/10 border-[#f5d0b5]/20'
                      : 'hover:bg-white/[0.04] border-transparent hover:border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center space-x-4 min-w-0 flex-1 pr-4">
                    {/* Track Number / Play Icon */}
                    <div className="w-6 text-center flex items-center justify-center text-xs font-mono text-slate-400 group-hover:text-white">
                      {isTrackPlaying ? (
                        <div className="flex items-end space-x-0.5 h-3">
                          <span className={`w-0.5 h-full rounded-full animate-pulse ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                          <span className={`w-0.5 h-2 rounded-full animate-pulse delay-75 ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                          <span className={`w-0.5 h-3 rounded-full animate-pulse delay-150 ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                        </div>
                      ) : (
                        <>
                          <span className="group-hover:hidden">{index + 1}</span>
                          <Play size={14} fill="currentColor" className="hidden group-hover:block" />
                        </>
                      )}
                    </div>

                    {/* Track Name & Artist */}
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold text-sm truncate ${
                        isCurrent
                          ? isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'
                          : 'text-white'
                      }`}>
                        {track.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Duration */}
                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike(track.id, track);
                      }}
                      className="p-1 text-slate-400 hover:text-white transition-colors"
                      title={isLiked ? 'Unlike Song' : 'Like Song'}
                    >
                      <Heart
                        size={15}
                        className={
                          isLiked
                            ? isOcean
                              ? 'fill-blue-500 text-blue-500'
                              : 'fill-[#f5d0b5] text-[#f5d0b5]'
                            : 'opacity-0 group-hover:opacity-100'
                        }
                      />
                    </button>
                    <span className="font-mono">{formatDuration(track.duration_ms)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center space-y-2 text-slate-400">
            <Music size={32} className="mx-auto text-slate-500" />
            <p className="text-white font-bold text-sm">No songs found in this album</p>
            <p className="text-xs">Songs may be unavailable or still loading.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumDetail;
