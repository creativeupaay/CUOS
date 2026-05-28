import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    description?: string;
    hasError?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ label, description, hasError, className = '', id, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

        return (
            <div className={`flex items-start gap-3 ${className}`}>
                <div className="flex h-5 items-center">
                    <input
                        ref={ref}
                        id={inputId}
                        type="checkbox"
                        className={`h-4 w-4 rounded border-[var(--color-border-default)] text-[var(--color-primary)] transition-colors focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${hasError ? 'border-red-500' : ''}`}
                        {...props}
                    />
                </div>
                {(label || description) && (
                    <div className="flex flex-col">
                        {label && (
                            <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">
                                {label}
                            </label>
                        )}
                        {description && (
                            <span className="text-xs text-[var(--color-text-muted)]">{description}</span>
                        )}
                    </div>
                )}
            </div>
        );
    },
);

Checkbox.displayName = 'Checkbox';
