import React from 'react';
import { Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'verified' | 'count' | 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const { t } = useLanguage();
  if (variant === 'verified') {
    return (
      <span
        title={t('verifiedAccount')}
        aria-label={t('verifiedAccount')}
        role="img"
        className={`inline-flex items-center justify-center rounded-full bg-blue-500 text-white shrink-0 shadow-sm shadow-blue-500/50 ${
          size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
        } ${className}`}
      >
        <Check className={size === 'sm' ? 'w-2.5 h-2.5 stroke-[3]' : 'w-3 h-3 stroke-[3]'} />
      </span>
    );
  }

  if (variant === 'count') {
    return (
      <span
        className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full font-bold text-[10px] leading-none bg-rose-500 text-white shadow-sm shadow-rose-500/50 min-w-[18px] h-[18px] ${className}`}
      >
        {children}
      </span>
    );
  }

  const variantStyles = {
    primary: 'bg-primary/15 text-primary-text border border-primary/30',
    secondary: 'bg-surface-elevated text-fg-muted border border-border',
    danger: 'bg-danger/15 text-danger-text border border-danger/30',
    success: 'bg-success/15 text-success border border-success/30',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
