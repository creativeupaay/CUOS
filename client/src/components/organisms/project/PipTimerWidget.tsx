import { useState } from 'react';
import { Play, Pause, Minimize2, Maximize2, Loader2 } from 'lucide-react';
import { useTimer, formatElapsed } from '@/hooks/useTaskTimer';

interface PipTimerWidgetProps {
    onClosePiP: () => void;
    onEndDay: () => void;
    resizePiP: (width: number, height: number) => void;
}

export default function PipTimerWidget({ onEndDay, resizePiP }: PipTimerWidgetProps) {
    const { timer, elapsed, isRunning, startTimer, pauseTimer, resumeTimer, isSyncing } = useTimer();
    const [mode, setMode] = useState<'expanded' | 'collapsed'>('expanded');

    const handleToggleMode = () => {
        if (mode === 'expanded') {
            setMode('collapsed');
            resizePiP(185, 58);
        } else {
            setMode('expanded');
            resizePiP(330, 215);
        }
    };

    const handleTogglePlayPause = () => {
        if (!timer) {
            startTimer();
            return;
        }
        if (isRunning) {
            pauseTimer();
        } else {
            resumeTimer();
        }
    };

    const formatted = formatElapsed(elapsed);

    // ── COLLAPSED MODE (HORIZONTAL) ──────────────────────────────────────────
    if (mode === 'collapsed') {
        return (
            <div
                className="w-full h-full flex items-center justify-between px-3 bg-slate-50 select-none box-border border-b border-slate-200/60"
                style={{ height: '100vh', boxSizing: 'border-box' }}
            >
                {/* Play / Pause */}
                <button
                    onClick={handleTogglePlayPause}
                    disabled={isSyncing}
                    title={isRunning ? 'Pause timer' : 'Resume timer'}
                    aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shrink-0 shadow-sm disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-primary, #10B981)' }}
                >
                    {isSyncing ? (
                        <Loader2 size={15} className="animate-spin" />
                    ) : isRunning ? (
                        <Pause size={15} fill="currentColor" />
                    ) : (
                        <Play size={15} fill="currentColor" className="ml-0.5" />
                    )}
                </button>

                {/* Timer Digits */}
                <div className="px-2 flex-1 text-center min-w-0">
                    <span
                        className="text-base font-bold tabular-nums tracking-wide text-slate-800 truncate block"
                        style={{ fontFamily: 'Outfit, Inter, system-ui, sans-serif' }}
                    >
                        {formatted}
                    </span>
                </div>

                {/* Expand Button */}
                <button
                    onClick={handleToggleMode}
                    title="Expand timer controls"
                    aria-label="Expand timer controls"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-all shrink-0"
                >
                    <Maximize2 size={14} />
                </button>
            </div>
        );
    }

    // ── EXPANDED MODE ─────────────────────────────────────────────────────────
    return (
        <div
            className="w-full h-full flex flex-col justify-between p-3.5 bg-slate-50 select-none box-border"
            style={{ height: '100vh', boxSizing: 'border-box' }}
        >
            {/* Top Bar: CUOS status indicator & Collapse button */}
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        {isRunning ? (
                            <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                            </>
                        ) : (
                            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                        )}
                    </span>
                    <span
                        className="text-[11px] font-bold tracking-wider text-slate-700 uppercase"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                        CUOS TIMER
                    </span>
                </div>

                <button
                    onClick={handleToggleMode}
                    title="Collapse to mini timer"
                    aria-label="Collapse to mini timer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                >
                    <Minimize2 size={13} />
                    <span>Collapse</span>
                </button>
            </div>

            {/* Timer Display */}
            <div className="my-auto py-1 text-center">
                <span
                    className="text-3xl font-extrabold tabular-nums tracking-wider text-slate-900 block"
                    style={{ fontFamily: 'Outfit, Inter, sans-serif' }}
                >
                    {formatted}
                </span>
                <span className="text-[11px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5 block">
                    {isRunning ? 'RUNNING' : timer ? 'PAUSED' : 'READY'}
                </span>
            </div>

            {/* Bottom Actions: Play/Pause & End Day */}
            <div className="flex items-center justify-center gap-3 pt-1 pb-1">
                <button
                    onClick={handleTogglePlayPause}
                    disabled={isSyncing}
                    title={isRunning ? 'Pause timer' : 'Resume timer'}
                    aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-primary, #10B981)' }}
                >
                    {isSyncing ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>{isRunning ? 'Pausing' : timer ? 'Resuming' : 'Starting'}</span>
                        </>
                    ) : isRunning ? (
                        <>
                            <Pause size={14} fill="currentColor" />
                            <span>Pause</span>
                        </>
                    ) : (
                        <>
                            <Play size={14} fill="currentColor" className="ml-0.5" />
                            <span>{timer ? 'Resume' : 'Start'}</span>
                        </>
                    )}
                </button>

                <button
                    onClick={onEndDay}
                    title="End day & submit time log"
                    aria-label="End day & submit time log"
                    className="px-4 py-2 rounded-full text-xs font-semibold transition-all hover:bg-slate-300 active:scale-95"
                    style={{ backgroundColor: '#E2E8F0', color: '#1E293B' }}
                >
                    End day
                </button>
            </div>
        </div>
    );
}
