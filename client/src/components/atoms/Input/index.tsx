import React from 'react';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    inputSize?: InputSize;
    hasError?: boolean;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
}

const sizeStyles: Record<InputSize, string> = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ inputSize = 'md', hasError, leftElement, rightElement, className = '', ...props }, ref) => {
        const base =
            'w-full rounded-lg border bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed';
        const errorStyles = hasError
            ? 'border-red-500 focus:ring-red-500'
            : 'border-[var(--color-border-default)]';

        if (leftElement || rightElement) {
            return (
                <div className="relative flex items-center">
                    {leftElement && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                            {leftElement}
                        </span>
                    )}
                    <input
                        ref={ref}
                        className={`${base} ${errorStyles} ${sizeStyles[inputSize]} ${leftElement ? 'pl-9' : ''} ${rightElement ? 'pr-9' : ''} ${className}`}
                        {...props}
                    />
                    {rightElement && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                            {rightElement}
                        </span>
                    )}
                </div>
            );
        }

        return (
            <input
                ref={ref}
                className={`${base} ${errorStyles} ${sizeStyles[inputSize]} ${className}`}
                {...props}
            />
        );
    },
);

Input.displayName = 'Input';
