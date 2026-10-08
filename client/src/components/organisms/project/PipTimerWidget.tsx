import { useState, useMemo } from 'react';
import {
    Play,
    Pause,
    Minimize2,
    Maximize2,
    Loader2,
    Coffee,
    Utensils,
    ChevronRight,
    ArrowLeft,
} from 'lucide-react';
import { useTimer, formatElapsed } from '@/hooks/useTaskTimer';
import { useBreak, type BreakType } from '@/hooks/useBreakTimer';
import { useBroadcastBreakMutation } from '@/features/notification/api/notificationApi';
import { LapIcon } from '@/components/atoms/LapIcon';
import toast from 'react-hot-toast';

interface PipTimerWidgetProps {
    onClosePiP: () => void;
    onEndDay: () => void;
    onLapse?: () => void;
    unassignedLapsesCount?: number;
    lapseBlocked?: boolean;
    resizePiP: (width: number, height: number) => void;
}

const QUICK_TEA_OPTIONS = [
    { minutes: 30, seconds: 30 * 60, label: '30m', tag: 'Quick' },
    { minutes: 45, seconds: 45 * 60, label: '45m', tag: 'Standard' },
    { minutes: 60, seconds: 60 * 60, label: '60m', tag: '1 hr' },
];

export default function PipTimerWidget({
    onEndDay,
    onLapse,
    unassignedLapsesCount = 0,
    lapseBlocked = false,
    resizePiP,
}: PipTimerWidgetProps) {
    const { timer, elapsed, isRunning, startTimer, pauseTimer, resumeTimer, isSyncing } = useTimer();
    const {
        isOnBreak,
        breakType,
        currentBreakElapsed,
        maxBreakDuration,
        remainingBreakSeconds,
        startBreak,
        endBreak,
    } = useBreak();
    const [broadcastBreak] = useBroadcastBreakMutation();

    const [mode, setMode] = useState<'expanded' | 'collapsed'>('expanded');
    const [view, setView] = useState<'main' | 'break-picker'>('main');
    const [isEndingBreak, setIsEndingBreak] = useState(false);
    const [isStartingBreak, setIsStartingBreak] = useState(false);

    const handleToggleMode = () => {
        if (mode === 'expanded') {
            setMode('collapsed');
            setView('main');
            resizePiP(245, 58);
        } else {
            setMode('expanded');
            resizePiP(340, 275);
        }
    };

    const handleTogglePlayPause = async () => {
        if (isOnBreak) {
            setIsEndingBreak(true);
            try {
                await endBreak();
                toast.success('Break ended! Work timer running 🎉');
            } finally {
                setIsEndingBreak(false);
            }
            return;
        }
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

    const handleStartBreak = async (type: BreakType, seconds?: number) => {
        setIsStartingBreak(true);
        try {
            if (!isRunning) {
                if (!timer) startTimer();
                else resumeTimer();
            }
            await startBreak(type, undefined, seconds);
            await broadcastBreak({ breakType: type }).unwrap();
            const label = type === 'lunch' ? 'Lunch Break' : 'Tea Break';
            toast.success(`${label} started! Enjoy your break ☕`);
            setView('main');
        } catch {
            toast.success('Break started!');
            setView('main');
        } finally {
            setIsStartingBreak(false);
        }
    };

    const formatted = formatElapsed(elapsed);

    const limitBadgeText = useMemo(() => {
        if (!maxBreakDuration) return null;
        if (remainingBreakSeconds !== null && remainingBreakSeconds > 0) {
            const minsLeft = Math.ceil(remainingBreakSeconds / 60);
            return `${minsLeft}m left`;
        }
        return maxBreakDuration === 3600 ? '1h max' : `${Math.round(maxBreakDuration / 60)}m max`;
    }, [maxBreakDuration, remainingBreakSeconds]);

    // ── COLLAPSED MODE (HORIZONTAL MICRO-BAR) ───────────────────────────────
    if (mode === 'collapsed') {
        return (
            <div
                className="w-full h-full flex items-center justify-between px-2.5 bg-slate-50 select-none box-border border-b border-slate-200/60"
                style={{ height: '100vh', boxSizing: 'border-box' }}
            >
                {/* 1. Play / Pause / Resume Work */}
                <button
                    onClick={handleTogglePlayPause}
                    disabled={isSyncing || isEndingBreak}
                    title={isOnBreak ? 'Resume work' : isRunning ? 'Pause timer' : 'Resume timer'}
                    aria-label={isOnBreak ? 'Resume work' : isRunning ? 'Pause timer' : 'Resume timer'}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shrink-0 shadow-sm disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                    style={{ backgroundColor: isOnBreak ? '#7C3AED' : 'var(--color-primary, #10B981)' }}
                >
                    {isSyncing || isEndingBreak ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : isOnBreak ? (
                        <Play size={14} fill="currentColor" className="ml-0.5" />
                    ) : isRunning ? (
                        <Pause size={14} fill="currentColor" />
                    ) : (
                        <Play size={14} fill="currentColor" className="ml-0.5" />
                    )}
                </button>

                {/* 2. Timer Digits */}
                <div className="px-1.5 flex-1 text-center min-w-0">
                    <span
                        className="text-base font-bold tabular-nums tracking-wide truncate block"
                        style={{
                            fontFamily: 'Outfit, Inter, system-ui, sans-serif',
                            color: isOnBreak ? '#6D28D9' : '#0F172A',
                            lineHeight: 1.1,
                        }}
                    >
                        {isOnBreak ? formatElapsed(currentBreakElapsed) : formatted}
                    </span>
                    <span
                        className="text-[9.5px] font-semibold truncate block"
                        style={{ color: isOnBreak ? '#7C3AED' : '#64748B' }}
                    >
                        {isOnBreak
                            ? `${breakType === 'lunch' ? 'Lunch' : breakType === 'tea' ? 'Tea' : 'Break'}${limitBadgeText ? ` (${limitBadgeText})` : ''}`
                            : isRunning
                                ? 'Working'
                                : 'Paused'}
                    </span>
                </div>

                {/* 3. Lapse Action Button */}
                <div className="relative shrink-0 mx-0.5">
                    <button
                        onClick={onLapse}
                        disabled={lapseBlocked || isOnBreak || !timer}
                        title={
                            !timer
                                ? 'Start timer first to record lapse'
                                : isOnBreak
                                    ? 'Cannot record lapse while on break'
                                    : 'Record lapse'
                        }
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                    >
                        <LapIcon size={13} />
                    </button>
                    {unassignedLapsesCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-mono font-bold flex items-center justify-center bg-slate-800 text-white shadow-xs pointer-events-none">
                            {unassignedLapsesCount}
                        </span>
                    )}
                </div>

                {/* 4. Break Trigger Button */}
                <button
                    onClick={() => {
                        setMode('expanded');
                        setView('break-picker');
                        resizePiP(340, 275);
                    }}
                    title="Take a break"
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-purple-600 hover:bg-purple-50 transition-all shrink-0 mx-0.5 shadow-xs"
                >
                    <Coffee size={13} />
                </button>

                {/* 5. Expand Button */}
                <button
                    onClick={handleToggleMode}
                    title="Expand timer controls"
                    aria-label="Expand timer controls"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-all shrink-0 ml-0.5"
                >
                    <Maximize2 size={13} />
                </button>
            </div>
        );
    }

    // ── EXPANDED MODE (COMPLETE PIP DASHBOARD) ──────────────────────────────
    return (
        <div
            className="w-full h-full flex flex-col justify-between p-3.5 bg-slate-50 select-none box-border"
            style={{ height: '100vh', boxSizing: 'border-box' }}
        >
            {/* Top Bar: Status indicator & Mode toggle */}
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 shrink-0">
                        {isOnBreak ? (
                            <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600" />
                            </>
                        ) : isRunning ? (
                            <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </>
                        ) : (
                            <span className="inline-flex rounded-full h-2 w-2 bg-amber-400" />
                        )}
                    </span>
                    <span
                        className="text-[11px] font-bold tracking-wider text-slate-700 uppercase"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                        {isOnBreak ? 'ON BREAK' : isRunning ? 'RUNNING' : timer ? 'PAUSED' : 'READY'}
                    </span>
                </div>

                <button
                    onClick={handleToggleMode}
                    title="Collapse to mini timer"
                    aria-label="Collapse to mini timer"
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                >
                    <Minimize2 size={12} />
                    <span>Collapse</span>
                </button>
            </div>

            {/* ── Center Content: Standard View OR Break Picker ────────────── */}
            {view === 'break-picker' ? (
                /* ── Break Selection View inside PiP ── */
                <div className="my-auto py-1">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={() => setView('main')}
                            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            <ArrowLeft size={12} /> Back
                        </button>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Choose Break
                        </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {/* Lunch Break */}
                        <button
                            onClick={() => handleStartBreak('lunch')}
                            disabled={isStartingBreak}
                            className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100/70 text-left transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-amber-200/80 flex items-center justify-center text-amber-700">
                                    <Utensils size={13} />
                                </span>
                                <div>
                                    <div className="text-xs font-bold text-amber-900">Lunch Break</div>
                                    <div className="text-[10px] text-amber-700">1 hr default • Auto-resumes</div>
                                </div>
                            </div>
                            <ChevronRight size={13} className="text-amber-500" />
                        </button>

                        {/* Tea Break Options */}
                        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                            {QUICK_TEA_OPTIONS.map((opt) => (
                                <button
                                    key={opt.minutes}
                                    onClick={() => handleStartBreak('tea', opt.seconds)}
                                    disabled={isStartingBreak}
                                    className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100/70 transition-all text-center"
                                >
                                    <Coffee size={12} className="text-purple-600 mb-0.5" />
                                    <span className="text-xs font-bold text-purple-950">{opt.label}</span>
                                    <span className="text-[9.5px] text-purple-600 font-medium">{opt.tag}</span>
                                </button>
                            ))}
                        </div>

                        {/* Custom Break */}
                        <button
                            onClick={() => handleStartBreak('other')}
                            disabled={isStartingBreak}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-left transition-all"
                        >
                            <span className="text-[11px] font-semibold text-slate-700">Custom Break (Notify Team)</span>
                            <ChevronRight size={12} className="text-slate-400" />
                        </button>
                    </div>
                </div>
            ) : (
                /* ── Standard Timer View ── */
                <div className="my-auto py-1 text-center">
                    <span
                        className="text-3xl font-extrabold tabular-nums tracking-wider text-slate-900 block"
                        style={{ fontFamily: 'Outfit, Inter, sans-serif', lineHeight: 1.1 }}
                    >
                        {isOnBreak ? formatElapsed(currentBreakElapsed) : formatted}
                    </span>
                    <span
                        className="text-[11px] font-semibold tracking-wider uppercase mt-1 block"
                        style={{ color: isOnBreak ? '#7C3AED' : '#64748B' }}
                    >
                        {isOnBreak
                            ? `☕ ${breakType === 'lunch' ? 'LUNCH' : breakType === 'tea' ? 'TEA' : 'AWAY'} BREAK${limitBadgeText ? ` (${limitBadgeText})` : ''}`
                            : isRunning
                                ? 'WORKING TIME'
                                : timer
                                    ? 'PAUSED'
                                    : 'READY TO START'}
                    </span>
                </div>
            )}

            {/* ── Bottom Actions Bar: All Timer Controls ───────────────────── */}
            {view === 'main' && (
                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-200/60">
                    {/* Primary Button: Play / Pause / Resume Work */}
                    <button
                        onClick={handleTogglePlayPause}
                        disabled={isSyncing || isEndingBreak}
                        title={isOnBreak ? 'Resume work' : isRunning ? 'Pause timer' : 'Resume timer'}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-xs disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                        style={{ backgroundColor: isOnBreak ? '#7C3AED' : 'var(--color-primary, #10B981)' }}
                    >
                        {isSyncing || isEndingBreak ? (
                            <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>{isOnBreak ? 'Resuming…' : isRunning ? 'Pausing' : 'Resuming'}</span>
                            </>
                        ) : isOnBreak ? (
                            <>
                                <Play size={13} fill="currentColor" className="ml-0.5" />
                                <span>Resume Work</span>
                            </>
                        ) : isRunning ? (
                            <>
                                <Pause size={13} fill="currentColor" />
                                <span>Pause</span>
                            </>
                        ) : (
                            <>
                                <Play size={13} fill="currentColor" className="ml-0.5" />
                                <span>{timer ? 'Resume' : 'Start'}</span>
                            </>
                        )}
                    </button>

                    {/* Lapse Button */}
                    <div className="relative shrink-0">
                        <button
                            onClick={onLapse}
                            disabled={lapseBlocked || isOnBreak || !timer}
                            title={
                                !timer
                                    ? 'Start timer first to record lapse'
                                    : isOnBreak
                                        ? 'Cannot record lapse while on break'
                                        : 'Record lapse'
                            }
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                        >
                            <LapIcon size={14} />
                        </button>
                        {unassignedLapsesCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-0.5 rounded-full text-[9px] font-mono font-bold flex items-center justify-center bg-slate-800 text-white shadow-xs pointer-events-none">
                                {unassignedLapsesCount}
                            </span>
                        )}
                    </div>

                    {/* Break Button (opens quick selector) */}
                    {!isOnBreak && (
                        <button
                            onClick={() => setView('break-picker')}
                            title="Take a break"
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-purple-600 hover:bg-purple-50 transition-all shrink-0 shadow-xs"
                        >
                            <Coffee size={14} />
                        </button>
                    )}

                    {/* End Day Button */}
                    <button
                        onClick={onEndDay}
                        title="End day & submit time log"
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-200/90 text-slate-800 hover:bg-slate-300 transition-all shrink-0 active:scale-95"
                    >
                        End day
                    </button>
                </div>
            )}
        </div>
    );
}
