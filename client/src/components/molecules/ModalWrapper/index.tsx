import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    hideHeader?: boolean;
    preventClose?: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

const sizeStyles: Record<NonNullable<ModalWrapperProps['size']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
};

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
    isOpen,
    onClose,
    title,
    size = 'md',
    hideHeader,
    preventClose,
    children,
    footer,
}) => {
    const handleEsc = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !preventClose) onClose();
        },
        [onClose, preventClose],
    );

    useEffect(() => {
        if (!isOpen) return;
        document.addEventListener('keydown', handleEsc);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = prev;
        };
    }, [isOpen, handleEsc]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!preventClose ? onClose : undefined}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`relative w-full ${sizeStyles[size]} bg-[var(--color-bg-surface)] rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden`}
            >
                {!hideHeader && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-default)] shrink-0">
                        {title && (
                            <h2 id="modal-title" className="text-base font-semibold text-[var(--color-text-primary)]">
                                {title}
                            </h2>
                        )}
                        {!preventClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="ml-auto p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                )}

                <div className="overflow-y-auto flex-1 p-6">{children}</div>

                {footer && (
                    <div className="px-6 py-4 border-t border-[var(--color-border-default)] shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
};
