import React from 'react';
import { Download } from 'lucide-react';

const Downloads: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-slate-400 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Download size={40} className="text-slate-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Downloads</h2>
            <p className="text-center max-w-xs mx-auto">Your downloaded content will appear here.</p>
        </div>
    );
};

export default Downloads;
