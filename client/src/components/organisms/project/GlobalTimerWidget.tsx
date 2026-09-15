import { useState, useEffect, useRef } from 'react';
import { Play, Pause, AlertTriangle, X, PictureInPicture2, Loader2 } from 'lucide-react';
import { useTimer, formatElapsed, LIMIT_SECONDS } from '@/hooks/useTaskTimer';
import { createPortal } from 'react-dom';
import GlobalEndDayContainer from './GlobalEndDayContainer';
import { useSetTimerStatusMutation } from '@/features/project/projectApi';
import { useDocumentPiP } from '@/hooks/useDocumentPiP';
import PipTimerWidget from './PipTimerWidget';
import toast from 'react-hot-toast';
import BreakButton from '@/components/organisms/BreakButton';
import { useBreak } from '@/hooks/useBreakTimer';
import { useLapses } from '@/hooks/useLapses';
import LapseModal from './LapseModal';
import { useGlobalTasks } from '@/hooks/useGlobalTasks';
import { LapIcon } from '@/components/atoms/LapIcon';

export default function GlobalTimerWidget() {
    const { timer, elapsed, isRunning, isHydrated, startTimer, pauseTimer, resumeTimer, stopTimer, bypassLimit, isSyncing, daySessionMeta, refreshDaySession } = useTimer();
    const { totalBreakElapsed, isOnBreak, endBreak } = useBreak();
    const { lapses, lastLapseElapsed, lastLapseBreak, addLapse, assignLapse, advanceLapseBoundary, unassignedLapses } = useLapses();
    const { logTime, updateTask } = useGlobalTasks();

    const [showLimitPopup, setShowLimitPopup] = useState(false);
    const [showEndDayPopup, setShowEndDayPopup] = useState(false);
    const [showLapseModal, setShowLapseModal] = useState(false);
    const [setTimerStatus] = useSetTimerStatusMutation();
    // Brief cooldown after break ends to prevent accidental lapse triggers from mis-clicks
    const [lapseBlocked, setLapseBlocked] = useState(false);
    const prevIsOnBreakRef = useRef<boolean>(false);

    // ── Post-break cooldown — prevent accidental lapse clicks ─────────────────
    useEffect(() => {
        const wasOnBreak = prevIsOnBreakRef.current;
        prevIsOnBreakRef.current = isOnBreak;
        // Break just ended → block Lapse for 1500ms
        if (wasOnBreak && !isOnBreak) {
            setLapseBlocked(true);
            const t = window.setTimeout(() => setLapseBlocked(false), 1500);
            return () => window.clearTimeout(t);
        }
    }, [isOnBreak]);
    // Capture a snapshot of the pending lapse seconds so LapseModal can read it
    const [pendingLapseSeconds, setPendingLapseSeconds] = useState<number>(0);

    const syncStatus = (status: 'running' | 'paused') => {
        setTimerStatus({ status }).catch(() => {/* silent fail */ });
    };

    // Auto-sync status only once initial hydration has settled and when status changes
    useEffect(() => {
        if (!isHydrated) return;

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
    }, [isHydrated, isRunning]);

    const { isSupported, isPipOpen, pipContainer, openPiP, closePiP, resizePiP } = useDocumentPiP();

    useEffect(() => {
        if (isRunning && !timer?.limitBypassed && elapsed >= LIMIT_SECONDS) {
            pauseTimer();
            syncStatus('paused');
            setShowLimitPopup(true);
        }
    }, [isRunning, timer?.limitBypassed, elapsed, pauseTimer]);

    // Keep day timer running while on break — only run after hydration has settled!
    useEffect(() => {
        if (!isHydrated) return;

        if (isOnBreak && !isRunning) {
            if (!timer) {
                startTimer();
                syncStatus('running');
            } else {
                resumeTimer();
                syncStatus('running');
            }
        }
    }, [isHydrated, isOnBreak, isRunning, timer, startTimer, resumeTimer]);

    const handleEndDay = async () => {
        if (isOnBreak) {
            await endBreak();
        }
        await refreshDaySession();
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

    const handleEndDayFromPip = async () => {
        if (isOnBreak) {
            await endBreak();
        }
        await refreshDaySession();
        try {
            window.focus();
        } catch {
            // Browser window focus ignored
        }
        setShowEndDayPopup(true);
    };

    // ── Lapse handler ─────────────────────────────────────────────────────────
    const handleLapse = () => {
        if (!timer) {
            toast.error('Start the timer first before recording a lapse.');
            return;
        }
        // Baseline must be at least the boundary from any previously ended session today or timer starting accumulated
        const effectiveLastElapsed = Math.max(
            lastLapseElapsed,
            daySessionMeta?.lastEndedAccumulated || 0,
            timer.accumulated || 0
        );
        const effectiveLastBreak = Math.max(
            lastLapseBreak,
            daySessionMeta?.lastEndedBreakAccumulated || 0
        );

        // Net work seconds since the last lapse boundary (minus break time in that window)
        const wallDelta = Math.max(0, elapsed - effectiveLastElapsed);
        const breakDelta = totalBreakElapsed >= effectiveLastBreak
            ? totalBreakElapsed - effectiveLastBreak
            : Math.max(0, totalBreakElapsed);
        const netSeconds = Math.max(0, wallDelta - breakDelta);

        if (netSeconds < 10) {
            toast('Lapse is too short — keep working!', { icon: '⏱️' });
            return;
        }

        setPendingLapseSeconds(netSeconds);
        setShowLapseModal(true);
    };

    const handleLapseAssign = async (taskId: string, projectId: string, _markComplete: boolean, note: string) => {
        const lapseRecord = addLapse(pendingLapseSeconds, elapsed, totalBreakElapsed);

        const lapseMinutes = Math.max(1, Math.round(pendingLapseSeconds / 60));
        try {
            await logTime(projectId, taskId, lapseMinutes, note || `Lapse — ${formatElapsed(pendingLapseSeconds)}`);
            // Once assigned time, mark it as completed even if it was in progress
            await updateTask(projectId, taskId, { status: 'completed' });
            // Mark as assigned (keep in lapses state so EOD can subtract this time)
            await assignLapse(lapseRecord.id, taskId, projectId, note || `Lapse — ${formatElapsed(pendingLapseSeconds)}`);
            toast.success(`Logged ${lapseMinutes}m & task marked completed ✓`);
        } catch {
            toast.error('Failed to log lapse time.');
        }
        setShowLapseModal(false);
    };

    const handleLapseKeepUnassigned = () => {
        addLapse(pendingLapseSeconds, elapsed, totalBreakElapsed);
        toast('Lapse kept — assign it at end of day.', { icon: '📌' });
        setShowLapseModal(false);
    };

    // While initial hydration is in flight and there's no cached timer, render a safe loading state
    if (!isHydrated && !timer) {
        return (
            <div className="flex items-center gap-1.5 p-1 rounded-full" style={{ backgroundColor: '#F8FAFC' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 opacity-70" style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="bg-white rounded-full px-3 py-1">
                    <span className="text-sm font-medium tabular-nums tracking-wide text-slate-400">
                        --:--:--
                    </span>
                </div>
                <button
                    disabled
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors opacity-50 cursor-not-allowed shrink-0"
                    style={{ backgroundColor: '#E2E8F0', color: '#1E293B' }}
                >
                    End day
                </button>
                <BreakButton />
            </div>
        );
    }

    if (!timer) {
        return (
            <div className="flex items-center gap-1.5 p-1 rounded-full" style={{ backgroundColor: '#F8FAFC' }}>
                <button
                    onClick={() => {
                        startTimer();
                        syncStatus('running');
                        if (daySessionMeta?.lastEndedAccumulated) {
                            advanceLapseBoundary(
                                daySessionMeta.lastEndedAccumulated,
                                daySessionMeta.lastEndedBreakAccumulated || 0
                            );
                        }
                    }}
                    title="Start day timer"
                    disabled={isSyncing}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    {isSyncing ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                    )}
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

                <BreakButton />

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
                    onClick={() => {
                        if (isOnBreak) {
                            toast('Day timer stays on while on break', { icon: '☕' });
                            return;
                        }
                        pauseTimer();
                        syncStatus('paused');
                    }}
                    title={isOnBreak ? 'Timer stays running during break' : 'Pause'}
                    disabled={isSyncing}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    {isSyncing ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Pause size={16} fill="currentColor" />
                    )}
                </button>
            ) : (
                <button
                    onClick={() => { resumeTimer(); syncStatus('running'); }}
                    title="Resume"
                    disabled={isSyncing}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    {isSyncing ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                    )}
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

            {/* ── Lapse button — compact icon-only ── */}
            <div className="relative shrink-0">
                <button
                    onClick={handleLapse}
                    disabled={lapseBlocked}
                    title={lapseBlocked ? 'Just ended break — wait a moment…' : 'Record a lapse — assign time to a completed task'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '9999px',
                        border: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        color: lapseBlocked ? '#94A3B8' : '#334155',
                        cursor: lapseBlocked ? 'not-allowed' : 'pointer',
                        opacity: lapseBlocked ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                    }}
                    onMouseEnter={(e) => {
                        if (lapseBlocked) return;
                        (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
                    }}
                >
                    <LapIcon size={15} className="text-slate-500" />
                </button>
                {unassignedLapses.length > 0 && (
                    <span
                        title={`${unassignedLapses.length} unassigned lapse${unassignedLapses.length > 1 ? 's' : ''}`}
                        className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center bg-slate-800 text-white shadow-sm pointer-events-none"
                    >
                        {unassignedLapses.length}
                    </span>
                )}
            </div>

            <BreakButton />

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
                    breakSeconds={totalBreakElapsed}
                    daySessionMeta={daySessionMeta}
                    allLapses={lapses}
                    pendingLapses={unassignedLapses}
                    onClose={() => setShowEndDayPopup(false)}
                    onSuccess={(allocatedMinutes?: number) => {
                        setShowEndDayPopup(false);
                        advanceLapseBoundary(elapsed, totalBreakElapsed);
                        stopTimer(allocatedMinutes);
                    }}
                />
            )}

            {showLapseModal && (
                <LapseModal
                    lapseSeconds={pendingLapseSeconds}
                    onAssign={handleLapseAssign}
                    onKeepUnassigned={handleLapseKeepUnassigned}
                    onClose={() => setShowLapseModal(false)}
                />
            )}
        </div>
    );
}
