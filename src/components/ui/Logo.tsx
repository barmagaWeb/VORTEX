import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  clickable?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showTagline = false, clickable = true }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  const content = (
    <div className="flex items-center gap-2.5 group select-none">
      {/* VORTEX Stylized Gradient Geometric V Icon */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center shrink-0`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            <linearGradient id="vortexGradient" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A78BFA" />
              <stop offset="0.45" stopColor="#7C3AED" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="vortexGlow" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#C4B5FD" stopOpacity="0.8" />
              <stop offset="1" stopColor="#60A5FA" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {/* Outer faceted geometric V */}
          <path
            d="M6 8 L24 42 L30 42 L42 8 L33 8 L24 28 L15 8 Z"
            fill="url(#vortexGradient)"
          />
          {/* Inner accent facet */}
          <path
            d="M24 28 L30 42 L42 8 L35 8 Z"
            fill="url(#vortexGlow)"
          />
        </svg>
      </div>

      <div className="flex flex-col">
        <span
          className={`font-black tracking-tight font-sans text-slate-100 group-hover:text-white transition-colors leading-none ${textSizes[size]}`}
        >
          VORTEX
        </span>
        {showTagline && (
          <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-400 mt-1">
            Connect. Share. Discover.
          </span>
        )}
      </div>
    </div>
  );

  if (clickable) {
    return (
      <Link to="/" className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
};
