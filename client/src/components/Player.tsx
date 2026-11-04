import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle,
    ListMusic, ChevronDown, Heart, Loader2, MonitorSpeaker, Mic2,
    Volume2, VolumeX, Volume1, MoreVertical, Sparkles, X, Plus, Disc, Music2,
    Maximize2, Minimize2
} from 'lucide-react';
import { Track } from '../types';
import AudioWaveform from './AudioWaveform';
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
            const best = audioStreams.find((s: any) => s.itag === 140 || s.itag === '140' || s.container === 'm4a' || s.mimeType?.includes('audio/mp4') || s.quality === '128 kbps') || audioStreams[0];
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
    onDismiss?: () => void;
}

const Player: React.FC<PlayerProps> = ({
    currentTrack, queue, onTrackChange, isExpanded, onToggleExpand,
    likedTrackIds, onToggleLike, onToggleQueue, isQueueVisible,
    isPlaying, setIsPlaying, isShuffle, onToggleShuffle, onQueueChange,
    isTurntableOpen, setIsTurntableOpen, onDismiss
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

    // Mobile Player Mode & Swipe-Down Gesture (Defaults to 'vintage')
    const [mobilePlayerMode, setMobilePlayerMode] = useState<'normal' | 'vintage'>(() => {
        try {
            const isMigrated = localStorage.getItem('slothify_player_default_vintage_v1');
            if (!isMigrated) {
                localStorage.setItem('slothify_player_default_vintage_v1', 'true');
                localStorage.setItem('slothify_mobile_player_style', 'vintage');
                return 'vintage';
            }
            const saved = localStorage.getItem('slothify_mobile_player_style');
            if (saved === 'vintage' || saved === 'normal') return saved;
        } catch { }
        return 'vintage';
    });

    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Listen for custom event to switch player mode (e.g. from Home hero "Spin Turntable")
    useEffect(() => {
        const handler = (e: any) => {
            if (e.detail === 'vintage' || e.detail === 'normal') {
                setMobilePlayerMode(e.detail);
            }
        };
        window.addEventListener('slothify_player_mode_change', handler);
        return () => window.removeEventListener('slothify_player_mode_change', handler);
    }, []);

    // Listen for Escape key to close expanded player
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isExpanded) {
                onToggleExpand();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isExpanded, onToggleExpand]);

    const springTransition = {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
        mass: 0.6
    };

    const surfaceLayoutTransition = {
        layout: { type: "spring" as const, bounce: 0.15, duration: 0.5 }
    };

    // Guard & Caching Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackIdRef = useRef<string | null>(null);
    const activeLoadedTrackIdRef = useRef<string | null>(null);
    const shuffledIndicesRef = useRef<number[]>([]);
    const isSeekingRef = useRef(false);
    const hasPreloadedRef = useRef<string | null>(null);
    const isDownbarDraggingRef = useRef(false);
    // Clean legacy/poisoned cache keys from previous versions
    try {
        localStorage.removeItem('slothify_video_cache');
        localStorage.removeItem('slothify_saavn_cache');
    } catch (e) { }

    const resolvedVideoMap = useRef<Map<string, string>>((() => {
        try {
            const saved = localStorage.getItem('slothify_video_cache_v3');
            if (saved) {
                return new Map(JSON.parse(saved));
            }
        } catch (e) { }
        return new Map();
    })());

    const persistVideoCache = useCallback(() => {
        try {
            const entries = Array.from(resolvedVideoMap.current.entries()).slice(-500);
            localStorage.setItem('slothify_video_cache_v3', JSON.stringify(entries));
        } catch (e) { }
    }, []);

    const resolvedSaavnMap = useRef<Map<string, string>>((() => {
        try {
            const saved = localStorage.getItem('slothify_saavn_cache_v3');
            if (saved) {
                return new Map(JSON.parse(saved));
            }
        } catch (e) { }
        return new Map();
    })());

    const persistSaavnCache = useCallback(() => {
        try {
            const entries = Array.from(resolvedSaavnMap.current.entries()).slice(-500);
            localStorage.setItem('slothify_saavn_cache_v3', JSON.stringify(entries));
        } catch (e) { }
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
        const targetDurationSec = track.duration_ms ? Math.round(track.duration_ms / 1000) : 0;

        // 1. If JioSaavn or Auto, pre-check JioSaavn first
        if (providerPref === 'jiosaavn' || providerPref === 'auto') {
            try {
                let songId = track.id.startsWith('saavn_') ? track.id.replace('saavn_', '') : resolvedSaavnMap.current.get(track.id);
                if (songId) {
                    try {
                        const songDetails = await AudioService.getSongDetails(songId);
                        if (songDetails) {
                            const songDur = songDetails.duration || 0;
                            const durMismatch = targetDurationSec > 0 && songDur > 0 && Math.abs(songDur - targetDurationSec) > 5;
                            const normArtist = trackArtist.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const primaryArtists = (songDetails.artists?.primary || []).map(a => (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
                            const artistMismatch = normArtist.length > 2 && primaryArtists.length > 0 && !primaryArtists.some(a => a.includes(normArtist) || normArtist.includes(a));
                            const targetHasRemix = /\b(remix|mix)\b/i.test(trackTitle);
                            const candHasRemix = /\b(remix|mix|hypertechno|techno|drum & bass|drum and bass|dnb|sped\s*up|speed\s*up|slowed|reverb)\b/i.test(songDetails.name || '');
                            const remixMismatch = !targetHasRemix && candHasRemix;

                            if (durMismatch || artistMismatch || remixMismatch) {
                                resolvedSaavnMap.current.delete(track.id);
                                persistSaavnCache();
                                songId = undefined;
                            }
                        } else {
                            resolvedSaavnMap.current.delete(track.id);
                            persistSaavnCache();
                            songId = undefined;
                        }
                    } catch {
                        songId = undefined;
                    }
                }
                if (!songId) {
                    // Try live Cloudflare AudioService first with target duration
                    const match = await AudioService.findStreamForTrack(trackTitle, trackArtist, targetDurationSec);
                    if (match?.songId) {
                        songId = match.songId;
                        resolvedSaavnMap.current.set(track.id, songId);
                        persistSaavnCache();
                    }
                }
                if (!songId) {
                    const sRes = await fetchSaavnApi(`/api/saavn/search?q=${encodeURIComponent(songQuery)}&title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(trackArtist)}&duration=${targetDurationSec}`);
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
                    fetchSaavnApi(`/api/saavn/stream/${songId}`).catch(() => { });
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
                const res = await fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(ytQuery)}&duration=${targetDurationSec}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.videoId) {
                        resolvedVideoMap.current.set(track.id, data.videoId);
                        persistVideoCache();
                        fetch(`${API_BASE}/api/youtube/preload/${data.videoId}`).catch(() => { });
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
                const targetDurationSec = currentTrack.duration_ms ? Math.round(currentTrack.duration_ms / 1000) : 0;

                let directUrl: string | null = null;
                let resolvedEngine: 'youtube' | 'jiosaavn' = 'youtube';

                // Helper: resolve via JioSaavn 320kbps with timestamp/duration matching
                const resolveSaavn = async (): Promise<string | null> => {
                    try {
                        let songId = trackId.startsWith('saavn_') ? trackId.replace('saavn_', '') : resolvedSaavnMap.current.get(trackId);

                        // If songId is known from a previous resolve or saavn_ ID:
                        // Validate its timestamp / duration against targetDurationSec to prevent wrong sped-up covers or stale IDs from playing
                        if (songId) {
                            try {
                                const songDetails = await AudioService.getSongDetails(songId, signal);
                                if (songDetails) {
                                    const songDur = songDetails.duration || 0;
                                    const durMismatch = targetDurationSec > 0 && songDur > 0 && Math.abs(songDur - targetDurationSec) > 5;
                                    const normArtist = trackArtist.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    const primaryArtists = (songDetails.artists?.primary || []).map(a => (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
                                    const artistMismatch = normArtist.length > 2 && primaryArtists.length > 0 && !primaryArtists.some(a => a.includes(normArtist) || normArtist.includes(a));
                                    const targetHasRemix = /\b(remix|mix)\b/i.test(trackTitle);
                                    const candHasRemix = /\b(remix|mix|hypertechno|techno|drum & bass|drum and bass|dnb|sped\s*up|speed\s*up|slowed|reverb)\b/i.test(songDetails.name || '');
                                    const remixMismatch = !targetHasRemix && candHasRemix;

                                    if (durMismatch || artistMismatch || remixMismatch) {
                                        console.warn(`[Player] Evicting stale/invalid cached songId "${songId}" for "${trackTitle}" (dur diff: ${Math.abs(songDur - targetDurationSec)}s, artist mismatch: ${artistMismatch}, remix mismatch: ${remixMismatch})`);
                                        resolvedSaavnMap.current.delete(trackId);
                                        persistSaavnCache();
                                        songId = undefined; // Force clean re-resolution with timestamp matching
                                    } else {
                                        const direct = AudioService.extractBestStreamUrl(songDetails.downloadUrl);
                                        if (direct) return direct;
                                    }
                                } else {
                                    resolvedSaavnMap.current.delete(trackId);
                                    persistSaavnCache();
                                    songId = undefined;
                                }
                            } catch {
                                songId = undefined;
                            }
                        }

                        // Try finding stream directly via Cloudflare AudioService with timestamp matching
                        try {
                            const match = await AudioService.findStreamForTrack(trackTitle, trackArtist, targetDurationSec, signal);
                            if (match?.streamUrl) {
                                resolvedSaavnMap.current.set(trackId, match.songId);
                                persistSaavnCache();
                                return match.streamUrl;
                            }
                        } catch { }

                        // Fallback to local serverless proxy route with timestamp matching
                        if (!songId) {
                            const sRes = await fetchSaavnApi(`/api/saavn/search?q=${encodeURIComponent(songQuery)}&title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(trackArtist)}&duration=${targetDurationSec}`, { signal });
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

                // Helper: resolve via YouTube (Client-Side Piped Racing + Backend Fallback) with timestamp matching
                const resolveYouTube = async (): Promise<string | null> => {
                    try {
                        let videoId = resolvedVideoMap.current.get(trackId);
                        if (!videoId) {
                            const ytQuery = `${cleanTitle} ${trackArtist} audio`.trim();
                            const res = await fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(ytQuery)}&duration=${targetDurationSec}`, { signal });
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

    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleSeekStart = useCallback(() => {
        isSeekingRef.current = true;
    }, []);

    const handleSeekChange = useCallback((value: number) => {
        isSeekingRef.current = true;
        setProgress(value);
    }, []);

    const handleSeekCommit = useCallback((value: number) => {
        isSeekingRef.current = true;
        setProgress(value);
        if (audioRef.current && isFinite(value)) {
            try {
                audioRef.current.currentTime = value;
            } catch (err) {
                console.warn('[Player] Seek error:', err);
            }
        }
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = setTimeout(() => {
            isSeekingRef.current = false;
        }, 1200);
    }, []);

    const handleSeekEnd = useCallback((value: number) => {
        handleSeekCommit(value);
    }, [handleSeekCommit]);

    // 3. Time Update & GAPLESS PRELOADER (Triggers at 15 seconds remaining)
    const onTimeUpdate = () => {
        if (!audioRef.current) return;
        const audio = audioRef.current;

        // Never overwrite progress if user is dragging slider or audio element is seeking
        if (!isSeekingRef.current && !audio.seeking) {
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
                preload="auto"
                loop={repeatMode === 'one'}
                onTimeUpdate={onTimeUpdate}
                onSeeking={() => {
                    isSeekingRef.current = true;
                    setIsBuffering(true);
                }}
                onSeeked={() => {
                    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
                    isSeekingRef.current = false;
                    setIsBuffering(false);
                    if (audioRef.current) {
                        setProgress(audioRef.current.currentTime);
                    }
                }}
                onLoadedMetadata={() => {
                    const d = audioRef.current?.duration;
                    if (d && isFinite(d) && d > 0) {
                        setDuration(d);
                    }
                }}
                onEnded={handleTrackEnd}
                onWaiting={() => setIsBuffering(true)}
                onCanPlay={() => setIsBuffering(false)}
                onError={() => setAudioError('Playback error')}
            />

            {/* Hidden Preloader Audio Element (Warms up browser cache for next song) */}
            <audio ref={preloadAudioRef} preload="auto" className="hidden" />

            {/* QUEUE & SMART SUGGESTIONS MODAL */}
            {isQueueVisible && (
                <div className={`fixed inset-y-0 right-0 w-full sm:w-96 backdrop-blur-2xl z-[120] p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 ${isOcean
                        ? 'bg-[#071329]/95 border-l border-blue-500/20 text-white'
                        : 'bg-[#140b07]/95 border-l border-[#f5d0b5]/15 text-white'
                    }`}>
                    <div className={`flex items-center justify-between pb-4 border-b ${isOcean ? 'border-blue-500/15' : 'border-white/10'
                        }`}>
                        <div className="flex items-center space-x-2">
                            <ListMusic size={22} className={isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} />
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
                                <div className={`flex items-center space-x-3 mt-2 p-2 rounded-xl border ${isOcean ? 'bg-blue-950/40 border-blue-500/25' : 'bg-white/5 border-white/5'
                                    }`}>
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
                                            className={`flex items-center space-x-3 p-2 rounded-xl cursor-pointer group transition-colors ${isOcean ? 'hover:bg-blue-950/30' : 'hover:bg-white/5'
                                                }`}
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
                                    <Sparkles size={16} className={isOcean ? 'text-cyan-400' : 'text-[#f5d0b5]'} />
                                    <span className={`text-xs font-bold uppercase tracking-wider ${isOcean ? 'text-cyan-400' : 'text-[#f5d0b5]'}`}>
                                        Spotify Smart Suggestions
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500">Mood Autoplay</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 mb-3">
                                Matching the mood and energy of <span className={`font-semibold ${isOcean ? 'text-cyan-300' : 'text-slate-300'}`}>{currentTrack.name}</span>
                            </p>

                            {isLoadingSuggestions ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 size={20} className={`animate-spin ${isOcean ? 'text-cyan-400' : 'text-[#f5d0b5]'}`} />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {smartSuggestions.map((t) => (
                                        <div
                                            key={t.id}
                                            className={`flex items-center justify-between p-2 rounded-xl group transition-colors ${isOcean ? 'hover:bg-blue-950/30' : 'hover:bg-white/5'
                                                }`}
                                        >
                                            <div
                                                onClick={() => onTrackChange(t)}
                                                className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                                            >
                                                <img src={t.album.images[0]?.url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`text-xs font-bold text-white truncate ${isOcean ? 'group-hover:text-cyan-400' : 'group-hover:text-[#f5d0b5]'}`}>{t.name}</h4>
                                                    <p className="text-[10px] text-slate-400 truncate">{t.artists[0]?.name}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (onQueueChange) {
                                                        onQueueChange([...queue, t]);
                                                    }
                                                }}
                                                className={`p-1.5 text-slate-500 hover:text-white rounded-lg ${isOcean ? 'hover:bg-blue-900/40 hover:text-cyan-400' : 'hover:bg-white/10 hover:text-[#f5d0b5]'
                                                    }`}
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

            {/* UNIFIED SINGLE PLAYER: SHARED ELEMENT TRANSITIONS (EXPANDED vs MINI BAR) */}
            <AnimatePresence mode="popLayout">
                {isExpanded && currentTrack ? (
                    <motion.div
                        key="full-player"
                        layoutId="player-surface"
                        transition={surfaceLayoutTransition}
                        drag={isMobile ? "y" : false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.55 }}
                        onDragEnd={(_, info) => {
                            if (isMobile && (info.offset.y > 75 || info.velocity.y > 350)) {
                                onToggleExpand();
                            }
                        }}
                        className={`fixed inset-0 z-[150] w-screen h-[100dvh] flex flex-col justify-between px-5 pt-safe pb-4 select-none overflow-hidden text-white ${isOcean ? 'bg-[#020612]' : 'bg-[#0d0705]'
                            }`}
                    >
                        {/* Thematic Ambient Scenery Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            className="absolute inset-0 pointer-events-none overflow-hidden -z-10"
                        >
                            <div
                                className={`absolute inset-0 bg-cover bg-center transition-all duration-700 scale-105 ${isOcean ? 'opacity-70' : 'opacity-85'
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
                                className={`absolute inset-0 ${isOcean
                                        ? 'bg-gradient-to-b from-[#020914]/70 via-[#030e1c]/80 to-[#020812]/92'
                                        : 'bg-gradient-to-b from-[#140803]/45 via-[#1a0a04]/55 to-[#0d0502]/70'
                                    }`}
                            />
                            <div
                                className={`absolute top-1/4 left-1/4 w-[50vw] h-[50vw] rounded-full blur-[80px] opacity-20 pointer-events-none transition-all duration-700 ${isOcean ? 'bg-blue-600' : 'bg-[#c87d46]'
                                    }`}
                                style={{ willChange: 'transform' }}
                            />
                            <div
                                className={`absolute bottom-1/4 right-1/4 w-[40vw] h-[40vw] rounded-full blur-[90px] opacity-15 pointer-events-none transition-all duration-700 ${isOcean ? 'bg-cyan-600' : 'bg-[#d97736]'
                                    }`}
                                style={{ willChange: 'transform' }}
                            />
                        </motion.div>

                        {/* Immediate Child Content Wrapper: layout="position" + clean 150ms exit fade */}
                        <motion.div
                            layout="position"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            className="relative w-full h-full flex flex-col justify-between select-none overflow-hidden"
                        >
                            {/* Top Bar with Grab Handle / Minimize, Style Switcher, and Queue */}
                            <div className="w-full relative z-20 flex flex-col">
                                {/* Mobile Swipe-down Grab Indicator */}
                                <div
                                    onClick={onToggleExpand}
                                    className="md:hidden w-full pt-1.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none select-none flex-shrink-0"
                                >
                                    <div className="w-10 h-1 rounded-full bg-white/30 hover:bg-white/50 transition-colors" />
                                </div>

                                <header className="flex items-center justify-between h-11 mb-1 px-0.5 select-none flex-shrink-0">
                                    <button
                                        onClick={onToggleExpand}
                                        className="p-2 -ml-2 text-white/80 hover:text-white active:scale-90 transition-transform"
                                        title="Minimize player"
                                    >
                                        <ChevronDown size={26} className="md:hidden" />
                                        <Minimize2 size={20} className="hidden md:inline" />
                                    </button>

                                    {/* Style Switcher: Mobile Only; Windows/Desktop is strictly dedicated to Vintage */}
                                    <div className="md:hidden flex items-center bg-white/[0.08] p-0.5 rounded-full border border-white/10 shadow-inner">
                                        <button
                                            onClick={() => {
                                                setMobilePlayerMode('normal');
                                                try { localStorage.setItem('slothify_mobile_player_style', 'normal'); } catch { }
                                            }}
                                            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold font-display transition-all ${mobilePlayerMode === 'normal'
                                                    ? isOcean
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'bg-[#f5d0b5] text-black shadow-sm'
                                                    : 'text-stone-400 hover:text-white'
                                                }`}
                                        >
                                            <Music2 size={12} />
                                            <span>Normal</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setMobilePlayerMode('vintage');
                                                try { localStorage.setItem('slothify_mobile_player_style', 'vintage'); } catch { }
                                            }}
                                            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold font-display transition-all ${mobilePlayerMode === 'vintage'
                                                    ? isOcean
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'bg-[#f5d0b5] text-black shadow-sm'
                                                    : 'text-stone-400 hover:text-white'
                                                }`}
                                        >
                                            <Disc size={12} className={isPlaying && mobilePlayerMode === 'vintage' ? 'animate-spin' : ''} />
                                            <span>Vintage</span>
                                        </button>
                                    </div>

                                    {/* Desktop Branding Badge */}
                                    <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs text-slate-300 select-none">
                                        <Disc size={13} className={`transition-colors ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} ${isPlaying ? 'animate-spin' : ''}`} />
                                        <span className="font-medium tracking-wide">Vintage Vinyl • {isOcean ? 'Ocean' : 'Autumn'}</span>
                                    </div>

                                    <button
                                        onClick={onToggleQueue}
                                        className={`p-2 -mr-2 rounded-full transition-all active:scale-90 ${isQueueVisible
                                                ? isOcean ? 'text-blue-400 bg-white/10' : 'text-[#f5d0b5] bg-white/10'
                                                : 'text-white/80 hover:text-white'
                                            }`}
                                        title="Play Queue"
                                    >
                                        <ListMusic size={22} />
                                    </button>
                                </header>
                            </div>

                            {/* Main Body: Stacked on Mobile, 2-Column Side-by-Side (CD on Left, UI on Right) on Desktop/Windows */}
                            <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center justify-center md:justify-around lg:justify-between max-w-6xl mx-auto w-full px-2 sm:px-6 md:px-8 py-2 md:py-4 gap-4 md:gap-8 lg:gap-14 select-none relative z-10 overflow-y-auto md:overflow-hidden">
                                {/* LEFT SIDE: CD / VINYL TURNTABLE & LIVE WAVEFORM */}
                                <div className="w-full md:w-1/2 flex flex-col items-center justify-center flex-shrink-0 my-auto">
                                    {/* Desktop is ALWAYS Vintage; Mobile uses normal only if chosen */}
                                    {isMobile && mobilePlayerMode === 'normal' ? (
                                        <motion.div
                                            layoutId="player-shared-artwork"
                                            transition={springTransition}
                                            className="relative w-full max-w-[min(34vh,240px)] sm:max-w-[min(44vh,340px)] aspect-square flex items-center justify-center select-none flex-shrink-0 shadow-[0_20px_50px_rgba(0,0,0,0.85)] rounded-2xl overflow-hidden border border-white/10"
                                        >
                                            <img
                                                src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=500'}
                                                alt=""
                                                className="w-full h-full object-cover rounded-2xl"
                                            />
                                            {isBuffering && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl backdrop-blur-sm">
                                                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                                                </div>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <div className="relative w-full max-w-[min(34vh,240px)] sm:max-w-[min(44vh,340px)] md:max-w-[min(55vh,420px)] lg:max-w-[min(65vh,460px)] aspect-square flex items-center justify-center select-none flex-shrink-0">
                                            {/* Outer vinyl platter smoothly dissolves on exit */}
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.92 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={isMobile ? { opacity: 0, scale: 0.85, transition: { duration: 0.12 } } : undefined}
                                                onClick={togglePlay}
                                                className={`w-full h-full rounded-full aspect-square bg-[#0a0a0d] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.95)] relative overflow-hidden flex items-center justify-center cursor-pointer select-none ${isPlaying ? 'spin-vinyl' : 'spin-vinyl-paused'
                                                    }`}
                                                style={{
                                                    ['--spin-duration' as any]: '10s',
                                                    willChange: 'transform'
                                                }}
                                                title={isPlaying ? "Click to Pause" : "Click to Play"}
                                            >
                                                <div className="absolute inset-3 sm:inset-4 rounded-full border border-white/[0.04] pointer-events-none" />
                                                <div className="absolute inset-6 sm:inset-8 rounded-full border border-white/[0.03] pointer-events-none" />
                                                <div className="absolute inset-9 sm:inset-12 rounded-full border border-white/[0.04] pointer-events-none" />
                                                <div className="absolute inset-12 sm:inset-16 rounded-full border border-white/[0.03] pointer-events-none" />
                                                <div className="absolute inset-15 sm:inset-20 rounded-full border border-white/[0.04] pointer-events-none" />
                                                <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.06)_45deg,transparent_90deg,rgba(255,255,255,0.06)_225deg,transparent_270deg)] pointer-events-none" />

                                                {/* Center label image seamlessly linked to shared artwork */}
                                                <motion.div
                                                    layoutId={isMobile ? "player-shared-artwork" : undefined}
                                                    transition={springTransition}
                                                    className="relative w-[38%] h-[38%] rounded-full overflow-hidden border-2 border-black/80 shadow-2xl flex items-center justify-center"
                                                >
                                                    <img
                                                        src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=300'}
                                                        alt={currentTrack.name}
                                                        className="w-full h-full object-cover rounded-full pointer-events-none"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                                                    <div className="absolute w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#121215] border border-white/20 shadow-md flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black" />
                                                    </div>
                                                </motion.div>
                                            </motion.div>
                                        </div>
                                    )}

                                    {/* Minimalist Live Waveform (Always active on desktop; on mobile if vintage) */}
                                    {(!isMobile || mobilePlayerMode === 'vintage') && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={isMobile ? { opacity: 0, transition: { duration: 0.12 } } : undefined}
                                            className="mt-3 sm:mt-4 flex items-center justify-center w-full max-w-[min(34vh,240px)] sm:max-w-[min(44vh,340px)] md:max-w-[min(55vh,420px)] lg:max-w-[min(65vh,460px)]"
                                        >
                                            <AudioWaveform isPlaying={isPlaying} barCount={24} />
                                        </motion.div>
                                    )}
                                </div>

                                {/* RIGHT SIDE: SONG INFO + SCRUB BAR + CONTROLS CONSOLE */}
                                <div className="w-full md:w-1/2 max-w-xl flex flex-col justify-center space-y-3 sm:space-y-4 md:space-y-5 px-1 sm:px-4 md:px-6 relative z-20">
                                    {/* Song Details */}
                                    <div>
                                        <span
                                            className={`text-[11px] font-bold tracking-widest uppercase block ${isOcean ? 'text-blue-500' : 'text-[#f5d0b5]'
                                                }`}
                                        >
                                            Now Playing
                                        </span>
                                        <div className="space-y-0.5">
                                            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate leading-tight">
                                                {currentTrack.name}
                                            </h2>
                                            <p className="text-sm md:text-base text-slate-300 truncate">
                                                {currentTrack.artists[0]?.name}
                                            </p>
                                            {currentTrack.album?.name && (
                                                <p className="text-xs text-slate-500 font-mono truncate">
                                                    {currentTrack.album.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Scrub Bar */}
                                    <div className="space-y-1 pt-0.5">
                                        <div className="relative group h-1.5 w-full bg-white/10 rounded-full cursor-pointer">
                                            <div
                                                className={`absolute h-full rounded-full transition-all ${isOcean ? 'bg-blue-600' : 'bg-[#f5d0b5]'
                                                    }`}
                                                style={{ width: `${(progress / (currentDuration || 1)) * 100}%` }}
                                            />
                                            <input
                                                type="range"
                                                min="0"
                                                max={currentDuration || 0}
                                                step="any"
                                                value={progress}
                                                onPointerDown={handleSeekStart}
                                                onChange={(e) => handleSeekChange(Number(e.target.value))}
                                                onPointerUp={(e) => handleSeekCommit(Number(e.currentTarget.value))}
                                                onTouchStart={handleSeekStart}
                                                onTouchEnd={(e) => handleSeekCommit(Number(e.currentTarget.value))}
                                                className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500 font-mono">
                                            <span>{formatTime(progress)}</span>
                                            <span>{formatTime(currentDuration)}</span>
                                        </div>
                                    </div>

                                    {/* Playback Controls */}
                                    <div className="flex justify-between items-center pt-1.5 px-1 sm:px-6">
                                        <button
                                            onClick={onToggleShuffle}
                                            className="p-2 text-slate-400 hover:text-white active:scale-90 transition-transform"
                                            title="Shuffle"
                                        >
                                            <Shuffle size={20} className={isShuffle ? (isOcean ? "text-blue-400" : "text-[#f5d0b5]") : "text-slate-400"} />
                                        </button>
                                        <button
                                            onClick={handleSkipBack}
                                            className="p-2 text-slate-300 hover:text-white active:scale-90 transition-transform"
                                            title="Previous"
                                        >
                                            <SkipBack size={26} fill="currentColor" />
                                        </button>

                                        {/* Master Play Button */}
                                        <button
                                            onClick={togglePlay}
                                            title={isPlaying ? "Pause" : "Play"}
                                            className={`w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all ${isOcean
                                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_28px_rgba(37,99,235,0.65)] ring-2 ring-blue-500/20'
                                                    : 'bg-[#f5d0b5] hover:bg-white text-black shadow-[0_0_24px_rgba(245,208,181,0.35)]'
                                                }`}
                                        >
                                            {isPlaying ? (
                                                <Pause size={24} className="sm:w-7 sm:h-7" fill="currentColor" />
                                            ) : (
                                                <Play size={24} className="sm:w-7 sm:h-7 ml-0.5" fill="currentColor" />
                                            )}
                                        </button>

                                        <button
                                            onClick={handleSkipForward}
                                            className="p-2 text-slate-300 hover:text-white active:scale-90 transition-transform"
                                            title="Next"
                                        >
                                            <SkipForward size={26} fill="currentColor" />
                                        </button>
                                        <button
                                            onClick={() => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')}
                                            className="p-2 text-slate-400 hover:text-white active:scale-90 transition-transform"
                                            title="Repeat"
                                        >
                                            {repeatMode === 'one' ? (
                                                <Repeat1 size={20} className={isOcean ? "text-blue-400" : "text-[#f5d0b5]"} />
                                            ) : (
                                                <Repeat size={20} className={repeatMode !== 'off' ? (isOcean ? "text-blue-400" : "text-[#f5d0b5]") : "text-slate-400"} />
                                            )}
                                        </button>
                                    </div>

                                    {/* Sub-controls: Like & Volume */}
                                    <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.06] px-1 sm:px-6">
                                        <button
                                            onClick={() => onToggleLike(currentTrack.id, currentTrack)}
                                            className={`flex items-center space-x-1.5 text-xs font-medium transition-colors active:scale-90 ${isLiked
                                                    ? isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'
                                                    : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            <Heart
                                                size={18}
                                                className={
                                                    isLiked
                                                        ? isOcean ? 'fill-blue-500 text-blue-500' : 'fill-[#f5d0b5] text-[#f5d0b5]'
                                                        : ''
                                                }
                                            />
                                            <span>{isLiked ? 'Liked' : 'Like'}</span>
                                        </button>

                                        <div className="flex items-center space-x-2 w-36 sm:w-44">
                                            <button
                                                onClick={() => setIsMuted(!isMuted)}
                                                className="text-slate-400 hover:text-white transition-colors"
                                            >
                                                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                            </button>
                                            <div className="relative h-1 flex-1 bg-white/10 rounded-full">
                                                <div
                                                    className={`absolute h-full rounded-full ${isOcean ? 'bg-blue-600' : 'bg-[#f5d0b5]'
                                                        }`}
                                                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                                                />
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    value={isMuted ? 0 : volume}
                                                    onChange={(e) => {
                                                        setIsMuted(false);
                                                        setVolume(parseFloat(e.target.value));
                                                    }}
                                                    className="absolute w-full h-full opacity-0 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Minimalist Footer */}
                                    <footer className="w-full pt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                        <span>Slothify Minimalist Audio</span>
                                        <span className="hidden md:inline">Esc to close</span>
                                    </footer>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                ) : currentTrack ? (
                    isMobile ? (
                        /* MOBILE DOWNBAR: ONE UNIQUE INSTANCE OF SHARED LAYOUT IDs */
                        <motion.div
                            key="collapsed-player"
                            layoutId="player-surface"
                            transition={surfaceLayoutTransition}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 60, scale: 0.95, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0.5, bottom: 0.7 }}
                            onDragStart={() => {
                                isDownbarDraggingRef.current = true;
                            }}
                            onDragEnd={(_, info) => {
                                setTimeout(() => {
                                    isDownbarDraggingRef.current = false;
                                }, 120);

                                if (info.offset.y < -25 || info.velocity.y < -250) {
                                    onToggleExpand();
                                } else if (info.offset.y > 35 || info.velocity.y > 250) {
                                    if (audioRef.current) audioRef.current.pause();
                                    setIsPlaying(false);
                                    onDismiss?.();
                                }
                            }}
                            onClick={() => {
                                if (isDownbarDraggingRef.current) return;
                                onToggleExpand();
                            }}
                            className={`pointer-events-auto fixed bottom-[4.5rem] left-3 right-3 h-14 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center px-2.5 justify-between shadow-2xl cursor-pointer active:scale-[0.99] select-none z-[80] overflow-hidden ${isOcean ? 'bg-[#030914]/85' : 'bg-[#120703]/85'
                                }`}
                        >
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <motion.div
                                    layoutId="player-shared-artwork"
                                    transition={springTransition}
                                    className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0"
                                >
                                    <img
                                        src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                                        className="w-full h-full rounded-xl object-cover"
                                        alt=""
                                    />
                                </motion.div>
                                <div className="flex flex-col min-w-0 ml-1">
                                    <span className="text-sm font-bold text-white truncate leading-tight">{currentTrack.name}</span>
                                    <span className="text-[11px] text-slate-400 truncate leading-tight">{currentTrack.artists[0]?.name}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 mr-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleLike(currentTrack.id, currentTrack); }}
                                    className="p-1 text-slate-300 active:scale-90"
                                    title={isLiked ? "Unlike" : "Like"}
                                >
                                    <Heart size={22} className={isLiked ? (isOcean ? "fill-blue-400 text-blue-400" : "fill-[#f5d0b5] text-[#f5d0b5]") : "text-slate-300"} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                                    title={isPlaying ? "Pause" : "Play"}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform ${isOcean
                                            ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.55)]'
                                            : 'bg-[#f5d0b5] text-black shadow-sm'
                                        }`}
                                >
                                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                                </button>
                            </div>
                            <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-white/10 rounded-full overflow-hidden">
                                <div className={`h-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} style={{ width: `${(progress / (currentDuration || 1)) * 100}%` }} />
                            </div>
                        </motion.div>
                    ) : (
                        /* DESKTOP MEDIA BAR: FIXED ROCK-SOLID SIZE WITH SMOOTH TRANSITION */
                        <motion.div
                            key="collapsed-desktop-player"
                            layoutId="player-surface"
                            transition={surfaceLayoutTransition}
                            onClick={onToggleExpand}
                            className={`pointer-events-auto fixed bottom-3.5 left-[256px] right-6 h-[72px] backdrop-blur-2xl rounded-2xl flex items-center justify-between px-5 shadow-2xl select-none transition-colors duration-200 border border-white/10 hover:border-white/20 z-[80] shadow-black/80 cursor-pointer ${isOcean ? 'bg-[#030914]/85 hover:bg-[#030914]/95' : 'bg-[#120703]/85 hover:bg-[#120703]/95'
                                }`}
                            title="Click anywhere to expand player"
                        >
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                                className="w-full h-full flex items-center justify-between"
                            >
                                {/* Left: Track Info */}
                                <div
                                    className="flex items-center space-x-3.5 w-[28%] min-w-0 group"
                                >
                                    <div className="relative flex-shrink-0 w-11 h-11 rounded-xl overflow-hidden">
                                        <img
                                            src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                                            className={`w-full h-full rounded-xl object-cover shadow-md transition-all ${isOcean ? 'group-hover:ring-2 group-hover:ring-blue-500/50' : 'group-hover:ring-2 group-hover:ring-[#f5d0b5]/50'}`}
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
                                        onClick={(e) => { e.stopPropagation(); onToggleShuffle(); }}
                                        title="Shuffle"
                                        className={`transition-colors ${isShuffle ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-[#8a8489] hover:text-white'}`}
                                    >
                                        <Shuffle size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleSkipBack(); }}
                                        title="Previous"
                                        className="text-[#8a8489] hover:text-white transition-colors"
                                    >
                                        <SkipBack size={18} fill="currentColor" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
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
                                        onClick={(e) => { e.stopPropagation(); handleSkipForward(); }}
                                        title="Next"
                                        className="text-[#8a8489] hover:text-white transition-colors"
                                    >
                                        <SkipForward size={18} fill="currentColor" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'); }}
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
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="relative h-1 w-32 md:w-44 bg-[#232029] rounded-full group cursor-pointer"
                                        >
                                            <div
                                                className={`absolute h-full rounded-full ${isOcean ? 'bg-blue-600' : 'bg-[#f5d0b5]'}`}
                                                style={{ width: `${(progress / (currentDuration || 1)) * 100}%` }}
                                            />
                                            <input
                                                type="range"
                                                min="0"
                                                max={currentDuration || 0}
                                                step="any"
                                                value={progress}
                                                onPointerDown={handleSeekStart}
                                                onChange={(e) => handleSeekChange(Number(e.target.value))}
                                                onPointerUp={(e) => handleSeekCommit(Number(e.currentTarget.value))}
                                                onMouseDown={handleSeekStart}
                                                onMouseUp={(e) => handleSeekCommit(Number(e.currentTarget.value))}
                                                onClick={(e) => e.stopPropagation()}
                                                className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                        </div>
                                        <span>{formatTime(currentDuration)}</span>
                                    </div>

                                    <div className="flex items-center space-x-2 pl-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMobilePlayerMode('vintage');
                                                onToggleExpand();
                                            }}
                                            title="Open Full Player (Vintage Turntable)"
                                            className={`p-1.5 rounded-lg transition-colors ${isOcean ? 'text-[#8a8489] hover:text-blue-400 hover:bg-blue-500/10' : 'text-[#8a8489] hover:text-[#f5d0b5] hover:bg-white/5'}`}
                                        >
                                            <Disc size={17} className={isPlaying ? "animate-spin" : ""} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleExpand();
                                            }}
                                            title="Expand Full Screen Player"
                                            className={`p-1.5 rounded-lg transition-colors ${isOcean ? 'text-[#8a8489] hover:text-blue-400 hover:bg-blue-500/10' : 'text-[#8a8489] hover:text-[#f5d0b5] hover:bg-white/5'}`}
                                        >
                                            <Maximize2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsMuted(!isMuted);
                                            }}
                                            className="text-[#8a8489] hover:text-white transition-colors"
                                        >
                                            {isMuted || volume === 0 ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleQueue();
                                            }}
                                            title="Queue"
                                            className={`transition-colors ${isQueueVisible ? (isOcean ? 'text-blue-400' : 'text-[#f5d0b5]') : 'text-[#8a8489] hover:text-white'}`}
                                        >
                                            <ListMusic size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (audioRef.current) audioRef.current.pause();
                                                setIsPlaying(false);
                                                onDismiss?.();
                                            }}
                                            title="Close Player"
                                            className="p-1.5 rounded-lg text-[#8a8489] hover:text-white hover:bg-white/10 transition-colors ml-0.5"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )
                ) : null}
            </AnimatePresence>
        </>
    );
};

export default Player;