import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-800/60 rounded-xl ${className}`}
    />
  );
};

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl bg-slate-900/40 border border-slate-800/80 ${className}`}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-4 shadow-lg shadow-violet-900/10">
          {icon}
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold text-slate-100">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1.5 mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
