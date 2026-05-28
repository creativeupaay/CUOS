import React from 'react';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options: SelectOption[];
    placeholder?: string;
    selectSize?: SelectSize;
    hasError?: boolean;
}

const sizeStyles: Record<SelectSize, string> = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ options, placeholder, selectSize = 'md', hasError, className = '', ...props }, ref) => {
        const base =
            'w-full rounded-lg border bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer';
        const errorStyles = hasError
            ? 'border-red-500 focus:ring-red-500'
            : 'border-[var(--color-border-default)]';

        return (
            <div className="relative">
                <select
                    ref={ref}
                    className={`${base} ${errorStyles} ${sizeStyles[selectSize]} pr-8 ${className}`}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                {/* Chevron icon */}
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            </div>
        );
    },
);

Select.displayName = 'Select';
