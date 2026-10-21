import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  className?: string;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showBadge = true,
  className = '',
  onClick
}) => {
  const { isOcean } = useTheme();

  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  const gradientClasses = isOcean
    ? 'from-[#1e40af] via-[#2563eb] to-[#3b82f6]'
    : 'from-[#c87d46] via-[#d97736] to-[#f5d0b5]';

  const glowClass = isOcean ? 'bg-blue-600/25' : 'bg-[#d97736]/20';
  const dotColor = isOcean ? '#3b82f6' : '#f5d0b5';
  const gradStop1 = isOcean ? '#3b82f6' : '#f5d0b5';
  const gradStop2 = isOcean ? '#1d4ed8' : '#d97736';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-2.5 select-none transition-transform duration-200 ${
        onClick ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''
      } ${className}`}
    >
      {/* Minimalist Iconic Glyph */}
      <div className={`relative ${iconSizes[size]} rounded-xl flex items-center justify-center flex-shrink-0 group overflow-hidden`}>
        {/* Background Gradient with Glass Border */}
        <div className={`absolute inset-0 bg-gradient-to-tr ${gradientClasses} opacity-90 rounded-xl`} />
        <div className="absolute inset-[1px] bg-[#0c0d12] rounded-[11px] transition-colors group-hover:bg-[#0c0d12]/80" />

        {/* Minimalist Graphic: Modern Wave Sloth Arc */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 w-4 h-4 text-white"
        >
          <path
            d="M5 14.5V9.5C5 7.5 7 5.5 10 5.5C13 5.5 15 7.5 15 9.5V14.5"
            stroke="url(#sloth-grad)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M10 8.5V15.5"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M19 11V13"
            stroke="url(#sloth-grad)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="10" cy="18" r="1.25" fill={dotColor} />
          <defs>
            <linearGradient id="sloth-grad" x1="5" y1="5.5" x2="19" y2="15.5" gradientUnits="userSpaceOnUse">
              <stop stopColor={gradStop1} />
              <stop offset="1" stopColor={gradStop2} />
            </linearGradient>
          </defs>
        </svg>

        {/* Ambient Glow */}
        <div className={`absolute -inset-1 ${glowClass} blur-sm rounded-xl -z-10`} />
      </div>

      {/* Modern Wordmark */}
      <div className="flex items-center space-x-1.5 leading-none">
        <span className={`font-black tracking-[-0.035em] text-white ${textSizes[size]}`}>
          Sloth<span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses}`}>ify</span>
        </span>
        {showBadge && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-white/[0.04] text-slate-400 border border-white/5">
            Music
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
