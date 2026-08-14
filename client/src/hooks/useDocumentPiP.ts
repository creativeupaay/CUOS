import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseDocumentPiPOptions {
    width?: number;
    height?: number;
    title?: string;
    onClose?: () => void;
}

export function useDocumentPiP() {
    const isSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window && !!window.documentPictureInPicture;
    const [isPipOpen, setIsPipOpen] = useState<boolean>(false);
    const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
    const pipWindowRef = useRef<Window | null>(null);
    const onCloseRef = useRef<(() => void) | undefined>(undefined);

    const copyStylesToPiP = (pipWin: Window) => {
        try {
            // Copy link stylesheets and inline style tags from current document
            const styleSheets = Array.from(document.styleSheets);
            styleSheets.forEach((styleSheet) => {
                try {
                    if (styleSheet.cssRules) {
                        const newStyle = pipWin.document.createElement('style');
                        Array.from(styleSheet.cssRules).forEach((rule) => {
                            newStyle.appendChild(pipWin.document.createTextNode(rule.cssText));
                        });
                        pipWin.document.head.appendChild(newStyle);
                    } else if (styleSheet.href) {
                        const newLink = pipWin.document.createElement('link');
                        newLink.rel = 'stylesheet';
                        newLink.href = styleSheet.href;
                        pipWin.document.head.appendChild(newLink);
                    }
                } catch (e) {
                    // Fallback for CORS stylesheets
                    if (styleSheet.href) {
                        const newLink = pipWin.document.createElement('link');
                        newLink.rel = 'stylesheet';
                        newLink.href = styleSheet.href;
                        pipWin.document.head.appendChild(newLink);
                    }
                }
            });

            // Copy explicit head elements like google fonts or style elements
            const styleElements = document.querySelectorAll('link[rel="stylesheet"], style');
            styleElements.forEach((el) => {
                if (!pipWin.document.head.querySelector(`[data-cuos-cloned="${el.getAttribute('href') || 'style'}"]`)) {
                    const cloned = el.cloneNode(true) as HTMLElement;
                    cloned.setAttribute('data-cuos-cloned', el.getAttribute('href') || 'style');
                    pipWin.document.head.appendChild(cloned);
                }
            });
        } catch (err) {
            console.warn('[useDocumentPiP] Failed to copy some styles:', err);
        }
    };

    const closePiP = useCallback(() => {
        if (pipWindowRef.current) {
            try {
                if (!pipWindowRef.current.closed) {
                    pipWindowRef.current.close();
                }
            } catch {
                // Ignore window close errors
            }
            pipWindowRef.current = null;
        }
        setPipContainer(null);
        setIsPipOpen(false);
    }, []);

    const openPiP = useCallback(async (options: UseDocumentPiPOptions = {}): Promise<boolean> => {
        if (!isSupported || !window.documentPictureInPicture) {
            console.warn('[useDocumentPiP] Document Picture-in-Picture is not supported in this browser.');
            return false;
        }

        // If PiP is already open, focus it
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
            try {
                pipWindowRef.current.focus();
                return true;
            } catch {
                pipWindowRef.current = null;
            }
        }

        const width = options.width || 330;
        const height = options.height || 185;
        onCloseRef.current = options.onClose;

        try {
            const pipWin = await window.documentPictureInPicture.requestWindow({
                width,
                height,
                preferInitialWindowPlacement: true,
            });

            pipWindowRef.current = pipWin;

            // Configure document body
            pipWin.document.title = options.title || 'CUOS Timer';
            pipWin.document.body.style.margin = '0';
            pipWin.document.body.style.padding = '0';
            pipWin.document.body.style.backgroundColor = '#F8FAFC';
            pipWin.document.body.style.fontFamily = '"Inter", system-ui, sans-serif';
            pipWin.document.body.style.overflow = 'hidden';
            pipWin.document.body.style.userSelect = 'none';

            // Copy stylesheets to PiP document
            copyStylesToPiP(pipWin);

            // Create container element for React portal
            const container = pipWin.document.createElement('div');
            container.id = 'cuos-pip-root';
            container.style.width = '100%';
            container.style.height = '100%';
            pipWin.document.body.appendChild(container);

            const handleUnload = () => {
                pipWindowRef.current = null;
                setPipContainer(null);
                setIsPipOpen(false);
                if (onCloseRef.current) {
                    onCloseRef.current();
                }
            };

            pipWin.addEventListener('pagehide', handleUnload, { once: true });

            setPipContainer(container);
            setIsPipOpen(true);
            return true;
        } catch (error) {
            console.error('[useDocumentPiP] Failed to open Document Picture-in-Picture window:', error);
            setIsPipOpen(false);
            setPipContainer(null);
            pipWindowRef.current = null;
            return false;
        }
    }, [isSupported]);

    const resizePiP = useCallback((width: number, height: number) => {
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
            try {
                pipWindowRef.current.resizeTo(width, height);
            } catch (err) {
                console.warn('[useDocumentPiP] Unable to resize PiP window:', err);
            }
        }
    }, []);

    // Clean up when unmounting main app
    useEffect(() => {
        return () => {
            if (pipWindowRef.current && !pipWindowRef.current.closed) {
                pipWindowRef.current.close();
                pipWindowRef.current = null;
            }
        };
    }, []);

    return {
        isSupported,
        isPipOpen,
        pipContainer,
        pipWindow: pipWindowRef.current,
        openPiP,
        closePiP,
        resizePiP,
    };
}
