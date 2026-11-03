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
  showBadge = false,
  className = '',
  onClick
}) => {
  const { isOcean } = useTheme();

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-9 h-9'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-2 select-none transition-transform duration-200 group ${
        onClick ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''
      } ${className}`}
    >
      {/* Sloth Mascot */}
      <img
        src="/favicon_sloth.png"
        alt="Slothify"
        className={`${iconSizes[size]} object-contain flex-shrink-0 drop-shadow-sm transition-transform duration-200 group-hover:scale-105`}
      />

      {/* Clean Aesthetic Wordmark */}
      <div className="flex items-center space-x-2 leading-none">
        <span className={`${textSizes[size]} font-black tracking-[0.24em] uppercase text-white/95 font-display transition-colors`}>
          Slothify
        </span>
        {showBadge && (
          <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-white/[0.06] text-neutral-400 font-display">
            Music
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
