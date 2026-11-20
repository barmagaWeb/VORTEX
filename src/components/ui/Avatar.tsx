import React, { useState } from 'react';
import { UserRound } from 'lucide-react';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isOnline?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = 'md',
  isOnline,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-28 h-28 text-2xl',
  };

  const statusDotSizes = {
    xs: 'w-1.5 h-1.5 border-[1px]',
    sm: 'w-2 h-2 border-[1.5px]',
    md: 'w-2.5 h-2.5 border-2',
    lg: 'w-3.5 h-3.5 border-2',
    xl: 'w-4 h-4 border-2',
    '2xl': 'w-5 h-5 border-[2.5px]',
  };

  return (
    <div className={`relative inline-block shrink-0 select-none ${className}`}>
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center font-bold text-white shadow-inner ring-1 ring-border/20 ${sizeClasses[size]} bg-gradient-to-tr from-violet-700 via-indigo-600 to-blue-500`}
      >
        {src && !hasError ? (
          <img
            src={src}
            alt={alt}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <UserRound aria-hidden="true" className="w-1/2 h-1/2 text-white/75" strokeWidth={1.5} />
        )}
      </div>

      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0 end-0 rounded-full border-surface ${
            statusDotSizes[size]
          } ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-fg-subtle'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};
