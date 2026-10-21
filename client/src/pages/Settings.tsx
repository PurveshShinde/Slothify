import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import {
    User as UserIcon, Shield, Coffee, Info, Globe, Check, Trash2, Cpu, LogIn, LogOut,
    Lock, KeyRound, Headphones, Palette, Upload, RotateCcw, Image as ImageIcon,
    Sparkles, Smile, Camera, X, CheckSquare, Square, Download, ExternalLink,
    Loader2, ListMusic, CheckCircle2, ChevronRight, HelpCircle, Layers, Radio
} from 'lucide-react';
import axios from 'axios';
import { useCache } from '../context/CacheContext';
import { useTheme, AppTheme } from '../context/ThemeContext';

export interface DefaultAvatarItem {
    id: string;
    name: string;
    url: string;
}

export const DEFAULT_AVATARS: DefaultAvatarItem[] = [
    { id: 'ghost', name: 'Ghost', url: '/avatars/ghost.png' },
    { id: 'detective', name: 'Incognito', url: '/avatars/detective.png' },
    { id: 'fox', name: 'Fox', url: '/avatars/fox.png' },
    { id: 'sloth', name: 'Sloth', url: '/avatars/sloth.png' },
    { id: 'dog', name: 'Dog', url: '/avatars/dog.png' },
    { id: 'cat', name: 'Cat', url: '/avatars/cat.png' },
    { id: 'toucan', name: 'Toucan', url: '/avatars/toucan.png' },
    { id: 'dinosaur', name: 'Dino', url: '/avatars/dinosaur.png' },
    { id: 'pig', name: 'Pig', url: '/avatars/pig.png' },
    { id: 'moon', name: 'Moon Face', url: '/avatars/moon.png' },
    { id: 'blue_creature', name: 'Creature', url: '/avatars/blue_creature.png' },
    { id: 'orange_face', name: 'Profile', url: '/avatars/orange_face.png' },
];

interface SettingsProps {
    user: User | null;
    isAuthenticated?: boolean;
    onOpenAuth?: () => void;
    onLogout?: () => void;
    onDeleteAccount?: () => Promise<void> | void;
}

