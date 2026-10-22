import React from 'react';

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
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm'
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-2.5 select-none transition-transform duration-200 group ${
        onClick ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''
      } ${className}`}
    >
      {/* Colorful Sloth Mascot */}
      <img
        src="/favicon_sloth.png"
        alt="Slothify"
        className={`${iconSizes[size]} object-contain flex-shrink-0 drop-shadow-md transition-transform duration-300 group-hover:scale-105 active:scale-95`}
      />

      {/* Wordmark: exact same typography as Windows / desktop view */}
      <div className="flex items-center space-x-2 leading-none">
        <span className={`${textSizes[size]} font-bold tracking-[0.35em] text-[#e8ded6] uppercase transition-colors group-hover:text-white`}>
          Slothify
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
