import React, { useState, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Heart, X, Volume2, VolumeX, Disc, ListMusic
} from 'lucide-react';
import { Track } from '../types';
import AudioWaveform from './AudioWaveform';
import { useTheme } from '../context/ThemeContext';

interface VintageTurntableProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  onTrackChange: (track: Track) => void;
  queue: Track[];
  progress: number;
  duration: number;
  onSeek: (seconds: number) => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'all' | 'one';
  onToggleRepeat: () => void;
  isLiked: boolean;
  onToggleLike: () => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
}

const DEFAULT_RECORD_ART = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600';

export const VintageTurntable: React.FC<VintageTurntableProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  onPlayPause,
  onTrackChange,
  queue,
  progress,
  duration,
  onSeek,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  isLiked,
  onToggleLike,
  volume,
  onVolumeChange
}) => {
  const { isOcean } = useTheme();
  const [rpm, setRpm] = useState<'33' | '45'>('33');
  const [activeTab, setActiveTab] = useState<'info' | 'queue'>('info');

  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trackTitle = currentTrack?.name || 'No Track Selected';
  const trackArtist = currentTrack?.artists?.[0]?.name || 'Slothify Audio Engine';
  const trackAlbum = currentTrack?.album?.name || '';
  const trackImage = currentTrack?.album?.images?.[0]?.url || DEFAULT_RECORD_ART;

  const currentProgress = currentTrack ? progress : 0;
  const currentDuration = currentTrack ? duration : 0;

  const formatTime = (time: number) => {
    if (isNaN(time) || time <= 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const spinDuration = rpm === '45' ? '6s' : '10s';

  return (
    <div
      className={`fixed inset-0 z-[200] w-screen h-screen flex flex-col justify-between p-5 md:p-8 lg:p-10 select-none overflow-hidden animate-in fade-in duration-300 ease-out text-white ${
        isOcean ? 'bg-[#020612]' : 'bg-[#0d0705]'
      }`}
    >
      {/* Thematic Ambient Scenery Backdrop (Ocean Waves vs Autumn Forest) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className={`absolute inset-0 bg-cover bg-center transition-all duration-700 scale-105 ${
            isOcean ? 'opacity-70' : 'opacity-85'
          }`}
          style={{
            backgroundImage: isOcean
              ? "url('/Ocean.jpg')"
              : "url('/Autumn.jpg')",
            imageRendering: '-webkit-optimize-contrast' as any,
            filter: isOcean ? 'contrast(1.05) saturate(1.1)' : 'contrast(1.1) saturate(1.15) brightness(0.95)'
          }}
        />
        <div
          className={`absolute inset-0 ${
            isOcean
              ? 'bg-gradient-to-b from-[#020914]/60 via-[#030e1c]/70 to-[#020812]/85'
              : 'bg-gradient-to-b from-[#140803]/35 via-[#1a0a04]/45 to-[#0d0502]/60'
          }`}
        />
        <div
          className={`absolute top-1/4 left-1/4 w-[45vw] h-[45vw] rounded-full blur-[140px] opacity-20 transition-all duration-700 ${
            isOcean ? 'bg-blue-600' : 'bg-[#c87d46]'
          }`}
        />
        <div
          className={`absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] rounded-full blur-[160px] opacity-15 transition-all duration-700 ${
            isOcean ? 'bg-cyan-600' : 'bg-[#d97736]'
          }`}
        />
      </div>

      {/* 1. MINIMALIST TOP BAR */}
      <header className="w-full flex items-center justify-between pb-4 border-b border-white/[0.06] relative z-20">
        {/* Left: Branding */}
        <div className="flex items-center space-x-2.5">
          <Disc
            size={18}
            className={`transition-colors ${
              isOcean ? 'text-blue-500' : 'text-[#f5d0b5]'
            } ${isPlaying ? 'animate-spin' : ''}`}
          />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-300">
            Slothify Vinyl • {isOcean ? 'Ocean' : 'Autumn'}
          </span>
        </div>

        {/* Center: Minimalist RPM Switcher */}
        <div className="flex items-center space-x-1 bg-white/[0.05] p-1 rounded-full border border-white/[0.08]">
          <button
            onClick={() => setRpm('33')}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all ${
              rpm === '33'
                ? isOcean
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#f5d0b5] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            33 RPM
          </button>
          <button
            onClick={() => setRpm('45')}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all ${
              rpm === '45'
                ? isOcean
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#f5d0b5] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            45 RPM
          </button>
        </div>

        {/* Right: Tabs & Close */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab(activeTab === 'info' ? 'queue' : 'info')}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-xs font-medium border border-white/[0.08]"
          >
            <ListMusic size={14} />
            <span>{activeTab === 'info' ? `Queue (${queue.length})` : 'Now Playing'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/15 text-slate-300 hover:text-white transition-all border border-white/[0.08] hover:scale-105 active:scale-95"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* 2. MAIN VIEWPORT - PERFECT CIRCULAR DISC & CLEAN CONTROLS */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-8 lg:gap-14 max-w-6xl mx-auto w-full py-4 relative z-10 overflow-y-auto lg:overflow-hidden">
        {/* LEFT: THE PERFECT CIRCLE VINYL RECORD & MINIMALIST TONEARM */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center relative flex-shrink-0">
          {/* Guaranteed 1:1 Aspect-Square Circular Platter Container */}
          <div className="relative w-full max-w-[min(65vh,440px)] aspect-square flex items-center justify-center flex-shrink-0 select-none">
            {/* The Vinyl Disc - Flawless Perfect Circle */}
            <div
              onClick={() => onPlayPause(!isPlaying)}
              className="w-full h-full rounded-full aspect-square bg-[#0a0a0d] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative overflow-hidden flex items-center justify-center cursor-pointer select-none transition-transform duration-500 hover:scale-[1.01]"
              style={{
                animation: isPlaying ? `spin ${spinDuration} linear infinite` : 'none'
              }}
              title={isPlaying ? "Click to Pause" : "Click to Play"}
            >
              {/* Concentric Grooves */}
              <div className="absolute inset-4 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-8 rounded-full border border-white/[0.03]" />
              <div className="absolute inset-12 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-16 rounded-full border border-white/[0.03]" />
              <div className="absolute inset-20 rounded-full border border-white/[0.04]" />
              <div className="absolute inset-24 rounded-full border border-white/[0.03]" />
              <div className="absolute inset-28 rounded-full border border-white/[0.04]" />

              {/* Conic Sheen Reflection */}
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.06)_45deg,transparent_90deg,rgba(255,255,255,0.06)_225deg,transparent_270deg)] pointer-events-none" />

              {/* Center Artwork Label */}
              <div className="relative w-[38%] h-[38%] rounded-full overflow-hidden border-2 border-black/80 shadow-2xl flex items-center justify-center">
                <img
                  src={trackImage}
                  alt={trackTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />

                {/* Spindle hole */}
                <div className="absolute w-5 h-5 rounded-full bg-[#121215] border border-white/20 shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-black" />
                </div>
              </div>
            </div>

            {/* Minimalist Tonearm */}
            <div className="absolute -top-3 -right-2 sm:-right-4 w-24 h-56 pointer-events-none z-30">
              {/* Pivot */}
              <div className="absolute top-1 right-3 w-10 h-10 rounded-full bg-[#1c1c20] border border-white/15 shadow-xl flex items-center justify-center">
                <div className={`w-4 h-4 rounded-full ${isOcean ? 'bg-blue-600' : 'bg-[#c87d46]'}`} />
              </div>

              {/* Arm Tube */}
              <div
                className="absolute top-7 right-7 origin-top transition-transform duration-700 ease-in-out"
                style={{
                  transform: isPlaying ? 'rotate(25deg)' : 'rotate(0deg)'
                }}
              >
                <div className="w-[3px] h-44 bg-gradient-to-r from-zinc-400 via-white to-zinc-400 rounded-full shadow-md" />

                {/* Needle Headshell */}
                <div className="absolute -bottom-3 -left-3 w-6 h-8 rounded-sm bg-[#18181c] border border-white/20 shadow-md transform rotate-[-12deg] flex flex-col items-center justify-end pb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isOcean ? 'bg-blue-500' : 'bg-[#f5d0b5]'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Minimalist Live Waveform */}
          <div className="mt-4 flex items-center justify-center w-full max-w-[min(65vh,440px)]">
            <AudioWaveform isPlaying={isPlaying} barCount={24} />
          </div>
        </div>

        {/* RIGHT: CLEAN MINIMALIST MEDIA PLAYER CONSOLE */}
        <div className="w-full lg:w-1/2 max-w-lg flex flex-col justify-center space-y-6 px-2 sm:px-4">
          {activeTab === 'info' ? (
            <>
              {/* Track Details */}
              <div className="space-y-1.5">
                <span className={`text-[11px] font-bold tracking-widest uppercase ${
                  isOcean ? 'text-blue-500' : 'text-[#f5d0b5]'
                }`}>
                  Now Playing
                </span>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight line-clamp-2">
                  {trackTitle}
                </h1>
                <p className="text-base sm:text-lg text-slate-300 truncate">
                  {trackArtist}
                </p>
                <p className="text-xs text-slate-500 font-mono truncate">
                  {trackAlbum}
                </p>
              </div>

              {/* Progress Scrub Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="relative h-1.5 w-full bg-white/10 rounded-full group cursor-pointer">
                  <div
                    className={`absolute h-full rounded-full transition-all ${
                      isOcean ? 'bg-blue-600' : 'bg-[#f5d0b5]'
                    }`}
                    style={{ width: `${(currentProgress / (currentDuration || 1)) * 100}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={currentDuration || 0}
                    value={currentProgress}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-slate-500">
                  <span>{formatTime(currentProgress)}</span>
                  <span>{formatTime(currentDuration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between px-2 pt-2">
                <button
                  onClick={onToggleShuffle}
                  title="Shuffle"
                  className={`transition-colors p-2 rounded-full hover:bg-white/5 ${
                    isShuffle
                      ? (isOcean ? 'text-blue-500' : 'text-[#f5d0b5]')
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shuffle size={20} />
                </button>

                <button
                  onClick={() => {
                    const idx = queue.findIndex(t => t.id === currentTrack?.id);
                    if (idx > 0) onTrackChange(queue[idx - 1]);
                  }}
                  title="Previous Track"
                  className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
                >
                  <SkipBack size={26} fill="currentColor" />
                </button>

                {/* Master Play / Pause Button in Clean Ocean Blue or Autumn Peach */}
                <button
                  onClick={() => onPlayPause(!isPlaying)}
                  title={isPlaying ? "Pause" : "Play"}
                  className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl ${
                    isOcean
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 ring-2 ring-blue-500/20'
                      : 'bg-[#f5d0b5] hover:bg-white text-black shadow-[#f5d0b5]/20'
                  }`}
                >
                  {isPlaying ? (
                    <Pause size={28} fill="currentColor" />
                  ) : (
                    <Play size={28} fill="currentColor" className="ml-1" />
                  )}
                </button>

                <button
                  onClick={() => {
                    const idx = queue.findIndex(t => t.id === currentTrack?.id);
                    if (idx >= 0 && idx < queue.length - 1) onTrackChange(queue[idx + 1]);
                  }}
                  title="Next Track"
                  className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
                >
                  <SkipForward size={26} fill="currentColor" />
                </button>

                <button
                  onClick={onToggleRepeat}
                  title="Repeat"
                  className={`transition-colors p-2 rounded-full hover:bg-white/5 ${
                    repeatMode !== 'off'
                      ? (isOcean ? 'text-blue-500' : 'text-[#f5d0b5]')
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
                </button>
              </div>

              {/* Sub-controls: Like & Volume */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] px-2">
                <button
                  onClick={onToggleLike}
                  className={`flex items-center space-x-2 text-xs font-medium transition-colors ${
                    isLiked
                      ? (isOcean ? 'text-blue-500' : 'text-[#f5d0b5]')
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Heart
                    size={18}
                    className={
                      isLiked
                        ? isOcean
                          ? 'fill-blue-500 text-blue-500'
                          : 'fill-[#f5d0b5] text-[#f5d0b5]'
                        : ''
                    }
                  />
                  <span>{isLiked ? 'Saved' : 'Save'}</span>
                </button>

                <div className="flex items-center space-x-2 w-32 sm:w-40">
                  <Volume2 size={16} className="text-slate-400 flex-shrink-0" />
                  <div className="relative h-1 flex-1 bg-white/10 rounded-full">
                    <div
                      className={`absolute h-full rounded-full ${
                        isOcean ? 'bg-blue-600' : 'bg-[#f5d0b5]'
                      }`}
                      style={{ width: `${volume * 100}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="absolute w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* TAB: QUEUE LIST */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className={`text-xs font-bold tracking-wider uppercase ${
                  isOcean ? 'text-blue-500' : 'text-[#f5d0b5]'
                }`}>
                  Queue
                </span>
                <span className="text-xs font-mono text-slate-500">{queue.length} Tracks</span>
              </div>

              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 scrollbar-hide">
                {queue.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No more tracks in queue</p>
                ) : (
                  queue.map((t, idx) => (
                    <div
                      key={`${t.id}_${idx}`}
                      onClick={() => onTrackChange(t)}
                      className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                        t.id === currentTrack?.id
                          ? isOcean
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                            : 'bg-white/10 text-[#f5d0b5]'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="text-xs font-mono text-slate-500 w-4 text-center">
                          {idx + 1}
                        </span>
                        <img
                          src={t.album?.images?.[0]?.url || DEFAULT_RECORD_ART}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold truncate leading-tight">{t.name}</span>
                          <span className="text-[11px] text-slate-400 truncate">{t.artists?.[0]?.name}</span>
                        </div>
                      </div>
                      <Play size={12} fill="currentColor" className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setActiveTab('info')}
                className="w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white text-xs font-medium transition-colors"
              >
                Back to Player
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 3. MINIMALIST FOOTER */}
      <footer className="w-full pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 font-mono relative z-20">
        <span>Slothify Minimalist Audio</span>
        <span>Esc to close</span>
      </footer>
    </div>
  );
};

export default VintageTurntable;
