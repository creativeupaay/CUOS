import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHydrationContext } from './HydrationProvider';
import { formatContinuousDuration } from './useHydrationReminder';

const STYLES = `
@keyframes moveWave {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}

@keyframes bubbleRise {
    0% {
        transform: translateY(20px) scale(0.5);
        opacity: 0;
    }
    10% {
        opacity: 0.6;
    }
    80% {
        opacity: 0.6;
    }
    100% {
        transform: translateY(-80vh) scale(1.5);
        opacity: 0;
    }
}

.water-container {
    transition: height 1.5s ease-in-out;
}

.water-bubble {
    position: absolute;
    bottom: -20px;
    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 50%;
    animation: bubbleRise linear infinite;
    pointer-events: none;
    z-index: 5;
}
`;

function useFocusTrap(isActive: boolean) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isActive) return;

        const container = containerRef.current;
        if (!container) return;

        const focusableElements = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        firstElement.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isActive]);

    return containerRef;
}

const WaveLayer = ({ color, gradient, speed, height, zIndex, offsetTop }: any) => (
    <div 
        style={{
            position: 'absolute',
            top: offsetTop,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex,
            pointerEvents: 'none',
        }}
    >
        <div 
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '200%',
                height: height,
                animation: `moveWave ${speed}s linear infinite`,
                display: 'flex',
                color: color
            }}
        >
            <svg viewBox="0 0 1440 110" preserveAspectRatio="none" style={{ width: '50%', height: '100%', display: 'block', margin: 0, padding: 0 }}>
                <path fill="currentColor" d="M0,50 Q180,100 360,50 T720,50 T1080,50 T1440,50 L1440,120 L0,120 Z"></path>
            </svg>
            <svg viewBox="0 0 1440 110" preserveAspectRatio="none" style={{ width: '50%', height: '100%', display: 'block', margin: 0, padding: 0 }}>
                <path fill="currentColor" d="M0,50 Q180,100 360,50 T720,50 T1080,50 T1440,50 L1440,120 L0,120 Z"></path>
            </svg>
        </div>
        
        <div 
            style={{
                position: 'absolute',
                top: height - 1, // overlap 1px to avoid seams
                left: 0,
                right: 0,
                bottom: 0,
                background: gradient || color,
            }}
        />
    </div>
);

const Waves = () => (
    <div className="absolute inset-0 w-full pointer-events-none" style={{ zIndex: 10 }}>
        {/* Back Layer */}
        <WaveLayer 
            color="rgba(64, 196, 255, 0.15)"
            gradient="linear-gradient(180deg, rgba(64, 196, 255, 0.15) 0%, rgba(0, 176, 255, 0.25) 100%)"
            speed={15}
            height={70}
            offsetTop={0}
            zIndex={1}
        />
        
        {/* Middle Layer */}
        <WaveLayer 
            color="rgba(0, 176, 255, 0.2)"
            gradient="linear-gradient(180deg, rgba(0, 176, 255, 0.2) 0%, rgba(0, 145, 234, 0.35) 100%)"
            speed={10}
            height={55}
            offsetTop={25}
            zIndex={2}
        />
        
        {/* Front Layer */}
        <WaveLayer 
            color="rgba(0, 145, 234, 0.25)"
            gradient="linear-gradient(180deg, rgba(0, 145, 234, 0.25) 0%, rgba(1, 87, 155, 0.5) 100%)"
            speed={6}
            height={40}
            offsetTop={50}
            zIndex={3}
        />
    </div>
);

const Bubbles = () => {
    const bubbles = [
        { left: '10%', size: 15, duration: 12, delay: 0 },
        { left: '25%', size: 25, duration: 18, delay: 5 },
        { left: '45%', size: 10, duration: 10, delay: 2 },
        { left: '65%', size: 20, duration: 15, delay: 7 },
        { left: '85%', size: 18, duration: 14, delay: 3 },
        { left: '15%', size: 22, duration: 16, delay: 9 },
        { left: '75%', size: 12, duration: 11, delay: 1 },
    ];
    
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 5 }}>
            {bubbles.map((b, i) => (
                <div 
                    key={i} 
                    className="water-bubble"
                    style={{
                        left: b.left,
                        width: b.size,
                        height: b.size,
                        animationDuration: `${b.duration}s`,
                        animationDelay: `${b.delay}s`
                    }}
                />
            ))}
        </div>
    );
};

