import React from 'react';
import { ChevronLeft, Download } from 'lucide-react';

interface DownloadsProps {
    onBack: () => void;
}

const Downloads: React.FC<DownloadsProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col h-full bg-black text-white p-6 pt-12 md:p-8 animate-in fade-in duration-300 relative">
            {/* Simple Header - Top Left */}
            <div className="flex flex-col mb-8 mt-4 md:mt-0">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Downloads</h1>
                <p className="text-slate-400 text-sm mt-2">Your offline library</p>
            </div>

            {/* Space for Songs */}
            <div className="flex-1 w-full">
                {/* 
                   This is the space where the list of songs would go.
                   For now, we keep it empty or show a minimal placeholder 
                   that indicates this is the "Space for songs".
                */}
                <div className="w-full h-64 flex flex-col items-center justify-center text-slate-600 space-y-3 mt-10">
                    <div className="p-4 rounded-full bg-white/5">
                        <Download size={32} />
                    </div>
                    <span className="font-medium">No songs downloaded</span>
                </div>
            </div>
        </div>
    );
};

export default Downloads;
