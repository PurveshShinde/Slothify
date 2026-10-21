import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft, Search as SearchIcon, Heart, Play, Pause,
  Clock, Trash2, RotateCcw, Sparkles, LogIn, Music, ShieldCheck, Check
} from 'lucide-react';
import { Track } from '../types';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

interface ExtendedHistoryTrack extends Track {
  playedAt?: string;
}

interface HistoryProps {
  isAuthenticated: boolean;
  onPlayTrack: (track: Track, fromQueue: Track[]) => void;
  likedTrackIds: Set<string>;
  onToggleLike: (id: string, track?: Track) => void;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  currentTrackId?: string;
  onOpenAuth?: () => void;
}

const formatDuration = (ms?: number) => {
  if (!ms) return '3:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const formatRelativeTime = (isoString?: string) => {
  if (!isoString) return 'Recently';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const History: React.FC<HistoryProps> = ({
  isAuthenticated,
  onPlayTrack,
  likedTrackIds,
  onToggleLike,
  isPlaying,
  currentTrackId,
  onOpenAuth
}) => {
  const navigate = useNavigate();
  const { isOcean } = useTheme();
  const [tracks, setTracks] = useState<ExtendedHistoryTrack[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await axios.get('/api/me/history?limit=100');
      if (Array.isArray(res.data)) {
        setTracks(res.data);
      } else {
        setTracks([]);
      }
    } catch (err) {
      console.error('Failed to load listening history:', err);
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [isAuthenticated]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClearAll = async () => {
    try {
      setIsClearing(true);
      await axios.delete('/api/me/history');
      setTracks([]);
      setShowClearConfirm(false);
      showToast('Listening history cleared');
    } catch (err) {
      console.error('Failed to clear history:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleRemoveTrack = async (track: ExtendedHistoryTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Optimistic update
      setTracks(prev => prev.filter(t => t.id !== track.id));
      await axios.delete(`/api/me/history/${track.id}`);
      showToast(`Removed "${track.name}" from history`);
    } catch (err) {
      console.error('Failed to remove track from history:', err);
    }
  };

  const filteredTracks = useMemo(() => {
    if (!filterQuery.trim()) return tracks;
    const query = filterQuery.toLowerCase();
    return tracks.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.artists?.some(a => a.name.toLowerCase().includes(query)) ||
      t.album?.name?.toLowerCase().includes(query)
    );
  }, [tracks, filterQuery]);

  const handlePlayAll = () => {
    if (filteredTracks.length > 0) {
      onPlayTrack(filteredTracks[0], filteredTracks);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-32">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 bg-slate-900 border border-emerald-500/30 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-sm">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        {isAuthenticated && tracks.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 transition-all"
          >
            <Trash2 size={14} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Hero Header */}
      <div className={`relative rounded-3xl overflow-hidden p-6 md:p-8 border ${
        isOcean
          ? 'bg-gradient-to-br from-[#0c1836] via-[#09132b] to-[#060d1e] border-blue-500/20'
          : 'bg-gradient-to-br from-[#241c19] via-[#1a1412] to-black border-white/10'
      }`}>
        <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
          isOcean ? 'bg-blue-600/15' : 'bg-[#c87d46]/10'
        }`} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center shadow-2xl flex-shrink-0 ${
              isOcean
                ? 'bg-gradient-to-tr from-blue-700 to-blue-500 shadow-blue-600/30 text-white'
                : 'bg-gradient-to-tr from-[#c87d46] to-[#f5d0b5] shadow-[#c87d46]/30 text-[#140f0d]'
            }`}>
              <Clock size={44} />
            </div>

            <div className="space-y-2">
              <div className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isOcean
                  ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                  : 'bg-[#f5d0b5]/10 border border-[#f5d0b5]/20 text-[#f5d0b5]'
              }`}>
                <Sparkles size={12} />
                <span>Personalized Activity</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Listening History</h1>
              <p className="text-stone-400 text-xs md:text-sm max-w-xl leading-relaxed">
                {isAuthenticated
                  ? `You have played ${tracks.length} track${tracks.length === 1 ? '' : 's'}. We use your history to curate your personalized recommendations on the Home screen.`
                  : 'Log in to securely track your played songs and personalize your home screen recommendations.'}
              </p>
            </div>
          </div>

          {isAuthenticated && tracks.length > 0 && (
            <div className="flex items-center space-x-3 flex-shrink-0">
              <button
                onClick={handlePlayAll}
                className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl hover:scale-105 active:scale-95 ${
                  isOcean
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
                    : 'bg-[#f5d0b5] hover:bg-white text-[#140f0d] shadow-black/40'
                }`}
              >
                <Play size={18} fill="currentColor" />
                <span>Play All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Clear Listening History?</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                This will remove all recorded plays from your account. Your Home recommendations will reset to general hits until you play more music.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={isClearing}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Stats Bar */}
      {isAuthenticated && tracks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search your history..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-[#1F2937]/60 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-stone-400 text-sm focus:outline-none focus:border-[#c87d46] transition-colors"
            />
          </div>
          <div className="text-xs text-stone-400 px-1 flex items-center space-x-2">
            <span>Showing {filteredTracks.length} of {tracks.length} tracks</span>
            <span className="text-stone-600">•</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck size={12} /> Auto-Sync Active
            </span>
          </div>
        </div>
      )}

      {/* Body Content */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin ${
            isOcean ? 'border-blue-500' : 'border-[#c87d46]'
          }`} />
          <p className="text-stone-400 text-sm">Loading your listening history...</p>
        </div>
      ) : !isAuthenticated ? (
        /* Guest State */
        <div className="p-8 md:p-12 bg-white/[0.02] border border-white/5 rounded-3xl text-center space-y-6 max-w-xl mx-auto my-8">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto ${
            isOcean ? 'bg-blue-500/10 text-blue-400' : 'bg-[#c87d46]/10 text-[#f5d0b5]'
          }`}>
            <LogIn size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">Save Your Listening History</h3>
            <p className="text-stone-400 text-sm leading-relaxed">
              Log in or create a free account to track what you play across sessions. Slothify uses your listening history in real time to recommend music tailored to your exact taste on the Home screen.
            </p>
          </div>
          <button
            onClick={onOpenAuth}
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl inline-flex items-center space-x-2 ${
              isOcean
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25'
                : 'bg-[#f5d0b5] hover:bg-white text-[#140f0d] shadow-black/40'
            }`}
          >
            <LogIn size={18} />
            <span>Log In / Sign Up</span>
          </button>
        </div>
      ) : tracks.length === 0 ? (
        /* Empty State */
        <div className="p-8 md:p-12 bg-white/[0.02] border border-white/5 rounded-3xl text-center space-y-6 max-w-xl mx-auto my-8">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto ${
            isOcean ? 'bg-blue-500/10 text-blue-400' : 'bg-[#c87d46]/10 text-[#f5d0b5]'
          }`}>
            <Music size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">No Listening History Yet</h3>
            <p className="text-stone-400 text-sm leading-relaxed">
              Every track you play while signed in will automatically be recorded here. As you listen, your Home page will adapt to feature new songs from your favorite artists.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl inline-flex items-center space-x-2 border ${
              isOcean
                ? 'bg-[#1e293b] hover:bg-[#334155] text-blue-400 border-blue-500/30'
                : 'bg-[#241c19] hover:bg-[#2e2320] text-[#f5d0b5] border-[#f5d0b5]/20'
            }`}
          >
            <Play size={16} fill="currentColor" />
            <span>Explore Music</span>
          </button>
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-stone-400 text-sm">No tracks matched "{filterQuery}"</p>
          <button
            onClick={() => setFilterQuery('')}
            className={`hover:underline text-xs font-semibold ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`}
          >
            Clear search
          </button>
        </div>
      ) : (
        /* Track Table */
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-[auto_4fr_3fr_2fr_minmax(100px,auto)] gap-4 px-4 py-3 border-b border-white/5 text-stone-400 text-xs font-bold uppercase tracking-wider">
            <span className="w-8 text-center">#</span>
            <span>Title</span>
            <span>Album</span>
            <span>Played</span>
            <div className="text-right pr-2">Actions</div>
          </div>

          {/* Track items */}
          <div className="divide-y divide-white/5">
            {filteredTracks.map((track, idx) => {
              const isCurrent = currentTrackId === track.id;
              const isPlayingRow = isCurrent && isPlaying;

              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => onPlayTrack(track, filteredTracks)}
                  className={`group grid md:grid-cols-[auto_4fr_3fr_2fr_minmax(100px,auto)] grid-cols-[auto_1fr_auto] gap-3 md:gap-4 items-center px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                    isCurrent ? (isOcean ? 'bg-blue-500/10' : 'bg-[#c87d46]/10') : ''
                  }`}
                >
                  {/* Number / Play indicator */}
                  <div className="flex items-center">
                    <div className="hidden md:flex w-8 items-center justify-center text-stone-400 font-medium text-sm">
                      <span className={`block group-hover:hidden ${isCurrent ? (isOcean ? 'text-blue-400 font-bold' : 'text-[#f5d0b5] font-bold') : ''}`}>
                        {isCurrent ? (
                          <span className="flex space-x-0.5 items-end h-3.5">
                            <span className={`w-1 animate-pulse h-3 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                            <span className={`w-1 animate-pulse h-2 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                            <span className={`w-1 animate-pulse h-3.5 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <span className="hidden group-hover:block text-white">
                        {isPlayingRow ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                      </span>
                    </div>

                    <div className="relative w-12 h-12 flex-shrink-0 md:hidden rounded-lg overflow-hidden bg-stone-800">
                      <img
                        src={track.album?.images?.[0]?.url || 'https://picsum.photos/60'}
                        className="w-full h-full object-cover"
                        alt={track.name}
                        loading="lazy"
                      />
                    </div>
                  </div>

                  {/* Title & Artist */}
                  <div className="flex items-center space-x-3 min-w-0 mr-2">
                    <img
                      src={track.album?.images?.[0]?.url || 'https://picsum.photos/60'}
                      className="hidden md:block w-11 h-11 rounded-lg object-cover shadow-sm flex-shrink-0"
                      alt={track.name}
                      loading="lazy"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-bold truncate leading-tight ${isCurrent ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-white'}`}>
                        {track.name}
                      </span>
                      <span className="text-xs text-stone-400 truncate mt-0.5 group-hover:text-stone-300 transition-colors">
                        {track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
                      </span>
                    </div>
                  </div>

                  {/* Album */}
                  <span className="hidden md:block text-xs text-stone-400 truncate group-hover:text-stone-300">
                    {track.album?.name || 'Single'}
                  </span>

                  {/* Played At */}
                  <span className="hidden md:block text-xs text-stone-400 tabular-nums">
                    {formatRelativeTime(track.playedAt)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-3">
                    <span className="text-xs text-stone-400 md:hidden tabular-nums">
                      {formatRelativeTime(track.playedAt)}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike(track.id, track);
                      }}
                      title={likedTrackIds.has(track.id) ? "Unlike" : "Like"}
                      className={`p-1.5 transition-colors ${
                        likedTrackIds.has(track.id)
                          ? (isOcean ? 'text-blue-400 fill-blue-400' : 'text-[#f5d0b5] fill-[#f5d0b5]')
                          : 'text-stone-400 hover:text-white md:opacity-0 md:group-hover:opacity-100'
                      }`}
                    >
                      <Heart size={16} fill={likedTrackIds.has(track.id) ? "currentColor" : "none"} />
                    </button>

                    <span className="hidden md:block text-xs text-stone-400 tabular-nums w-10 text-right">
                      {formatDuration(track.duration_ms)}
                    </span>

                    <button
                      onClick={(e) => handleRemoveTrack(track, e)}
                      title="Remove from history"
                      className="p-1.5 text-stone-500 hover:text-rose-400 transition-colors md:opacity-0 md:group-hover:opacity-100 rounded-lg hover:bg-white/5"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
