import React from 'react';
import { CurrencyDisplay } from '@/components/molecules/CurrencyDisplay';
import type { LucideIcon } from 'lucide-react';

export interface MetricCard {
    label: string;
    amount: number;
    icon: LucideIcon;
    /** Tailwind color class for the icon, e.g. 'text-red-500' */
    iconColor: string;
    /** Tailwind bg class for the icon container, e.g. 'bg-red-50' */
    iconBg: string;
    /** Optional click handler */
    onClick?: () => void;
    badge?: React.ReactNode;
}

export interface MetricCardSetProps {
    cards: MetricCard[];
    columns?: 2 | 3 | 4;
    className?: string;
}

export const MetricCardSet: React.FC<MetricCardSetProps> = ({ cards, columns = 4, className = '' }) => {
    const colClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-2 md:grid-cols-3',
        4: 'grid-cols-2 md:grid-cols-4',
    }[columns];

    return (
        <div className={`grid ${colClass} gap-4 ${className}`}>
            {cards.map((card) => {
                const Inner = (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
                                <card.icon size={20} className={card.iconColor} />
                            </div>
                            {card.badge}
                        </div>
                        <p className="text-xs font-medium mb-1 text-[var(--color-text-muted)]">{card.label}</p>
                        <CurrencyDisplay
                            amount={card.amount}
                            compact
                            className="text-xl font-bold text-[var(--color-text-primary)]"
                        />
                    </>
                );

                if (card.onClick) {
                    return (
                        <button
                            key={card.label}
                            type="button"
                            onClick={card.onClick}
                            className="rounded-xl border border-[var(--color-border-default)] bg-white p-4 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                            {Inner}
                        </button>
                    );
                }

                return (
                    <div
                        key={card.label}
                        className="rounded-xl border border-[var(--color-border-default)] bg-white p-4 transition-all hover:shadow-md"
                    >
                        {Inner}
                    </div>
                );
            })}
        </div>
    );
};
