import React from 'react';
import { Play, Pause, Heart, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Track } from '../types';
import { getTrackThumbnail } from '../utils/imageOptimizer';

export interface TrackRowProps {
  track: Track;
  index?: number;
  isCurrent?: boolean;
  isPlaying?: boolean;
  isLiked?: boolean;
  onPlay: (track: Track) => void;
  onToggleLike?: (id: string, track: Track) => void;
  onAddToPlaylist?: (track: Track, e: React.MouseEvent) => void;
  onRemove?: (track: Track, e: React.MouseEvent) => void;
  showCover?: boolean;
  showIndex?: boolean;
  showAlbum?: boolean;
  showDuration?: boolean;
  showLike?: boolean;
  variant?: 'compact' | 'table';
  className?: string;
  isOcean?: boolean;
}

const formatDuration = (ms?: number) => {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  isCurrent = false,
  isPlaying = false,
  isLiked = false,
  onPlay,
  onToggleLike,
  onAddToPlaylist,
  onRemove,
  showCover = true,
  showIndex = false,
  showAlbum = false,
  showDuration = true,
  showLike = true,
  variant = 'compact',
  className = '',
  isOcean = false
}) => {
  const thumbUrl = getTrackThumbnail(track, 'https://picsum.photos/40', '150');
  const isPlayingCurrent = isCurrent && isPlaying;

  const activeColorClass = isOcean ? 'text-blue-400' : 'text-[#f5d0b5]';
  const activeBgClass = isOcean ? 'bg-blue-600/15 border-blue-500/30' : 'bg-[#f5d0b5]/10 border-[#f5d0b5]/20';
  const activeBarClass = isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]';
  const activeHeartClass = isOcean ? 'fill-blue-500 text-blue-500' : 'fill-[#f5d0b5] text-[#f5d0b5]';

  if (variant === 'table') {
    return (
      <div
        onClick={() => onPlay(track)}
        className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
          isCurrent
            ? activeBgClass
            : 'hover:bg-white/[0.04] border-transparent hover:border-white/[0.06]'
        } ${className}`}
      >
        <div className="flex items-center space-x-4 min-w-0 flex-1 pr-4">
          {showIndex && (
            <div className="w-6 text-center flex items-center justify-center text-xs font-mono text-slate-400 group-hover:text-white">
              {isPlayingCurrent ? (
                <div className="flex items-end space-x-0.5 h-3">
                  <span className={`w-0.5 h-full rounded-full animate-pulse ${activeBarClass}`} />
                  <span className={`w-0.5 h-2 rounded-full animate-pulse delay-75 ${activeBarClass}`} />
                  <span className={`w-0.5 h-3 rounded-full animate-pulse delay-150 ${activeBarClass}`} />
                </div>
              ) : (
                <>
                  <span className="group-hover:hidden">{typeof index === 'number' ? index + 1 : ''}</span>
                  <Play size={14} fill="currentColor" className="hidden group-hover:block" />
                </>
              )}
            </div>
          )}

          {showCover && (
            <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-[#18151c]">
              <img
                src={thumbUrl}
                loading="lazy"
                className="w-full h-full object-cover"
                alt=""
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=150';
                }}
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className={`font-bold text-sm truncate ${isCurrent ? activeColorClass : 'text-white'}`}>
              {track.name}
            </p>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
            </p>
          </div>

          {showAlbum && (
            <span className="hidden md:block text-sm text-slate-400 group-hover:text-white truncate max-w-[200px]">
              {track.album?.name || 'Single'}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          {showLike && onToggleLike && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike(track.id, track);
              }}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title={isLiked ? 'Unlike Song' : 'Like Song'}
            >
              <Heart size={15} className={isLiked ? activeHeartClass : ''} />
            </button>
          )}

          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(track, e);
              }}
              className="p-1 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              <Trash2 size={15} />
            </button>
          )}

          {showDuration && (
            <span className="tabular-nums font-mono text-slate-400 text-xs">
              {formatDuration(track.duration_ms)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Compact variant (cards, lists, search items)
  return (
    <div
      onClick={() => onPlay(track)}
      className={`flex items-center space-x-3.5 p-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] rounded-2xl cursor-pointer transition-all group ${
        isCurrent ? activeBgClass : ''
      } ${className}`}
    >
      {showCover && (
        <div className="relative w-11 h-11 flex-shrink-0 rounded-xl overflow-hidden bg-[#18151c]">
          <img
            src={thumbUrl}
            loading="lazy"
            className="w-full h-full object-cover"
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=150';
            }}
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {isPlayingCurrent ? (
              <Pause size={16} fill="white" className="text-white" />
            ) : (
              <Play size={16} fill="white" className="text-white ml-0.5" />
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3
          className={`font-semibold text-xs md:text-sm text-white truncate transition-colors leading-tight ${
            isCurrent
              ? activeColorClass
              : isOcean
              ? 'group-hover:text-blue-400'
              : 'group-hover:text-[#f5d0b5]'
          }`}
        >
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

      <div className="flex items-center space-x-1 flex-shrink-0">
        {showLike && onToggleLike && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(track.id, track);
            }}
            className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
            title={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart size={16} className={isLiked ? activeHeartClass : ''} />
          </button>
        )}

        {onAddToPlaylist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToPlaylist(track, e);
            }}
            className={`p-2 text-[#8a8489] rounded-full transition-colors hover:bg-white/5 cursor-pointer ${
              isOcean ? 'hover:text-blue-400' : 'hover:text-[#f5d0b5]'
            }`}
            title="Add to Playlist"
          >
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TrackRow;
