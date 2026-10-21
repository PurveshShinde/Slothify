import React from 'react';
// import { Download } from 'lucide-react';

/* 
 * --------------------------------------------------------------------------
 * 🚧 DOWNLOAD FEATURE (Commented out for future use)
 * --------------------------------------------------------------------------
 * This feature has been temporarily disabled/commented out per project requirements.
 * When enabling in the future, implement client-side audio caching (e.g. Cache API
 * or IndexedDB audio blob storage) to keep server-side storage at zero.
 */

const Downloads: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-slate-400 animate-in fade-in zoom-in duration-300">
            {/* Download feature UI commented out for future
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Download size={40} className="text-slate-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Downloads</h2>
            <p className="text-center max-w-xs mx-auto">Your downloaded content will appear here.</p>
            */}
            <h2 className="text-2xl font-bold text-white mb-2">Offline Downloads</h2>
            <p className="text-center max-w-xs mx-auto">Downloads are currently disabled to optimize streaming performance.</p>
        </div>
    );
};

export default Downloads;
