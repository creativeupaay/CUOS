import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimerState {
    startedAt: number;       // epoch ms of when current run began
    accumulated: number;     // seconds elapsed before current run
    status: 'running' | 'paused';
    limitBypassed?: boolean;
    dateKey?: string;        // YYYY-MM-DD for the work day
}

export interface DaySessionMeta {
    lastEndedAccumulated: number;
    lastEndedBreakAccumulated: number;
    previouslyLoggedMinutes: number;
    isEnded: boolean;
}

export interface TimerContextValue {
    timer: TimerState | null;
    elapsed: number;          // total seconds elapsed (accumulated + current run)
    isRunning: boolean;
    isHydrated: boolean;      // true once initial server hydration has completed
    startTimer: () => void;
    pauseTimer: () => void;
    resumeTimer: () => void;
    stopTimer: (allocatedMinutes?: number) => TimerState | null;  // returns snapshot then clears
    clearTimer: () => void;
    bypassLimit: () => void;
    isSyncing: boolean;       // true while communicating with server
    daySessionMeta: DaySessionMeta | null;
    refreshDaySession: () => Promise<DaySessionMeta | null>;
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
    const runSeconds = Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
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
    isEnded?: boolean;
}): TimerState | null {
    if (session.isEnded) {
        return null;
    }
    return {
        startedAt: session.startedAt ?? Date.now(),
        accumulated: session.accumulated || 0,
        status: session.status,
        limitBypassed: session.limitBypassed || false,
        dateKey: getTodayKey(),
    };
}

/** Call the server API without importing RTK Query (to keep the hook self-contained) */
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