export function HydrationOverlay() {
    const { state, acknowledgeWater, remindLater, requestNotificationPermission } = useHydrationContext();
    const { stage, message, isSnoozed, cycleStartedAt } = state;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (stage === 'REMINDER_90') {
            requestNotificationPermission();
        }
    }, [stage, requestNotificationPermission]);

    useEffect(() => {
        if (stage !== 'NORMAL' && !isSnoozed) {
            const t = setTimeout(() => setMounted(true), 50);
            return () => clearTimeout(t);
        } else {
            setMounted(false);
        }
    }, [stage, isSnoozed]);

    if (stage === 'NORMAL' || isSnoozed) {
        return null;
    }

    const isBlocking = stage === 'BLOCKED_180';
    const durationLabel = formatContinuousDuration(cycleStartedAt);

    let overlayHeight = '0vh';
    let minHeight = '0px';
    if (mounted) {
        switch (stage) {
            case 'REMINDER_90':
                overlayHeight = '30vh';
                minHeight = '320px'; // Ensure text fits
                break;
            case 'REMINDER_120':
                overlayHeight = '45vh';
                minHeight = '360px';
                break;
            case 'REMINDER_150':
                overlayHeight = '70vh';
                minHeight = '420px';
                break;
            case 'BLOCKED_180':
                overlayHeight = 'calc(100vh - 40px)';
                minHeight = 'calc(100vh - 40px)';
                break;
            default:
                overlayHeight = '0vh';
                minHeight = '0px';
        }
    }

    const content = (
        <>
            <style>{STYLES}</style>
            <div 
                className={`fixed inset-0 z-[2147483647] flex items-end justify-center overflow-hidden ${
                    isBlocking ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                aria-live="polite"
            >
                {/* The main water container that rises from the bottom */}
                <div 
                    className={`absolute inset-x-0 w-full flex flex-col water-container pointer-events-auto`}
                    style={{ bottom: 0, height: overlayHeight, minHeight }}
                    role={isBlocking ? "alertdialog" : "status"}
                    aria-modal={isBlocking}
                >
                    {/* The Faded Blur Layer - Fades in softly at the top to eliminate any rectangular edge */}
                    <div 
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backdropFilter: 'blur(5px)',
                            WebkitBackdropFilter: 'blur(5px)',
                            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,1) 80px)',
                            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,1) 80px)',
                            zIndex: 0,
                            pointerEvents: 'none'
                        }}
                    />
                    
                    <Waves />
                    <Bubbles />

                    {/* We use an inner wrapper to center the content vertically regardless of water height. */}
                    <div className="relative z-20 flex-1 w-full flex items-center justify-center p-4">
                        <OverlayContent 
                            message={message}
                            isBlocking={isBlocking}
                            durationLabel={durationLabel}
                            onAcknowledge={acknowledgeWater}
                            onRemindLater={remindLater}
                        />
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(content, document.body);
}

interface ContentProps {
    message: string | null;
    isBlocking: boolean;
    durationLabel: string;
    onAcknowledge: () => void;
    onRemindLater: () => void;
}

function OverlayContent({ message, isBlocking, durationLabel, onAcknowledge, onRemindLater }: ContentProps) {
    const containerRef = useFocusTrap(isBlocking);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <div 
            ref={containerRef}
            className={`text-center transition-all duration-1000 transform max-w-3xl w-full px-4 ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
        >
            {/* Droplet SVG with soft glow */}
            <div className="w-16 h-16 mx-auto mb-6 relative flex items-center justify-center animate-bounce" style={{ animationDuration: '2.5s' }}>
                <div className="absolute inset-0 bg-white/40 rounded-full blur-xl" />
                <svg viewBox="0 0 24 24" fill="white" className="w-12 h-12 relative z-10" style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 100, 200, 0.4))' }}>
                    <path d="M12 21.5C17.2467 21.5 21.5 17.2467 21.5 12C21.5 8.5 12 2 12 2C12 2 2.5 8.5 2.5 12C2.5 17.2467 6.75329 21.5 12 21.5Z" />
                </svg>
            </div>

            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6" style={{ textShadow: '0 4px 20px rgba(0, 100, 200, 0.4)' }}>
                {isBlocking ? 'TIME FOR A BREAK' : 'Time for some water'}
            </h2>
            
            {/* Glass Pill for Duration */}
            <div className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-white/10 border border-white/20 mb-8 backdrop-blur-md shadow-lg shadow-black/5">
                <p className="text-xs sm:text-sm font-bold text-white tracking-[0.25em] uppercase">
                    {durationLabel} OF CONTINUOUS WORK
                </p>
            </div>

            <div className="max-w-xl mx-auto mb-10 text-white/95 leading-relaxed">
                <p className={`${
                    isBlocking ? 'text-xl sm:text-2xl font-medium' : 'text-lg sm:text-xl'
                }`} style={{ textShadow: '0 2px 10px rgba(0, 100, 200, 0.3)' }}>
                    {message || "It's important to stay hydrated. Take a moment to drink some water and stretch."}
                </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-2">
                <button
                    onClick={onAcknowledge}
                    className="btn px-8 h-12 sm:h-14 text-base sm:text-lg font-bold text-[#0284c7] bg-white hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-900/20 min-w-[180px] cursor-pointer"
                    style={{ borderRadius: '14px' }}
                >
                    I've had water
                </button>

                {isBlocking && (
                    <button
                        onClick={onRemindLater}
                        className="btn px-8 h-12 sm:h-14 text-base sm:text-lg font-bold text-white transition-all hover:bg-white/10 active:scale-95 min-w-[180px] cursor-pointer"
                        style={{ 
                            borderRadius: '14px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        Remind me in 15 min
                    </button>
                )}
            </div>

            {isBlocking && (
                <p className="mt-8 text-sm text-white/70 font-medium" style={{ textShadow: '0 1px 4px rgba(0, 100, 200, 0.3)' }}>
                    Your work timer is still running in the background.
                </p>
            )}
        </div>
    );
}

export default HydrationOverlay;
