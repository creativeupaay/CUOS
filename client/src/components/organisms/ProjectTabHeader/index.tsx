import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ProjectTabHeaderProps {
    title: string;
    icon: LucideIcon;
    badgeCount?: number;
    rightElement?: React.ReactNode;
}

export function ProjectTabHeader({
    title,
    icon: Icon,
    badgeCount,
    rightElement,
}: ProjectTabHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <Icon size={15} style={{ color: 'var(--color-text-muted)' }} />
                <h2
                    className="text-sm font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {title}
                </h2>
                {badgeCount !== undefined && (
                    <span
                        className="text-[11px] px-1.5 py-0.5 rounded-full"
                        style={{
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        {badgeCount}
                    </span>
                )}
            </div>
            {rightElement && (
                <div>
                    {rightElement}
                </div>
            )}
        </div>
    );
}
