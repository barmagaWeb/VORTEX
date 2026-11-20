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
          <label htmlFor={inputId} className="block text-xs font-semibold text-fg-muted">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute start-3.5 text-fg-subtle pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-surface text-fg placeholder:text-fg-subtle text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary py-2.5 ${
              leftIcon ? 'ps-10' : 'ps-3.5'
            } ${rightIcon ? 'pe-10' : 'pe-3.5'} ${
              error
                ? 'border-danger/80 focus:ring-danger/40 focus:border-danger'
                : 'border-border hover:border-fg-subtle/50'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute end-3.5 flex items-center text-fg-subtle">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-danger-text font-medium">{error}</p>}
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
          <label htmlFor={textareaId} className="block text-xs font-semibold text-fg-muted">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`w-full bg-surface text-fg placeholder:text-fg-subtle text-sm rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary p-3.5 resize-none min-h-[90px] ${
            error
              ? 'border-danger/80 focus:ring-danger/40 focus:border-danger'
              : 'border-border hover:border-fg-subtle/50'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-danger-text font-medium">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
