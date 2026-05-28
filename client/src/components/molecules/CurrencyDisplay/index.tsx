import React from 'react';
import { formatCurrencyINR, formatCurrencyCompact } from './utils';

export interface CurrencyDisplayProps {
    amount: number;
    currency?: string;
    locale?: string;
    /** If true, shows compact format like ₹1.2 L or ₹3.5 Cr */
    compact?: boolean;
    className?: string;
    /** Show +/- prefix for delta values */
    showSign?: boolean;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
    amount,
    compact,
    className = '',
    showSign,
}) => {
    const formatted = compact ? formatCurrencyCompact(amount) : formatCurrencyINR(amount);
    const sign = showSign && amount > 0 ? '+' : '';
    const colorClass = showSign ? (amount >= 0 ? 'text-emerald-600' : 'text-red-600') : '';

    return (
        <span className={`tabular-nums ${colorClass} ${className}`} title={formatCurrencyINR(amount)}>
            {sign}
            {formatted}
        </span>
    );
};
