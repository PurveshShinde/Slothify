import React, { useState } from 'react';
import { X, Lock, User, Key, Download, Copy, Check, AlertTriangle, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import axios from 'axios';
import BrandLogo from './BrandLogo';
import { useTheme } from '../context/ThemeContext';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthSuccess: (token: string, user: any) => void;
    initialMode?: 'login' | 'register';
}

type ModalTab = 'login' | 'register' | 'recovery_key_reveal' | 'forgot_password';

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen, onClose, onAuthSuccess, initialMode = 'login'
}) => {
    const { isOcean } = useTheme();
    const [tab, setTab] = useState<ModalTab>(initialMode);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreedToFun, setAgreedToFun] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [recoveryPassphrase, setRecoveryPassphrase] = useState('');

    // State for newly registered account
    const [generatedPassphrase, setGeneratedPassphrase] = useState('');
    const [pendingToken, setPendingToken] = useState('');
    const [pendingUser, setPendingUser] = useState<any>(null);
    const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Whenever modal opens or mode changes, always reset tab to initialMode (login or register)
    React.useEffect(() => {
        if (isOpen) {
            setTab(initialMode);
            setError(null);
            setUsername('');
            setPassword('');
            setConfirmPassword('');
            setAgreedToFun(false);
            setAgreedToTerms(false);
            setRecoveryPassphrase('');
            setNewPassword('');
            setHasConfirmedSaved(false);
            setIsCopied(false);
        }
    }, [isOpen, initialMode]);

    if (!isOpen) return null;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const res = await axios.post('/api/auth/login', { username, password });
            onAuthSuccess(res.data.token, res.data.user);
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please check your username and password.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match. Please ensure both passwords match.');
            return;
        }

        if (!agreedToFun) {
            setError('Please tick the checkbox confirming you will not complain about free stuff.');
            return;
        }

        if (!agreedToTerms) {
            setError('Please tick the checkbox to agree to the Terms & Conditions and Privacy Policy.');
            return;
        }

        setIsLoading(true);

        try {
            const res = await axios.post('/api/auth/register', { username, password });
            setGeneratedPassphrase(res.data.recoveryPassphrase);
            setPendingToken(res.data.token);
            setPendingUser(res.data.user);
            setTab('recovery_key_reveal');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed. Username may already be in use.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRecover = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const res = await axios.post('/api/auth/recover', {
                username,
                recoveryPassphrase,
                newPassword
            });
            onAuthSuccess(res.data.token, res.data.user);
            alert('Password reset successfully! Your account is now unlocked.');
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Recovery failed. Please check your username and 12-word passphrase.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadKey = () => {
        const text = `SLOTHIFY EMERGENCY ACCOUNT RECOVERY KEY
=========================================
Username: ${username}
Generated: ${new Date().toISOString()}

12-WORD RECOVERY PASSPHRASE:
${generatedPassphrase}

IMPORTANT NOTICE:
- Slothify does not ask for or store your email address.
- There is NO "Forgot Password" link via email.
- This 12-word passphrase is the ONLY way to unlock your account if you forget your password.
- Keep this file in a safe, offline location.
`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slothify-recovery-key-${username.toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopyPassphrase = () => {
        navigator.clipboard.writeText(generatedPassphrase);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
    };

    const handleFinishRegistration = () => {
        if (!hasConfirmedSaved) {
            setError('Please confirm that you have saved your recovery passphrase before continuing.');
            return;
        }
        onAuthSuccess(pendingToken, pendingUser);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative text-white">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                >
                    <X size={20} />
                </button>

                {/* 1. LOGIN TAB */}
                {tab === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="text-center space-y-2 pt-1">
                            <div className="flex justify-center mb-1">
                                <BrandLogo size="lg" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-white">Sign In to Slothify</h2>
                            <p className="text-xs text-slate-400">Access and sync your private encrypted music library</p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center space-x-2">
                                <AlertTriangle size={16} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Username</label>
                                <div className="relative">
                                     <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        className={`w-full bg-[#1e1e1e] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none ${isOcean ? 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' : 'focus:border-[#c87d46]'}`}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider">Password</label>
                                    <button
                                        type="button"
                                        onClick={() => { setError(null); setTab('forgot_password'); }}
                                        className={`text-xs hover:underline ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`}
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className={`w-full bg-[#1e1e1e] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none ${isOcean ? 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' : 'focus:border-[#c87d46]'}`}
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3.5 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 ${isOcean ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25' : 'bg-[#f5d0b5] hover:bg-white text-[#140f0d] shadow-black/30'}`}
                        >
                            {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <span>Log In</span>}
                        </button>

                        <div className="text-center pt-2">
                            <span className="text-xs text-stone-400">Don't have an account? </span>
                            <button
                                type="button"
                                onClick={() => { setError(null); setTab('register'); }}
                                className={`text-xs font-bold hover:underline ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`}
                            >
                                Create an account
                            </button>
                        </div>
                    </form>
                )}

                {/* 2. REGISTER TAB */}
                {tab === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-5">
                        <div className="text-center space-y-2">
                            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${isOcean ? 'bg-blue-500/15 text-blue-400' : 'bg-[#c87d46]/15 text-[#f5d0b5]'}`}>
                                <Lock size={24} />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight">Create Account</h2>
                            <p className="text-xs text-stone-400">Access and sync your private playlists</p>
                        </div>

                        {/* No-Email Warning */}
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 space-y-1">
                            <div className="flex items-center space-x-2 font-bold">
                                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                                <span>No Email Required</span>
                            </div>
                            <p className="text-[11px] text-amber-200/80 leading-relaxed">
                                We never ask for your email address. Because of this, there is no email password reset. You will receive an emergency 12-word recovery passkey on the next step.
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center space-x-2">
                                <AlertTriangle size={16} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-1.5">Username</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                                    <input
                                        type="text"
                                        required
                                        minLength={3}
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        className={`w-full bg-[#1e1e1e] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none ${isOcean ? 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' : 'focus:border-[#c87d46]'}`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-1.5">Password</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className={`w-full bg-[#1e1e1e] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none ${isOcean ? 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' : 'focus:border-[#c87d46]'}`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-1.5">Confirm Password</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm your password"
                                        className={`w-full bg-[#1e1e1e] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none ${isOcean ? 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30' : 'focus:border-[#c87d46]'}`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 1. Fun Part Tick */}
                        <div className="flex items-start space-x-2.5 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                            <input
                                type="checkbox"
                                id="funCheckbox"
                                checked={agreedToFun}
                                onChange={(e) => {
                                    setAgreedToFun(e.target.checked);
                                    if (e.target.checked) setError(null);
                                }}
                                className={`mt-0.5 rounded border-white/20 bg-white/5 w-4 h-4 cursor-pointer flex-shrink-0 ${isOcean ? 'accent-blue-500 text-blue-500 focus:ring-blue-500' : 'accent-[#c87d46] text-[#c87d46] focus:ring-[#c87d46]'}`}
                            />
                            <label htmlFor="funCheckbox" className="text-xs text-stone-300 select-none cursor-pointer leading-relaxed">
                                I won't be a bitch and complain about free stuff
                            </label>
                        </div>

                        {/* 2. Terms and Conditions Tick */}
                        <div className="flex items-start space-x-2.5 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                            <input
                                type="checkbox"
                                id="termsCheckbox"
                                checked={agreedToTerms}
                                onChange={(e) => {
                                    setAgreedToTerms(e.target.checked);
                                    if (e.target.checked) setError(null);
                                }}
                                className={`mt-0.5 rounded border-white/20 bg-white/5 w-4 h-4 cursor-pointer flex-shrink-0 ${isOcean ? 'accent-blue-500 text-blue-500 focus:ring-blue-500' : 'accent-[#c87d46] text-[#c87d46] focus:ring-[#c87d46]'}`}
                            />
                            <label htmlFor="termsCheckbox" className="text-xs text-stone-300 select-none cursor-pointer leading-relaxed">
                                I agree to the{' '}
                                <a
                                    href="/terms"
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`font-bold hover:underline ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Terms & Conditions
                                </a>{' '}
                                and{' '}
                                <a
                                    href="/privacy"
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`font-bold hover:underline ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Privacy Policy
                                </a>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !agreedToFun || !agreedToTerms}
                            className={`w-full py-3.5 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 ${(!agreedToFun || !agreedToTerms || isLoading) ? 'opacity-50 cursor-not-allowed' : ''} ${isOcean ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25' : 'bg-[#f5d0b5] hover:bg-white text-[#140f0d] shadow-black/30'}`}
                        >
                            {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <span>Create Account</span>}
                        </button>

                        <div className="text-center pt-2">
                            <span className="text-xs text-stone-400">Already have an account? </span>
                            <button
                                type="button"
                                onClick={() => { setError(null); setTab('login'); }}
                                className={`text-xs font-bold hover:underline ${isOcean ? 'text-blue-400' : 'text-[#f5d0b5]'}`}
                            >
                                Log In
                            </button>
                        </div>
                    </form>
                )}

                {/* 3. RECOVERY KEY REVEAL TAB (CRUCIAL REQUIREMENT) */}
                {tab === 'recovery_key_reveal' && (
                    <div className="space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-1">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                                <Key size={24} />
                            </div>
                            <h2 className="text-xl font-black tracking-tight">Your Emergency Recovery Passphrase</h2>
                            <p className="text-xs text-stone-400">Save these 12 words to recover your account if you ever forget your password.</p>
                        </div>

                        {/* Words Grid */}
                        <div className="p-4 bg-black/60 border border-white/10 rounded-2xl grid grid-cols-3 gap-2 font-mono text-xs select-all">
                            {generatedPassphrase.split(' ').map((word, idx) => (
                                <div key={idx} className="bg-white/5 rounded-lg py-1.5 px-2.5 flex items-center space-x-2">
                                    <span className="text-stone-500 text-[10px] w-4">{idx + 1}.</span>
                                    <span className="text-emerald-300 font-bold">{word}</span>
                                </div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={handleDownloadKey}
                                className="py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition-colors border border-white/10"
                            >
                                <Download size={16} />
                                <span>Download (.txt)</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyPassphrase}
                                className="py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 transition-colors border border-white/10"
                            >
                                {isCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                <span>{isCopied ? 'Copied!' : 'Copy Words'}</span>
                            </button>
                        </div>

                        {/* Confirmation Checkbox */}
                        <label className="flex items-start space-x-3 cursor-pointer p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-stone-300">
                            <input
                                type="checkbox"
                                checked={hasConfirmedSaved}
                                onChange={(e) => {
                                    setHasConfirmedSaved(e.target.checked);
                                    if (e.target.checked) setError(null);
                                }}
                                className={`mt-0.5 rounded w-4 h-4 cursor-pointer ${isOcean ? 'accent-blue-500' : 'accent-[#c87d46]'}`}
                            />
                            <span>I understand there is no email reset, and I have safely saved my 12-word passphrase.</span>
                        </label>

                        {error && (
                            <p className="text-red-400 text-xs text-center">{error}</p>
                        )}

                        <button
                            type="button"
                            onClick={handleFinishRegistration}
                            className={`w-full py-3.5 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 ${!hasConfirmedSaved ? 'opacity-50 cursor-not-allowed' : ''} ${isOcean ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25' : 'bg-[#f5d0b5] hover:bg-white text-[#140f0d] shadow-black/30'}`}
                        >
                            <span>Continue to Slothify</span>
                            <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {/* 4. FORGOT PASSWORD / RECOVERY TAB */}
                {tab === 'forgot_password' && (
                    <form onSubmit={handleRecover} className="space-y-5">
                        <div className="text-center space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                                <Key size={24} />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight">Account Recovery</h2>
                            <p className="text-xs text-slate-400">Unlock your account using your 12-word emergency recovery passphrase</p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center space-x-2">
                                <AlertTriangle size={16} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    className="w-full bg-[#1e1e1e] border border-white/5 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">12-Word Recovery Passphrase</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={recoveryPassphrase}
                                    onChange={(e) => setRecoveryPassphrase(e.target.value)}
                                    placeholder="e.g. galaxy velvet frozen thunder whisper crystal forest shadow blossom velvet canyon breeze"
                                    className="w-full bg-[#1e1e1e] border border-white/5 rounded-xl py-3 px-4 text-xs font-mono text-white focus:outline-none focus:border-amber-500 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">New Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter at least 6 characters"
                                    className="w-full bg-[#1e1e1e] border border-white/5 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                            {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <span>Reset Password & Log In</span>}
                        </button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setError(null); setTab('login'); }}
                                className="text-xs text-slate-400 hover:text-white hover:underline"
                            >
                                Back to Log In
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
