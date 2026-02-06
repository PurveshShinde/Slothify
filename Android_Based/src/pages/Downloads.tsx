import React, { useMemo } from 'react';
import { Download, Play, Trash2, Search } from 'lucide-react';
import type { DownloadedItem } from '../plugins/NyxMusic';
import type { Track } from '../types/types';

interface DownloadsProps {
    isAuthenticated: boolean;
    downloads: DownloadedItem[];
    onPlayTrack: (track: Track) => void;
    onDelete: (videoId: string) => void;
}

const Downloads: React.FC<DownloadsProps> = ({ isAuthenticated, downloads, onPlayTrack, onDelete }) => {
    // Memoize stats or sorting if needed

    const handlePlay = (item: DownloadedItem) => {
        // Convert DownloadedItem to Track-like object
        const track: Track = {
            id: item.videoId,
            name: item.title || "Unknown Title",
            artists: [{ name: item.artist || "Unknown Artist" }],
            album: { name: "Downloaded", images: [{ url: item.thumbnail || "" }] },
            duration_ms: item.duration ? parseInt(item.duration) : 0,
            uri: item.filePath
        };
        onPlayTrack(track);
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                <h2 className="text-2xl font-bold text-white">Login to view downloads</h2>
            </div>
        );
    }

    if (downloads.length === 0) {
        return (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-24 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-white">Downloads</h1>
                </div>
                <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center">
                        <Download size={40} className="text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">No downloads yet</h2>
                    <p className="text-slate-400 text-center max-w-sm">
                        Downloaded songs will appear here for offline listening
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-24 p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold text-white">Downloads</h1>
                <span className="text-sm text-slate-400">{downloads.length} songs</span>
            </div>

            <div className="space-y-2">
                {downloads.map((item) => (
                    <div key={item.videoId} className="group flex items-center p-3 rounded-md hover:bg-white/5 transition-colors cursor-pointer" onClick={() => handlePlay(item)}>
                        <div className="relative w-12 h-12 mr-4 flex-shrink-0">
                            {item.thumbnail ? (
                                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover rounded shadow-md" />
                            ) : (
                                <div className="w-full h-full bg-slate-800 rounded flex items-center justify-center">
                                    <Download size={20} className="text-slate-500" />
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                <Play size={20} className="text-white fill-white" />
                            </div>
                        </div>

                        <div className="flex-1 min-w-0 mr-4">
                            <h3 className="font-medium text-white truncate">{item.title || item.videoId}</h3>
                            <p className="text-sm text-slate-400 truncate">{item.artist || "Unknown Artist"}</p>
                        </div>

                        <button
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onDelete(item.videoId); }}
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Downloads;
