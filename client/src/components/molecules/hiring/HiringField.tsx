import { type ReactNode } from 'react';

export function HiringField({
    label,
    required,
    error,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {label}
                {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
            </label>
            {children}
            {error && (
                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                    {error}
                </p>
            )}
        </div>
    );
}
