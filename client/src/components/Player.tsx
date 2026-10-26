import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle,
    ListMusic, ChevronDown, Heart, Loader2, MonitorSpeaker, Mic2,
    Volume2, VolumeX, Volume1, MoreVertical, Sparkles, X, Plus, Disc
} from 'lucide-react';
import { Track } from '../types';
import VintageTurntable from './VintageTurntable';
import { useTheme } from '../context/ThemeContext';
import { AudioService } from '../services/audioService';

const rawApiBase = ((import.meta as any).env?.VITE_API_BASE || (import.meta as any).env?.VITE_API_URL || '').trim();
const API_BASE = rawApiBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');

// JioSaavn route executor: prefers same-origin Vercel Mumbai Serverless Function (bom1)
// to bypass cloud/datacenter IP geoblocks, with fallback to API_BASE
const fetchSaavnApi = async (endpoint: string, options?: RequestInit): Promise<Response> => {
    // 1. Try local/same-origin route first (hits Vercel Mumbai function or Vite proxy)
    try {
        const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const localRes = await fetch(cleanPath, options);
        if (localRes.ok) return localRes;
    } catch { }

    // 2. Fallback to API_BASE if defined and on a different origin
    if (API_BASE) {
        const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return fetch(`${API_BASE}${cleanPath}`, options);
    }

    throw new Error(`JioSaavn request to ${endpoint} failed`);
};

// Client-Side Piped instances racing for YouTube fallback (runs on user's own network/residential IP)
const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://piped-api.lunar.icu',
    'https://pipedapi.leptons.xyz',
    'https://pipedapi.tokhmi.xyz'
];

async function racePipedStreams(videoId: string, signal?: AbortSignal): Promise<string | null> {
    const promises = PIPED_INSTANCES.map(async (base) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        if (signal) {
            signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        try {
            const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`Piped error: ${res.status}`);
            const data = await res.json();
            const audioStreams = data.audioStreams || [];
            if (!audioStreams.length) throw new Error('No audio streams');
            const best = audioStreams.find((s: any) => s.itag === 140 || s.quality === '128 kbps') || audioStreams[0];
            if (!best?.url) throw new Error('No url');
            return best.url as string;
        } catch (e) {
            clearTimeout(timeoutId);
            throw e;
        }
    });

    try {
        return await Promise.any(promises);
    } catch {
        return null;
    }
}


interface PlayerProps {
    currentTrack: Track | null;
    queue: Track[];
    onTrackChange: (track: Track) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    likedTrackIds: Set<string>;
    onToggleLike: (id: string, track?: Track) => void;
    onToggleQueue: () => void;
    isQueueVisible: boolean;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    isShuffle: boolean;
    onToggleShuffle: () => void;
    onQueueChange?: (newQueue: Track[]) => void;
    isTurntableOpen?: boolean;
    setIsTurntableOpen?: (open: boolean) => void;
}

