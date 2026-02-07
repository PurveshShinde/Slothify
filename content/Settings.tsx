
import React, { useState } from 'react';
import { User } from '../types';
import { LogOut, User as UserIcon, Moon, Shield, Coffee, Info, Globe, Check, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface SettingsProps {
    user: User | null;
}

const Settings: React.FC<SettingsProps> = ({ user }) => {
    const [showRecentlyPlayed, setShowRecentlyPlayed] = useState(true);
    const [showTopArtists, setShowTopArtists] = useState(true);
    const [showTopTracks, setShowTopTracks] = useState(true);

    const handleLogout = async () => {
        try {
            await axios.post('/api/auth/logout');
            window.location.reload();
        } catch (e) {
            window.location.href = '/';
        }
    };

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
        <h3 className="text-xl font-bold text-white px-2 mb-4 mt-8">{children}</h3>
    );

    const ToggleItem = ({ icon: Icon, title, subtitle, checked, onChange, colorClass = "bg-blue-600" }: any) => (
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
            <div className={`w-12 h-6 rounded-full relative transition-colors ${checked ? colorClass : 'bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${checked ? 'right-1' : 'left-1'}`} />
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 px-4">
            <h1 className="text-4xl font-black text-white px-2 mb-8">Settings</h1>

            {/* 1. Account & Authentication */}
            <div className="bg-[#111827]/60 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-sm mb-6">
                <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[#1F2937] overflow-hidden shadow-2xl flex-shrink-0">
                        {user?.images?.[0]?.url ? (
                            <img src={user.images[0].url} alt={user.display_name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                <UserIcon size={40} className="text-slate-500" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-bold text-white truncate">{user?.display_name || 'Guest User'}</h2>
                        <div className="flex items-center space-x-2 mt-1">
                            {user ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                                    Spotify Connected
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400 border border-slate-600">
                                    Not Connected
                                </span>
                            )}
                            {user?.email && <span className="text-sm text-slate-500 truncate hidden md:inline">• {user.email}</span>}
                        </div>
                    </div>
                    {user ? (
                        <button
                            onClick={handleLogout}
                            className="hidden md:flex items-center space-x-2 px-6 py-3 bg-slate-800 hover:bg-red-500/10 hover:text-red-500 text-white rounded-xl font-bold transition-all border border-white/5 hover:border-red-500/20"
                        >
                            <LogOut size={18} />
                            <span>Log out</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => window.location.href = '/api/auth/login'}
                            className="hidden md:flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-600/20"
                        >
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span>Login with Spotify</span>
                        </button>
                    )}
                </div>
                <div className="mt-6 md:hidden">
                    {user ? (
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-slate-800 hover:bg-red-500/10 hover:text-red-500 text-white rounded-xl font-bold transition-all border border-white/5 hover:border-red-500/20"
                        >
                            <LogOut size={18} />
                            <span>Log out</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => window.location.href = '/api/auth/login'}
                            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-600/20"
                        >
                            <span>Login with Spotify</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Data & Personalization - Only show if logged in */}
            {user && (
                <>
                    <SectionTitle>Data & Personalization</SectionTitle>
                    <div className="grid gap-4 md:grid-cols-2">
                        <ToggleItem
                            icon={Coffee}
                            title="Recently Played"
                            subtitle="Show on Home screen"
                            checked={showRecentlyPlayed}
                            onChange={setShowRecentlyPlayed}
                        />
                        <ToggleItem
                            icon={Coffee}
                            title="Top Artists"
                            subtitle="Show your stats"
                            checked={showTopArtists}
                            onChange={setShowTopArtists}
                        />
                        <ToggleItem
                            icon={Coffee}
                            title="Top Tracks"
                            subtitle="Show your stats"
                            checked={showTopTracks}
                            onChange={setShowTopTracks}
                        />
                    </div>
                </>
            )}

            {/* 3. Privacy & Data Usage */}
            <SectionTitle>Privacy & Data Usage</SectionTitle>
            <div className="bg-[#1F2937]/30 rounded-2xl p-6 border border-white/5">
                <div className="flex items-start space-x-4">
                    <Shield className="text-green-500 flex-shrink-0 mt-1" size={24} />
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-white text-lg">Your Data is Safe</h4>
                            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                                Nyx operates with read-only access to your public Spotify metadata. We do not store your password, audio files, or personal payment information.
                                No data is shared with third parties.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {['No Audio Playback', 'No Downloads', 'Read-Only Metadata'].map(tag => (
                                <span key={tag} className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-bold">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Integrations */}
            <SectionTitle>Integrations</SectionTitle>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-5 bg-[#1F2937]/50 rounded-2xl border border-white/5">
                    <div className="flex items-center space-x-4">
                        <div className={`p-3 ${user ? 'bg-green-500/20' : 'bg-slate-700/50'} rounded-xl`}>
                            <Globe size={20} className={user ? "text-green-500" : "text-slate-500"} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">Spotify</h4>
                            {user ? (
                                <p className="text-xs text-green-400 flex items-center gap-1"><Check size={10} /> Connected</p>
                            ) : (
                                <p className="text-xs text-slate-500">Not Connected</p>
                            )}
                        </div>
                    </div>
                    <button disabled className="px-4 py-2 bg-white/5 text-slate-500 rounded-lg text-sm font-bold cursor-not-allowed">
                        Managed
                    </button>
                </div>
                <div className="flex items-center justify-between p-5 bg-[#1F2937]/30 rounded-2xl border border-white/5 opacity-75">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-red-500/10 rounded-xl">
                            <Globe size={20} className="text-red-500/50" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-300">YouTube</h4>
                            <p className="text-xs text-slate-500">Metadata discovery only</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg text-xs font-bold">
                        Coming Soon
                    </span>
                </div>
            </div>

            {/* 6. Support the Developer */}
            <SectionTitle>Support the Developer 💙</SectionTitle>
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl p-8 border border-white/10 text-center space-y-4">
                <h3 className="text-2xl font-black text-white">Love using Nyx?</h3>
                <p className="text-slate-300 max-w-md mx-auto">
                    If you enjoy discovering music with Nyx and want to support its development, consider buying me a coffee. It helps keep the servers running!
                </p>
                <button
                    onClick={() => window.open('https://buymeacoffee.com/purvesh.dev', '_blank')} // Replace with actual link
                    className="inline-flex items-center space-x-3 px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black rounded-full font-black text-lg transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-yellow-400/20"
                >
                    <Coffee size={24} />
                    <span>Buy Me a Coffee</span>
                </button>
            </div>

            {/* 7. About */}
            <div className="text-center pt-12 pb-6 space-y-2">
                <div className="flex items-center justify-center space-x-2 text-slate-500 font-bold">
                    <Info size={16} />
                    <span>Nyx v1.0.0</span>
                </div>
                <p className="text-slate-600 text-sm">Built with React & Spotify Web API</p>
            </div>
        </div>
    );
};

export default Settings;
