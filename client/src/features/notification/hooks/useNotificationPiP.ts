import { useDocumentPiP } from '@/hooks/useDocumentPiP';
import { useCallback } from 'react';

/**
 * Custom hook to open and manage a dedicated standalone Notification Document Picture-in-Picture window.
 */
export function useNotificationPiP() {
    const { isSupported, isPipOpen, pipContainer, openPiP, closePiP } = useDocumentPiP();

    const openNotificationPiP = useCallback(async () => {
        return await openPiP({
            width: 340,
            height: 155,
            title: 'CUOS Notifications',
        });
    }, [openPiP]);

    return {
        isSupported,
        isPipOpen,
        pipContainer,
        openNotificationPiP,
        closeNotificationPiP: closePiP,
    };
}
