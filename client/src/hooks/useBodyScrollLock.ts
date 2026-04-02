import { useEffect } from 'react';

let activeLockCount = 0;
let lockedScrollY = 0;
let originalBodyStyles: Partial<CSSStyleDeclaration> | null = null;
let originalHtmlOverflow = '';

export default function useBodyScrollLock(locked: boolean) {
    useEffect(() => {
        if (!locked || typeof document === 'undefined') return;

        const body = document.body;
        const html = document.documentElement;

        if (activeLockCount === 0) {
            lockedScrollY = window.scrollY;
            originalBodyStyles = {
                overflow: body.style.overflow,
                position: body.style.position,
                top: body.style.top,
                width: body.style.width,
                left: body.style.left,
                right: body.style.right,
            };
            originalHtmlOverflow = html.style.overflow;

            body.style.overflow = 'hidden';
            body.style.position = 'fixed';
            body.style.top = `-${lockedScrollY}px`;
            body.style.width = '100%';
            body.style.left = '0';
            body.style.right = '0';
            html.style.overflow = 'hidden';
        }

        activeLockCount += 1;

        return () => {
            activeLockCount = Math.max(0, activeLockCount - 1);

            if (activeLockCount === 0 && originalBodyStyles) {
                body.style.overflow = originalBodyStyles.overflow ?? '';
                body.style.position = originalBodyStyles.position ?? '';
                body.style.top = originalBodyStyles.top ?? '';
                body.style.width = originalBodyStyles.width ?? '';
                body.style.left = originalBodyStyles.left ?? '';
                body.style.right = originalBodyStyles.right ?? '';
                html.style.overflow = originalHtmlOverflow;
                window.scrollTo({ top: lockedScrollY });
                originalBodyStyles = null;
            }
        };
    }, [locked]);
}
