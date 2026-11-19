import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute start-3.5 text-slate-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 py-2.5 ${
              leftIcon ? 'ps-10' : 'ps-3.5'
            } ${rightIcon ? 'pe-10' : 'pe-3.5'} ${
              error
                ? 'border-rose-500/80 focus:ring-rose-500/50 focus:border-rose-500'
                : 'border-slate-700/80 hover:border-slate-600'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute end-3.5 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-slate-300">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 p-3.5 resize-none min-h-[90px] ${
            error
              ? 'border-rose-500/80 focus:ring-rose-500/50 focus:border-rose-500'
              : 'border-slate-700/80 hover:border-slate-600'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