const Player: React.FC<PlayerProps> = ({
    currentTrack, queue, onTrackChange, isExpanded, onToggleExpand,
    likedTrackIds, onToggleLike, onToggleQueue, isQueueVisible,
    isPlaying, setIsPlaying, isShuffle, onToggleShuffle, onQueueChange,
    isTurntableOpen, setIsTurntableOpen
}) => {
    const { isOcean } = useTheme();
    const [isBuffering, setIsBuffering] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
    const [audioError, setAudioError] = useState<string | null>(null);

    const isLiked = currentTrack ? likedTrackIds.has(currentTrack.id) : false;
    const currentDuration = duration > 0 ? duration : (currentTrack?.duration_ms ? currentTrack.duration_ms / 1000 : 0);

    // Reset progress and duration when track changes
    useEffect(() => {
        setProgress(0);
        setDuration(currentTrack?.duration_ms ? currentTrack.duration_ms / 1000 : 0);
    }, [currentTrack?.id]);

    // Smart Mood Suggestions
    const [smartSuggestions, setSmartSuggestions] = useState<Track[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [activeEngine, setActiveEngine] = useState<'youtube' | 'jiosaavn' | null>(null);

    // Guard & Caching Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackIdRef = useRef<string | null>(null);
    const activeLoadedTrackIdRef = useRef<string | null>(null);
    const shuffledIndicesRef = useRef<number[]>([]);
    const isSeekingRef = useRef(false);
    const hasPreloadedRef = useRef<string | null>(null);
    // Clean legacy/poisoned cache keys from previous versions
    try {
        localStorage.removeItem('slothify_video_cache');
        localStorage.removeItem('slothify_saavn_cache');
    } catch (e) {}

    const resolvedVideoMap = useRef<Map<string, string>>((() => {
        try {
            const saved = localStorage.getItem('slothify_video_cache_v3');
            if (saved) {
                return new Map(JSON.parse(saved));
            }
        } catch (e) {}
        return new Map();
    })());

    const persistVideoCache = useCallback(() => {
        try {
            const entries = Array.from(resolvedVideoMap.current.entries()).slice(-500);
            localStorage.setItem('slothify_video_cache_v3', JSON.stringify(entries));
        } catch (e) {}
    }, []);

    const resolvedSaavnMap = useRef<Map<string, string>>((() => {
        try {
            const saved = localStorage.getItem('slothify_saavn_cache_v3');
            if (saved) {
                return new Map(JSON.parse(saved));
            }
        } catch (e) {}
        return new Map();
    })());

    const persistSaavnCache = useCallback(() => {
        try {
            const entries = Array.from(resolvedSaavnMap.current.entries()).slice(-500);
            localStorage.setItem('slothify_saavn_cache_v3', JSON.stringify(entries));
        } catch (e) {}
    }, []);

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

    // Helper: Determine next track in queue or from smart suggestions
    const getNextTrack = useCallback((): Track | null => {
        if (!currentTrack) return null;
        if (queue.length > 1) {
            const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
            if (currentIndex >= 0 && currentIndex < queue.length - 1) {
                return queue[currentIndex + 1];
            }
            if (repeatMode === 'all') {
                return queue[0];
            }
        }
        // If queue has ended or only 1 song, pick top smart suggestion
        if (smartSuggestions.length > 0) {
            return smartSuggestions[0];
        }
        return null;
    }, [currentTrack, queue, repeatMode, smartSuggestions]);

    // Proactive preload helper: pre-resolves next track, skipping YouTube completely if found on JioSaavn
    const preloadNextTrack = useCallback(async (track: Track) => {
        const providerPref = localStorage.getItem('slothify_audio_provider') || 'auto';
        const trackTitle = track.name || '';
        const trackArtist = track.artists[0]?.name || '';
        const cleanTitle = trackTitle.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/["'’]/g, '').trim();
        const songQuery = `${cleanTitle} ${trackArtist}`.trim();

        // 1. If JioSaavn or Auto, pre-check JioSaavn first
        if (providerPref === 'jiosaavn' || providerPref === 'auto') {
            try {
                let songId = track.id.startsWith('saavn_') ? track.id.replace('saavn_', '') : resolvedSaavnMap.current.get(track.id);
                if (!songId) {
                    // Try live Cloudflare AudioService first
                    const match = await AudioService.findStreamForTrack(trackTitle, trackArtist);
                    if (match?.songId) {
                        songId = match.songId;
                        resolvedSaavnMap.current.set(track.id, songId);
                        persistSaavnCache();
                    }
                }
                if (!songId) {
                    const sRes = await fetchSaavnApi(`/api/saavn/search?q=${encodeURIComponent(songQuery)}&title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(trackArtist)}`);
                    if (sRes.ok) {
                        const sData = await sRes.json();
                        if (sData.videoId) {
                            songId = sData.videoId;
                            resolvedSaavnMap.current.set(track.id, songId);
                            persistSaavnCache();
                        }
                    }
                }
                if (songId) {
                    // Pre-warm JioSaavn in cache — SKIP YouTube / yt-dlp completely!
                    fetchSaavnApi(`/api/saavn/stream/${songId}`).catch(() => {});
                    return;
                }
            } catch { }
        }

        // 2. Only if YouTube is chosen or if JioSaavn was not found, resolve YouTube
        if (providerPref === 'youtube' || providerPref === 'auto') {
            try {
                if (resolvedVideoMap.current.has(track.id)) {
                    return;
                }
                const ytQuery = `${cleanTitle} ${trackArtist} audio`.trim();
                const res = await fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(ytQuery)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.videoId) {
                        resolvedVideoMap.current.set(track.id, data.videoId);
                        persistVideoCache();
                        fetch(`${API_BASE}/api/youtube/preload/${data.videoId}`).catch(() => {});
                    }
                }
            } catch { }
        }
    }, [persistVideoCache, persistSaavnCache]);

    // Keep latest helpers in refs to prevent unnecessary loader re-triggers
    const getNextTrackRef = useRef(getNextTrack);
    getNextTrackRef.current = getNextTrack;
    const preloadNextTrackRef = useRef(preloadNextTrack);
    preloadNextTrackRef.current = preloadNextTrack;

    // 1. Fetch Spotify Smart Suggestions based on current track's mood & style
    useEffect(() => {
        if (!currentTrack) return;
        const artist = currentTrack.artists[0]?.name || '';
        setIsLoadingSuggestions(true);

        fetch(`${API_BASE}/api/recommendations/smart?track=${encodeURIComponent(currentTrack.name)}&artist=${encodeURIComponent(artist)}`)
            .then(res => res.json())
            .then(data => {
                const tracks = data.tracks || [];
                setSmartSuggestions(tracks);

                // If queue only has current song, automatically append suggestions for endless mood radio
                if (queue.length <= 1 && tracks.length > 0 && onQueueChange) {
                    onQueueChange([currentTrack, ...tracks.slice(0, 5)]);
                }
            })
            .catch(err => console.warn('Failed to load smart mood suggestions:', err))
            .finally(() => setIsLoadingSuggestions(false));
    }, [currentTrack?.id]);

    // 2. Main Track Loader with Fast Start (STABLE: only triggers on genuine track ID changes)
    useEffect(() => {
        if (!currentTrack || !audioRef.current) return;

        const audio = audioRef.current;
        const trackId = currentTrack.id;

        // Guard: Prevent re-initializing the audio if already loaded
        if (activeLoadedTrackIdRef.current === trackId) {
            return;
        }
        activeLoadedTrackIdRef.current = trackId;
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
                const trackTitle = currentTrack.name || '';
                const trackArtist = currentTrack.artists[0]?.name || '';
                const cleanTitle = trackTitle.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/["'’]/g, '').trim();
                const songQuery = `${cleanTitle} ${trackArtist}`.trim();
                const providerPref = localStorage.getItem('slothify_audio_provider') || 'auto';

                let directUrl: string | null = null;
                let resolvedEngine: 'youtube' | 'jiosaavn' = 'youtube';

                // Helper: resolve via JioSaavn 320kbps
                const resolveSaavn = async (): Promise<string | null> => {
                    try {
                        let songId = trackId.startsWith('saavn_') ? trackId.replace('saavn_', '') : resolvedSaavnMap.current.get(trackId);

                        // If songId is known from a previous resolve or saavn_ ID, fetch direct stream URL from worker
                        if (songId) {
                            try {
                                const direct = await AudioService.getSongStreamUrl(songId, signal);
                                if (direct) return direct;
                            } catch { }
                        }

                        // Try finding stream directly via Cloudflare AudioService
                        try {
                            const match = await AudioService.findStreamForTrack(trackTitle, trackArtist, signal);
                            if (match?.streamUrl) {
                                resolvedSaavnMap.current.set(trackId, match.songId);
                                persistSaavnCache();
                                return match.streamUrl;
                            }
                        } catch { }

                        // Fallback to local serverless proxy route
                        if (!songId) {
                            const sRes = await fetchSaavnApi(`/api/saavn/search?q=${encodeURIComponent(songQuery)}&title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(trackArtist)}`, { signal });
                            if (!sRes.ok) return null;
                            const sData = await sRes.json();
                            // If search endpoint already decrypted the direct 320kbps streamUrl, play immediately!
                            if (sData.streamUrl) {
                                if (sData.videoId) {
                                    resolvedSaavnMap.current.set(trackId, sData.videoId);
                                    persistSaavnCache();
                                }
                                return sData.streamUrl;
                            }
                            songId = sData.videoId;
                            if (songId) {
                                resolvedSaavnMap.current.set(trackId, songId);
                                persistSaavnCache();
                            }
                        }
                        if (!songId) return null;
                        const stRes = await fetchSaavnApi(`/api/saavn/stream/${songId}`, { signal });
                        if (!stRes.ok) return null;
                        const stData = await stRes.json();
                        return stData.success && stData.url ? stData.url : null;
                    } catch {
                        return null;
                    }
                };

                // Helper: resolve via YouTube (Client-Side Piped Racing + Backend Fallback)
                const resolveYouTube = async (): Promise<string | null> => {
                    try {
                        let videoId = resolvedVideoMap.current.get(trackId);
                        if (!videoId) {
                            const ytQuery = `${cleanTitle} ${trackArtist} audio`.trim();
                            const res = await fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(ytQuery)}`, { signal });
                            if (!res.ok) return null;
                            const data = await res.json();
                            videoId = data.videoId;
                            if (videoId) {
                                resolvedVideoMap.current.set(trackId, videoId);
                                persistVideoCache();
                            }
                        }
                        if (!videoId) return null;

                        // 1. Race public Piped CORS instances from the client's network to bypass datacenter IP bans
                        try {
                            const pipedStream = await racePipedStreams(videoId, signal);
                            if (pipedStream) return pipedStream;
                        } catch { }

                        // 2. Fallback to server-side YouTube stream resolution
                        const streamRes = await fetch(`${API_BASE}/api/youtube/stream/${videoId}`, { signal });
                        if (!streamRes.ok) return null;
                        const streamData = await streamRes.json();
                        return streamData.success && streamData.url ? streamData.url : null;
                    } catch {
                        return null;
                    }
                };

                // Priority based on user selection with seamless fallback
                if (providerPref === 'jiosaavn') {
                    directUrl = await resolveSaavn();
                    if (directUrl) {
                        resolvedEngine = 'jiosaavn';
                    } else {
                        console.warn('[Player] JioSaavn unavailable for this track, falling back to YouTube');
                        directUrl = await resolveYouTube();
                        if (directUrl) resolvedEngine = 'youtube';
                    }
                } else if (providerPref === 'youtube') {
                    directUrl = await resolveYouTube();
                    if (directUrl) {
                        resolvedEngine = 'youtube';
                    } else {
                        console.warn('[Player] YouTube unavailable for this track, falling back to JioSaavn');
                        directUrl = await resolveSaavn();
                        if (directUrl) resolvedEngine = 'jiosaavn';
                    }
                } else {
                    // Auto mode: try JioSaavn first for crystal-clear 320kbps CD quality, fallback to YouTube
                    directUrl = await resolveSaavn();
                    if (directUrl) {
                        resolvedEngine = 'jiosaavn';
                    } else {
                        directUrl = await resolveYouTube();
                        if (directUrl) resolvedEngine = 'youtube';
                    }
                }

                if (!directUrl) {
                    throw new Error('All audio providers failed to extract track');
                }

                if (currentTrackIdRef.current !== trackId || !audioRef.current) return;

                setActiveEngine(resolvedEngine);
                audio.src = directUrl;
                audio.load();

                audio.oncanplay = () => {
                    if (currentTrackIdRef.current === trackId && audioRef.current) {
                        setIsBuffering(false);
                        audioRef.current.play()
                            .then(() => setIsPlaying(true))
                            .catch(err => { if (err.name !== 'AbortError') setIsPlaying(false); });

                        // ✅ PROACTIVE PRELOAD: While first song starts, pre-warm next track (JioSaavn preferred)
                        const next = getNextTrackRef.current();
                        if (next && next.id !== trackId) {
                            preloadNextTrackRef.current(next);
                        }
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
        if (!currentTrack) return;
        setIsPlaying(!isPlaying);
    }, [currentTrack, isPlaying, setIsPlaying]);

    const handleSkipForward = useCallback((e?: React.SyntheticEvent) => {
        if (e) e.stopPropagation();
        if (!currentTrack) return;

        // Check if there is a next track in queue
        const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
        if (currentIndex >= 0 && currentIndex < queue.length - 1) {
            let nextIndex = currentIndex + 1;
            if (isShuffle) {
                if (shuffledIndicesRef.current.length !== queue.length) {
                    const indices = Array.from({ length: queue.length }, (_, i) => i);
                    for (let i = indices.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [indices[i], indices[j]] = [indices[j], indices[i]];
                    }
                    shuffledIndicesRef.current = indices;
                }
                const currentShuffledPos = shuffledIndicesRef.current.indexOf(currentIndex);
                const nextShuffledPos = (currentShuffledPos + 1) % shuffledIndicesRef.current.length;
                nextIndex = shuffledIndicesRef.current[nextShuffledPos];
            }
            onTrackChange(queue[nextIndex]);
            return;
        }

        // If at end of queue, play top smart mood suggestion
        if (smartSuggestions.length > 0) {
            const nextSuggestion = smartSuggestions[0];
            if (onQueueChange) {
                onQueueChange([...queue, nextSuggestion]);
            }
            onTrackChange(nextSuggestion);
        }
    }, [currentTrack, queue, isShuffle, smartSuggestions, onTrackChange, onQueueChange]);

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

    // 3. Time Update & GAPLESS PRELOADER (Triggers at 15 seconds remaining)
    const onTimeUpdate = () => {
        if (!audioRef.current) return;
        const audio = audioRef.current;

        if (!isSeekingRef.current) {
            setProgress(audio.currentTime);
        }

        // Preload next track when <= 15 seconds remaining
        const timeRemaining = duration - audio.currentTime;
        if (duration > 15 && timeRemaining <= 15 && !hasPreloadedRef.current) {
            const nextTrack = getNextTrack();
            if (nextTrack && nextTrack.id !== currentTrack?.id) {
                hasPreloadedRef.current = nextTrack.id;
                console.log(`[Slothify] Preloading next song buffer: ${nextTrack.name}`);

                preloadNextTrack(nextTrack);
            }
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <>
            {/* Main Audio Element */}
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

            {/* Hidden Preloader Audio Element (Warms up browser cache for next song) */}
            <audio ref={preloadAudioRef} preload="auto" className="hidden" />

            {/* QUEUE & SMART SUGGESTIONS MODAL */}
            {isQueueVisible && (
                <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[#121212]/95 backdrop-blur-xl border-l border-white/10 z-[120] p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between pb-4 border-b border-white/10">
                        <div className="flex items-center space-x-2">
                            <ListMusic size={22} className="text-[#f5d0b5]" />
                            <h2 className="text-lg font-black text-white">Play Queue</h2>
                        </div>
                        <button onClick={onToggleQueue} className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/5">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-6 pt-4 scrollbar-hide">
                        {/* Now Playing */}
                        {currentTrack && (
                            <div>
                                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Now Playing</span>
                                <div className="flex items-center space-x-3 mt-2 p-2 bg-white/5 rounded-xl border border-white/5">
                                    <img src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'} className="w-12 h-12 rounded-lg object-cover" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-sm font-bold truncate ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`}>{currentTrack.name}</h4>
                                        <p className="text-xs text-stone-400 truncate">{currentTrack.artists[0]?.name}</p>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full animate-ping mr-2 ${isOcean ? 'bg-blue-500' : 'bg-[#f5d0b5]'}`} />
                                </div>
                            </div>
                        )}

                        {/* Next in Queue */}
                        {queue.length > 1 && (
                            <div>
                                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Next In Queue</span>
                                <div className="space-y-1 mt-2">
                                    {queue.filter(t => t.id !== currentTrack?.id).map((t, idx) => (
                                        <div
                                            key={`${t.id}_${idx}`}
                                            onClick={() => onTrackChange(t)}
                                            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
                                        >
                                            <img src={t.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-xs font-bold text-white truncate transition-colors ${isOcean ? 'group-hover:text-blue-400' : 'group-hover:text-[#f5d0b5]'}`}>{t.name}</h4>
                                                <p className="text-[10px] text-stone-400 truncate">{t.artists[0]?.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Smart Mood Suggestions */}
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Sparkles size={16} className="text-purple-400" />
                                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Spotify Smart Suggestions</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Mood Autoplay</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 mb-3">
                                Matching the mood and energy of <span className="text-slate-300 font-semibold">{currentTrack.name}</span>
                            </p>

                            {isLoadingSuggestions ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 size={20} className="animate-spin text-purple-400" />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {smartSuggestions.map((t) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 group transition-colors"
                                        >
                                            <div
                                                onClick={() => onTrackChange(t)}
                                                className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                                            >
                                                <img src={t.album.images[0]?.url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-xs font-bold text-white group-hover:text-purple-400 truncate">{t.name}</h4>
                                                    <p className="text-[10px] text-slate-400 truncate">{t.artists[0]?.name}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (onQueueChange) {
                                                        onQueueChange([...queue, t]);
                                                    }
                                                }}
                                                className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/10"
                                                title="Add to queue"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* EXPANDED MOBILE PLAYER - Only rendered when track is active */}
            {isExpanded && currentTrack ? (
                <div className={`md:hidden fixed inset-0 z-[100] flex flex-col h-[100dvh] px-6 pt-safe pb-8 animate-in slide-in-from-bottom duration-300 ${isOcean ? 'bg-gradient-to-b from-[#0a152d] via-[#060c1c] to-[#03060f]' : 'bg-gradient-to-b from-[#181926] via-[#0d0e14] to-[#07080b]'}`}>
                    <header className="flex items-center justify-between h-16 mb-4">
                        <button onClick={onToggleExpand}><ChevronDown size={30} className="text-white" /></button>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} /> Slothify Music
                            </span>
                            <span className="text-xs font-semibold text-slate-300 truncate max-w-[200px] mt-0.5">{currentTrack.album?.name || ''}</span>
                        </div>
                        <MoreVertical size={22} className="text-white" />
                    </header>

                    <div className="flex-1 flex items-center justify-center mb-8 w-full">
                        <div className="w-full aspect-square relative shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
                            <img src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=300'} alt="" className="w-full h-full object-cover rounded-2xl" />
                            {isBuffering && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl backdrop-blur-sm">
                                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-end mb-6">
                        <div className="flex flex-col min-w-0 pr-4">
                            <h2 className="text-2xl font-bold text-white truncate leading-tight mb-1">{currentTrack.name}</h2>
                            <p className="text-base text-slate-400 truncate">{currentTrack.artists[0]?.name}</p>
                        </div>
                        <button onClick={() => onToggleLike(currentTrack.id, currentTrack)} className="mb-1 p-1">
                            <Heart size={26} className={isLiked ? (isOcean ? "fill-blue-400 text-blue-400" : "fill-[#f5d0b5] text-[#f5d0b5]") : "text-white"} />
                        </button>
                    </div>

                    <div className="space-y-2 mb-6">
                        <div className="relative group h-1 w-full bg-white/20 rounded-full">
                            <div className={`absolute h-full rounded-full ${isOcean ? 'bg-blue-600' : 'bg-[#f5d0b5]'}`} style={{ width: `${(progress / (currentDuration || 1)) * 100}%` }} />
                            <input
                                type="range" min="0" max={currentDuration || 0} value={progress}
                                onChange={(e) => setProgress(Number(e.target.value))}
                                onMouseDown={() => isSeekingRef.current = true}
                                onMouseUp={(e) => handleSeekEnd(Number(e.currentTarget.value))}
                                touch-action="none"
                                className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                            />
                        </div>
                        <div className="flex justify-between text-xs text-stone-400 font-medium font-mono">
                            <span>{formatTime(progress)}</span><span>{formatTime(currentDuration)}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-8 px-2">
                        <button onClick={onToggleShuffle}><Shuffle size={22} className={isShuffle ? (isOcean ? "text-blue-400" : "text-[#f5d0b5]") : "text-stone-400"} /></button>
                        <button onClick={handleSkipBack}><SkipBack size={32} className="text-white fill-white" /></button>
                        <button onClick={togglePlay} className={`w-16 h-16 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl ${isOcean ? 'bg-blue-600 text-white shadow-blue-500/40' : 'bg-[#f5d0b5] text-black'}`}>
                            {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={handleSkipForward}><SkipForward size={32} className="text-white fill-white" /></button>
                        <button onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')} className={repeatMode !== 'off' ? (isOcean ? "text-blue-400" : "text-[#f5d0b5]") : "text-stone-400"}>
                            {repeatMode === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
                        </button>
                    </div>
                </div>
            ) : currentTrack ? (
                /* DESKTOP PLAYER + MOBILE MINI - Real-time active track */
                <>
                    <div className={`md:hidden fixed bottom-[4.5rem] left-3 right-3 h-14 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center px-2.5 justify-between shadow-2xl z-[80] bg-black/35`} onClick={() => onToggleExpand()}>
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <img src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'} className="w-10 h-10 rounded-xl object-cover" alt="" />
                            <div className="flex flex-col min-w-0 ml-1">
                                <span className="text-sm font-bold text-white truncate leading-tight">{currentTrack.name}</span>
                                <span className="text-[11px] text-slate-400 truncate leading-tight">{currentTrack.artists[0]?.name}</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3 mr-1">
                            <Heart size={22} className={isLiked ? (isOcean ? "fill-blue-400 text-blue-400" : "fill-[#f5d0b5] text-[#f5d0b5]") : "text-slate-300"} onClick={(e) => { e.stopPropagation(); onToggleLike(currentTrack.id, currentTrack); }} />
                            <button onClick={(e) => { togglePlay(e); }} className={`w-9 h-9 rounded-full flex items-center justify-center ${isOcean ? 'bg-blue-600 text-white' : 'bg-[#f5d0b5] text-black'}`}>
                                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} style={{ width: `${(progress / (currentDuration || 1)) * 100}%` }}></div>
                        </div>
                    </div>

                    <div className={`hidden md:flex fixed md:bottom-3.5 md:left-[256px] md:right-6 h-[72px] backdrop-blur-2xl rounded-2xl z-[70] items-center justify-between px-5 shadow-2xl select-none transition-all duration-300 bg-black/35 hover:bg-black/45 border border-white/10 shadow-black/80`}>
                        {/* Left: Track Info - Click to Open Vintage Turntable */}
                        <div
                            onClick={() => setIsTurntableOpen && setIsTurntableOpen(true)}
                            className="flex items-center space-x-3.5 w-[28%] min-w-0 cursor-pointer group"
                            title="Open Vintage Turntable Player"
                        >
                            <div className="relative flex-shrink-0">
                                <img
                                    src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                                    className={`w-11 h-11 rounded-xl object-cover shadow-md transition-all ${isOcean ? 'group-hover:ring-2 group-hover:ring-blue-500/50' : 'group-hover:ring-2 group-hover:ring-[#f5d0b5]/50'}`}
                                    alt=""
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                    <Disc size={16} className={`${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} ${isPlaying ? 'animate-spin' : ''}`} />
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className={`text-xs font-semibold truncate text-white transition-colors leading-tight ${isOcean ? 'group-hover:text-blue-400' : 'group-hover:text-[#f5d0b5]'}`}>
                                    {currentTrack.name}
                                </span>
                                <span className="text-[11px] text-[#8a8489] hover:text-white cursor-pointer truncate mt-0.5 leading-tight">
                                    {currentTrack.artists[0]?.name}
                                </span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleLike(currentTrack.id, currentTrack); }}
                                className={`p-1.5 transition-colors ml-1 ${isOcean ? 'text-[#8a8489] hover:text-blue-400' : 'text-[#8a8489] hover:text-[#f5d0b5]'}`}
                                title="Like"
                            >
                                <Heart size={16} className={isLiked ? (isOcean ? "fill-blue-400 text-blue-400" : "fill-[#f5d0b5] text-[#f5d0b5]") : ""} />
                            </button>
                        </div>

                        {/* Center: Playback Controls */}
                        <div className="flex items-center space-x-5 justify-center">
                            <button
                                onClick={onToggleShuffle}
                                title="Shuffle"
                                className={`transition-colors ${isShuffle ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-[#8a8489] hover:text-white'}`}
                            >
                                <Shuffle size={16} />
                            </button>
                            <button
                                onClick={handleSkipBack}
                                title="Previous"
                                className="text-[#8a8489] hover:text-white transition-colors"
                            >
                                <SkipBack size={18} fill="currentColor" />
                            </button>
                            <button
                                onClick={togglePlay}
                                title={isPlaying ? "Pause" : "Play"}
                                className={`w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md ${isOcean ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30' : 'bg-[#f5d0b5] hover:bg-[#ebd0bc] text-black shadow-[#f5d0b5]/15'}`}
                            >
                                {isBuffering ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : isPlaying ? (
                                    <Pause size={16} fill="currentColor" />
                                ) : (
                                    <Play size={16} fill="currentColor" className="ml-0.5" />
                                )}
                            </button>
                            <button
                                onClick={handleSkipForward}
                                title="Next"
                                className="text-[#8a8489] hover:text-white transition-colors"
                            >
                                <SkipForward size={18} fill="currentColor" />
                            </button>
                            <button
                                onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
                                title="Repeat"
                                className={`transition-colors ${repeatMode !== 'off' ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-[#8a8489] hover:text-white'}`}
                            >
                                {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                            </button>
                        </div>

                        {/* Right: Progress Slider & Volume */}
                        <div className="flex items-center justify-end space-x-3 w-[38%]">
                            <div className="flex items-center space-x-2 text-[11px] text-[#8a8489] font-mono">
                                <span>{formatTime(progress)}</span>
                                <div className="relative h-1 w-32 md:w-44 bg-[#232029] rounded-full group cursor-pointer">
                                    <div
                                        className={`absolute h-full rounded-full ${isOcean ? 'bg-blue-600' : 'bg-[#f5d0b5]'}`}
                                        style={{ width: `${(progress / (currentDuration || 1)) * 100}%` }}
                                    />
                                    <input
                                        type="range"
                                        min="0"
                                        max={currentDuration || 0}
                                        value={progress}
                                        onChange={(e) => handleSeekEnd(Number(e.target.value))}
                                        className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                </div>
                                <span>{formatTime(currentDuration)}</span>
                            </div>

                            <div className="flex items-center space-x-2 pl-2">
                                <button
                                    onClick={() => setIsTurntableOpen && setIsTurntableOpen(true)}
                                    title="Open Vintage Vinyl Turntable"
                                    className={`p-1.5 rounded-lg transition-colors ${isOcean ? 'text-[#8a8489] hover:text-blue-400 hover:bg-blue-500/10' : 'text-[#8a8489] hover:text-[#f5d0b5] hover:bg-white/5'}`}
                                >
                                    <Disc size={17} className={isPlaying ? "animate-spin" : ""} />
                                </button>
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className="text-[#8a8489] hover:text-white transition-colors"
                                >
                                    {isMuted || volume === 0 ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
                                </button>
                                <button
                                    onClick={onToggleQueue}
                                    title="Queue"
                                    className={`transition-colors ${isQueueVisible ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-[#8a8489] hover:text-white'}`}
                                >
                                    <ListMusic size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {/* VINTAGE VINYL TURNTABLE PLAYER MODAL */}
            <VintageTurntable
                isOpen={Boolean(isTurntableOpen)}
                onClose={() => setIsTurntableOpen && setIsTurntableOpen(false)}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlayPause={setIsPlaying}
                onTrackChange={onTrackChange}
                queue={queue}
                progress={progress}
                duration={currentDuration}
                onSeek={handleSeekEnd}
                isShuffle={isShuffle}
                onToggleShuffle={onToggleShuffle}
                repeatMode={repeatMode}
                onToggleRepeat={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
                isLiked={Boolean(isLiked)}
                onToggleLike={() => currentTrack && onToggleLike(currentTrack.id, currentTrack)}
                volume={volume}
                onVolumeChange={setVolume}
            />
        </>
    );
};

export default Player;