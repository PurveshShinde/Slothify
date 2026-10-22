import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface VinylRecordProps {
  image?: string;
  isPlaying?: boolean;
  className?: string;
  onClick?: () => void;
}

export const VinylRecord: React.FC<VinylRecordProps> = ({
  image,
  isPlaying = false,
  className = '',
  onClick
}) => {
  const { isOcean } = useTheme();
  // Track if disc has ever started spinning for the current image
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // Reset to default upright state when image/track changes
    setHasStarted(false);
  }, [image]);

  useEffect(() => {
    if (isPlaying && !hasStarted) {
      setHasStarted(true);
    }
  }, [isPlaying, hasStarted]);

  // When playing: 'spin-vinyl' (continuous spin)
  // When paused after playing: 'spin-vinyl-paused' (freezes at exact current rotation angle)
  // Default state before playing: '' (0deg upright default cover)
  const animClass = isPlaying
    ? 'spin-vinyl'
    : hasStarted
      ? 'spin-vinyl-paused'
      : '';

  return (
    <div
      onClick={onClick}
      className={`relative aspect-square flex-shrink-0 select-none ${className || 'w-40 h-40 md:w-44 md:h-44 lg:w-48 lg:h-48'}`}
      style={{ aspectRatio: '1 / 1' }}
    >
      {/* Vinyl Outer Disc */}
      <div
        className={`w-full h-full rounded-full bg-[#0a0a0d] shadow-[0_15px_35px_rgba(0,0,0,0.8)] border border-white/[0.08] relative overflow-hidden flex items-center justify-center ${animClass}`}
        style={{
          ['--spin-duration' as any]: '12s',
          willChange: 'transform'
        }}
      >
        {/* Vinyl Concentric Grooves */}
        <div className="absolute inset-2 rounded-full border border-white/[0.04]" />
        <div className="absolute inset-4 rounded-full border border-white/[0.03]" />
        <div className="absolute inset-6 rounded-full border border-white/[0.04]" />
        <div className="absolute inset-8 rounded-full border border-white/[0.03]" />
        <div className="absolute inset-10 rounded-full border border-white/[0.04]" />
        <div className="absolute inset-12 rounded-full border border-white/[0.03]" />
        <div className="absolute inset-14 rounded-full border border-white/[0.04]" />
        <div className="absolute inset-16 rounded-full border border-white/[0.03]" />

        {/* Realistic Sheen / Light Reflection Rays */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.05)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.06)_45deg,transparent_90deg,rgba(255,255,255,0.06)_225deg,transparent_270deg)]" />

        {/* Center Label Area (Song Poster in the middle) */}
        <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-[#1a171d] shadow-inner flex items-center justify-center">
          {image ? (
            <img src={image} alt="Vinyl Label" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isOcean ? 'bg-gradient-to-tr from-[#0a152d] to-[#1e293b]' : 'bg-gradient-to-tr from-[#241c19] to-[#3a2c26]'}`}>
              <div className={`w-3 h-3 rounded-full ${isOcean ? 'bg-blue-400/60' : 'bg-[#f5d0b5]/60'}`} />
            </div>
          )}

          {/* Spindle Hole */}
          <div className="absolute w-3 h-3 rounded-full bg-[#0a0a0d] border border-white/20 shadow-inner" />
        </div>
      </div>
    </div>
  );
};

export default VinylRecord;
