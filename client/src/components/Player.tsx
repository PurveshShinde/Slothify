import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle,
    ListMusic, ChevronDown, Heart, Loader2, MonitorSpeaker, Mic2, Share2,
    Volume2, VolumeX, Volume1, MoreVertical
} from 'lucide-react';
import { Track } from '../types';

const API_BASE = 'http://127.0.0.1:5000';

interface PlayerProps {
    currentTrack: Track | null;
    queue: Track[];
    onTrackChange: (track: Track) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    likedTrackIds: Set<string>;
    onToggleLike: (id: string) => void;
    onToggleQueue: () => void;
    isQueueVisible: boolean;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    isShuffle: boolean;
    onToggleShuffle: () => void;
}

const Player: React.FC<PlayerProps> = ({
    currentTrack, queue, onTrackChange, isExpanded, onToggleExpand,
    likedTrackIds, onToggleLike, onToggleQueue, isQueueVisible,
    isPlaying, setIsPlaying, isShuffle, onToggleShuffle
}) => {
    const [isBuffering, setIsBuffering] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
    const [audioError, setAudioError] = useState<string | null>(null);

    // Guard to prevent multiple simultaneous preload pings
    const [isPreloading, setIsPreloading] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackIdRef = useRef<string | null>(null);
    const shuffledIndicesRef = useRef<number[]>([]);
    const isSeekingRef = useRef(false);
    const hasPreloadedRef = useRef<string | null>(null);

    // Sync Audio Element with Prop State
    useEffect(() => {
        if (!audioRef.current) return;
        if (isPlaying && audioRef.current.paused) {
            audioRef.current.play().catch(() => setIsPlaying(false));
        } else if (!isPlaying && !audioRef.current.paused) {
            audioRef.current.pause();
        }
    }, [isPlaying, setIsPlaying]);

    useEffect(() => {
        shuffledIndicesRef.current = [];
    }, [queue]);

    useEffect(() => {
        if (isShuffle) shuffledIndicesRef.current = [];
    }, [isShuffle]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
    }, [volume, isMuted]);

    // Main Track Loader
    useEffect(() => {
        if (!currentTrack || !audioRef.current) return;

        const audio = audioRef.current;
        const trackId = currentTrack.id;
        currentTrackIdRef.current = trackId;

        hasPreloadedRef.current = null;
        setIsBuffering(true);
        setAudioError(null);

        const controller = new AbortController();
        const signal = controller.signal;

        const loadTrack = async () => {
            audio.pause();
            audio.currentTime = 0;
            setIsBuffering(true);
            setProgress(0);

            try {
                const query = `${currentTrack.name} ${currentTrack.artists[0].name} audio`;
                const res = await fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(query)}`, {
                    signal,
                    credentials: 'include'
                });

                if (!res.ok) throw new Error('Search failed');
                const data = await res.json();

                if (currentTrackIdRef.current !== trackId) return;

                // Pass the stream token to the backend to avoid 401
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
    }, [currentTrack?.id, setIsPlaying]);

    const togglePlay = useCallback((e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsPlaying(!isPlaying);
    }, [isPlaying, setIsPlaying]);

    const handleSkipForward = useCallback((e?: React.SyntheticEvent) => {
        if (e) e.stopPropagation();
        if (!currentTrack || queue.length === 0) return;

        const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
        let nextIndex;

        if (isShuffle) {
            if (shuffledIndicesRef.current.length !== queue.length) {
                const indices = Array.from({ length: queue.length }, (_, i) => i);
                for (let i = indices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indices[i], indices[j]] = [indices[j], indices[i]];
                }
                shuffledIndicesRef.current = indices;
            }
            let currentShuffledPos = shuffledIndicesRef.current.indexOf(currentIndex);
            const nextShuffledPos = (currentShuffledPos + 1) % shuffledIndicesRef.current.length;
            nextIndex = shuffledIndicesRef.current[nextShuffledPos];
        } else {
            nextIndex = (currentIndex + 1) % queue.length;
        }
        onTrackChange(queue[nextIndex]);
    }, [currentTrack, queue, isShuffle, onTrackChange]);

    const handleSkipBack = useCallback((e?: React.SyntheticEvent) => {
        if (e) e.stopPropagation();
        if (!currentTrack || queue.length === 0) return;
        if (audioRef.current && audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
            return;
        }
        const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
        const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
        onTrackChange(queue[prevIndex]);
    }, [currentTrack, queue, onTrackChange]);

    const handleTrackEnd = useCallback(() => {
        if (repeatMode === 'one') {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
            }
        } else {
            handleSkipForward();
        }
    }, [repeatMode, handleSkipForward]);

    const handleSeekEnd = (value: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = value;
        setTimeout(() => { isSeekingRef.current = false; }, 300);
    };

    const onTimeUpdate = () => {
        if (!audioRef.current) return;
        const audio = audioRef.current;

        if (!isSeekingRef.current) {
            setProgress(audio.currentTime);
        }

        // ✅ FIXED PRE-LOAD LOGIC
        const timeRemaining = duration - audio.currentTime;
        if (duration > 15 && timeRemaining <= 10 && !hasPreloadedRef.current && !isPreloading && queue.length > 0) {

            const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
            const nextTrack = queue[(currentIndex + 1) % queue.length];

            if (nextTrack && nextTrack.id !== currentTrack?.id) {
                setIsPreloading(true);
                hasPreloadedRef.current = nextTrack.id;
                console.log(`[Slothify] Pre-loading: ${nextTrack.name}`);

                const query = `${nextTrack.name} ${nextTrack.artists[0].name} audio`;

                fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
                    .then(res => res.json())
                    .then(data => {
                        // ✅ Pass credentials and token to avoid 401
                        return fetch(`${API_BASE}/api/youtube/stream/${data.videoId}?token=${data.streamToken}`, {
                            credentials: 'include'
                        });
                    })
                    .then(() => {
                        setIsPreloading(false);
                    })
                    .catch(err => {
                        console.error("[Slothify] Pre-load failed:", err);
                        setIsPreloading(false);
                        hasPreloadedRef.current = null; // Allow retry if it failed
                    });
            }
        }
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
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onEnded={handleTrackEnd}
                onWaiting={() => setIsBuffering(true)}
                onCanPlay={() => setIsBuffering(false)}
                onError={() => setAudioError('Playback error')}
            />

            {/* EXPANDED MOBILE PLAYER */}
            {isExpanded ? (
                <div className="md:hidden fixed inset-0 bg-gradient-to-b from-[#505050] to-[#121212] z-[100] flex flex-col h-[100dvh] px-6 pt-safe pb-8 animate-in slide-in-from-bottom duration-300">
                    <header className="flex items-center justify-between h-16 mb-4">
                        <button onClick={onToggleExpand}><ChevronDown size={32} className="text-white" /></button>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest opacity-80">PLAYING FROM ALBUM</span>
                            <span className="text-xs font-bold text-white truncate max-w-[200px]">{currentTrack.album.name}</span>
                        </div>
                        <MoreVertical size={24} className="text-white" />
                    </header>

                    <div className="flex-1 flex items-center justify-center mb-8 w-full">
                        <div className="w-full aspect-square relative shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
                            <img src={currentTrack.album.images[0]?.url} alt="" className="w-full h-full object-cover rounded-md" />
                            {isBuffering && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-end mb-6">
                        <div className="flex flex-col min-w-0 pr-4">
                            <h2 className="text-2xl font-bold text-white truncate leading-tight mb-1">{currentTrack.name}</h2>
                            <p className="text-lg text-slate-300 truncate">{currentTrack.artists[0].name}</p>
                        </div>
                        <button onClick={() => onToggleLike(currentTrack.id)} className="mb-1">
                            <Heart size={28} className={isLiked ? "fill-[#3b82f6] text-[#3b82f6]" : "text-white"} />
                        </button>
                    </div>

                    <div className="space-y-2 mb-6">
                        <div className="relative group h-1 w-full bg-white/20 rounded-full">
                            <div className="absolute h-full bg-white rounded-full" style={{ width: `${(progress / (duration || 1)) * 100}%` }} />
                            <input
                                type="range" min="0" max={duration || 0} value={progress}
                                onChange={(e) => setProgress(Number(e.target.value))}
                                onMouseDown={() => isSeekingRef.current = true}
                                onMouseUp={(e) => handleSeekEnd(Number(e.currentTarget.value))}
                                onTouchStart={() => isSeekingRef.current = true}
                                onTouchEnd={(e) => handleSeekEnd(Number(e.currentTarget.value))}
                                className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 font-medium">
                            <span>{formatTime(progress)}</span><span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-8 px-2">
                        <button onClick={onToggleShuffle}><Shuffle size={24} className={isShuffle ? "text-[#3b82f6]" : "text-white"} /></button>
                        <button onClick={handleSkipBack}><SkipBack size={36} className="text-white fill-white" /></button>
                        <button onClick={togglePlay} className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg text-black">
                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={handleSkipForward}><SkipForward size={36} className="text-white fill-white" /></button>
                        <button onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')} className={repeatMode !== 'off' ? "text-[#3b82f6]" : "text-white"}>
                            {repeatMode === 'one' ? <Repeat1 size={24} /> : <Repeat size={24} />}
                        </button>
                    </div>
                </div>
            ) : (
                /* DESKTOP PLAYER + MOBILE MINI */
                <>
                    <div className="md:hidden fixed bottom-[4.5rem] left-2 right-2 h-14 bg-[#3E3E3E] rounded-md flex items-center px-2 justify-between shadow-lg z-[80]" onClick={() => onToggleExpand()}>
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <img src={currentTrack.album.images[0]?.url} className="w-10 h-10 rounded-sm object-cover" alt="" />
                            <div className="flex flex-col min-w-0 ml-1">
                                <span className="text-sm font-bold text-white truncate leading-tight">{currentTrack.name}</span>
                                <span className="text-[11px] text-slate-300 truncate leading-tight">{currentTrack.artists[0].name}</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3 mr-2">
                            <Heart size={24} className={isLiked ? "fill-[#3b82f6] text-[#3b82f6]" : "text-white"} onClick={(e) => { e.stopPropagation(); onToggleLike(currentTrack.id); }} />
                            <button onClick={(e) => { togglePlay(e); }} className="text-white">
                                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-white/20 rounded-full">
                            <div className="h-full bg-white" style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-[#181818] border-t border-[#282828] z-[80] items-center justify-between px-6">
                        <div className="flex items-center space-x-4 w-[30%] min-w-0">
                            <img src={currentTrack.album.images[0]?.url} className="w-14 h-14 rounded shadow-lg object-cover" alt="" />
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold truncate text-white hover:underline cursor-pointer">{currentTrack.name}</span>
                                <span className="text-xs text-slate-400 hover:text-white cursor-pointer truncate">{currentTrack.artists[0].name}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); onToggleLike(currentTrack.id); }} className="p-2 text-slate-400 hover:text-white transition-colors ml-2">
                                <Heart size={18} className={isLiked ? "fill-[#3b82f6] text-[#3b82f6]" : ""} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center w-[40%] space-y-2">
                            <div className="flex items-center space-x-6">
                                <button onClick={onToggleShuffle} className={`hover:text-white transition-colors ${isShuffle ? 'text-[#3b82f6]' : 'text-slate-400'}`}><Shuffle size={18} /></button>
                                <button onClick={handleSkipBack} className="text-slate-400 hover:text-white transition-colors"><SkipBack size={22} fill="currentColor" /></button>
                                <button onClick={togglePlay} className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                                    {isBuffering ? <Loader2 size={18} className="animate-spin" /> : isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                                </button>
                                <button onClick={handleSkipForward} className="text-slate-400 hover:text-white transition-colors"><SkipForward size={22} fill="currentColor" /></button>
                                <button onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')} className={`hover:text-white transition-colors ${repeatMode !== 'off' ? 'text-[#3b82f6]' : 'text-slate-400'}`}>
                                    {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
                                </button>
                            </div>
                            <div className="flex items-center w-full max-w-lg space-x-2 text-xs text-[#b3b3b3] font-mono">
                                <span className="w-8 text-right">{formatTime(progress)}</span>
                                <div className="relative h-1 flex-1 bg-[#4d4d4d] rounded-full group">
                                    <div className="absolute h-full bg-white group-hover:bg-[#3b82f6] rounded-full" style={{ width: `${(progress / (duration || 1)) * 100}%` }} />
                                    <input type="range" min="0" max={duration || 0} value={progress} onChange={(e) => handleSeekEnd(Number(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer z-10" />
                                </div>
                                <span className="w-8">{formatTime(duration)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end w-[30%] space-x-4">
                            <button className="text-slate-400 hover:text-white"><Mic2 size={18} /></button>
                            <button onClick={onToggleQueue} className={`transition-colors ${isQueueVisible ? 'text-[#3b82f6]' : 'text-slate-400 hover:text-white'}`}><ListMusic size={18} /></button>
                            <button className="text-slate-400 hover:text-white"><MonitorSpeaker size={18} /></button>
                            <div className="flex items-center space-x-2 w-24 group relative">
                                <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-white">
                                    {isMuted || volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                                </button>
                                <div className="relative h-1 flex-1 bg-[#4d4d4d] rounded-full">
                                    <div className="absolute h-full bg-white group-hover:bg-[#3b82f6] rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
                                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }} className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[20px] opacity-0 cursor-pointer z-20" />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default Player;