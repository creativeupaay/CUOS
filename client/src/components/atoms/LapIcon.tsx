import React from 'react';

export interface LapIconProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    className?: string;
}

export function LapIcon({ size = 16, className = '', style, ...props }: LapIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={style}
            {...props}
        >
            {/* Pole with rounded caps */}
            <line
                x1="5"
                y1="3"
                x2="5"
                y2="21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
            {/* Pennant flag */}
            <path
                d="M 6.5 2.8 C 9.5 2.1, 15.5 3.8, 19.5 3.0 C 14.8 6.2, 9.8 9.2, 6.5 12.3 Z"
                fill="currentColor"
            />
        </svg>
    );
}

export default LapIcon;
