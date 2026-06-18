import React from 'react';
import { formatCurrencyINR } from './utils';

export interface CurrencyDisplayProps {
    amount: number;
    currency?: string;
    locale?: string;
    className?: string;
    /** Show +/- prefix for delta values */
    showSign?: boolean;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
    amount,
    className = '',
    showSign,
}) => {
    const formatted = formatCurrencyINR(amount);
    const sign = showSign && amount > 0 ? '+' : '';
    const colorClass = showSign ? (amount >= 0 ? 'text-emerald-600' : 'text-red-600') : '';

    return (
        <span className={`tabular-nums ${colorClass} ${className}`} title={formatCurrencyINR(amount)}>
            {sign}
            {formatted}
        </span>
    );
};
