import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

export function HiringModal({
    open,
    title,
    children,
    onClose,
}: {
    open: boolean;
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    useBodyScrollLock(open);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
                className="w-full max-w-lg rounded-2xl border p-6 shadow-xl"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        Close
                    </button>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}
