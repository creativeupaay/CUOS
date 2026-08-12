import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimerState {
    startedAt: number;       // epoch ms of when current run began
    accumulated: number;     // seconds elapsed before current run
    status: 'running' | 'paused';
    limitBypassed?: boolean;
}

export interface TimerContextValue {
    timer: TimerState | null;
    elapsed: number;          // total seconds elapsed (accumulated + current run)
    isRunning: boolean;
    startTimer: () => void;
    pauseTimer: () => void;
    resumeTimer: () => void;
    stopTimer: () => TimerState | null;  // returns snapshot then clears
    clearTimer: () => void;
    bypassLimit: () => void;
}

const STORAGE_KEY = 'cuos_global_timer';
export const LIMIT_SECONDS = 12 * 60 * 60;

// ─── Context ──────────────────────────────────────────────────────────────────

const TimerContext = createContext<TimerContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadFromStorage(): TimerState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as TimerState;
    } catch {
        return null;
    }
}

function saveToStorage(state: TimerState | null) {
    if (state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
}

function calcElapsed(timer: TimerState | null): number {
    if (!timer) return 0;
    if (timer.status === 'paused') return timer.accumulated;
    const runSeconds = Math.floor((Date.now() - timer.startedAt) / 1000);
    const total = timer.accumulated + runSeconds;
    if (!timer.limitBypassed && total > LIMIT_SECONDS) {
        return LIMIT_SECONDS;
    }
    return total;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [timer, setTimer] = useState<TimerState | null>(loadFromStorage);
    const [elapsed, setElapsed] = useState<number>(() => calcElapsed(loadFromStorage()));
    const intervalRef = useRef<number | null>(null);

    // Keep elapsed in sync
    useEffect(() => {
        const tick = () => setElapsed(calcElapsed(timer));
        tick(); // immediate update

        if (timer?.status === 'running') {
            intervalRef.current = window.setInterval(tick, 1000);
        } else {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [timer]);

    // Sync to localStorage whenever state changes
    useEffect(() => {
        saveToStorage(timer);
    }, [timer]);

    const startTimer = useCallback(() => {
        const newTimer: TimerState = {
            startedAt: Date.now(),
            accumulated: 0,
            status: 'running',
        };
        setTimer(newTimer);
    }, []);

    const pauseTimer = useCallback(() => {
        setTimer(prev => {
            if (!prev || prev.status !== 'running') return prev;
            const runSeconds = Math.floor((Date.now() - prev.startedAt) / 1000);
            let accumulated = prev.accumulated + runSeconds;
            if (!prev.limitBypassed && accumulated > LIMIT_SECONDS) {
                accumulated = LIMIT_SECONDS;
            }
            return {
                ...prev,
                accumulated,
                status: 'paused',
            };
        });
    }, []);

    const resumeTimer = useCallback(() => {
        setTimer(prev => {
            if (!prev || prev.status !== 'paused') return prev;
            return {
                ...prev,
                startedAt: Date.now(),
                status: 'running',
            };
        });
    }, []);

    const stopTimer = useCallback((): TimerState | null => {
        let snapshot: TimerState | null = null;
        setTimer(prev => {
            if (!prev) return null;
            // Freeze accumulated at stop time
            const runSeconds = prev.status === 'running'
                ? Math.floor((Date.now() - prev.startedAt) / 1000)
                : 0;
            let accumulated = prev.accumulated + runSeconds;
            if (!prev.limitBypassed && accumulated > LIMIT_SECONDS) {
                accumulated = LIMIT_SECONDS;
            }
            snapshot = { ...prev, accumulated, status: 'paused' };
            return null; // clear timer
        });
        return snapshot;
    }, []);

    const clearTimer = useCallback(() => {
        setTimer(null);
    }, []);

    const bypassLimit = useCallback(() => {
        setTimer(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                limitBypassed: true,
                status: 'running',
                startedAt: prev.status === 'paused' ? Date.now() : prev.startedAt
            };
        });
    }, []);

    return (
        <TimerContext.Provider value={{
            timer,
            elapsed,
            isRunning: timer?.status === 'running',
            startTimer,
            pauseTimer,
            resumeTimer,
            stopTimer,
            clearTimer,
            bypassLimit,
        }}>
            {children}
        </TimerContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTimer(): TimerContextValue {
    const ctx = useContext(TimerContext);
    if (!ctx) throw new Error('useTimer must be used within TimerProvider');
    return ctx;
}

// ─── Format helper ───────────────────────────────────────────────────────────

export function formatElapsed(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
