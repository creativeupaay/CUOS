import { useState, useEffect } from 'react';
import { Play, Pause, AlertTriangle, X, PictureInPicture2 } from 'lucide-react';
import { useTimer, formatElapsed, LIMIT_SECONDS } from '@/hooks/useTaskTimer';
import { createPortal } from 'react-dom';
import GlobalEndDayContainer from './GlobalEndDayContainer';
import { useSetTimerStatusMutation } from '@/features/project/projectApi';
import { useDocumentPiP } from '@/hooks/useDocumentPiP';
import PipTimerWidget from './PipTimerWidget';
import toast from 'react-hot-toast';

export default function GlobalTimerWidget() {
    const { timer, elapsed, isRunning, startTimer, pauseTimer, resumeTimer, stopTimer, bypassLimit } = useTimer();
    const [showLimitPopup, setShowLimitPopup] = useState(false);
    const [showEndDayPopup, setShowEndDayPopup] = useState(false);
    const [setTimerStatus] = useSetTimerStatusMutation();

    const syncStatus = (status: 'running' | 'paused') => {
        setTimerStatus({ status }).catch(() => {/* silent fail */ });
    };

    // Auto-sync status on mount and when it changes (e.g., across tabs or page reloads)
    useEffect(() => {
        syncStatus(isRunning ? 'running' : 'paused');

        let intervalId: number | null = null;
        // Periodically sync with backend every 30s to recover from backend restarts
        if (isRunning) {
            intervalId = window.setInterval(() => {
                syncStatus('running');
            }, 30000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isRunning]);
    const { isSupported, isPipOpen, pipContainer, openPiP, closePiP, resizePiP } = useDocumentPiP();

    useEffect(() => {
        if (isRunning && !timer?.limitBypassed && elapsed >= LIMIT_SECONDS) {
            pauseTimer();
            syncStatus('paused');
            setShowLimitPopup(true);
        }
    }, [isRunning, timer?.limitBypassed, elapsed, pauseTimer]);

    const handleEndDay = () => {
        pauseTimer();
        syncStatus('paused');
        setShowEndDayPopup(true);
    };

    const handlePopOut = async () => {
        if (!isSupported) {
            toast.error('Document Picture-in-Picture is unavailable in your browser.');
            return;
        }
        const success = await openPiP({
            width: 330,
            height: 215,
            title: 'CUOS Universal Timer',
        });
        if (!success && !isPipOpen) {
            toast.error('Failed to open Picture-in-Picture timer window.');
        }
    };

    const handleEndDayFromPip = () => {
        pauseTimer();
        try {
            window.focus();
        } catch {
            // Browser window focus ignored
        }
        setShowEndDayPopup(true);
    };

    if (!timer) {
        return (
            <div className="flex items-center gap-1.5 p-1 rounded-full" style={{ backgroundColor: '#F8FAFC' }}>
                <button
                    onClick={() => { startTimer(); syncStatus('running'); }}
                    title="Start day timer"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                </button>
                <div className="bg-white rounded-full px-3 py-1">
                    <span className="text-sm font-medium tabular-nums tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
                        00:00:00
                    </span>
                </div>
                <button
                    disabled
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors opacity-50 cursor-not-allowed shrink-0"
                    style={{ backgroundColor: '#E2E8F0', color: '#1E293B' }}
                >
                    End day
                </button>

                <button
                    onClick={handlePopOut}
                    title="Pop out floating timer"
                    aria-label="Pop out floating timer"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-all shrink-0 ml-0.5"
                >
                    <PictureInPicture2 size={16} />
                </button>

                {isPipOpen && pipContainer && createPortal(
                    <PipTimerWidget
                        onClosePiP={closePiP}
                        onEndDay={handleEndDayFromPip}
                        resizePiP={resizePiP}
                    />,
                    pipContainer
                )}
            </div>
        );
    }

    return (
        <div
            className="flex items-center gap-1.5 p-1 rounded-full transition-all"
            style={{ backgroundColor: '#F8FAFC' }}
        >
            {isRunning ? (
                <button
                    onClick={() => { pauseTimer(); syncStatus('paused'); }}
                    title="Pause"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Pause size={16} fill="currentColor" />
                </button>
            ) : (
                <button
                    onClick={() => { resumeTimer(); syncStatus('running'); }}
                    title="Resume"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                </button>
            )}

            <div className="bg-white rounded-full px-3 py-1">
                <span
                    className="text-sm font-medium tabular-nums tracking-wide min-w-[65px] text-center inline-block"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {formatElapsed(elapsed)}
                </span>
            </div>

            <button
                onClick={handleEndDay}
                title="End Day"
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors hover:bg-slate-300 shrink-0"
                style={{ backgroundColor: '#E2E8F0', color: '#1E293B' }}
            >
                End day
            </button>

            <button
                onClick={handlePopOut}
                title="Pop out floating timer"
                aria-label="Pop out floating timer"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ml-0.5 ${isPipOpen
                        ? 'bg-emerald-100 text-emerald-700 font-bold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
            >
                <PictureInPicture2 size={16} />
            </button>

            {isPipOpen && pipContainer && createPortal(
                <PipTimerWidget
                    onClosePiP={closePiP}
                    onEndDay={handleEndDayFromPip}
                    resizePiP={resizePiP}
                />,
                pipContainer
            )}

            {showLimitPopup && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
                        <button onClick={() => setShowLimitPopup(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={18} />
                        </button>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle size={24} className="text-amber-500" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">12-Hour Limit Reached</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                You have been working for 12 hours. Do you want to continue running the timer?
                            </p>
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={() => setShowLimitPopup(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                >
                                    No, stop here
                                </button>
                                <button
                                    onClick={() => {
                                        bypassLimit();
                                        setShowLimitPopup(false);
                                    }}
                                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                >
                                    Yes, continue
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showEndDayPopup && (
                <GlobalEndDayContainer
                    timerSeconds={elapsed}
                    onClose={() => setShowEndDayPopup(false)}
                    onSuccess={() => {
                        setShowEndDayPopup(false);
                        stopTimer();
                    }}
                />
            )}
        </div>
    );
}