async function apiCall(method: string, path: string, body?: any): Promise<any> {
    try {
        let res = await fetch(`${API_BASE}${path}`, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });

        // If access token expired (401), attempt a single refresh and retry
        if (res.status === 401 && !path.includes('/auth/')) {
            try {
                const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (refreshRes.ok) {
                    res = await fetch(`${API_BASE}${path}`, {
                        method,
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: body ? JSON.stringify(body) : undefined,
                    });
                }
            } catch {
                // Ignore refresh failure
            }
        }

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
    const [isHydrated, setIsHydrated] = useState(false);
    const [daySessionMeta, setDaySessionMeta] = useState<DaySessionMeta | null>(null);
    const intervalRef = useRef<number | null>(null);
    const syncPollRef = useRef<number | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);
    const timerRef = useRef<TimerState | null>(timer);
    timerRef.current = timer;
    // Track when the user last performed a local timer action (start/pause/resume/bypass)
    // to prevent the server poll from overwriting a fresh local state
    const lastActionRef = useRef<number>(0);

    const applySessionMeta = useCallback((session: any) => {
        if (!session) return;
        setDaySessionMeta({
            lastEndedAccumulated: session.lastEndedAccumulated || 0,
            lastEndedBreakAccumulated: session.lastEndedBreakAccumulated || 0,
            previouslyLoggedMinutes: session.previouslyLoggedMinutes || 0,
            isEnded: session.isEnded || false,
        });
    }, []);

    const refreshDaySession = useCallback(async (): Promise<DaySessionMeta | null> => {
        try {
            const session = await apiCall('GET', '/projects/day-session');
            if (session) {
                applySessionMeta(session);
                return {
                    lastEndedAccumulated: session.lastEndedAccumulated || 0,
                    lastEndedBreakAccumulated: session.lastEndedBreakAccumulated || 0,
                    previouslyLoggedMinutes: session.previouslyLoggedMinutes || 0,
                    isEnded: session.isEnded || false,
                };
            }
            return null;
        } catch {
            return null;
        }
    }, [applySessionMeta]);

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
                if (cancelled) return;
                if (session) {
                    applySessionMeta(session);
                    // Server has a session for today
                    const serverTimer = sessionToTimer(session);
                    if (serverTimer) {
                        setTimer(serverTimer);
                        saveToStorage(serverTimer);
                    } else if (session.isEnded) {
                        // User previously ended the day: clear local timer so it doesn't run
                        setTimer(null);
                        saveToStorage(null);
                    }
                }
            } catch {
                // Network offline — use localStorage cache (already loaded in useState)
            } finally {
                if (!cancelled) {
                    setIsHydrated(true);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [applySessionMeta]);

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

    // ── Recalculate elapsed when user returns to tab ──────────────────────────
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Immediately recalculate elapsed so display is accurate when tab is focused
                setElapsed(calcElapsed(timer));
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
                // ── Grace period guard ──────────────────────────────────────
                // If the user performed a local action in the last 30 seconds,
                // skip this poll to avoid overwriting the fresh local state with
                // a stale server response (e.g., server restarted or hasn't
                // processed our start/pause yet).
                const secondsSinceLastAction = (Date.now() - lastActionRef.current) / 1000;
                if (secondsSinceLastAction < 30) return;

                const session = await apiCall('GET', '/projects/day-session');
                if (!session) return;

                // Only sync from server if the server's startedAt is NEWER than
                // what we have locally. This prevents a stale server "paused"
                // state from overwriting our running local timer.
                const serverStartedAt = session.startedAt ?? 0;
                const localStartedAt = timer.startedAt ?? 0;
                const serverIsNewer = serverStartedAt > localStartedAt;

                const serverTimer = sessionToTimer(session);
                if (!serverTimer) return;

                if (session.status === 'running') {
                    // Server is also running — only sync if there's significant accumulated drift
                    const serverAccumulated = session.accumulated ?? 0;
                    if (Math.abs(serverAccumulated - timer.accumulated) > 60) {
                        setTimer(serverTimer);
                        saveToStorage(serverTimer);
                        broadcastState(serverTimer);
                    }
                } else if (session.status === 'paused' && serverIsNewer) {
                    // Server paused AFTER our local start — trust server (e.g., another device paused)
                    setTimer(serverTimer);
                    saveToStorage(serverTimer);
                    broadcastState(serverTimer);
                }
                // If server is paused but local startedAt is newer: ignore — our start is more recent
            } catch { /* ignore network errors */ }
        }, SYNC_POLL_INTERVAL);

        return () => {
            if (syncPollRef.current) {
                clearInterval(syncPollRef.current);
                syncPollRef.current = null;
            }
        };
    }, [timer?.status, timer?.startedAt, timer?.accumulated, broadcastState]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const startTimer = useCallback(() => {
        // Mark that user just acted — grace period prevents poll from overwriting this
        lastActionRef.current = Date.now();
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
                    applySessionMeta(session);
                    // Trust server's accumulated value (may differ if another session ran)
                    const serverTimer = sessionToTimer(session);
                    if (serverTimer) {
                        setTimer(serverTimer);
                        saveToStorage(serverTimer);
                        broadcastState(serverTimer);
                    }
                }
            })
            .catch(() => { /* network offline — local state is fine */ })
            .finally(() => setIsSyncing(false));
    }, [timer, broadcastState, applySessionMeta]);

    const pauseTimer = useCallback(() => {
        // Mark that user just acted — grace period prevents poll from overwriting this
        lastActionRef.current = Date.now();
        const prev = timerRef.current;
        if (!prev || prev.status !== 'running') return;
        const runSeconds = Math.floor((Date.now() - prev.startedAt) / 1000);
        let accumulated = prev.accumulated + runSeconds;
        if (!prev.limitBypassed && accumulated > LIMIT_SECONDS) {
            accumulated = LIMIT_SECONDS;
        }
        const next: TimerState = { ...prev, accumulated, status: 'paused' };
        setTimer(next);
        saveToStorage(next);
        broadcastState(next);

        // Fire-and-forget server sync
        apiCall('PATCH', '/projects/day-session/pause', { accumulated }).catch(() => {});
    }, [broadcastState]);

    const resumeTimer = useCallback(() => {
        // Mark that user just acted — grace period prevents poll from overwriting this
        lastActionRef.current = Date.now();
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
                        applySessionMeta(session);
                        const serverTimer = sessionToTimer(session);
                        if (serverTimer) {
                            setTimer(serverTimer);
                            saveToStorage(serverTimer);
                            broadcastState(serverTimer);
                        }
                    }
                })
                .catch(() => {})
                .finally(() => setIsSyncing(false));

            return next;
        });
    }, [broadcastState, applySessionMeta]);

    const stopTimer = useCallback((allocatedMinutes?: number): TimerState | null => {
        const prev = timerRef.current;
        const runSeconds = (prev && prev.status === 'running')
            ? Math.floor((Date.now() - prev.startedAt) / 1000)
            : 0;
        let accumulated = (prev?.accumulated || 0) + runSeconds;
        if (prev && !prev.limitBypassed && accumulated > LIMIT_SECONDS) {
            accumulated = LIMIT_SECONDS;
        }
        const snapshot: TimerState | null = prev ? { ...prev, accumulated, status: 'paused' } : null;

        // 1. Clear timer
        setTimer(null);
        saveToStorage(null);
        broadcastState(null);

        // 2. Update daySessionMeta cleanly OUTSIDE setTimer updater
        setDaySessionMeta(prevMeta => ({
            lastEndedAccumulated: accumulated,
            lastEndedBreakAccumulated: prevMeta?.lastEndedBreakAccumulated || 0,
            previouslyLoggedMinutes: (prevMeta?.previouslyLoggedMinutes || 0) + (allocatedMinutes || 0),
            isEnded: true,
        }));

        // 3. Send isEnded: true so server marks session as ended
        apiCall('PATCH', '/projects/day-session/pause', { isEnded: true, allocatedMinutes, accumulated }).catch(() => {});

        return snapshot;
    }, [broadcastState]);

    const clearTimer = useCallback(() => {
        setTimer(null);
        saveToStorage(null);
        broadcastState(null);
    }, [broadcastState]);

    const bypassLimit = useCallback(() => {
        // Mark that user just acted — grace period prevents poll from overwriting this
        lastActionRef.current = Date.now();
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
            isHydrated,
            startTimer,
            pauseTimer,
            resumeTimer,
            stopTimer,
            clearTimer,
            bypassLimit,
            isSyncing,
            daySessionMeta,
            refreshDaySession,
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
