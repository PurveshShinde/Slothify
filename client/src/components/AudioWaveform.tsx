import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface AudioWaveformProps {
  isPlaying?: boolean;
  barCount?: number;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isPlaying = false,
  barCount = 36,
  className = ''
}) => {
  const { isOcean } = useTheme();

  // Pre-calculated organic heights for a realistic sound spectrum
  const baseHeights = [
    18, 28, 42, 60, 35, 20, 48, 75, 90, 65,
    40, 55, 78, 100, 85, 50, 32, 68, 88, 70,
    45, 30, 62, 80, 58, 40, 25, 52, 74, 92,
    64, 45, 30, 22, 15, 10
  ];

  return (
    <div className={`flex items-end space-x-[2.5px] h-8 select-none ${className}`}>
      {Array.from({ length: barCount }).map((_, i) => {
        const heightPercent = baseHeights[i % baseHeights.length];
        const animationDelay = `${(i * 0.05).toFixed(2)}s`;
        const animationDuration = `${0.6 + (i % 5) * 0.15}s`;

        return (
          <div
            key={i}
            className={`w-[2px] rounded-full transition-all duration-300 ${
              isPlaying
                ? isOcean
                  ? 'bg-gradient-to-t from-blue-600 via-cyan-400 to-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                  : 'bg-gradient-to-t from-[#c87d46] via-[#d97736] to-[#f5d0b5] shadow-[0_0_8px_rgba(245,208,181,0.3)]'
                : isOcean
                  ? 'bg-cyan-400/50'
                  : 'bg-[#f5d0b5]/40'
            }`}
            style={{
              height: isPlaying ? `${Math.max(15, heightPercent)}%` : `${Math.max(12, heightPercent * 0.35)}%`,
              animation: isPlaying ? `waveformPulse ${animationDuration} ease-in-out infinite alternate` : 'none',
              animationDelay
            }}
          />
        );
      })}

      <style>{`
        @keyframes waveformPulse {
          0% { height: 18%; opacity: 0.6; }
          50% { height: 85%; opacity: 1; }
          100% { height: 35%; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default AudioWaveform;
