import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Database, Key, Server, Check } from 'lucide-react';

const Privacy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto pb-32 animate-in fade-in duration-300 pt-6 px-4 md:px-8 text-white">
            {/* Top Navigation */}
            <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-sm mb-6"
            >
                <ArrowLeft size={16} />
                <span>Back</span>
            </button>

            {/* Header */}
            <div className="space-y-3 mb-8 border-b border-white/10 pb-6">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <ShieldCheck size={14} />
                    <span>Real-Time Privacy & Encryption</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight">Privacy Policy</h1>
                <p className="text-slate-400 text-sm md:text-base">
                    Last updated: October 2026 • Real-time privacy and encryption are built in to protect your music experience.
                </p>
            </div>

            {/* Privacy Guarantee Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <EyeOff className="text-[#f5d0b5]" size={24} />
                    <h3 className="font-bold text-white text-base">No Emails Required</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        We never ask for your email address, phone number, real name, or identity documents.
                    </p>
                </div>
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <Lock className="text-emerald-400" size={24} />
                    <h3 className="font-bold text-white text-base">Real-Time Encryption</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Your liked tracks and private playlists are encrypted in real time before syncing to the cloud.
                    </p>
                </div>
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                    <Server className="text-amber-400" size={24} />
                    <h3 className="font-bold text-white text-base">Zero Ad Trackers</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        No Google Analytics, Meta Pixel, cross-site trackers, or advertising telemetry.
                    </p>
                </div>
            </div>

            {/* Privacy Sections */}
            <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Key size={18} className="text-[#f5d0b5] flex-shrink-0" />
                        <span>1. What We Collect (And What We Don't)</span>
                    </h2>
                    <div className="space-y-2">
                        <p className="flex items-start space-x-2">
                            <Check size={16} className="text-emerald-400 mt-1 flex-shrink-0" />
                            <span><strong>What we store:</strong> Your chosen username, a secure cryptographic hash of your password, and your 12-word recovery passphrase.</span>
                        </p>
                        <p className="flex items-start space-x-2">
                            <Check size={16} className="text-emerald-400 mt-1 flex-shrink-0" />
                            <span><strong>What we NEVER ask for:</strong> No email address, no payment or card info, no phone number, and no GPS location tracking.</span>
                        </p>
                    </div>
                </section>

                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Database size={18} className="text-[#f5d0b5] flex-shrink-0" />
                        <span>2. Real-Time Privacy & Built-In Encryption</span>
                    </h2>
                    <p>
                        We built real-time data encryption directly into Slothify. When you save a liked song, build a custom playlist, or stream music, your data is automatically scrambled and encrypted before being saved.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        This guarantees real-time privacy: no one on our servers can inspect or snoop on what songs you like or what playlists you create. Your music taste stays strictly between you and your headphones.
                    </p>
                </section>

                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <ShieldCheck size={18} className="text-[#f5d0b5] flex-shrink-0" />
                        <span>3. Passwords & Emergency Recovery</span>
                    </h2>
                    <p>
                        Passwords and 12-word passphrases are never stored in plain text. Because we don't store your email, password resets can only be performed by providing your original 12-word recovery passphrase.
                    </p>
                </section>

                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Lock size={18} className="text-[#f5d0b5] flex-shrink-0" />
                        <span>4. Browser Cache & Local Storage</span>
                    </h2>
                    <p>
                        Slothify saves your login session and cached music in your browser's local memory to provide fast navigation. You can clear this cache at any time through the Settings page with a single click.
                    </p>
                </section>
            </div>

            {/* Footer Navigation */}
            <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                <span>© {new Date().getFullYear()} Slothify Music. Real-time privacy and encryption.</span>
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors underline">
                        Terms & Conditions
                    </button>
                    <button onClick={() => navigate('/')} className="hover:text-white transition-colors">
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
