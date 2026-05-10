import React, { useEffect } from 'react';

export interface ContextMenuItem {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
}

interface ContextMenuProps {
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, onClose }) => {
    useEffect(() => {
        const h = () => onClose();
        window.addEventListener('click', h);
        return () => window.removeEventListener('click', h);
    }, [onClose]);

    return (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-lg border shadow-lg py-1.5 animate-in fade-in zoom-in-95 duration-100"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            onClick={(e) => e.stopPropagation()}>
            {items.map((item, i) => (
                <button key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); item.onClick(); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${item.danger ? 'text-red-600 hover:bg-red-50' : 'hover:bg-black/5'}`}
                    style={{ color: item.danger ? undefined : 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => { if (!item.danger) e.currentTarget.style.color = 'var(--color-text-primary)' }}
                    onMouseLeave={(e) => { if (!item.danger) e.currentTarget.style.color = 'var(--color-text-secondary)' }}>
                    {item.icon}{item.label}
                </button>
            ))}
        </div>
    );
};
