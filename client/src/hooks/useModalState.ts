import { useState, useCallback } from 'react';

export type ModalId = string;

export interface UseModalStateReturn {
    /** Returns true if the given modal ID is open */
    isOpen: (id: ModalId) => boolean;
    /** Opens a modal by ID */
    open: (id: ModalId) => void;
    /** Closes a modal by ID */
    close: (id: ModalId) => void;
    /** Toggles a modal's open state */
    toggle: (id: ModalId) => void;
    /** Closes all open modals */
    closeAll: () => void;
    /** The raw set of currently open modal IDs */
    openSet: Set<ModalId>;
}

/**
 * Manages multiple modal open/close states without per-modal useState calls.
 *
 * Usage:
 *   const modal = useModalState();
 *   modal.open('add-expense');
 *   modal.isOpen('add-expense'); // true
 *   modal.close('add-expense');
 */
export function useModalState(): UseModalStateReturn {
    const [openSet, setOpenSet] = useState<Set<ModalId>>(new Set());

    const isOpen = useCallback((id: ModalId) => openSet.has(id), [openSet]);

    const open = useCallback((id: ModalId) => {
        setOpenSet((prev) => new Set([...prev, id]));
    }, []);

    const close = useCallback((id: ModalId) => {
        setOpenSet((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const toggle = useCallback((id: ModalId) => {
        setOpenSet((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const closeAll = useCallback(() => setOpenSet(new Set()), []);

    return { isOpen, open, close, toggle, closeAll, openSet };
}
