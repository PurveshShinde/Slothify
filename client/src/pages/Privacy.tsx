import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Database, Key, Server, Check, ListMusic, History, Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Privacy: React.FC = () => {
    const navigate = useNavigate();
    const { isOcean } = useTheme();

    return (
        <div className="max-w-4xl mx-auto pb-32 animate-in fade-in duration-300 pt-6 px-4 md:px-8 text-white">
            {/* Top Navigation */}
            <button
                onClick={() => navigate(-1)}
                className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors text-sm mb-6 ${
                    isOcean ? 'hover:text-cyan-400' : 'hover:text-[#f5d0b5]'
                }`}
            >
                <ArrowLeft size={16} />
                <span>Back</span>
            </button>

            {/* Header */}
            <div className="space-y-3 mb-8 border-b border-white/10 pb-6">
                <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isOcean 
                        ? 'bg-cyan-500/10 border border-cyan-500/25 text-cyan-400' 
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                }`}>
                    <ShieldCheck size={14} />
                    <span>Real-Time Privacy & Encryption</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight">Privacy Policy</h1>
                <p className="text-slate-400 text-sm md:text-base">
                    Last updated: November 2026 • Real-time privacy, playlist cloud sync, and zero-knowledge encryption built to protect your music library.
                </p>
            </div>

            {/* Privacy Guarantee Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <EyeOff className={isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} size={24} />
                    <h3 className="font-bold text-white text-base">No Emails Required</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        We never ask for your email address, phone number, real name, or identity documents.
                    </p>
                </div>
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <Lock className={isOcean ? 'text-cyan-400' : 'text-emerald-400'} size={24} />
                    <h3 className="font-bold text-white text-base">Zero-Knowledge Encryption</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Your custom playlists and liked tracks are encrypted before saving to our MongoDB cloud store.
                    </p>
                </div>
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <Server className={isOcean ? 'text-sky-400' : 'text-amber-400'} size={24} />
                    <h3 className="font-bold text-white text-base">Zero Ad Trackers</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        No Google Analytics, Meta Pixel, cross-site trackers, commercial telemetry, or profiling cookies.
                    </p>
                </div>
            </div>

            {/* Privacy Sections */}
            <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                {/* 1. Account Info */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Key size={18} className={`${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} flex-shrink-0`} />
                        <span>1. Account Information & Pseudonymous Identity</span>
                    </h2>
                    <div className="space-y-2">
                        <p className="flex items-start space-x-2">
                            <Check size={16} className={`${isOcean ? 'text-cyan-400' : 'text-emerald-400'} mt-1 flex-shrink-0`} />
                            <span><strong>What we store for accounts:</strong> Your chosen username, a cryptographically salted & hashed password, and your 12-word recovery passphrase.</span>
                        </p>
                        <p className="flex items-start space-x-2">
                            <Check size={16} className={`${isOcean ? 'text-cyan-400' : 'text-emerald-400'} mt-1 flex-shrink-0`} />
                            <span><strong>What we NEVER ask for:</strong> No email address, no phone number, no payment or card details, no Google/Apple accounts, and no GPS location.</span>
                        </p>
                    </div>
                </section>

                {/* 2. User Playlists & Music Library Storage */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <ListMusic size={18} className={`${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} flex-shrink-0`} />
                        <span>2. Playlists, Liked Songs & Library Data Collection</span>
                    </h2>
                    <p>
                        When you use Slothify with a registered account, we collect and store the following music library data to synchronize your experience across your devices:
                    </p>
                    <ul className="space-y-2.5 pl-2">
                        <li className="flex items-start space-x-2">
                            <Check size={15} className={`${isOcean ? 'text-cyan-400' : 'text-emerald-400'} mt-1 flex-shrink-0`} />
                            <span><strong>Custom Playlists:</strong> The playlist names, descriptions, track lists, added timestamps, and cover art configurations you create.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                            <Check size={15} className={`${isOcean ? 'text-cyan-400' : 'text-emerald-400'} mt-1 flex-shrink-0`} />
                            <span><strong>Liked Songs & Favorites:</strong> Track IDs, song titles, artists, album artwork URLs, and the timestamps when you liked them.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                            <Check size={15} className={`${isOcean ? 'text-cyan-400' : 'text-emerald-400'} mt-1 flex-shrink-0`} />
                            <span><strong>Followed Artists:</strong> The artist profiles you follow to quickly navigate to their albums and track releases.</span>
                        </li>
                        <li className="flex items-start space-x-2">
                            <Check size={15} className={`${isOcean ? 'text-cyan-400' : 'text-emerald-400'} mt-1 flex-shrink-0`} />
                            <span><strong>Listening History:</strong> The 100 most recently played tracks while logged in, used solely to power your personalized home recommendations.</span>
                        </li>
                    </ul>
                    <div className={`p-3.5 rounded-xl text-xs border ${
                        isOcean 
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' 
                            : 'bg-[#c87d46]/10 border-[#c87d46]/20 text-[#f5d0b5]'
                    }`}>
                        <strong>Why we store this:</strong> This library data exists exclusively so you can access your saved music, playlists, and recommendations from any browser or device without losing your curated tracks.
                    </div>
                </section>

                {/* 3. Zero-Knowledge Encryption */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Database size={18} className={`${isOcean ? 'text-cyan-400' : 'text-emerald-400'} flex-shrink-0`} />
                        <span>3. Zero-Knowledge Encryption for Your Playlists</span>
                    </h2>
                    <p>
                        We built real-time cryptographic encryption into our backend database. Your custom playlists, playlist contents, and liked songs are automatically encrypted with AES-256-GCM using your unique account key before being committed to our cloud database.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        This guarantees strict privacy: database administrators, hosting providers, or external observers cannot inspect or snoop on the songs you like or what private playlists you create. Your music taste stays strictly between you and your headphones.
                    </p>
                </section>

                {/* 4. Listening History & Personalized Recommendations */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <History size={18} className={`${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} flex-shrink-0`} />
                        <span>4. Listening History & Recommendation Algorithm</span>
                    </h2>
                    <p>
                        Slothify records your recent playback history solely to compute your personal top artists and generate tailored "Made For You" and "Jump Back In" playlists on your Home screen.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Your listening habits are never monetized, never packaged into commercial advertising segments, and never shared with data brokers or record labels.
                    </p>
                </section>

                {/* 5. Passwords & Emergency Recovery */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <ShieldCheck size={18} className={`${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'} flex-shrink-0`} />
                        <span>5. Passwords & Emergency Recovery Passphrase</span>
                    </h2>
                    <p>
                        Passwords are never stored in plain text. Because we don't store your email, password resets can only be performed by providing your original 12-word recovery passphrase. You are solely responsible for saving this phrase upon registration.
                    </p>
                </section>

                {/* 6. Complete Data Deletion & User Autonomy */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Trash2 size={18} className="text-rose-400 flex-shrink-0" />
                        <span>6. Complete Data Deletion & User Control</span>
                    </h2>
                    <p>
                        You have absolute control over every piece of data stored in Slothify:
                    </p>
                    <ul className="space-y-1.5 text-xs text-slate-400 pl-2">
                        <li>• You can delete any individual playlist or unlike any song at any time.</li>
                        <li>• You can clear your browser cache and local storage from the Settings page.</li>
                        <li>• You can permanently delete your account using the "Delete Account" button in Settings. This completely and irreversibly purges your username, password hash, encrypted playlists, liked tracks, and listening history from our MongoDB database forever.</li>
                    </ul>
                </section>
            </div>

            {/* Footer Navigation */}
            <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                <span>© {new Date().getFullYear()} Slothify Music. Real-time privacy, playlist encryption, and zero tracking.</span>
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate('/terms')} className={`transition-colors underline ${isOcean ? 'hover:text-cyan-400' : 'hover:text-[#f5d0b5]'}`}>
                        Terms & Conditions
                    </button>
                    <button onClick={() => navigate('/')} className={`transition-colors ${isOcean ? 'hover:text-cyan-400' : 'hover:text-[#f5d0b5]'}`}>
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
