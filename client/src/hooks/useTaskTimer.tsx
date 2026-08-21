import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimerState {
    startedAt: number;       // epoch ms of when current run began
    accumulated: number;     // seconds elapsed before current run
    status: 'running' | 'paused';
    limitBypassed?: boolean;
    dateKey?: string;        // YYYY-MM-DD for the work day
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
    isSyncing: boolean;       // true while communicating with server
}

const STORAGE_KEY = 'cuos_global_timer';
const SYNC_POLL_INTERVAL = 15000; // 15 seconds — polls server for cross-device sync
export const LIMIT_SECONDS = 12 * 60 * 60;
const WORK_DAY_START_UTC_MS = 30 * 60_000; // 30 mins = 00:30 UTC = 6:00 AM IST

// ─── Context ──────────────────────────────────────────────────────────────────

const TimerContext = createContext<TimerContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayKey(): string {
    const shifted = new Date(Date.now() - WORK_DAY_START_UTC_MS);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function loadFromStorage(): TimerState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as TimerState;
        
        // Stale state check: If the stored timer is from a previous work day, drop it!
        if (parsed.dateKey && parsed.dateKey !== getTodayKey()) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        
        return parsed;
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

export function calcElapsed(timer: TimerState | null): number {
    if (!timer) return 0;
    if (timer.status === 'paused') return timer.accumulated;
    const runSeconds = Math.floor((Date.now() - timer.startedAt) / 1000);
    const total = timer.accumulated + runSeconds;
    if (!timer.limitBypassed && total > LIMIT_SECONDS) {
        return LIMIT_SECONDS;
    }
    return total;
}

function sessionToTimer(session: {
    accumulated: number;
    startedAt: number | null;
    status: 'running' | 'paused';
    limitBypassed: boolean;
}): TimerState {
    return {
        startedAt: session.startedAt ?? Date.now(),
        accumulated: session.accumulated,
        status: session.status,
        limitBypassed: session.limitBypassed,
        dateKey: getTodayKey(),
    };
}

/** Call the server API without importing RTK Query (to keep the hook self-contained) */
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

async function apiCall(method: string, path: string, body?: any): Promise<any> {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data ?? null;
    } catch {
        return null;
    }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [timer, setTimer] = useState<TimerState | null>(loadFromStorage);
    const [elapsed, setElapsed] = useState<number>(() => calcElapsed(loadFromStorage()));
    const [isSyncing, setIsSyncing] = useState(false);
    const intervalRef = useRef<number | null>(null);
    const syncPollRef = useRef<number | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);

    // ── BroadcastChannel (cross-tab sync within same browser) ─────────────────
    useEffect(() => {
        try {
            const bc = new BroadcastChannel('cuos_timer');
            broadcastRef.current = bc;

            bc.onmessage = (event) => {
                if (event.data?.type === 'TIMER_STATE_UPDATE') {
                    const newTimer = event.data.timer as TimerState | null;
                    setTimer(newTimer);
                    saveToStorage(newTimer);
                }
            };

            return () => {
                bc.close();
                broadcastRef.current = null;
            };
        } catch {
            // BroadcastChannel not supported (rare)
        }
    }, []);

    /** Broadcasts the new timer state to all other tabs in this browser */
    const broadcastState = useCallback((newTimer: TimerState | null) => {
        try {
            broadcastRef.current?.postMessage({ type: 'TIMER_STATE_UPDATE', timer: newTimer });
        } catch { /* ignore */ }
    }, []);

    // ── Hydrate from server on mount ──────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const session = await apiCall('GET', '/projects/day-session');
                if (cancelled || !session) return;

                // Server has a session for today
                const serverTimer = sessionToTimer(session);
                setTimer(serverTimer);
                saveToStorage(serverTimer);
            } catch {
                // Network offline — use localStorage cache (already loaded in useState)
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // ── Keep elapsed in sync ──────────────────────────────────────────────────
    useEffect(() => {
        const tick = () => setElapsed(calcElapsed(timer));
        tick();

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

    // ── Cross-device polling (every 15s while running) ────────────────────────
    useEffect(() => {
        if (!timer?.status || timer.status !== 'running') {
            if (syncPollRef.current) {
                clearInterval(syncPollRef.current);
                syncPollRef.current = null;
            }
            return;
        }

        syncPollRef.current = window.setInterval(async () => {
            try {
                const session = await apiCall('GET', '/projects/day-session');
                if (!session) return;
                
                // If server is paused but we are running, or if server's accumulated time differs greatly (drift)
                // We sync with the server to prevent stale state from persisting.
                const serverTimer = sessionToTimer(session);
                if (session.status === 'paused' || Math.abs(serverTimer.accumulated - timer.accumulated) > 30) {
                    setTimer(serverTimer);
                    saveToStorage(serverTimer);
                    broadcastState(serverTimer);
                }
            } catch { /* ignore network errors */ }
        }, SYNC_POLL_INTERVAL);

        return () => {
            if (syncPollRef.current) {
                clearInterval(syncPollRef.current);
                syncPollRef.current = null;
            }
        };
    }, [timer?.status, broadcastState]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const startTimer = useCallback(() => {
        const newTimer: TimerState = {
            startedAt: Date.now(),
            accumulated: timer?.accumulated ?? 0,   // ← preserve any existing progress!
            status: 'running',
            limitBypassed: timer?.limitBypassed ?? false,
            dateKey: getTodayKey(),
        };
        setTimer(newTimer);
        saveToStorage(newTimer);
        broadcastState(newTimer);

        // Fire-and-forget server sync
        setIsSyncing(true);
        apiCall('POST', '/projects/day-session/start')
            .then((session) => {
                if (session) {
                    // Trust server's accumulated value (may differ if another session ran)
                    const serverTimer = sessionToTimer(session);
                    setTimer(serverTimer);
                    saveToStorage(serverTimer);
                    broadcastState(serverTimer);
                }
            })
            .catch(() => { /* network offline — local state is fine */ })
            .finally(() => setIsSyncing(false));
    }, [timer, broadcastState]);

    const pauseTimer = useCallback(() => {
        setTimer(prev => {
            if (!prev || prev.status !== 'running') return prev;
            const runSeconds = Math.floor((Date.now() - prev.startedAt) / 1000);
            let accumulated = prev.accumulated + runSeconds;
            if (!prev.limitBypassed && accumulated > LIMIT_SECONDS) {
                accumulated = LIMIT_SECONDS;
            }
            const next: TimerState = { ...prev, accumulated, status: 'paused' };
            saveToStorage(next);
            broadcastState(next);

            // Fire-and-forget server sync
            apiCall('PATCH', '/projects/day-session/pause').catch(() => {});

            return next;
        });
    }, [broadcastState]);

    const resumeTimer = useCallback(() => {
        setTimer(prev => {
            if (!prev || prev.status !== 'paused') return prev;
            const next: TimerState = { ...prev, startedAt: Date.now(), status: 'running', dateKey: getTodayKey() };
            saveToStorage(next);
            broadcastState(next);

            // Sync with server and adopt server state (which corrects accumulated drift across days)
            setIsSyncing(true);
            apiCall('POST', '/projects/day-session/start')
                .then((session) => {
                    if (session) {
                        const serverTimer = sessionToTimer(session);
                        setTimer(serverTimer);
                        saveToStorage(serverTimer);
                        broadcastState(serverTimer);
                    }
                })
                .catch(() => {})
                .finally(() => setIsSyncing(false));

            return next;
        });
    }, [broadcastState]);

    const stopTimer = useCallback((): TimerState | null => {
        let snapshot: TimerState | null = null;
        setTimer(prev => {
            if (!prev) return null;
            const runSeconds = prev.status === 'running'
                ? Math.floor((Date.now() - prev.startedAt) / 1000)
                : 0;
            let accumulated = prev.accumulated + runSeconds;
            if (!prev.limitBypassed && accumulated > LIMIT_SECONDS) {
                accumulated = LIMIT_SECONDS;
            }
            snapshot = { ...prev, accumulated, status: 'paused' };
            saveToStorage(null);
            broadcastState(null);

            // Sync pause to server
            apiCall('PATCH', '/projects/day-session/pause').catch(() => {});

            return null;
        });
        return snapshot;
    }, [broadcastState]);

    const clearTimer = useCallback(() => {
        setTimer(null);
        saveToStorage(null);
        broadcastState(null);
    }, [broadcastState]);

    const bypassLimit = useCallback(() => {
        setTimer(prev => {
            if (!prev) return prev;
            const next: TimerState = {
                ...prev,
                limitBypassed: true,
                status: 'running',
                startedAt: prev.status === 'paused' ? Date.now() : prev.startedAt,
            };
            saveToStorage(next);
            broadcastState(next);

            // Sync with server
            apiCall('PATCH', '/projects/day-session/bypass-limit').catch(() => {});

            return next;
        });
    }, [broadcastState]);

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
            isSyncing,
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
