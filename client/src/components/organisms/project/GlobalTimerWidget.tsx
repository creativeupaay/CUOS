import { useState, useEffect } from 'react';

import { Play, Pause, AlertTriangle, X } from 'lucide-react';
import { useTimer, formatElapsed, LIMIT_SECONDS } from '@/hooks/useTaskTimer';
import { createPortal } from 'react-dom';
import GlobalEndDayContainer from './GlobalEndDayContainer';

export default function GlobalTimerWidget() {
    const { timer, elapsed, isRunning, startTimer, pauseTimer, resumeTimer, stopTimer, bypassLimit } = useTimer();
    const [showLimitPopup, setShowLimitPopup] = useState(false);
    const [showEndDayPopup, setShowEndDayPopup] = useState(false);



    useEffect(() => {
        if (isRunning && !timer?.limitBypassed && elapsed >= LIMIT_SECONDS) {
            pauseTimer();
            setShowLimitPopup(true);
        }
    }, [isRunning, timer?.limitBypassed, elapsed, pauseTimer]);

    const handleEndDay = () => {
        pauseTimer();
        setShowEndDayPopup(true);
    };

    if (!timer) {
        return (
            <div className="flex items-center gap-1.5 p-1 rounded-full" style={{ backgroundColor: '#F8FAFC' }}>
                <button
                    onClick={() => startTimer()}
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
                    onClick={pauseTimer}
                    title="Pause"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Pause size={16} fill="currentColor" />
                </button>
            ) : (
                <button
                    onClick={resumeTimer}
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
