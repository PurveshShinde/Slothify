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
            setError('Passwords do not match. Please verify both passwords.');
            return;
        }

        if (!agreedToFun) {
            setError("Please tick the checkbox confirming you won't be an ungrateful bitch and complain about free stuff.");
            return;
        }

        if (!agreedToTerms) {
            setError('Please tick the checkbox confirming you agree to the Terms & Conditions and Privacy Policy.');
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
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className={`border rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-white my-auto max-h-[92vh] overflow-y-auto scrollbar-hide backdrop-blur-xl transition-colors duration-200 ${
                isOcean
                    ? 'bg-[#09101d]/95 border-blue-500/20'
                    : 'bg-[#140e0c]/95 border-white/10'
            }`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                    <X size={16} />
                </button>

                {/* 1. LOGIN TAB */}
                {tab === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="text-center pt-1 pb-1">
                            <img src="/favicon_sloth.png" alt="Slothify" className="w-8 h-8 mx-auto mb-2.5 object-contain" />
                            <h2 className="text-lg font-bold text-white tracking-tight">Sign In</h2>
                            <p className="text-xs text-neutral-400 mt-0.5">Welcome back to Slothify</p>
                        </div>

                        {error && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center space-x-2">
                                <AlertTriangle size={14} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1.5">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-neutral-300">Password</label>
                                    <button
                                        type="button"
                                        onClick={() => { setError(null); setTab('forgot_password'); }}
                                        className="text-xs text-neutral-400 hover:text-white transition-colors"
                                    >
                                        Forgot?
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-2.5 font-medium rounded-xl text-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 mt-1 shadow-sm ${
                                isOcean
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                    : 'bg-white hover:bg-neutral-200 text-black'
                            }`}
                        >
                            {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <span>Sign In</span>}
                        </button>

                        <div className="text-center pt-1 text-xs text-neutral-400">
                            <span>Don't have an account? </span>
                            <button
                                type="button"
                                onClick={() => { setError(null); setTab('register'); }}
                                className="text-white hover:underline font-medium ml-0.5"
                            >
                                Sign up
                            </button>
                        </div>
                    </form>
                )}

                {/* 2. REGISTER TAB */}
                {tab === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-3.5">
                        <div className="text-center pt-1 pb-1">
                            <img src="/favicon_sloth.png" alt="Slothify" className="w-8 h-8 mx-auto mb-2.5 object-contain" />
                            <h2 className="text-lg font-bold text-white tracking-tight">Create Account</h2>
                            <p className="text-xs text-neutral-400 mt-0.5">Sync playlists with zero-knowledge privacy</p>
                        </div>

                        {error && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center space-x-2">
                                <AlertTriangle size={14} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-2.5">
                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    minLength={3}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Choose a username"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-1">
                            <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-neutral-300 select-none">
                                <input
                                    type="checkbox"
                                    checked={agreedToFun}
                                    onChange={(e) => {
                                        setAgreedToFun(e.target.checked);
                                        if (e.target.checked) setError(null);
                                    }}
                                    className={`mt-0.5 rounded w-4 h-4 cursor-pointer flex-shrink-0 ${
                                        isOcean ? 'accent-blue-600' : 'accent-neutral-200'
                                    }`}
                                />
                                <span className="leading-snug">
                                    I won't be an ungrateful bitch and complain about free stuff
                                </span>
                            </label>

                            <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-neutral-300 select-none">
                                <input
                                    type="checkbox"
                                    checked={agreedToTerms}
                                    onChange={(e) => {
                                        setAgreedToTerms(e.target.checked);
                                        if (e.target.checked) setError(null);
                                    }}
                                    className={`mt-0.5 rounded w-4 h-4 cursor-pointer flex-shrink-0 ${
                                        isOcean ? 'accent-blue-600' : 'accent-neutral-200'
                                    }`}
                                />
                                <span className="leading-snug">
                                    I won't create multiple accounts and agree to the{' '}
                                    <a href="/terms" target="_blank" rel="noreferrer" className="text-white underline hover:no-underline" onClick={(e) => e.stopPropagation()}>Terms & Conditions</a>
                                    {' '}and{' '}
                                    <a href="/privacy" target="_blank" rel="noreferrer" className="text-white underline hover:no-underline" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !agreedToFun || !agreedToTerms}
                            className={`w-full py-2.5 font-medium rounded-xl text-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 mt-1 shadow-sm ${
                                isOcean
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                    : 'bg-white hover:bg-neutral-200 text-black'
                            }`}
                        >
                            {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <span>Create Account</span>}
                        </button>

                        <div className="text-center pt-1 text-xs text-neutral-400">
                            <span>Already have an account? </span>
                            <button
                                type="button"
                                onClick={() => { setError(null); setTab('login'); }}
                                className="text-white hover:underline font-medium ml-0.5"
                            >
                                Sign in
                            </button>
                        </div>
                    </form>
                )}

                {/* 3. RECOVERY KEY REVEAL TAB */}
                {tab === 'recovery_key_reveal' && (
                    <div className="space-y-3.5">
                        <div className="text-center pt-1">
                            <h2 className="text-lg font-bold text-white tracking-tight">Recovery Passphrase</h2>
                            <p className="text-xs text-neutral-400 mt-1">
                                Save these 12 words to recover your account if you ever forget your password. We don't store your email.
                            </p>
                        </div>

                        {/* Words Grid */}
                        <div className="p-3 bg-black/40 border border-white/10 rounded-xl grid grid-cols-3 gap-1.5 font-mono text-xs select-all">
                            {generatedPassphrase.split(' ').map((word, idx) => (
                                <div key={idx} className="bg-white/[0.04] rounded-lg py-1 px-2 flex items-center space-x-1.5">
                                    <span className="text-neutral-500 text-[10px] w-3">{idx + 1}.</span>
                                    <span className="text-neutral-200 font-semibold truncate">{word}</span>
                                </div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={handleDownloadKey}
                                className="py-2 px-3 text-xs font-medium rounded-xl flex items-center justify-center space-x-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 transition-colors"
                            >
                                <Download size={14} />
                                <span>Download</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyPassphrase}
                                className="py-2 px-3 text-xs font-medium rounded-xl flex items-center justify-center space-x-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 transition-colors"
                            >
                                {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                <span>{isCopied ? 'Copied' : 'Copy Words'}</span>
                            </button>
                        </div>

                        {/* Confirmation Checkbox */}
                        <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-neutral-300 select-none pt-1">
                            <input
                                type="checkbox"
                                checked={hasConfirmedSaved}
                                onChange={(e) => {
                                    setHasConfirmedSaved(e.target.checked);
                                    if (e.target.checked) setError(null);
                                }}
                                className={`mt-0.5 rounded w-4 h-4 cursor-pointer flex-shrink-0 ${
                                    isOcean ? 'accent-blue-600' : 'accent-neutral-200'
                                }`}
                            />
                            <span className="leading-snug">I have saved my 12-word recovery passphrase safely.</span>
                        </label>

                        {error && (
                            <p className="text-red-400 text-xs text-center">{error}</p>
                        )}

                        <button
                            type="button"
                            onClick={handleFinishRegistration}
                            disabled={!hasConfirmedSaved}
                            className={`w-full py-2.5 font-medium rounded-xl text-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 mt-1 shadow-sm ${
                                isOcean
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                    : 'bg-white hover:bg-neutral-200 text-black'
                            }`}
                        >
                            <span>Continue to Slothify</span>
                            <ArrowRight size={15} />
                        </button>
                    </div>
                )}

                {/* 4. FORGOT PASSWORD / RECOVERY TAB */}
                {tab === 'forgot_password' && (
                    <form onSubmit={handleRecover} className="space-y-3.5">
                        <div className="text-center pt-1">
                            <h2 className="text-lg font-bold text-white tracking-tight">Reset Password</h2>
                            <p className="text-xs text-neutral-400 mt-1">Enter your username and 12-word recovery passphrase</p>
                        </div>

                        {error && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center space-x-2">
                                <AlertTriangle size={14} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-2.5">
                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1">12-Word Recovery Passphrase</label>
                                <textarea
                                    required
                                    rows={2}
                                    value={recoveryPassphrase}
                                    onChange={(e) => setRecoveryPassphrase(e.target.value)}
                                    placeholder="Paste your 12 recovery words separated by spaces"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors resize-none leading-relaxed"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter at least 6 characters"
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.06] transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-2.5 font-medium rounded-xl text-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 mt-1 shadow-sm ${
                                isOcean
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                    : 'bg-white hover:bg-neutral-200 text-black'
                            }`}
                        >
                            {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <span>Reset Password & Sign In</span>}
                        </button>

                        <div className="text-center pt-1">
                            <button
                                type="button"
                                onClick={() => { setError(null); setTab('login'); }}
                                className="text-xs text-neutral-400 hover:text-white transition-colors"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
