import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, CheckCircle2, AlertTriangle, Smile, Heart, Sparkles, Scale } from 'lucide-react';

const Terms: React.FC = () => {
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
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#f5d0b5]/10 border border-[#f5d0b5]/20 text-[#f5d0b5] text-xs font-bold uppercase tracking-wider">
                    <Scale size={14} />
                    <span>Slothify Guidelines</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight">Terms & Conditions</h1>
                <p className="text-slate-400 text-sm md:text-base">
                    Last updated: October 2026 • The honest, friendly, and transparent guide to using Slothify.
                </p>
            </div>

            {/* Fun Highlight Banner */}
            <div className="mb-8 p-5 bg-gradient-to-r from-[#c87d46]/25 via-[#d97736]/15 to-[#f5d0b5]/10 border border-[#f5d0b5]/30 rounded-3xl shadow-xl space-y-2">
                <div className="flex items-center space-x-2 text-[#f5d0b5] font-black text-sm uppercase tracking-wider">
                    <Smile size={18} />
                    <span>The Slothify Golden Agreement</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-white leading-snug">
                    "I won't be a bitch and complain about free stuff."
                </p>
                <p className="text-xs text-[#f5d0b5]/80 leading-relaxed">
                    Slothify was built with care as a free, open-source streaming and playlist experience. We don't charge you a dime, we don't spam you with ads, and we don't sell your data. In return, all we ask is good vibes!
                </p>
            </div>

            {/* Main Terms Sections */}
            <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <CheckCircle2 size={18} className="text-[#f5d0b5] flex-shrink-0" />
                        <span>1. 100% Free Service & Community Spirit</span>
                    </h2>
                    <p>
                        Slothify is offered completely free of charge. There are no surprise trials, hidden paywalls, subscription tiers, or credit card requirements. You are free to explore, listen, search, and manage your music library without restriction.
                    </p>
                </section>

                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
                        <span>2. "As-Is" Service & Third-Party Reliability</span>
                    </h2>
                    <p>
                        Because Slothify is an open hobby project, services are provided on an <strong>"as-is" and "as-available"</strong> basis without any express or implied warranty. 
                    </p>
                    <p className="text-slate-400 text-xs">
                        Audio streams, album artworks, and metadata are dynamically queried from public community APIs and open scrapers. If a stream buffers, a track is temporarily unavailable, or a server spins down for maintenance, please be patient—our team works continuously to keep everything running smoothly.
                    </p>
                </section>

                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Shield size={18} className="text-[#f5d0b5] flex-shrink-0" />
                        <span>3. Private Accounts & Your 12-Word Passphrase</span>
                    </h2>
                    <p>
                        We respect your privacy to the absolute extreme: <strong>we never ask for or store your email address</strong>. 
                    </p>
                    <p className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                        <strong>Important:</strong> Because there is no email on file, there is no "Forgot Password via Email" button. When you create an account, you receive an emergency 12-word recovery passphrase. <strong>You are solely responsible for saving this passphrase.</strong> If you forget your password and do not have your passphrase, no one can unlock your account.
                    </p>
                </section>

                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Sparkles size={18} className="text-[#f5d0b5] flex-shrink-0" />
                        <span>4. Acceptable Fair Use</span>
                    </h2>
                    <p>
                        You agree to use Slothify in a responsible manner. Please do not flood our backend proxy servers with bots, automated scrapers, denial-of-service scripts, or excessive requests that could degrade the experience for fellow listeners.
                    </p>
                </section>

                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Heart size={18} className="text-rose-500 flex-shrink-0" />
                        <span>5. Feedback & Support</span>
                    </h2>
                    <p>
                        Have constructive suggestions, feature requests, or cool ideas? We love to hear from our community! Reach out through our official channels or support development by buying the dev a coffee.
                    </p>
                </section>
            </div>

            {/* Footer Navigation */}
            <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                <span>© {new Date().getFullYear()} Slothify Music. Made for music lovers.</span>
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors underline">
                        Privacy Policy
                    </button>
                    <button onClick={() => navigate('/')} className="hover:text-white transition-colors">
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Terms;
