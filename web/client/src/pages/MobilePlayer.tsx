import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
    Heart, ChevronDown, MoreVertical, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
    MonitorSpeaker, Share2, ListMusic
} from 'lucide-react';

interface MobilePlayerProps {
    onBack: () => void;
}

const MobilePlayer: React.FC<MobilePlayerProps> = ({ onBack }) => {
    const {
        currentTrack, isPlaying, volume, isMuted, isShuffle, repeatMode, isQueueVisible,
        progress, duration,
        setIsPlaying, setVolume, setIsMuted, toggleShuffle, setRepeatMode, setIsQueueVisible,
        skipForward, skipBack, likedTrackIds, toggleLike, requestSeek, setProgress, setIsSeeking
    } = useStore();

    const isLiked = currentTrack && likedTrackIds.has(currentTrack.id);

    // Replicate necessary local state/refs for the UI control (slider)
    // Note: The actual AUDIO element is in Player.tsx (the footer), which persists.
    // We need to sync progress with the global audio or store?
    // Problem: progress is local to Player.tsx.
    // Solution: We need to lift 'progress' and 'duration' to the store OR 
    // allow MobilePlayer to subscribe to audio updates?

    // Actually, passing audioRef or syncing progress is complex if they are separate components.
    // HOWEVER, if 'currentView' is 'player', the Player footer might still exist but be hidden?
    // User wants "separate page".

    // If I move the Audio element to App.tsx or useStore, it persists.
    // But currently Audio is in Player.tsx.

    // Quick Fix: Let Player.tsx handle the Audio logic. MobilePlayer just controls it.
    // But `progress` is needed for the slider.
    // I should move `progress` and `duration` to the Zustand store so both components can see it.

    // STEP 1: Implement basic UI. We'll add store support for progress in a moment.
    const [localProgress, setLocalProgress] = useState(0);
    const [localDuration, setLocalDuration] = useState(0);

    // TEMPORARY: using store's currentTrack

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!currentTrack) return null;

    return (
        <div className="fixed inset-0 bg-gradient-to-b from-[#505050] to-[#121212] z-[100] flex flex-col h-[100dvh] px-6 pt-safe pb-8 animate-in slide-in-from-bottom duration-300">
            <header className="flex items-center justify-between h-16 mb-4">
                <button onClick={onBack}><ChevronDown size={32} className="text-white" /></button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest opacity-80">PLAYING FROM PLAYLIST</span>
                </div>
                <MoreVertical size={24} className="text-white" />
            </header>
            <div className="flex-1 flex items-center justify-center mb-8 w-full">
                <div className="w-full aspect-square relative shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
                    <img src={currentTrack.album.images[0]?.url} alt="" className="w-full h-full object-cover rounded-md" />
                </div>
            </div>
            <div className="flex justify-between items-end mb-6">
                <div className="flex flex-col min-w-0 pr-4">
                    <h2 className="text-2xl font-bold text-white truncate leading-tight mb-1">{currentTrack.name}</h2>
                    <p className="text-lg text-slate-300 truncate">{currentTrack.artists[0].name}</p>
                </div>
                <button onClick={() => toggleLike(currentTrack.id)} className="mb-1">
                    <Heart size={28} className={isLiked ? "fill-[#1ed760] text-[#1ed760]" : "text-white"} />
                </button>
            </div>

            <div className="space-y-2 mb-6">
                <div className="relative group h-1 w-full bg-white/20 rounded-full">
                    <div className="absolute h-full bg-white rounded-full group-hover:bg-[#1ed760]" style={{ width: `${(progress / (duration || 1)) * 100}%` }} />
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={progress}
                        onMouseDown={() => setIsSeeking(true)}
                        onTouchStart={() => setIsSeeking(true)}
                        onChange={(e) => setProgress(Number(e.target.value))}
                        onMouseUp={(e) => {
                            setIsSeeking(false);
                            requestSeek(Number(e.currentTarget.value));
                        }}
                        onTouchEnd={(e) => {
                            setIsSeeking(false);
                            requestSeek(Number(e.currentTarget.value));
                        }}
                        className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                    />
                </div>
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                    <span>{formatTime(progress)}</span><span>{formatTime(duration)}</span>
                </div>
            </div>

            <div className="flex justify-between items-center mb-8 px-2">
                <button onClick={toggleShuffle}><Shuffle size={24} className={isShuffle ? "text-[#1ed760]" : "text-white"} /></button>
                <button onClick={skipBack}><SkipBack size={36} className="text-white fill-white" /></button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 bg-[#1ed760] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg text-black">
                    {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={skipForward}><SkipForward size={36} className="text-white fill-white" /></button>
                <button onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')} className={repeatMode !== 'off' ? "text-[#1ed760]" : "text-white"}>
                    {repeatMode === 'one' ? <Repeat1 size={24} /> : <Repeat size={24} />}
                </button>
            </div>
            <div className="flex justify-between items-center px-4">
                <MonitorSpeaker size={20} className="text-[#1ed760]" />
                <div className="flex items-center space-x-6">
                    <Share2 size={20} className="text-white" />
                    <ListMusic size={20} className="text-white" onClick={() => setIsQueueVisible(!isQueueVisible)} />
                </div>
            </div>
        </div>
    );
};

export default MobilePlayer;
