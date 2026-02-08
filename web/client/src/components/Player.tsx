import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle,
    ListMusic, ChevronDown, Heart, Loader2, MonitorSpeaker, Mic2, Share2,
    Volume2, VolumeX, Volume1, MoreVertical
} from 'lucide-react';
import { useStore } from '../store/useStore';

const API_BASE = 'http://127.0.0.1:5000';

interface PlayerProps {
    onMobileExpand?: () => void;
}

const Player: React.FC<PlayerProps> = ({ onMobileExpand }) => {
    // ✅ GLOBAL STATE
    const {
        currentTrack, queue, isPlaying, volume, isMuted, isShuffle, repeatMode,
        isPlayerExpanded, isQueueVisible, progress, duration,
        setIsPlaying, setVolume, setIsMuted, toggleShuffle, setRepeatMode,
        setIsPlayerExpanded, setIsQueueVisible, setProgress, setDuration,
        skipForward, skipBack, setCurrentTrack, likedTrackIds, toggleLike
    } = useStore();

    // Local State (UI only)
    const [isBuffering, setIsBuffering] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackIdRef = useRef<string | null>(null);
    const isSeekingRef = useRef(false);

    // ... (rest of audio logic)

    // Sync Audio Element with Store State
    useEffect(() => {
        if (!audioRef.current) return;
        if (isPlaying && audioRef.current.paused) {
            audioRef.current.play().catch(() => setIsPlaying(false));
        } else if (!isPlaying && !audioRef.current.paused) {
            audioRef.current.pause();
        }
    }, [isPlaying, setIsPlaying]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
    }, [volume, isMuted]);

    // Handle Global Seek Requests (from MobilePlayer)
    useEffect(() => {
        const { seekRequest, requestSeek } = useStore.getState();
        if (seekRequest !== null && audioRef.current) {
            audioRef.current.currentTime = seekRequest;
            requestSeek(null); // Reset
        }
    }, [useStore().seekRequest]); // React to changes

    useEffect(() => {
        if (!currentTrack || !audioRef.current) return;

        const audio = audioRef.current;
        const trackId = currentTrack.id;
        currentTrackIdRef.current = trackId;

        // ✅ FIX: Reset progress and pause immediately
        setProgress(0);
        setDuration(0);
        setIsBuffering(true);
        setAudioError(null);
        audio.pause();

        const controller = new AbortController();
        const signal = controller.signal;

        const loadTrack = async () => {
            try {
                const query = `${currentTrack.name} ${currentTrack.artists[0].name} audio`;
                const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, { signal, credentials: 'include' });
                if (!res.ok) throw new Error('Search failed');

                const data = await res.json();
                if (currentTrackIdRef.current !== trackId) return;

                audio.pause();
                audio.src = `${API_BASE}/api/youtube/stream/${data.videoId}?token=${data.streamToken}`;
                audio.load();

                audio.oncanplay = () => {
                    if (currentTrackIdRef.current === trackId && audioRef.current) {
                        setIsBuffering(false);
                        audioRef.current.play()
                            .then(() => setIsPlaying(true))
                            .catch(err => { if (err.name !== 'AbortError') setIsPlaying(false); });
                    }
                };
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    setIsBuffering(false);
                    setAudioError('Failed to load');
                }
            }
        };

        loadTrack();
        return () => controller.abort();
    }, [currentTrack?.id, setIsPlaying, setProgress, setDuration]);

    const togglePlay = useCallback((e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsPlaying(!isPlaying);
    }, [isPlaying, setIsPlaying]);

    const handleSeekStart = () => {
        isSeekingRef.current = true;
    };

    const handleSeek = (value: number) => {
        setProgress(value);
    };

    const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const value = Number(e.currentTarget.value);
        audioRef.current.currentTime = value;
        // Small delay to prevent onTimeUpdate from jumping back
        setTimeout(() => { isSeekingRef.current = false; }, 200);
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const isLiked = currentTrack && likedTrackIds.has(currentTrack.id);
    if (!currentTrack) return null;

    return (
        <>
            <audio
                ref={audioRef}
                loop={repeatMode === 'one'}
                onTimeUpdate={() => {
                    const { isSeeking } = useStore.getState();
                    if (!isSeeking && !isSeekingRef.current) {
                        setProgress(audioRef.current?.currentTime || 0);
                    }
                }}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onEnded={() => {
                    if (repeatMode === 'one') {
                        if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
                    } else {
                        skipForward();
                    }
                }}
                onWaiting={() => setIsBuffering(true)}
                onCanPlay={() => setIsBuffering(false)}
                onError={() => setAudioError('Playback error')}
            />

            {/* DESKTOP PLAYER + MOBILE MINI ONLY */}

            {/* Mobile Mini Player */}
            <div
                className="md:hidden fixed bottom-[4.5rem] left-2 right-2 h-14 bg-[#3E3E3E] rounded-md flex items-center px-2 justify-between shadow-lg z-[80]"
                onClick={() => {
                    // Trigger mobile expansion via Navigation
                    if (onMobileExpand) onMobileExpand();
                    else setIsPlayerExpanded(true); // Fallback
                }}
            >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <img src={currentTrack.album.images[0]?.url} className="w-10 h-10 rounded-sm object-cover" alt="" />
                    <div className="flex flex-col min-w-0 ml-1">
                        <span className="text-sm font-bold text-white truncate leading-tight">{currentTrack.name}</span>
                        <span className="text-[11px] text-slate-300 truncate leading-tight">{currentTrack.artists[0].name}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-3 mr-2">
                    <Heart size={24} className={isLiked ? "fill-[#1ed760] text-[#1ed760]" : "text-white"} onClick={(e) => { e.stopPropagation(); toggleLike(currentTrack.id); }} />
                    <button onClick={(e) => { togglePlay(e); }} className="text-white">
                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                    </button>
                </div>
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-white/20 rounded-full" onClick={(e) => e.stopPropagation()}>
                    <div className="h-full bg-white" style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
                </div>
            </div>

            {/* Desktop Full */}
            <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-[#181818] border-t border-[#282828] z-[80] items-center justify-between px-6">
                <div className="flex items-center space-x-4 w-[30%] min-w-0">
                    <img src={currentTrack.album.images[0]?.url} className="w-14 h-14 rounded shadow-lg object-cover" alt="" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold truncate text-white hover:underline cursor-pointer">{currentTrack.name}</span>
                        <span className="text-xs text-slate-400 hover:text-white cursor-pointer truncate">{currentTrack.artists[0].name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleLike(currentTrack.id); }} className="p-2 text-slate-400 hover:text-white transition-colors ml-2">
                        <Heart size={18} className={isLiked ? "fill-[#1ed760] text-[#1ed760]" : ""} />
                    </button>
                </div>
                <div className="flex flex-col items-center w-[40%] space-y-2">
                    <div className="flex items-center space-x-6">
                        <button onClick={toggleShuffle} className={`hover:text-white transition-colors ${isShuffle ? 'text-[#1ed760]' : 'text-slate-400'}`}><Shuffle size={18} /></button>
                        <button onClick={skipBack} className="text-slate-400 hover:text-white transition-colors"><SkipBack size={22} fill="currentColor" /></button>
                        <button onClick={togglePlay} className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                        </button>
                        <button onClick={skipForward} className="text-slate-400 hover:text-white transition-colors"><SkipForward size={22} fill="currentColor" /></button>
                        <button onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')} className={`hover:text-white transition-colors ${repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-slate-400'}`}>
                            {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
                        </button>
                    </div>
                    <div className="flex items-center w-full max-w-lg space-x-2 text-xs text-[#b3b3b3] font-mono">
                        <span className="w-8 text-right">{formatTime(progress)}</span>
                        <div className="relative h-1 flex-1 bg-[#4d4d4d] rounded-full group">
                            <div className="absolute h-full bg-white group-hover:bg-[#1ed760] rounded-full" style={{ width: `${(progress / (duration || 1)) * 100}%` }} />
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={progress}
                                onMouseDown={handleSeekStart}
                                onTouchStart={handleSeekStart}
                                onChange={(e) => handleSeek(Number(e.target.value))}
                                onMouseUp={handleSeekEnd}
                                onTouchEnd={handleSeekEnd}
                                className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                            />
                        </div>
                        <span className="w-8">{formatTime(duration)}</span>
                    </div>
                </div>
                <div className="flex items-center justify-end w-[30%] space-x-4">
                    <button className="text-slate-400 hover:text-white"><Mic2 size={18} /></button>
                    <button onClick={() => setIsQueueVisible(!isQueueVisible)} className={`transition-colors ${isQueueVisible ? 'text-[#1ed760]' : 'text-slate-400 hover:text-white'}`}><ListMusic size={18} /></button>
                    <button className="text-slate-400 hover:text-white"><MonitorSpeaker size={18} /></button>
                    <div className="flex items-center space-x-2 w-24 group relative">
                        <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-white">
                            {isMuted || volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                        </button>
                        <div className="relative h-1 flex-1 bg-[#4d4d4d] rounded-full">
                            <div className="absolute h-full bg-white group-hover:bg-[#1ed760] rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
                            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }} className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[20px] opacity-0 cursor-pointer z-20" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Player;
