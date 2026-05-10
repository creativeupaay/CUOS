import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
    hint?: string;
}

export const Label: React.FC<LabelProps> = ({ required, hint, children, className = '', ...props }) => (
    <label
        className={`block text-sm font-medium text-[var(--color-text-primary)] mb-1.5 ${className}`}
        {...props}
    >
        {children}
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        {hint && <span className="ml-1.5 text-xs font-normal text-[var(--color-text-muted)]">({hint})</span>}
    </label>
);
