import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

    // Filter smart suggestions to exclude any track already in the queue or currently playing
    const displayedSuggestions = useMemo(() => {
        const queuedIdSet = new Set<string>();
        const queuedKeySet = new Set<string>();

        const normalizeStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        if (currentTrack) {
            queuedIdSet.add(currentTrack.id);
            queuedKeySet.add(`${normalizeStr(currentTrack.name)}_${normalizeStr(currentTrack.artists?.[0]?.name)}`);
        }

        for (const t of queue) {
            if (t?.id) queuedIdSet.add(t.id);
            queuedKeySet.add(`${normalizeStr(t?.name)}_${normalizeStr(t?.artists?.[0]?.name)}`);
        }

        return smartSuggestions.filter(t => {
            if (!t || !t.id) return false;
            if (queuedIdSet.has(t.id)) return false;
            const key = `${normalizeStr(t.name)}_${normalizeStr(t.artists?.[0]?.name)}`;
            if (queuedKeySet.has(key)) return false;
            return true;
        });
    }, [smartSuggestions, queue, currentTrack]);

    const upcomingTracks = useMemo(() => {
        if (!currentTrack) return queue;
        return queue.filter(t => t.id !== currentTrack.id);
    }, [queue, currentTrack]);

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
        // If queue has ended or only 1 song, pick top smart suggestion (excluding queued tracks)
        if (displayedSuggestions.length > 0) {
            return displayedSuggestions[0];
        }
        return null;
    }, [currentTrack, queue, repeatMode, displayedSuggestions]);

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

        // If at end of queue, play top smart mood suggestion (excluding queued tracks)
        if (displayedSuggestions.length > 0) {
            const nextSuggestion = displayedSuggestions[0];
            if (onQueueChange) {
                onQueueChange([...queue, nextSuggestion]);
            }
            onTrackChange(nextSuggestion);
        }
    }, [currentTrack, queue, isShuffle, displayedSuggestions, onTrackChange, onQueueChange]);

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
            <AnimatePresence>
                {isQueueVisible && (
                    <>
                        {/* Backdrop Overlay with z-[190] so it sits cleanly on top of the z-[150] Full Player */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={onToggleQueue}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[190]"
                        />

                        {/* Slide-out Drawer with z-[200] so it appears on top of the Full Player */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className={`fixed inset-y-0 right-0 w-full sm:w-[420px] backdrop-blur-3xl z-[200] flex flex-col shadow-2xl ${
                                isOcean
                                    ? 'bg-[#050c1b]/95 border-l border-white/[0.08] text-white'
                                    : 'bg-[#120804]/95 border-l border-white/[0.08] text-white'
                            }`}
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] flex-shrink-0">
                                <div className="flex items-center space-x-2.5">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                        isOcean ? 'bg-blue-500/15 text-blue-400' : 'bg-[#f5d0b5]/15 text-[#f5d0b5]'
                                    }`}>
                                        <ListMusic size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white tracking-tight font-display">Play Queue</h2>
                                        <p className="text-[11px] text-slate-400">
                                            {upcomingTracks.length} upcoming {upcomingTracks.length === 1 ? 'track' : 'tracks'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {upcomingTracks.length > 0 && onQueueChange && currentTrack && (
                                        <button
                                            onClick={() => onQueueChange([currentTrack])}
                                            className="text-[11px] font-medium text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
                                            title="Clear upcoming tracks from queue"
                                        >
                                            Clear
                                        </button>
                                    )}
                                    <button
                                        onClick={onToggleQueue}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
                                        title="Close queue"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Scrollable Content */}
                            <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5 scrollbar-hide">
                                {/* Now Playing Section */}
                                {currentTrack && (
                                    <div className="space-y-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1 font-display">
                                            Now Playing
                                        </span>
                                        <div className={`flex items-center space-x-3.5 p-3 rounded-2xl border transition-all ${
                                            isOcean
                                                ? 'bg-blue-950/20 border-blue-500/20 shadow-[0_4px_24px_rgba(3,10,25,0.4)]'
                                                : 'bg-[#24130b]/20 border-[#f5d0b5]/15 shadow-[0_4px_24px_rgba(15,7,3,0.4)]'
                                        }`}>
                                            <img
                                                src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                                                className="w-12 h-12 rounded-xl object-cover shadow-md flex-shrink-0"
                                                alt=""
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-white truncate leading-snug">
                                                    {currentTrack.name}
                                                </h4>
                                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                                    {currentTrack.artists[0]?.name}
                                                </p>
                                            </div>
                                            {/* Calm Soundwave Equalizer Indicator */}
                                            <div className="flex items-end space-x-0.5 h-3.5 px-1 flex-shrink-0" title="Playing">
                                                <span className={`w-0.5 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'} ${isPlaying ? 'animate-pulse' : 'h-1.5'}`} style={{ height: isPlaying ? '100%' : '30%' }} />
                                                <span className={`w-0.5 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'} ${isPlaying ? 'animate-pulse' : 'h-3'}`} style={{ height: isPlaying ? '60%' : '70%', animationDelay: '0.15s' }} />
                                                <span className={`w-0.5 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'} ${isPlaying ? 'animate-pulse' : 'h-2'}`} style={{ height: isPlaying ? '80%' : '50%', animationDelay: '0.3s' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Up Next Section */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">
                                            Up Next
                                        </span>
                                        {upcomingTracks.length > 0 && (
                                            <span className="text-[11px] text-slate-500 font-mono">
                                                {upcomingTracks.length}
                                            </span>
                                        )}
                                    </div>

                                    {upcomingTracks.length === 0 ? (
                                        <div className="py-6 px-4 text-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01]">
                                            <p className="text-xs font-medium text-slate-400">Queue is empty</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Add tracks from recommendations below</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {upcomingTracks.map((t, idx) => (
                                                <div
                                                    key={`${t.id}_${idx}`}
                                                    className={`flex items-center space-x-3 p-2 rounded-xl group transition-all ${
                                                        isOcean ? 'hover:bg-blue-950/30' : 'hover:bg-white/[0.05]'
                                                    }`}
                                                >
                                                    <div
                                                        onClick={() => onTrackChange(t)}
                                                        className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                                                    >
                                                        <span className="text-[11px] font-mono text-slate-500 w-4 text-center flex-shrink-0 group-hover:hidden">
                                                            {idx + 1}
                                                        </span>
                                                        <Play size={12} fill="currentColor" className="text-white w-4 text-center flex-shrink-0 hidden group-hover:block" />
                                                        <img
                                                            src={t.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                                                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow-sm"
                                                            alt=""
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white truncate transition-colors">
                                                                {t.name}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                                {t.artists[0]?.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {onQueueChange && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newQueue = queue.filter(item => item.id !== t.id);
                                                                onQueueChange(newQueue);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-all"
                                                            title="Remove from queue"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Calm Autoplay Recommendations Section */}
                                <div className="space-y-2 pt-2">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center space-x-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${isOcean ? 'bg-blue-400' : 'bg-[#f5d0b5]'}`} />
                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest font-display">
                                                Recommended For You
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.06]">
                                            Autoplay
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 px-1">
                                        Similar to <span className={`font-semibold ${isOcean ? 'text-blue-300' : 'text-[#f5d0b5]'}`}>{currentTrack?.name}</span>
                                    </p>

                                    {isLoadingSuggestions ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 size={18} className={`animate-spin ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`} />
                                        </div>
                                    ) : displayedSuggestions.length === 0 ? (
                                        <div className="py-5 px-4 text-center rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                            <p className="text-[11px] text-slate-400">All recommended tracks are in your queue</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {displayedSuggestions.map((t) => (
                                                <div
                                                    key={t.id}
                                                    className={`flex items-center justify-between p-2 rounded-xl group transition-all ${
                                                        isOcean ? 'hover:bg-blue-950/30' : 'hover:bg-white/[0.05]'
                                                    }`}
                                                >
                                                    <div
                                                        onClick={() => onTrackChange(t)}
                                                        className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                                                    >
                                                        <img
                                                            src={t.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=100'}
                                                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow-sm"
                                                            alt=""
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white truncate transition-colors">
                                                                {t.name}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                                {t.artists[0]?.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (onQueueChange) {
                                                                onQueueChange([...queue, t]);
                                                            }
                                                        }}
                                                        className={`p-1.5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center space-x-1 ${
                                                            isOcean
                                                                ? 'hover:bg-blue-600/30 hover:text-blue-300'
                                                                : 'hover:bg-[#f5d0b5]/20 hover:text-[#f5d0b5]'
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
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

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
                            {/* Ocean Scenery Layer */}
                            <div
                                className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ease-out will-change-transform ${
                                    isOcean ? 'opacity-70 scale-100' : 'opacity-0 scale-[1.08]'
                                }`}
                                style={{
                                    backgroundImage: "url('/Ocean.jpg')",
                                    imageRendering: '-webkit-optimize-contrast' as any,
                                    filter: 'contrast(1.05) saturate(1.1)',
                                    backfaceVisibility: 'hidden',
                                    WebkitBackfaceVisibility: 'hidden',
                                }}
                            />
                            {/* Autumn Scenery Layer */}
                            <div
                                className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ease-out will-change-transform ${
                                    !isOcean ? 'opacity-85 scale-[1.08]' : 'opacity-0 scale-100'
                                }`}
                                style={{
                                    backgroundImage: "url('/Autumn.jpg')",
                                    imageRendering: '-webkit-optimize-contrast' as any,
                                    filter: 'contrast(1.1) saturate(1.15) brightness(0.95)',
                                    backfaceVisibility: 'hidden',
                                    WebkitBackfaceVisibility: 'hidden',
                                }}
                            />
                            <div
                                className={`absolute inset-0 transition-colors duration-700 ease-out ${isOcean
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

                                <header className="flex items-center justify-between h-11 mb-1 px-1 select-none flex-shrink-0">
                                    <button
                                        onClick={onToggleExpand}
                                        className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                                        title="Minimize player"
                                    >
                                        <ChevronDown size={24} className="md:hidden" />
                                        <Minimize2 size={20} className="hidden md:inline" />
                                    </button>

                                    {/* Style Switcher: Mobile Only; Windows/Desktop is strictly dedicated to Vintage */}
                                    <div className={`md:hidden relative flex items-center p-0.5 rounded-full border backdrop-blur-md transition-colors ${
                                        isOcean ? 'bg-black/40 border-blue-500/20' : 'bg-black/40 border-[#f5d0b5]/20'
                                    }`}>
                                        <button
                                            onClick={() => {
                                                setMobilePlayerMode('normal');
                                                try { localStorage.setItem('slothify_mobile_player_style', 'normal'); } catch { }
                                            }}
                                            className={`relative z-10 flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold font-display transition-colors ${
                                                mobilePlayerMode === 'normal'
                                                    ? isOcean
                                                        ? 'text-white'
                                                        : 'text-black'
                                                    : isOcean
                                                        ? 'text-slate-400 hover:text-white'
                                                        : 'text-stone-400 hover:text-white'
                                            }`}
                                        >
                                            {mobilePlayerMode === 'normal' && (
                                                <motion.div
                                                    layoutId="mobile-player-style-pill"
                                                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                                    className={`absolute inset-0 rounded-full shadow-md -z-10 ${
                                                        isOcean
                                                            ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.55)]'
                                                            : 'bg-[#f5d0b5] shadow-[0_0_12px_rgba(245,208,181,0.35)]'
                                                    }`}
                                                />
                                            )}
                                            <Music2 size={12} />
                                            <span>Normal</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setMobilePlayerMode('vintage');
                                                try { localStorage.setItem('slothify_mobile_player_style', 'vintage'); } catch { }
                                            }}
                                            className={`relative z-10 flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold font-display transition-colors ${
                                                mobilePlayerMode === 'vintage'
                                                    ? isOcean
                                                        ? 'text-white'
                                                        : 'text-black'
                                                    : isOcean
                                                        ? 'text-slate-400 hover:text-white'
                                                        : 'text-stone-400 hover:text-white'
                                            }`}
                                        >
                                            {mobilePlayerMode === 'vintage' && (
                                                <motion.div
                                                    layoutId="mobile-player-style-pill"
                                                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                                    className={`absolute inset-0 rounded-full shadow-md -z-10 ${
                                                        isOcean
                                                            ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.55)]'
                                                            : 'bg-[#f5d0b5] shadow-[0_0_12px_rgba(245,208,181,0.35)]'
                                                    }`}
                                                />
                                            )}
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
                                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 ${
                                            isQueueVisible
                                                ? isOcean
                                                    ? 'text-blue-400 bg-blue-500/20 ring-1 ring-blue-500/40 shadow-[0_0_12px_rgba(37,99,235,0.3)]'
                                                    : 'text-[#f5d0b5] bg-[#f5d0b5]/20 ring-1 ring-[#f5d0b5]/40 shadow-[0_0_12px_rgba(245,208,181,0.2)]'
                                                : 'text-white/80 hover:text-white hover:bg-white/10'
                                        }`}
                                        title="Play Queue"
                                    >
                                        <ListMusic size={20} />
                                    </button>
                                </header>
                            </div>

                            {/* Main Body: Stacked on Mobile, 2-Column Side-by-Side (CD on Left, UI on Right) on Desktop/Windows */}
                            <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center justify-center md:justify-around lg:justify-between max-w-6xl mx-auto w-full px-2 sm:px-6 md:px-8 py-2 md:py-4 gap-4 md:gap-8 lg:gap-14 select-none relative z-10 overflow-y-auto md:overflow-hidden">
                                {/* LEFT SIDE: CD / VINYL TURNTABLE & LIVE WAVEFORM */}
                                <div className="w-full md:w-1/2 flex flex-col items-center justify-center flex-shrink-0 my-auto">
                                    {/* Desktop is ALWAYS Vintage; Mobile uses normal only if chosen */}
                                    <AnimatePresence mode="wait">
                                        {isMobile && mobilePlayerMode === 'normal' ? (
                                            <motion.div
                                                key="mobile-normal-art"
                                                layoutId="player-shared-artwork"
                                                transition={springTransition}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                                className={`relative w-full max-w-[min(34vh,240px)] sm:max-w-[min(44vh,340px)] aspect-square flex items-center justify-center select-none flex-shrink-0 shadow-[0_20px_50px_rgba(0,0,0,0.85)] rounded-2xl overflow-hidden border ${
                                                    isOcean ? 'border-blue-500/20' : 'border-[#f5d0b5]/15'
                                                }`}
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
                                            <motion.div
                                                key="mobile-vintage-art"
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                                className="relative w-full max-w-[min(34vh,240px)] sm:max-w-[min(44vh,340px)] md:max-w-[min(55vh,420px)] lg:max-w-[min(65vh,460px)] aspect-square rounded-full flex items-center justify-center select-none flex-shrink-0 isolate"
                                            >
                                                {/* Pure Circular Depth Shadow: Static, non-rotating, 100% radial with zero square box edges */}
                                                <div
                                                    aria-hidden="true"
                                                    className="absolute inset-1 rounded-full pointer-events-none select-none -z-10"
                                                    style={{
                                                        background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.6) 65%, transparent 88%)',
                                                        filter: 'blur(20px)',
                                                        transform: 'translateY(14px)',
                                                    }}
                                                />
                                                <div
                                                    aria-hidden="true"
                                                    className="absolute inset-0 rounded-full pointer-events-none select-none -z-10"
                                                    style={{
                                                        background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.7) 60%, transparent 75%)',
                                                        filter: 'blur(8px)',
                                                        transform: 'translateY(8px)',
                                                    }}
                                                />

                                                {/* Outer vinyl platter smoothly dissolves on exit */}
                                                <div
                                                    onClick={togglePlay}
                                                    className={`w-full h-full rounded-full aspect-square bg-[#0a0a0d] border relative overflow-hidden flex items-center justify-center cursor-pointer select-none ${
                                                        isOcean ? 'border-blue-500/20' : 'border-[#f5d0b5]/15'
                                                    } ${isPlaying ? 'spin-vinyl' : 'spin-vinyl-paused'}`}
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
                                                    <div
                                                        className="relative w-[38%] h-[38%] rounded-full overflow-hidden border-2 border-black/80 shadow-2xl flex items-center justify-center pointer-events-none"
                                                    >
                                                        <img
                                                            src={currentTrack.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=300'}
                                                            alt={currentTrack.name}
                                                            className="w-full h-full object-cover rounded-full pointer-events-none"
                                                        />
                                                        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                                                        <div className={`absolute w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#121215] border shadow-md flex items-center justify-center ${
                                                            isOcean ? 'border-blue-400/30' : 'border-[#f5d0b5]/30'
                                                        }`}>
                                                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

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