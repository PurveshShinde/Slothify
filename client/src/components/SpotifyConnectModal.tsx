import React, { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle, Link2, Sparkles, Disc } from 'lucide-react';
import { useSpotify } from '../context/SpotifyContext';

export const SpotifyConnectModal: React.FC = () => {
    const {
        isImportModalOpen,
        closeImportModal,
        importByPlaylistUrl,
        isImporting,
        importError
    } = useSpotify();

    const [playlistUrl, setPlaylistUrl] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);

    if (!isImportModalOpen) return null;

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = playlistUrl.trim();
        if (!trimmed || isImporting) return;

        setLocalError(null);
        const res = await importByPlaylistUrl(trimmed);
        if (res.success) {
            setPlaylistUrl('');
            closeImportModal();
        } else {
            setLocalError(res.error || 'Failed to import. Please ensure the Spotify playlist or album is public.');
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setPlaylistUrl(text.trim());
            }
        } catch {}
    };

    const displayError = localError || importError;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-md rounded-2xl p-6 sm:p-7 shadow-2xl border text-white animate-in zoom-in-95 duration-200 overflow-hidden"
                style={{
                    backgroundColor: '#121212',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                }}
            >
                {/* Decorative Spotify ambient glow */}
                <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#1DB954]/20 rounded-full blur-3xl pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={closeImportModal}
                    className="absolute top-5 right-5 p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <X size={18} />
                </button>

                {/* Header with Spotify Logo */}
                <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center shadow-lg shadow-[#1DB954]/25 flex-shrink-0">
                        <svg className="w-6 h-6 text-black fill-current" viewBox="0 0 24 24">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.218.358-.683.473-1.042.254-2.858-1.745-6.457-2.14-10.697-1.171-.41.093-.815-.164-.908-.573-.093-.41.164-.816.573-.908 4.636-1.06 8.608-.607 11.82 1.356.359.219.473.684.254 1.042zm1.469-3.267c-.274.446-.86.588-1.306.314-3.272-2.012-8.261-2.595-12.132-1.419-.501.152-1.034-.136-1.186-.637-.152-.5.136-1.033.637-1.185 4.417-1.34 9.914-.689 13.673 1.621.446.275.588.86.314 1.306zm.126-3.41c-3.924-2.33-10.395-2.545-14.152-1.404-.602.183-1.242-.162-1.425-.764-.183-.602.162-1.242.764-1.425 4.312-1.31 11.455-1.061 15.98 1.625.541.321.718 1.025.397 1.566-.321.541-1.025.718-1.564.402z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white font-display">Import Spotify Playlist</h2>
                        <p className="text-xs text-neutral-400">Paste any Spotify link to sync with your library</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleImport} className="space-y-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-300">Spotify Link or ID</span>
                            <button
                                type="button"
                                onClick={handlePaste}
                                className="text-[11px] text-[#1DB954] hover:underline font-semibold cursor-pointer"
                            >
                                Paste from Clipboard
                            </button>
                        </div>

                        <div className="relative">
                            <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                value={playlistUrl}
                                onChange={(e) => {
                                    setPlaylistUrl(e.target.value);
                                    if (localError) setLocalError(null);
                                }}
                                placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
                                className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-3.5 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954] transition-all font-mono"
                                autoFocus
                            />
                        </div>
                    </div>

                    {displayError && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2 animate-in fade-in">
                            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                            <span>{displayError}</span>
                        </div>
                    )}

                    <div className="space-y-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-neutral-300">
                        <div className="flex items-center space-x-1.5 font-semibold text-white text-xs">
                            <Sparkles size={13} className="text-[#1DB954]" />
                            <span>Supported Spotify Formats</span>
                        </div>
                        <ul className="space-y-1 text-neutral-400 pl-4 list-disc text-[11px]">
                            <li><strong>Public & Unlisted Playlists</strong> (syncs 200+ songs)</li>
                            <li><strong>Albums & EPs</strong> (imports all tracks)</li>
                            <li><strong>Single Tracks</strong> (e.g. <code>open.spotify.com/track/...</code>)</li>
                        </ul>
                    </div>

                    <div className="flex gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={closeImportModal}
                            disabled={isImporting}
                            className="flex-1 py-3 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isImporting || !playlistUrl.trim()}
                            className="flex-1 py-3 rounded-xl text-xs font-bold bg-[#1DB954] hover:bg-[#1ed760] text-black transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-[#1DB954]/20 font-display cursor-pointer"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 size={15} className="animate-spin text-black" />
                                    <span>Importing (200+ Songs)...</span>
                                </>
                            ) : (
                                <span>Import Playlist</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SpotifyConnectModal;
