import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
    className?: string;
    children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-sky-50 text-sky-700',
    purple: 'bg-indigo-50 text-indigo-700',
    neutral: 'bg-gray-100 text-gray-600',
};

const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-gray-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-sky-500',
    purple: 'bg-indigo-500',
    neutral: 'bg-gray-400',
};

const sizeStyles: Record<BadgeSize, string> = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', size = 'md', dot, children, className = '' }) => (
    <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
        {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
        {children}
    </span>
);