const Settings: React.FC<SettingsProps> = ({ user, isAuthenticated, onOpenAuth, onLogout, onDeleteAccount }) => {
    const navigate = useNavigate();
    const { clearCache, setLibraryPlaylists } = useCache();
    const { theme, setTheme, isOcean } = useTheme();
    const [showRecentlyPlayed, setShowRecentlyPlayed] = useState(true);
    const [showTopArtists, setShowTopArtists] = useState(true);
    const [showTopTracks, setShowTopTracks] = useState(true);
    const [cacheCleared, setCacheCleared] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Audio Engine & Source Selection
    const [audioProvider, setAudioProvider] = useState<'auto' | 'jiosaavn' | 'youtube'>(() => {
        return (localStorage.getItem('slothify_audio_provider') as any) || 'auto';
    });

    const handleSelectAudioProvider = (provider: 'auto' | 'jiosaavn' | 'youtube') => {
        setAudioProvider(provider);
        localStorage.setItem('slothify_audio_provider', provider);
        axios.post('/api/audio/provider', { provider }).catch(() => {});
    };

    // Spotify Account & Playlist Import State
    const [spotifyCredential, setSpotifyCredential] = useState('');
    const [spotifyLimit, setSpotifyLimit] = useState<number>(10);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [discoverError, setDiscoverError] = useState<string | null>(null);
    const [discoveredPlaylists, setDiscoveredPlaylists] = useState<Array<{
        id: string;
        name: string;
        description: string;
        image: string;
        trackCount: number;
        owner: string;
    }>>([]);
    const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());
    const [isImporting, setIsImporting] = useState(false);
    const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
    const [showHelpGuide, setShowHelpGuide] = useState(false);

    const handleDiscoverPlaylists = async (overrideLimit?: number, overrideCred?: string) => {
        setIsDiscovering(true);
        setDiscoverError(null);
        setImportSuccessMessage(null);
        try {
            const limit = overrideLimit ?? spotifyLimit;
            const credential = overrideCred !== undefined ? overrideCred : spotifyCredential;
            const res = await axios.post('/api/spotify/discover-playlists', {
                credential,
                limit
            });
            if (res.data?.playlists && Array.isArray(res.data.playlists)) {
                setDiscoveredPlaylists(res.data.playlists);
                // Initially select the first 1 or 2 so user chooses explicitly
                setSelectedPlaylistIds(new Set(res.data.playlists.slice(0, 1).map((p: any) => p.id)));
            } else {
                setDiscoveredPlaylists([]);
            }
        } catch (err: any) {
            setDiscoverError(err.response?.data?.details || err.response?.data?.error || 'Failed to discover playlists');
        } finally {
            setIsDiscovering(false);
        }
    };

    const toggleSelectPlaylist = (id: string) => {
        setSelectedPlaylistIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedPlaylistIds(new Set(discoveredPlaylists.map(p => p.id)));
    };

    const handleDeselectAll = () => {
        setSelectedPlaylistIds(new Set());
    };

    const handleImportSelected = async () => {
        if (selectedPlaylistIds.size === 0) return;
        setIsImporting(true);
        setDiscoverError(null);
        setImportSuccessMessage(null);
        const idsToImport = Array.from(selectedPlaylistIds);

        try {
            const res = await axios.post('/api/spotify/import-playlists', {
                playlistIds: idsToImport
            });

            if (res.data?.success) {
                // Fetch updated me/playlists and update global cache
                const meRes = await axios.get('/api/me/playlists');
                if (Array.isArray(meRes.data)) {
                    setLibraryPlaylists(meRes.data);
                }

                // Notify all components: Sidebar, PlaylistsPage, and Library
                window.dispatchEvent(new Event('slothify_playlists_updated'));

                setImportSuccessMessage(
                    `Successfully imported ${res.data.importedCount || idsToImport.length} playlist${idsToImport.length > 1 ? 's' : ''} into your library!`
                );
            }
        } catch (err: any) {
            setDiscoverError(err.response?.data?.details || err.response?.data?.error || 'Failed to import playlists');
        } finally {
            setIsImporting(false);
        }
    };

    // Local profile picture / avatar state (strictly client-side)
    const [localAvatar, setLocalAvatar] = useState<string>(() => {
        return localStorage.getItem('slothify_local_avatar') || '/avatars/ghost.png';
    });
    const [isCustomUpload, setIsCustomUpload] = useState<boolean>(() => {
        const saved = localStorage.getItem('slothify_local_avatar');
        return Boolean(saved && !saved.startsWith('/avatars/'));
    });
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleSelectAvatar = (url: string) => {
        setLocalAvatar(url);
        setIsCustomUpload(false);
        localStorage.setItem('slothify_local_avatar', url);
        window.dispatchEvent(new Event('slothify_avatar_changed'));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
                setLocalAvatar(dataUrl);
                setIsCustomUpload(true);
                localStorage.setItem('slothify_local_avatar', dataUrl);
                window.dispatchEvent(new Event('slothify_avatar_changed'));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleResetDefault = () => {
        handleSelectAvatar('/avatars/ghost.png');
    };

    const handleClearCache = () => {
        clearCache();
        setCacheCleared(true);
        setTimeout(() => setCacheCleared(false), 3000);
    };

    const handleConfirmDelete = async () => {
        if (!onDeleteAccount) return;
        setIsDeletingAccount(true);
        setDeleteError(null);
        try {
            await onDeleteAccount();
        } catch (err: any) {
            setDeleteError(err.response?.data?.error || 'Failed to delete account. Please try again.');
            setIsDeletingAccount(false);
        }
    };

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
        <h3 className="text-xl font-bold text-white px-2 mb-4 mt-8">{children}</h3>
    );

    const ToggleItem = ({ icon: Icon, title, subtitle, checked, onChange }: any) => (
        <div
            onClick={() => onChange(!checked)}
            className="flex items-center justify-between p-5 bg-[#1F2937]/50 rounded-2xl border border-white/5 hover:bg-[#1F2937] transition-colors cursor-pointer group"
        >
            <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl bg-slate-800 group-hover:bg-opacity-80 transition-colors`}>
                    <Icon size={20} className="text-white" />
                </div>
                <div>
                    <h4 className="font-bold text-white">{title}</h4>
                    <p className="text-xs text-slate-400">{subtitle}</p>
                </div>
            </div>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${checked ? (isOcean ? 'bg-blue-600' : 'bg-[#c87d46]') : 'bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${checked ? 'right-1' : 'left-1'}`} />
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto pb-28 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 px-4">
            <h1 className="text-3xl md:text-4xl font-black text-white px-2 mb-8 tracking-tight">Settings</h1>

            {/* 1. Account & Status */}
            <div className={`border rounded-3xl p-6 md:p-8 backdrop-blur-sm mb-6 ${
                isOcean ? 'bg-[#0f172a]/70 border-blue-500/15' : 'bg-[#111827]/60 border-white/5'
            }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center space-x-5">
                        {/* Circular Avatar with click target and camera edit badge */}
                        <div
                            onClick={() => setIsAvatarModalOpen(true)}
                            className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-2 overflow-hidden shadow-2xl flex-shrink-0 bg-slate-800 cursor-pointer group transition-all duration-200 hover:scale-105 ${
                                isOcean ? 'border-blue-500/40 hover:border-blue-400' : 'border-[#f5d0b5]/30 hover:border-[#f5d0b5]'
                            }`}
                            title="Click to change profile picture"
                        >
                            <img
                                src={localAvatar || '/avatars/ghost.png'}
                                alt={user?.display_name || 'User'}
                                className="w-full h-full object-cover rounded-full transition-transform duration-300 group-hover:scale-110"
                            />
                            {/* Hover overlay with Camera icon */}
                            <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white rounded-full">
                                <Camera size={18} className="drop-shadow" />
                                <span className="text-[10px] font-bold mt-0.5 tracking-wide">Edit</span>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl md:text-2xl font-bold text-white truncate">
                                {user?.display_name || user?.username || (isAuthenticated ? 'Slothify Member' : 'Guest Listener')}
                            </h2>
                            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                                {isAuthenticated ? (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                                        Cloud Sync Active
                                    </span>
                                ) : (
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        isOcean
                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            : 'bg-[#f5d0b5]/10 text-[#f5d0b5] border border-[#f5d0b5]/20'
                                    }`}>
                                        Local Storage Only
                                    </span>
                                )}
                                <button
                                    onClick={() => setIsAvatarModalOpen(true)}
                                    className={`text-xs font-semibold inline-flex items-center space-x-1 transition-colors hover:underline ${
                                        isOcean ? 'text-blue-400 hover:text-blue-300' : 'text-[#f5d0b5] hover:text-white'
                                    }`}
                                >
                                    <Camera size={12} />
                                    <span>Change Avatar</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {isAuthenticated ? (
                            <button
                                onClick={onLogout}
                                className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-sm font-bold transition-all"
                            >
                                <LogOut size={16} />
                                <span>Log Out</span>
                            </button>
                        ) : (
                            <button
                                onClick={onOpenAuth}
                                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${
                                    isOcean
                                        ? 'bg-[#1e293b] hover:bg-[#334155] text-blue-400 border border-blue-500/30'
                                        : 'bg-[#241c19] hover:bg-[#2e2320] text-[#f5d0b5] border border-[#f5d0b5]/25'
                                }`}
                            >
                                <LogIn size={16} />
                                <span>Log In / Sign Up</span>
                            </button>
                        )}
                        <button
                            onClick={handleClearCache}
                            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all border border-white/5"
                        >
                            <Trash2 size={16} />
                            <span>{cacheCleared ? 'Cache Cleared!' : 'Clear Cache'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Audio Engine Selection */}
            <SectionTitle>Audio Engine & Stream Source</SectionTitle>
            <div className="grid gap-4 md:grid-cols-3 mb-8">
                {/* Auto / Smart Fallback */}
                <div
                    onClick={() => handleSelectAudioProvider('auto')}
                    className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 group ${
                        audioProvider === 'auto'
                            ? isOcean
                                ? 'bg-gradient-to-br from-[#0c1836] via-[#09132b] to-[#060d1e] border-blue-500 shadow-xl shadow-blue-500/20 ring-1 ring-blue-500/50'
                                : 'bg-gradient-to-br from-[#241a16] via-[#1a120e] to-[#120c09] border-[#c87d46] shadow-xl shadow-[#c87d46]/20 ring-1 ring-[#c87d46]/50'
                            : 'bg-[#111827]/40 border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3.5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                                isOcean ? 'bg-blue-600 shadow-blue-600/30' : 'bg-[#c87d46] shadow-[#c87d46]/30'
                            }`}>
                                <Sparkles size={20} className="text-white" />
                            </div>
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h4 className="font-bold text-white text-base">Smart Auto</h4>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        Recommended
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">Tries JioSaavn 320k first, seamlessly falls back to Piped</p>
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            audioProvider === 'auto' ? (isOcean ? 'bg-blue-600 text-white' : 'bg-[#c87d46] text-white') : 'border border-white/20'
                        }`}>
                            {audioProvider === 'auto' && <Check size={14} strokeWidth={3} />}
                        </div>
                    </div>
                </div>

                {/* JioSaavn Engine */}
                <div
                    onClick={() => handleSelectAudioProvider('jiosaavn')}
                    className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 group ${
                        audioProvider === 'jiosaavn'
                            ? 'bg-gradient-to-br from-[#062c1e] via-[#041d14] to-[#02100b] border-emerald-500 shadow-xl shadow-emerald-500/20 ring-1 ring-emerald-500/50'
                            : 'bg-[#111827]/40 border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
                                <Headphones size={20} className="text-white" />
                            </div>
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h4 className="font-bold text-white text-base">JioSaavn</h4>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        320kbps CD Quality
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">Direct 320kbps master audio streams via Saavn CDN</p>
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            audioProvider === 'jiosaavn' ? 'bg-emerald-600 text-white' : 'border border-white/20'
                        }`}>
                            {audioProvider === 'jiosaavn' && <Check size={14} strokeWidth={3} />}
                        </div>
                    </div>
                </div>

                {/* Piped (YouTube Engine) */}
                <div
                    onClick={() => handleSelectAudioProvider('youtube')}
                    className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 group ${
                        audioProvider === 'youtube'
                            ? 'bg-gradient-to-br from-[#2c0b0e] via-[#1d0709] to-[#120405] border-rose-500 shadow-xl shadow-rose-500/20 ring-1 ring-rose-500/50'
                            : 'bg-[#111827]/40 border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3.5">
                            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/30">
                                <Radio size={20} className="text-white" />
                            </div>
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h4 className="font-bold text-white text-base">Piped (YouTube)</h4>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                        Direct Stream
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">Direct GoogleVideo audio streams via Piped API instances</p>
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            audioProvider === 'youtube' ? 'bg-rose-600 text-white' : 'border border-white/20'
                        }`}>
                            {audioProvider === 'youtube' && <Check size={14} strokeWidth={3} />}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Theme & Atmosphere Selection */}
            <SectionTitle>Theme & Atmosphere</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2 mb-6">
                {/* Ocean Theme (Default) Card */}
                <div
                    onClick={() => setTheme('ocean')}
                    className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 group ${
                        theme === 'ocean'
                            ? 'bg-gradient-to-br from-[#0c1836] via-[#09132b] to-[#060d1e] border-blue-500 shadow-xl shadow-blue-500/20 ring-1 ring-blue-500/50'
                            : 'bg-[#111827]/40 border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3.5">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                                <Palette size={20} className="text-white" />
                            </div>
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h4 className="font-bold text-white text-base">Ocean</h4>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        Default
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">Deep ocean blue & sea azure glow, sleek and modern</p>
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            theme === 'ocean' ? 'bg-blue-600 text-white scale-100' : 'border border-white/20 scale-90'
                        }`}>
                            {theme === 'ocean' && <Check size={14} strokeWidth={3} />}
                        </div>
                    </div>

                    {/* Preview Swatch Bar */}
                    <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-white/5">
                        <span className="text-[11px] text-slate-400">Palette:</span>
                        <div className="flex items-center space-x-1.5">
                            <div className="w-5 h-5 rounded-full bg-black border border-white/10" title="Background" />
                            <div className="w-5 h-5 rounded-full bg-[#1e40af]" title="Deep Ocean" />
                            <div className="w-5 h-5 rounded-full bg-[#2563eb]" title="Ocean Blue" />
                            <div className="w-5 h-5 rounded-full bg-[#3b82f6]" title="Sea Blue" />
                        </div>
                    </div>
                </div>

                {/* Autumn Theme Card */}
                <div
                    onClick={() => setTheme('autumn')}
                    className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 group ${
                        theme === 'autumn'
                            ? 'bg-gradient-to-br from-[#241a16] via-[#1a120e] to-[#120c09] border-[#c87d46] shadow-xl shadow-[#c87d46]/20 ring-1 ring-[#c87d46]/50'
                            : 'bg-[#111827]/40 border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3.5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#c87d46] to-[#f5d0b5] flex items-center justify-center shadow-lg shadow-[#c87d46]/30">
                                <Palette size={20} className="text-[#140f0d]" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-base">Autumn</h4>
                                <p className="text-xs text-slate-400 mt-0.5">Warm terracotta, amber & peach, cozy vintage warmth</p>
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            theme === 'autumn' ? 'bg-[#c87d46] text-white scale-100' : 'border border-white/20 scale-90'
                        }`}>
                            {theme === 'autumn' && <Check size={14} strokeWidth={3} />}
                        </div>
                    </div>

                    {/* Preview Swatch Bar */}
                    <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-white/5">
                        <span className="text-[11px] text-slate-400">Palette:</span>
                        <div className="flex items-center space-x-1.5">
                            <div className="w-5 h-5 rounded-full bg-[#0c0b0f] border border-white/10" title="Espresso Dark" />
                            <div className="w-5 h-5 rounded-full bg-[#241c19]" title="Warm Mocha" />
                            <div className="w-5 h-5 rounded-full bg-[#c87d46]" title="Terracotta" />
                            <div className="w-5 h-5 rounded-full bg-[#f5d0b5]" title="Peach" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2.5 Spotify Account & Playlist Import */}
            <SectionTitle>Spotify Account & Playlist Import</SectionTitle>
            <div className={`border rounded-3xl p-6 md:p-8 backdrop-blur-sm mb-6 transition-all duration-300 relative overflow-hidden ${
                isOcean
                    ? 'bg-gradient-to-br from-[#0c182c]/80 via-[#0a1424]/70 to-[#070e1a]/85 border-blue-500/20'
                    : 'bg-gradient-to-br from-[#1d1613]/80 via-[#17110e]/70 to-[#100b09]/85 border-white/10'
            }`}>
                {/* Subtle Spotify green ambient glow */}
                <div className="absolute -top-20 -right-20 w-52 h-52 bg-[#1DB954]/15 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-white/[0.08]">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/30 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] mr-1.5 animate-pulse" />
                                Spotube Spotify Integration
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                                Integrated alongside all your native playlists
                            </span>
                        </div>
                        <h4 className="text-xl font-bold text-white tracking-tight">
                            Import Spotify Playlists to Library
                        </h4>
                        <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
                            Discover playlists using your Spotube <code className="px-1.5 py-0.5 rounded bg-white/10 text-emerald-300 font-mono text-[11px]">sp_dc</code> cookie, Spotify token, or public playlist links. Choose exactly which playlists to import into your library.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowHelpGuide(!showHelpGuide)}
                        className="self-start inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                    >
                        <HelpCircle size={14} />
                        <span>{showHelpGuide ? 'Hide Guide' : 'How It Works'}</span>
                    </button>
                </div>

                {/* Collapsible How It Works Guide */}
                {showHelpGuide && (
                    <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3 text-xs text-slate-300 animate-in fade-in duration-200">
                        <div className="font-bold text-white flex items-center gap-1.5">
                            <Sparkles size={14} className="text-[#1DB954]" />
                            <span>Three Ways to Import:</span>
                        </div>
                        <ul className="space-y-2 pl-2">
                            <li className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center font-bold text-[10px] mt-0.5">1</span>
                                <div>
                                    <strong className="text-white">Public Playlist Links / IDs:</strong> Paste direct playlist URLs (e.g. <span className="text-emerald-300 font-mono">open.spotify.com/playlist/...</span>). You can enter multiple links separated by commas or newlines.
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center font-bold text-[10px] mt-0.5">2</span>
                                <div>
                                    <strong className="text-white">Spotube Account Cookie (<code>sp_dc</code>):</strong> Enter your Spotify <span className="text-emerald-300 font-mono">sp_dc</span> session cookie (or Spotify access token) to discover and selectively import all your private and followed playlists.
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center font-bold text-[10px] mt-0.5">3</span>
                                <div>
                                    <strong className="text-white">Instant Curated Hits:</strong> Leave the input blank or click "Quick Load Top 10 Hits" to discover curated top global playlists across all genres.
                                </div>
                            </li>
                        </ul>
                    </div>
                )}

                {/* Discovery Controls */}
                <div className="mt-6 space-y-4">
                    {/* Limit Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Number of Playlists to Discover
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            {[5, 10, 25, 50].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setSpotifyLimit(num)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                        spotifyLimit === num
                                            ? isOcean
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                : 'bg-[#c87d46] text-white shadow-lg shadow-[#c87d46]/30'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                                    }`}
                                >
                                    {num} Playlists
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Credential / URL Input */}
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Spotify Credential, Token, or Playlist URL(s)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={spotifyCredential}
                                onChange={(e) => setSpotifyCredential(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleDiscoverPlaylists();
                                }}
                                placeholder="Paste playlist URLs, sp_dc cookie, or token (or leave blank for curated hits)..."
                                className={`w-full px-4 py-3 rounded-2xl bg-black/50 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors pr-10 ${
                                    isOcean
                                        ? 'border-blue-500/20 focus:border-blue-500'
                                        : 'border-white/10 focus:border-[#f5d0b5]'
                                }`}
                            />
                            {spotifyCredential && (
                                <button
                                    onClick={() => setSpotifyCredential('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors"
                                    title="Clear"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => handleDiscoverPlaylists()}
                            disabled={isDiscovering}
                            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white transition-all shadow-lg disabled:opacity-50 ${
                                isOcean
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-600/25'
                                    : 'bg-gradient-to-r from-[#c87d46] to-[#d97736] hover:from-[#d97736] hover:to-[#e88847] shadow-[#c87d46]/25'
                            }`}
                        >
                            {isDiscovering ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Discovering Playlists...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    <span>Discover Playlists</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setSpotifyCredential('');
                                handleDiscoverPlaylists(10, '');
                            }}
                            disabled={isDiscovering}
                            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50"
                        >
                            <ListMusic size={15} />
                            <span>Quick Load Top 10 Hits</span>
                        </button>
                    </div>

                    {/* Error message */}
                    {discoverError && (
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
                            <span>{discoverError}</span>
                            <button onClick={() => setDiscoverError(null)} className="text-rose-400 hover:text-rose-200">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Discovered Playlists Interactive Checklist */}
                {discoveredPlaylists.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-white/[0.08] space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-white text-base">Select Playlists to Import</h5>
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/25">
                                        {discoveredPlaylists.length} Available
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Check only the playlists you want to import into your library.
                                </p>
                            </div>

                            <div className="flex items-center space-x-2">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                                >
                                    Select All
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeselectAll}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                                >
                                    Deselect All
                                </button>
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                    selectedPlaylistIds.size > 0
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-white/5 text-slate-400'
                                }`}>
                                    {selectedPlaylistIds.size} of {discoveredPlaylists.length} selected
                                </span>
                            </div>
                        </div>

                        {/* Playlists Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1 scrollbar-hide">
                            {discoveredPlaylists.map((pl) => {
                                const isSelected = selectedPlaylistIds.has(pl.id);
                                return (
                                    <div
                                        key={pl.id}
                                        onClick={() => toggleSelectPlaylist(pl.id)}
                                        className={`flex items-center space-x-3.5 p-3 rounded-2xl border cursor-pointer transition-all duration-200 select-none group ${
                                            isSelected
                                                ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/40'
                                                : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-black/60'
                                        }`}
                                    >
                                        {/* Checkbox */}
                                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                                            isSelected
                                                ? 'bg-emerald-500 text-black shadow-sm'
                                                : 'border border-white/20 group-hover:border-white/40'
                                        }`}>
                                            {isSelected && <Check size={14} strokeWidth={3} />}
                                        </div>

                                        {/* Artwork */}
                                        <img
                                            src={pl.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'}
                                            alt={pl.name}
                                            className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-md"
                                        />

                                        {/* Info */}
                                        <div className="min-w-0 flex-1">
                                            <h6 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                                                {pl.name}
                                            </h6>
                                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                {pl.trackCount} tracks • {pl.owner || 'Spotify'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Import Action Bar */}
                        <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs text-slate-400">
                                {selectedPlaylistIds.size === 0 ? (
                                    <span className="text-amber-400 font-semibold">
                                        ⚠️ Select at least one playlist to import.
                                    </span>
                                ) : (
                                    <span>
                                        Ready to import <strong className="text-white">{selectedPlaylistIds.size}</strong> playlist{selectedPlaylistIds.size > 1 ? 's' : ''} with full tracklists.
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleImportSelected}
                                disabled={selectedPlaylistIds.size === 0 || isImporting}
                                className={`inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl text-xs md:text-sm font-black transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed ${
                                    isImporting
                                        ? 'bg-slate-700 text-slate-300'
                                        : 'bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-emerald-500/20 active:scale-95'
                                }`}
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin text-white" />
                                        <span className="text-white">Importing Selected Playlists...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={16} />
                                        <span>Import Selected ({selectedPlaylistIds.size})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Import Success Notification */}
                {importSuccessMessage && (
                    <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 size={18} />
                            </div>
                            <div>
                                <h6 className="text-xs md:text-sm font-bold text-emerald-300">
                                    {importSuccessMessage}
                                </h6>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Your imported playlists are now available in your Playlists section, Your Library, and Sidebar alongside your other playlists.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/playlists')}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-transform active:scale-95 flex-shrink-0"
                        >
                            <span>Go to Playlists</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* 3. Architecture & Storage Info */}
            <SectionTitle>Architecture & Storage</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="p-5 bg-[#1F2937]/50 rounded-2xl border border-white/5">
                    <div className="flex items-center space-x-4 mb-2">
                        <div className={`p-3 rounded-xl ${isOcean ? 'bg-blue-500/10 text-blue-400' : 'bg-[#f5d0b5]/10 text-[#f5d0b5]'}`}>
                            <Globe size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">Public Metadata Scraper</h4>
                            <p className="text-xs text-slate-400">Spotify Embed & Open Music APIs</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        No Spotify credentials or developer tokens required. Public embed endpoints and open APIs deliver real-time playlist and track data.
                    </p>
                </div>

                <div className="p-5 bg-[#1F2937]/50 rounded-2xl border border-white/5">
                    <div className="flex items-center space-x-4 mb-2">
                        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                            <Headphones size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">High-Fidelity Audio Streaming</h4>
                            <p className="text-xs text-slate-400">Direct stream processing & Smart audio buffer</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        Audio streams directly to your browser with low-latency dynamic buffering and seamless playback across all your devices.
                    </p>
                </div>

                <div className="p-5 bg-[#1F2937]/50 rounded-2xl border border-white/5 md:col-span-2">
                    <div className="flex items-center space-x-4 mb-2">
                        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <Lock size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">Real-Time Privacy & Cloud Sync</h4>
                            <p className="text-xs text-slate-400">Built-in encryption & Private vault</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        Your playlists, liked songs, and listening history are protected with built-in encryption before syncing in real time. Your music taste stays strictly private to your account.
                    </p>
                </div>
            </div>

            {/* 3. Personalization */}
            <SectionTitle>Display & Feeds</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
                <ToggleItem
                    icon={Coffee}
                    title="Trending & Recent Tracks"
                    subtitle="Show on Home screen"
                    checked={showRecentlyPlayed}
                    onChange={setShowRecentlyPlayed}
                />
                <ToggleItem
                    icon={Coffee}
                    title="Top Artists"
                    subtitle="Show top chart artists"
                    checked={showTopArtists}
                    onChange={setShowTopArtists}
                />
                <ToggleItem
                    icon={Coffee}
                    title="Top Tracks"
                    subtitle="Show global charts"
                    checked={showTopTracks}
                    onChange={setShowTopTracks}
                />
            </div>

            {/* 4. Privacy & Data Usage */}
            <SectionTitle>Privacy & Data Usage</SectionTitle>
            <div className={`rounded-2xl p-6 border transition-all duration-300 ${
                isOcean
                    ? 'bg-[#0f172a]/50 border-blue-500/20 shadow-lg shadow-blue-500/5'
                    : 'bg-[#1F2937]/30 border-white/5'
            }`}>
                <div className="flex items-start space-x-4">
                    <Shield className={`${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} flex-shrink-0 mt-1`} size={24} />
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-white text-lg">Your Privacy is Protected</h4>
                            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                                Slothify runs completely free without tracking. No user logins or payment cards are stored. Audio and metadata are delivered through open, privacy-conscious proxy pipelines.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {['Zero Login Required', 'Client-Side Cache', 'High-Fidelity Audio', 'Real-Time Privacy', 'Ad-Free Streams'].map(tag => (
                                <span
                                    key={tag}
                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                        isOcean
                                            ? 'bg-blue-500/10 text-cyan-300 border-blue-500/25'
                                            : 'bg-[#f5d0b5]/10 text-[#f5d0b5] border-[#f5d0b5]/20'
                                    }`}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4.5 Account Danger Zone (Delete Account) */}
            {isAuthenticated && (
                <>
                    <SectionTitle>Account Danger Zone</SectionTitle>
                    <div className="bg-rose-950/20 border border-rose-500/20 rounded-3xl p-6 md:p-8 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h4 className="font-bold text-rose-400 text-lg flex items-center gap-2">
                                    <Trash2 size={20} />
                                    <span>Delete Account</span>
                                </h4>
                                <p className="text-slate-400 text-xs md:text-sm mt-1 leading-relaxed max-w-xl">
                                    Permanently delete your account along with your playlists, liked tracks, and listening history. This action is irreversible.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-600/20 flex-shrink-0"
                            >
                                Delete Account
                            </button>
                        </div>

                        {showDeleteConfirm && (
                            <div className="p-4 bg-black/60 border border-rose-500/30 rounded-2xl space-y-3 animate-in fade-in duration-200">
                                <p className="text-xs text-rose-300 font-bold">
                                    ⚠️ Are you completely sure? This will delete your username, encrypted playlists, and liked songs forever. You will not be able to recover them.
                                </p>
                                {deleteError && (
                                    <p className="text-xs text-rose-400 font-bold">{deleteError}</p>
                                )}
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={handleConfirmDelete}
                                        disabled={isDeletingAccount}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
                                    >
                                        {isDeletingAccount ? 'Deleting Forever...' : 'Yes, Permanently Delete My Account'}
                                    </button>
                                    <button
                                        onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                                        disabled={isDeletingAccount}
                                        className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 5. Support the Developer */}
            <SectionTitle>Support the Developer ☕</SectionTitle>
            <div className={`rounded-3xl p-8 border text-center space-y-4 transition-all duration-300 ${
                isOcean
                    ? 'bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-blue-950/40 border-blue-500/20 shadow-xl shadow-blue-500/5'
                    : 'bg-gradient-to-r from-[#c87d46]/20 via-[#d97736]/15 to-[#f5d0b5]/10 border-[#f5d0b5]/20 shadow-xl shadow-[#c87d46]/5'
            }`}>
                <h3 className="text-2xl font-black text-white">Love using Slothify?</h3>
                <p className="text-slate-300 max-w-md mx-auto">
                    If you enjoy discovering and streaming music with Slothify, consider supporting its open-source development!
                </p>
                <button
                    onClick={() => window.open('https://buymeacoffee.com/purvesh.dev', '_blank')}
                    className={`inline-flex items-center space-x-3 px-8 py-4 rounded-full font-black text-lg transition-transform hover:scale-105 active:scale-95 shadow-xl ${
                        isOcean
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-blue-500/25'
                            : 'bg-[#f5d0b5] hover:bg-[#ebd0bc] text-black shadow-[#f5d0b5]/20'
                    }`}
                >
                    <Coffee size={24} />
                    <span>Buy Me a Coffee</span>
                </button>
            </div>

            {/* 6. About & Legal */}
            <div className="text-center pt-12 pb-6 space-y-3">
                <div className="flex items-center justify-center space-x-4 text-xs text-slate-400">
                    <button onClick={() => navigate('/terms')} className={`underline transition-colors ${
                        isOcean ? 'hover:text-cyan-400' : 'hover:text-[#f5d0b5]'
                    }`}>
                        Terms & Conditions
                    </button>
                    <span>•</span>
                    <button onClick={() => navigate('/privacy')} className={`underline transition-colors ${
                        isOcean ? 'hover:text-cyan-400' : 'hover:text-[#f5d0b5]'
                    }`}>
                        Privacy Policy
                    </button>
                </div>
                <div className="flex items-center justify-center space-x-2 text-slate-500 font-bold">
                    <Info size={16} />
                    <span>Slothify v1.0.1</span>
                </div>
                <p className="text-slate-600 text-sm">Modular Plugin & Scraper Architecture</p>
            </div>

            {/* Avatar Selection Modal (Opens when tapping the circular profile picture) */}
            {isAvatarModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setIsAvatarModalOpen(false)}
                >
                    <div
                        className={`w-full max-w-lg rounded-3xl border p-6 md:p-7 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto ${
                            isOcean
                                ? 'bg-[#0b1329]/95 border-blue-500/30 shadow-blue-950/50'
                                : 'bg-[#181412]/95 border-white/10 shadow-black/80'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between pb-4 border-b border-white/[0.08]">
                            <div className="flex items-center space-x-3">
                                <div className={`p-2.5 rounded-2xl ${isOcean ? 'bg-blue-600/20 text-blue-400' : 'bg-[#f5d0b5]/15 text-[#f5d0b5]'}`}>
                                    <Smile size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Choose Profile Picture</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Stored locally on this device only. 100% private.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAvatarModalOpen(false)}
                                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Current Selection & Upload Options */}
                        <div className="py-5 flex flex-col sm:flex-row items-center sm:justify-between gap-4 border-b border-white/[0.08]">
                            <div className="flex items-center space-x-4">
                                <div className={`w-16 h-16 rounded-full border-2 overflow-hidden shadow-xl p-0.5 flex-shrink-0 ${
                                    isOcean ? 'border-blue-500' : 'border-[#f5d0b5]'
                                }`}>
                                    <img
                                        src={localAvatar || '/avatars/ghost.png'}
                                        alt="Current Profile"
                                        className="w-full h-full object-cover rounded-full"
                                    />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">Active Profile Picture</div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                        {isCustomUpload ? 'Custom device photo' : DEFAULT_AVATARS.find(a => a.url === localAvatar)?.name || 'Default Avatar'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                        isOcean
                                            ? 'bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30'
                                            : 'bg-[#f5d0b5]/15 hover:bg-[#f5d0b5]/25 text-[#f5d0b5] border border-[#f5d0b5]/25'
                                    }`}
                                >
                                    <Upload size={13} />
                                    <span>Upload Photo</span>
                                </button>

                                <button
                                    onClick={handleResetDefault}
                                    className="flex items-center space-x-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
                                    title="Reset to default ghost avatar"
                                >
                                    <RotateCcw size={13} />
                                </button>
                            </div>
                        </div>

                        {/* Presets Grid */}
                        <div className="pt-4">
                            <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-3 flex items-center justify-between">
                                <span>Default Avatar Icons</span>
                                <span className="text-[10px] text-slate-500">Tap to select</span>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                {DEFAULT_AVATARS.map((avatar) => {
                                    const isSelected = localAvatar === avatar.url;
                                    return (
                                        <button
                                            key={avatar.id}
                                            onClick={() => handleSelectAvatar(avatar.url)}
                                            className={`group flex flex-col items-center p-2 rounded-2xl border transition-all duration-200 select-none relative ${
                                                isSelected
                                                    ? isOcean
                                                        ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/50 scale-[1.04]'
                                                        : 'bg-[#f5d0b5]/15 border-[#f5d0b5] ring-2 ring-[#f5d0b5]/50 scale-[1.04]'
                                                    : 'bg-black/20 hover:bg-black/40 border-white/5 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden mb-1.5 shadow-md">
                                                <img
                                                    src={avatar.url}
                                                    alt={avatar.name}
                                                    className="w-full h-full object-cover rounded-full transition-transform duration-200 group-hover:scale-105"
                                                />
                                                {isSelected && (
                                                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center text-white">
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-lg ${
                                                            isOcean ? 'bg-blue-600' : 'bg-[#c87d46]'
                                                        }`}>
                                                            <Check size={11} strokeWidth={3} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`text-[11px] font-semibold truncate max-w-full ${
                                                isSelected ? 'text-white font-bold' : 'text-slate-400 group-hover:text-slate-200'
                                            }`}>
                                                {avatar.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                                <Lock size={12} className="text-emerald-400" />
                                <span>100% Local Device Storage</span>
                            </div>
                            <button
                                onClick={() => setIsAvatarModalOpen(false)}
                                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                                    isOcean ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#c87d46] hover:bg-[#d97736]'
                                }`}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
