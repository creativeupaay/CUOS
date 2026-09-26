import type { ReactNode, CSSProperties } from 'react';
import { createPortal } from 'react-dom';

type ModalPortalProps = {
    children: ReactNode;
    high?: boolean;
    className?: string;
    style?: CSSProperties;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export default function ModalPortal({ children, high = false, className = '', style, onClick }: ModalPortalProps) {
    if (typeof document === 'undefined') {
        return null;
    }

    const baseClass = high ? 'modal-overlay-high' : 'modal-overlay';
    const mergedClass = className ? `${baseClass} ${className}` : baseClass;

    return createPortal(
        <div className={mergedClass} style={style} onClick={onClick}>
            {children}
        </div>,
        document.body
    );
}
