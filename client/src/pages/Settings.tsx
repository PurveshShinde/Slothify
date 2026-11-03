import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import {
    Shield, Info, Check, Trash2, LogIn, LogOut,
    Lock, Headphones, Palette, Upload, RotateCcw,
    Smile, Camera, X, Download, Loader2, ListMusic,
    CheckCircle2, ChevronRight, HelpCircle, Radio, Sparkles
} from 'lucide-react';
import axios from 'axios';
import { useCache } from '../context/CacheContext';
import { useTheme } from '../context/ThemeContext';
import { useSpotify } from '../context/SpotifyContext';
import { APP_VERSION } from '../version';

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
        axios.post('/api/audio/provider', { provider }).catch(() => { });
    };

    // Spotify Integration
    const {
        isConnected: isSpotifyConnected,
        spotifyPlaylists,
        openConnectModal,
        openImportModal,
        disconnectSpotify
    } = useSpotify();
    const [showHelpGuide, setShowHelpGuide] = useState(false);

    // Local profile picture / avatar state
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
        setTimeout(() => setCacheCleared(false), 2500);
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

    const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
        <div className="mb-3.5 pt-7 first:pt-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{title}</h2>
            {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
        </div>
    );

    const ToggleRow = ({
        title,
        subtitle,
        checked,
        onChange
    }: {
        title: string;
        subtitle: string;
        checked: boolean;
        onChange: (val: boolean) => void;
    }) => (
        <div
            onClick={() => onChange(!checked)}
            className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer select-none"
        >
            <div className="pr-4">
                <div className="text-sm font-medium text-white">{title}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{subtitle}</div>
            </div>
            <div
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 flex-shrink-0 ${checked
                    ? isOcean ? 'bg-blue-600' : 'bg-[#c87d46]'
                    : 'bg-white/10'
                    }`}
            >
                <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                />
            </div>
        </div>
    );

    const accentBorder = isOcean ? 'border-blue-500/50' : 'border-[#c87d46]/50';
    const accentBg = isOcean ? 'bg-blue-500/10' : 'bg-[#c87d46]/10';
    const accentText = isOcean ? 'text-blue-400' : 'text-[#f5d0b5]';
    const accentBtn = isOcean
        ? 'bg-blue-600 hover:bg-blue-500 text-white'
        : 'bg-[#c87d46] hover:bg-[#d97736] text-white';

    return (
        <div className="max-w-3xl mx-auto pb-24 pt-6 px-4 sm:px-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Settings</h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                    Manage your account, audio engine, and playback preferences.
                </p>
            </div>

            {/* 1. Account & Status Card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="flex items-center space-x-4">
                        {/* Avatar */}
                        <div
                            onClick={() => setIsAvatarModalOpen(true)}
                            className="relative w-14 h-14 rounded-full overflow-hidden bg-neutral-800 cursor-pointer group flex-shrink-0 border border-white/15 hover:border-white/40 transition-colors"
                            title="Click to change avatar"
                        >
                            <img
                                src={localAvatar || '/avatars/ghost.png'}
                                alt={user?.display_name || 'Profile'}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Camera size={16} />
                            </div>
                        </div>

                        {/* Name & Status */}
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                                    {user?.display_name || user?.username || (isAuthenticated ? 'Slothify Member' : 'Guest Listener')}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2.5 mt-1">
                                {isAuthenticated ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Cloud Synced
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                                        Guest Mode (Local Only)
                                    </span>
                                )}
                                <span className="text-neutral-600">•</span>
                                <button
                                    onClick={() => setIsAvatarModalOpen(true)}
                                    className={`text-xs hover:underline transition-colors ${accentText}`}
                                >
                                    Change Avatar
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                        {isAuthenticated ? (
                            <button
                                onClick={onLogout}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/30 rounded-lg bg-rose-500/5 hover:bg-rose-500/10 transition-colors"
                            >
                                <LogOut size={13} />
                                <span>Sign Out</span>
                            </button>
                        ) : (
                            <button
                                onClick={onOpenAuth}
                                className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${accentBtn}`}
                            >
                                <LogIn size={13} />
                                <span>Sign In</span>
                            </button>
                        )}
                        <button
                            onClick={handleClearCache}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <Trash2 size={13} />
                            <span>{cacheCleared ? 'Cleared' : 'Clear Cache'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Audio Engine Selection */}
            <SectionHeader
                title="Audio Engine"
                description="Choose the stream pipeline used to fetch high-bitrate music playback."
            />
            <div className="grid gap-2.5 sm:grid-cols-3 mb-2">
                {/* Smart Auto */}
                <div
                    onClick={() => handleSelectAudioProvider('auto')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${audioProvider === 'auto'
                        ? `${accentBg} ${accentBorder}`
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <Sparkles size={16} className={audioProvider === 'auto' ? accentText : 'text-neutral-400'} />
                            <span className="text-sm font-semibold text-white">Smart Auto</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${audioProvider === 'auto'
                            ? (isOcean ? 'bg-blue-600 border-blue-600' : 'bg-[#c87d46] border-[#c87d46]')
                            : 'border-white/20'
                            }`}>
                            {audioProvider === 'auto' && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                        Prefers 320kbps CD-quality audio with automatic fallback.
                    </p>
                </div>

                {/* JioSaavn */}
                <div
                    onClick={() => handleSelectAudioProvider('jiosaavn')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${audioProvider === 'jiosaavn'
                        ? `${accentBg} ${accentBorder}`
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <Headphones size={16} className={audioProvider === 'jiosaavn' ? accentText : 'text-neutral-400'} />
                            <span className="text-sm font-semibold text-white">JioSaavn</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${audioProvider === 'jiosaavn'
                            ? (isOcean ? 'bg-blue-600 border-blue-600' : 'bg-[#c87d46] border-[#c87d46]')
                            : 'border-white/20'
                            }`}>
                            {audioProvider === 'jiosaavn' && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                        Direct 320kbps audio master streams via Saavn CDN.
                    </p>
                </div>

                {/* YouTube / Piped */}
                <div
                    onClick={() => handleSelectAudioProvider('youtube')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${audioProvider === 'youtube'
                        ? `${accentBg} ${accentBorder}`
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <Radio size={16} className={audioProvider === 'youtube' ? accentText : 'text-neutral-400'} />
                            <span className="text-sm font-semibold text-white">YouTube (Piped)</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${audioProvider === 'youtube'
                            ? (isOcean ? 'bg-blue-600 border-blue-600' : 'bg-[#c87d46] border-[#c87d46]')
                            : 'border-white/20'
                            }`}>
                            {audioProvider === 'youtube' && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                        Direct streams via privacy-preserving Piped instances.
                    </p>
                </div>
            </div>

            {/* 3. Theme & Atmosphere */}
            <SectionHeader
                title="Appearance"
                description="Select the interface tone and accent palette."
            />
            <div className="grid gap-2.5 sm:grid-cols-2 mb-2">
                {/* Ocean Theme */}
                <div
                    onClick={() => setTheme('ocean')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${theme === 'ocean'
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <Palette size={16} className={theme === 'ocean' ? 'text-blue-400' : 'text-neutral-400'} />
                            <span className="text-sm font-semibold text-white">Ocean</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${theme === 'ocean' ? 'bg-blue-600 border-blue-600' : 'border-white/20'
                            }`}>
                            {theme === 'ocean' && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                    </div>
                    <p className="text-xs text-neutral-400">Deep midnight blue, crisp cyan, and sea azure accents.</p>
                    <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#050b14] border border-white/10" />
                        <span className="w-3.5 h-3.5 rounded-full bg-[#0f172a]" />
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-600" />
                        <span className="w-3.5 h-3.5 rounded-full bg-cyan-400" />
                    </div>
                </div>

                {/* Autumn Theme */}
                <div
                    onClick={() => setTheme('autumn')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${theme === 'autumn'
                        ? 'bg-[#c87d46]/10 border-[#c87d46]/50'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <Palette size={16} className={theme === 'autumn' ? 'text-[#f5d0b5]' : 'text-neutral-400'} />
                            <span className="text-sm font-semibold text-white">Autumn</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${theme === 'autumn' ? 'bg-[#c87d46] border-[#c87d46]' : 'border-white/20'
                            }`}>
                            {theme === 'autumn' && <Check size={11} className="text-white" strokeWidth={3} />}
                        </div>
                    </div>
                    <p className="text-xs text-neutral-400">Warm espresso, burnt terracotta, and soft peach tones.</p>
                    <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#0c0b0f] border border-white/10" />
                        <span className="w-3.5 h-3.5 rounded-full bg-[#241c19]" />
                        <span className="w-3.5 h-3.5 rounded-full bg-[#c87d46]" />
                        <span className="w-3.5 h-3.5 rounded-full bg-[#f5d0b5]" />
                    </div>
                </div>
            </div>

            {/* 4. Spotify Playlist Importer */}
            <SectionHeader
                title="Spotify Playlist Importer"
                description="Import public Spotify playlists, albums, or tracks directly via link (200+ songs supported). Completely session-only, zero database sync."
            />
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-2 space-y-4">
                {isSpotifyConnected ? (
                    <div className="space-y-4">
                        {/* Connected User Profile Banner */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/25">
                            <div className="flex items-center space-x-3.5">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-800 border-2 border-[#1DB954] flex-shrink-0 flex items-center justify-center">
                                    <div className="w-full h-full bg-[#1DB954] flex items-center justify-center">
                                        <svg className="w-6 h-6 text-black fill-current" viewBox="0 0 24 24">
                                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-bold text-white">Spotify Importer</h4>
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1DB954] text-black">
                                            Active
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-400 mt-0.5">
                                        {spotifyPlaylists.length} {spotifyPlaylists.length === 1 ? 'playlist' : 'playlists'} imported &bull; Active in session
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-stretch sm:self-auto">
                                <button
                                    type="button"
                                    onClick={openConnectModal}
                                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black transition-all shadow-md shadow-[#1DB954]/20 flex items-center justify-center space-x-1.5 font-display cursor-pointer"
                                >
                                    <ListMusic size={14} />
                                    <span>Import More</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={disconnectSpotify}
                                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                                    title="Clear all imported Spotify playlists"
                                >
                                    <LogOut size={13} />
                                    <span>Clear All</span>
                                </button>
                            </div>
                        </div>

                        {/* Imported Playlists Preview */}
                        {spotifyPlaylists.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-neutral-400 flex items-center justify-between">
                                    <span>Imported in this session ({spotifyPlaylists.length})</span>
                                    <button onClick={() => navigate('/library')} className="text-xs text-[#1DB954] hover:underline flex items-center space-x-1 cursor-pointer">
                                        <span>View in Library</span>
                                        <ChevronRight size={12} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                    {spotifyPlaylists.map(pl => (
                                        <div key={pl.id} onClick={() => navigate(`/playlist/${pl.id}`)} className="flex items-center space-x-2.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors border border-white/5">
                                            <img src={pl.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100'} alt="" className="w-9 h-9 rounded-lg object-cover" />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-medium text-white truncate">{pl.name}</div>
                                                <div className="text-[11px] text-neutral-400">{pl.tracks?.total || pl.tracks?.items?.length || 0} songs</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-neutral-400 flex items-start space-x-2">
                            <CheckCircle2 size={14} className="text-[#1DB954] flex-shrink-0 mt-0.5" />
                            <span>
                                <strong>Strict Non-Sync:</strong> Your imported playlists exist strictly in this browser session. Clicking Clear All immediately removes them with zero cloud database residue.
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center shadow-md shadow-[#1DB954]/25 flex-shrink-0">
                                    <svg className="w-5 h-5 text-black fill-current" viewBox="0 0 24 24">
                                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Import Spotify Playlists via Link</h4>
                                    <p className="text-xs text-neutral-400">Paste any public Spotify link to import playlists, albums, or single tracks into your library.</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={openConnectModal}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black transition-all shadow-md shadow-[#1DB954]/20 flex-shrink-0 font-display cursor-pointer"
                            >
                                Import Playlist
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Display Preferences */}
            <SectionHeader
                title="Display Feeds"
                description="Control what sections appear on your Home and Explore pages."
            />
            <div className="border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 mb-2">
                <ToggleRow
                    title="Trending & Recent Tracks"
                    subtitle="Show quick discovery items on the Home screen"
                    checked={showRecentlyPlayed}
                    onChange={setShowRecentlyPlayed}
                />
                <ToggleRow
                    title="Top Artists"
                    subtitle="Show trending chart artists on the Explore page"
                    checked={showTopArtists}
                    onChange={setShowTopArtists}
                />
                <ToggleRow
                    title="Top Tracks"
                    subtitle="Show global charts and curated tracks"
                    checked={showTopTracks}
                    onChange={setShowTopTracks}
                />
            </div>

            {/* 6. Privacy & Security */}
            <SectionHeader
                title="Privacy & Storage"
            />
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-2">
                <div className="flex items-start space-x-3.5">
                    <Shield size={18} className={`${accentText} flex-shrink-0 mt-0.5`} />
                    <div>
                        <div className="text-sm font-medium text-white">Private & Tracker-Free</div>
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                            Slothify requires no trackers, advertising cookies, or personal payment details. Private playlists and liked songs are encrypted at rest and synced exclusively to your account.
                        </p>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                            {['Zero Trackers', 'End-to-End Vault', 'Direct Proxy Stream', 'Ad-Free'].map((badge) => (
                                <span
                                    key={badge}
                                    className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/5 border border-white/10 text-neutral-300"
                                >
                                    {badge}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 7. Support the Developer */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 my-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="text-sm font-medium text-white">Support the Project</div>
                    <p className="text-xs text-neutral-400 mt-1">
                        Slothify is free and open-source. If you enjoy using it, consider supporting development!
                    </p>
                </div>
                <a
                    href="https://buymeacoffee.com/purvesh.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block transition-transform hover:scale-105 active:scale-95 self-start sm:self-auto flex-shrink-0"
                >
                    <img
                        src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                        alt="Buy Me A Coffee"
                        className="h-10 sm:h-11 w-auto rounded-xl shadow-md"
                    />
                </a>
            </div>

            {/* 8. Danger Zone (Authenticated Only) */}
            {isAuthenticated && (
                <>
                    <SectionHeader title="Danger Zone" />
                    <div className="border border-rose-500/20 bg-rose-500/[0.02] rounded-2xl p-5 mb-2 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-rose-300">Delete Account</div>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    Permanently delete your profile, playlists, and listening history.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-3.5 py-1.5 text-xs font-medium text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-500/10 transition-colors self-start sm:self-auto"
                            >
                                Delete Account
                            </button>
                        </div>

                        {showDeleteConfirm && (
                            <div className="pt-3 border-t border-rose-500/20 space-y-2.5">
                                <p className="text-xs text-rose-300 font-medium">
                                    Are you sure? This action cannot be reversed.
                                </p>
                                {deleteError && (
                                    <p className="text-xs text-rose-400 font-medium">{deleteError}</p>
                                )}
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={handleConfirmDelete}
                                        disabled={isDeletingAccount}
                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                        {isDeletingAccount ? 'Deleting...' : 'Yes, Delete Permanently'}
                                    </button>
                                    <button
                                        onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                                        disabled={isDeletingAccount}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 9. Footer & Legal */}
            <div className="text-center pt-8 pb-4 space-y-2 text-xs text-neutral-500">
                <div className="flex items-center justify-center space-x-3">
                    <button onClick={() => navigate('/terms')} className="hover:text-neutral-300 transition-colors">
                        Terms & Conditions
                    </button>
                    <span>•</span>
                    <button onClick={() => navigate('/privacy')} className="hover:text-neutral-300 transition-colors">
                        Privacy Policy
                    </button>
                </div>
                <div className="flex items-center justify-center space-x-1.5">
                    <Info size={13} />
                    <span>Slothify v{APP_VERSION}</span>
                </div>
            </div>

            {/* Avatar Selection Modal */}
            {isAvatarModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
                    onClick={() => setIsAvatarModalOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121214] p-5 shadow-2xl relative max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                            <div className="flex items-center space-x-2">
                                <Smile size={18} className={accentText} />
                                <h3 className="text-sm font-semibold text-white">Choose Profile Avatar</h3>
                            </div>
                            <button
                                onClick={() => setIsAvatarModalOpen(false)}
                                className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Current & Upload */}
                        <div className="py-4 flex items-center justify-between border-b border-white/10">
                            <div className="flex items-center space-x-3">
                                <img
                                    src={localAvatar || '/avatars/ghost.png'}
                                    alt="Current"
                                    className="w-12 h-12 rounded-full object-cover border border-white/20 bg-neutral-800"
                                />
                                <div>
                                    <div className="text-xs font-semibold text-white">Active Avatar</div>
                                    <div className="text-[11px] text-neutral-400">
                                        {isCustomUpload ? 'Custom upload' : DEFAULT_AVATARS.find(a => a.url === localAvatar)?.name || 'Default'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-1.5">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors"
                                >
                                    <Upload size={12} />
                                    <span>Upload</span>
                                </button>
                                <button
                                    onClick={handleResetDefault}
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                    title="Reset to default"
                                >
                                    <RotateCcw size={13} />
                                </button>
                            </div>
                        </div>

                        {/* Avatar Grid */}
                        <div className="pt-3.5">
                            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-2.5">
                                Presets
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                                {DEFAULT_AVATARS.map((avatar) => {
                                    const isSelected = localAvatar === avatar.url;
                                    return (
                                        <button
                                            key={avatar.id}
                                            onClick={() => handleSelectAvatar(avatar.url)}
                                            className={`p-1.5 rounded-xl border flex flex-col items-center transition-all ${isSelected
                                                ? `${accentBg} ${accentBorder}`
                                                : 'border-transparent hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                                                }`}
                                        >
                                            <div className="relative w-11 h-11 rounded-full overflow-hidden mb-1">
                                                <img
                                                    src={avatar.url}
                                                    alt={avatar.name}
                                                    className="w-full h-full object-cover"
                                                />
                                                {isSelected && (
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                        <Check size={13} className="text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-neutral-400 truncate max-w-full">
                                                {avatar.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
                            <div className="flex items-center space-x-1 text-[11px] text-neutral-500">
                                <Lock size={11} className="text-emerald-400" />
                                <span>Stored locally</span>
                            </div>
                            <button
                                onClick={() => setIsAvatarModalOpen(false)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${accentBtn}`}
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
