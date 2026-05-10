import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
    name?: string;
    /** Remote image URL (profile photo). Falls back to initials when absent. */
    photoUrl?: string | null;
    /** Tailwind size key OR a raw pixel size number (e.g. 20, 24). */
    size?: AvatarSize | number;
    /** When true renders a white ring around the avatar (for stacked groups). */
    ring?: boolean;
    /** When true the fallback circle uses the primary brand colour. */
    selected?: boolean;
    className?: string;
    /** @deprecated Use photoUrl instead */
    src?: string;
}

// ─── Tailwind size map (used when size is a named key) ───────────────────────
const sizeConfig: Record<AvatarSize, { container: string; text: string; px: number }> = {
    xs: { container: 'w-6 h-6', text: 'text-[10px]', px: 24 },
    sm: { container: 'w-8 h-8', text: 'text-xs', px: 32 },
    md: { container: 'w-10 h-10', text: 'text-sm', px: 40 },
    lg: { container: 'w-12 h-12', text: 'text-base', px: 48 },
    xl: { container: 'w-16 h-16', text: 'text-lg', px: 64 },
};

function getInitials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name?: string): string {
    const colors = [
        'bg-purple-100 text-purple-700',
        'bg-blue-100 text-blue-700',
        'bg-emerald-100 text-emerald-700',
        'bg-amber-100 text-amber-700',
        'bg-rose-100 text-rose-700',
        'bg-sky-100 text-sky-700',
        'bg-indigo-100 text-indigo-700',
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
}

export const Avatar: React.FC<AvatarProps> = ({
    name,
    photoUrl,
    src,
    size = 'md',
    ring = false,
    selected = false,
    className = '',
}) => {
    // Resolve image source — photoUrl takes precedence over legacy src
    const imageSrc = photoUrl ?? src ?? null;

    // ── Numeric pixel size ──────────────────────────────────────────────────
    if (typeof size === 'number') {
        const px = size;
        const fontSize = Math.max(8, Math.floor(px * 0.45));
        const ringStyle: React.CSSProperties = ring ? { boxShadow: '0 0 0 2px white' } : {};
        const initials = name ? name.charAt(0).toUpperCase() : '?';

        if (imageSrc) {
            return (
                <img
                    src={imageSrc}
                    alt={name ?? 'Avatar'}
                    title={name}
                    style={{
                        width: px,
                        height: px,
                        minWidth: px,
                        minHeight: px,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        display: 'inline-block',
                        ...ringStyle,
                    }}
                    className={className}
                />
            );
        }

        return (
            <div
                title={name}
                style={{
                    width: px,
                    height: px,
                    minWidth: px,
                    minHeight: px,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize,
                    fontWeight: 700,
                    flexShrink: 0,
                    backgroundColor: selected ? 'var(--color-primary)' : '#BFDBFE',
                    color: selected ? 'white' : '#1D4ED8',
                    ...ringStyle,
                }}
                className={className}
            >
                {initials}
            </div>
        );
    }

    // ── Named size key ──────────────────────────────────────────────────────
    const { container, text } = sizeConfig[size];
    const ringClass = ring ? 'ring-2 ring-white' : '';

    if (imageSrc) {
        return (
            <img
                src={imageSrc}
                alt={name ?? 'Avatar'}
                className={`${container} rounded-full object-cover ring-1 ring-[var(--color-border-default)] shrink-0 ${ringClass} ${className}`}
            />
        );
    }

    if (selected) {
        return (
            <span
                className={`${container} ${text} inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${ringClass} ${className}`}
                title={name}
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
                {getInitials(name)}
            </span>
        );
    }

    return (
        <span
            className={`${container} ${text} ${getColorFromName(name)} inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${ringClass} ${className}`}
            title={name}
        >
            {getInitials(name)}
        </span>
    );
};
