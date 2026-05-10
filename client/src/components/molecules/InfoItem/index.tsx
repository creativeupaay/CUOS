import React from 'react';

export interface InfoItemProps {
    label: string;
    value: React.ReactNode;
    capitalize?: boolean;
}

export function InfoItem({ label, value, capitalize }: InfoItemProps) {
    return (
        <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </p>
            <p
                className={`text-sm font-medium ${capitalize ? 'capitalize' : ''}`}
                style={{ color: 'var(--color-text-primary)' }}
            >
                {value}
            </p>
        </div>
    );
}
