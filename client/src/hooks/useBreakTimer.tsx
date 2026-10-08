import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAppSelector } from '@/app/hooks';
import { getApiBaseUrl } from '@/config/api.config';
import { useTimer } from './useTaskTimer';

export type BreakType = 'lunch' | 'tea' | 'other';

export const DEFAULT_BREAK_LIMITS: Record<BreakType, number | null> = {
    lunch: 60 * 60, // 3600 seconds = 1 hour
    tea: 30 * 60,   // 1800 seconds = 30 minutes
    other: null,    // Custom reason, no automatic limit
};

export interface BreakState {
    dateKey: string;
    breakAccumulated: number;          // Total break seconds accumulated before current break
    breakStartedAt: number | null;     // Epoch ms when current break started, null if not on break
    breakType: BreakType | null;
    breakReason: string | null;
    breakDurationLimit?: number | null; // Limit in seconds (e.g. 1800 for 30m, 2700 for 45m, 3600 for 60m)
    userId?: string;
}

export interface BreakContextValue {
    isOnBreak: boolean;
    breakType: BreakType | null;
    breakReason: string | null;
    breakAccumulated: number;
    breakStartedAt: number | null;
    breakDurationLimit?: number | null;
    currentBreakElapsed: number;       // Seconds spent in current active break
    totalBreakElapsed: number;         // Total seconds spent on break today
    maxBreakDuration: number | null;   // Max seconds for current break type
    remainingBreakSeconds: number | null; // Seconds remaining in current break before auto-resume
    startBreak: (type: BreakType, reason?: string, durationLimitSeconds?: number) => Promise<void>;
    endBreak: (isAuto?: boolean) => Promise<void>;
    resetBreak: () => void;
}

const STORAGE_KEY_PREFIX = 'cuos_break_session';
const WORK_DAY_START_UTC_MS = 30 * 60_000; // 30 mins = 00:30 UTC = 6:00 AM IST
const API_BASE = getApiBaseUrl();

function getTodayKey(): string {
    const shifted = new Date(Date.now() - WORK_DAY_START_UTC_MS);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getBreakStorageKey(userId?: string): string {
    return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;
}

function loadFromStorage(userId?: string): BreakState {
    const defaultState: BreakState = {
        dateKey: getTodayKey(),
        breakAccumulated: 0,
        breakStartedAt: null,
        breakType: null,
        breakReason: null,
        breakDurationLimit: null,
        userId,
    };
    try {
        const key = getBreakStorageKey(userId);
        const raw = localStorage.getItem(key);
        if (!raw) {
            // Clean up un-scoped legacy key if userId is active
            if (userId && localStorage.getItem(STORAGE_KEY_PREFIX)) {
                try { localStorage.removeItem(STORAGE_KEY_PREFIX); } catch { /* ignore */ }
            }
            return defaultState;
        }
        const parsed = JSON.parse(raw) as BreakState;
        if (userId && parsed.userId && parsed.userId !== userId) {
            return defaultState;
        }
        if (parsed.dateKey && parsed.dateKey !== getTodayKey()) {
            localStorage.removeItem(key);
            return defaultState;
        }

        // Auto-expire break if it exceeded limit while offline / browser was closed
        if (parsed.breakStartedAt && parsed.breakType) {
            const limit = parsed.breakDurationLimit ?? DEFAULT_BREAK_LIMITS[parsed.breakType];
            if (limit) {
                const elapsed = Math.max(0, Math.floor((Date.now() - parsed.breakStartedAt) / 1000));
                if (elapsed >= limit) {
                    parsed.breakAccumulated = (parsed.breakAccumulated || 0) + limit;
                    parsed.breakStartedAt = null;
                    parsed.breakType = null;
                    parsed.breakReason = null;
                    parsed.breakDurationLimit = null;
                    saveToStorage(parsed, userId);
                }
            }
        }

        return parsed;
    } catch {
        return defaultState;
    }
}

function saveToStorage(state: BreakState, userId?: string) {
    try {
        const key = getBreakStorageKey(userId);
        localStorage.setItem(key, JSON.stringify({ ...state, userId: userId || state.userId }));
        if (userId) {
            try { localStorage.removeItem(STORAGE_KEY_PREFIX); } catch { /* ignore */ }
        }
    } catch {
        // localStorage error fallback
    }
}

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

const BreakContext = createContext<BreakContextValue | null>(null);

export function BreakProvider({ children }: { children: React.ReactNode }) {
    const user = useAppSelector((state) => state.auth.user);
    const userId = user?._id;
    const userIdRef = useRef<string | undefined>(userId);
    userIdRef.current = userId;

    const { isRunning, timer, startTimer, resumeTimer } = useTimer();

    const [state, setState] = useState<BreakState>(() => loadFromStorage(userId));
    const [currentBreakElapsed, setCurrentBreakElapsed] = useState<number>(() => {
        const s = loadFromStorage(userId);
        return s.breakStartedAt ? Math.max(0, Math.floor((Date.now() - s.breakStartedAt) / 1000)) : 0;
    });
    const [totalBreakElapsed, setTotalBreakElapsed] = useState<number>(() => {
        const s = loadFromStorage(userId);
        const currentSec = s.breakStartedAt ? Math.max(0, Math.floor((Date.now() - s.breakStartedAt) / 1000)) : 0;
        return (s.breakAccumulated || 0) + currentSec;
    });

    const intervalRef = useRef<number | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);

    // Reset when switching active user
    useEffect(() => {
        if (!userId) {
            const clean: BreakState = {
                dateKey: getTodayKey(),
                breakAccumulated: 0,
                breakStartedAt: null,
                breakType: null,
                breakReason: null,
                breakDurationLimit: null,
            };
            setState(clean);
            setCurrentBreakElapsed(0);
            setTotalBreakElapsed(0);
            return;
        }
        const cached = loadFromStorage(userId);
        setState(cached);
        const cur = cached.breakStartedAt ? Math.max(0, Math.floor((Date.now() - cached.breakStartedAt) / 1000)) : 0;
        setCurrentBreakElapsed(cur);
        setTotalBreakElapsed((cached.breakAccumulated || 0) + cur);
    }, [userId]);

    // ── BroadcastChannel for tab synchronization ──
    useEffect(() => {
        try {
            const bc = new BroadcastChannel('cuos_break');
            broadcastRef.current = bc;
            bc.onmessage = (e) => {
                if (e.data?.type === 'BREAK_STATE_UPDATE') {
                    if (e.data.userId && userIdRef.current && e.data.userId !== userIdRef.current) {
                        return;
                    }
                    const newState = e.data.state as BreakState;
                    if (newState) {
                        setState(newState);
                        saveToStorage(newState, userIdRef.current);
                    }
                }
            };
            return () => {
                bc.close();
                broadcastRef.current = null;
            };
        } catch {
            // BroadcastChannel unsupported
        }
    }, []);

    const broadcastState = useCallback((newState: BreakState) => {
        try {
            broadcastRef.current?.postMessage({
                type: 'BREAK_STATE_UPDATE',
                state: newState,
                userId: userIdRef.current,
            });
        } catch {
            // ignore
        }
    }, []);

    // ── Hydrate from server on mount ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const session = await apiCall('GET', '/projects/day-session');
                if (cancelled) return;

                if (session) {
                    const serverDateKey = session.dateKey || getTodayKey();
                    if (serverDateKey !== getTodayKey()) return;

                    let sBreakStartedAt: number | null = session.breakStartedAt || null;
                    let sBreakType: BreakType | null = session.breakType || null;
                    let sBreakAccumulated: number = session.breakAccumulated || 0;
                    let sBreakReason: string | null = session.breakReason || null;
                    let sBreakDurationLimit: number | null = session.breakDurationLimit || null;

                    // If server session break exceeded limit, resolve locally
                    if (sBreakStartedAt && sBreakType) {
                        const limit = sBreakDurationLimit ?? DEFAULT_BREAK_LIMITS[sBreakType];
                        if (limit) {
                            const elapsed = Math.max(0, Math.floor((Date.now() - sBreakStartedAt) / 1000));
                            if (elapsed >= limit) {
                                sBreakAccumulated += limit;
                                sBreakStartedAt = null;
                                sBreakType = null;
                                sBreakReason = null;
                                sBreakDurationLimit = null;
                            }
                        }
                    }

                    setState(() => {
                        const serverState: BreakState = {
                            dateKey: serverDateKey,
                            breakAccumulated: sBreakAccumulated,
                            breakStartedAt: sBreakStartedAt,
                            breakType: sBreakType,
                            breakReason: sBreakReason,
                            breakDurationLimit: sBreakDurationLimit,
                            userId,
                        };
                        saveToStorage(serverState, userId);
                        return serverState;
                    });
                } else {
                    // Server confirmed no session today: reset break to zero
                    const cleanState: BreakState = {
                        dateKey: getTodayKey(),
                        breakAccumulated: 0,
                        breakStartedAt: null,
                        breakType: null,
                        breakReason: null,
                        breakDurationLimit: null,
                        userId,
                    };
                    setState(cleanState);
                    saveToStorage(cleanState, userId);
                }
            } catch {
                // Network offline
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    // ── Actions ──
    const startBreak = useCallback(async (type: BreakType, reason?: string, durationLimitSeconds?: number) => {
        const now = Date.now();
        const finalLimit = typeof durationLimitSeconds === 'number' && durationLimitSeconds > 0
            ? durationLimitSeconds
            : (DEFAULT_BREAK_LIMITS[type] || null);

        const newState: BreakState = {
            ...state,
            dateKey: getTodayKey(),
            breakStartedAt: now,
            breakType: type,
            breakReason: reason || null,
            breakDurationLimit: finalLimit,
            userId,
        };
        setState(newState);
        saveToStorage(newState, userId);
        broadcastState(newState);

        // Fire-and-forget server sync
        apiCall('POST', '/projects/day-session/break/start', {
            breakType: type,
            reason: reason || null,
            durationLimitSeconds: finalLimit,
        }).catch(() => {});
    }, [state, broadcastState, userId]);

    const endBreak = useCallback(async (isAuto = false) => {
        const now = Date.now();
        const limit = state.breakDurationLimit ?? (state.breakType ? DEFAULT_BREAK_LIMITS[state.breakType] : null);
        let additionalSec = state.breakStartedAt ? Math.max(0, Math.floor((now - state.breakStartedAt) / 1000)) : 0;
        if (limit && additionalSec > limit) {
            additionalSec = limit;
        }
        const newAccumulated = (state.breakAccumulated || 0) + additionalSec;
        const previousType = state.breakType;
        const prevLimit = limit;

        const newState: BreakState = {
            dateKey: getTodayKey(),
            breakAccumulated: newAccumulated,
            breakStartedAt: null,
            breakType: null,
            breakReason: null,
            breakDurationLimit: null,
            userId,
        };
        setState(newState);
        saveToStorage(newState, userId);
        broadcastState(newState);

        // Ensure working timer resumes/runs when break ends
        if (!isRunning) {
            if (!timer) startTimer();
            else resumeTimer();
        }

        if (isAuto) {
            const mins = prevLimit ? Math.round(prevLimit / 60) : (previousType === 'lunch' ? 60 : 30);
            const breakTitle = previousType === 'lunch'
                ? 'Lunch break (1 hr)'
                : previousType === 'tea'
                    ? `Tea break (${mins} min)`
                    : 'Break';
            toast.success(`⏰ ${breakTitle} time is up! Working timer resumed.`, {
                duration: 6000,
                style: {
                    background: '#ECFDF5',
                    color: '#065F46',
                    border: '1px solid #A7F3D0',
                    fontWeight: 600,
                },
            });
        }

        // Fire-and-forget server sync
        apiCall('POST', '/projects/day-session/break/end').catch(() => {});
    }, [state, broadcastState, userId, isRunning, timer, startTimer, resumeTimer]);

    const resetBreak = useCallback(() => {
        const emptyState: BreakState = {
            dateKey: getTodayKey(),
            breakAccumulated: 0,
            breakStartedAt: null,
            breakType: null,
            breakReason: null,
            breakDurationLimit: null,
            userId,
        };
        setState(emptyState);
        saveToStorage(emptyState, userId);
        broadcastState(emptyState);
    }, [broadcastState, userId]);

    // ── Timer tick for break duration ──
    useEffect(() => {
        const updateElapsed = () => {
            if (state.breakStartedAt) {
                const currentSec = Math.max(0, Math.floor((Date.now() - state.breakStartedAt) / 1000));
                const limit = state.breakDurationLimit ?? (state.breakType ? DEFAULT_BREAK_LIMITS[state.breakType] : null);

                if (limit && currentSec >= limit) {
                    // Break duration reached limit -> Auto-end break and resume working timer!
                    endBreak(true);
                    return;
                }

                setCurrentBreakElapsed(currentSec);
                setTotalBreakElapsed((state.breakAccumulated || 0) + currentSec);
            } else {
                setCurrentBreakElapsed(0);
                setTotalBreakElapsed(state.breakAccumulated || 0);
            }
        };

        updateElapsed();

        if (state.breakStartedAt) {
            intervalRef.current = window.setInterval(updateElapsed, 1000);
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
    }, [state.breakStartedAt, state.breakAccumulated, state.breakType, state.breakDurationLimit, endBreak]);

    const maxBreakDuration = state.breakDurationLimit ?? (state.breakType ? DEFAULT_BREAK_LIMITS[state.breakType] : null);
    const remainingBreakSeconds = maxBreakDuration
        ? Math.max(0, maxBreakDuration - currentBreakElapsed)
        : null;

    const value: BreakContextValue = {
        isOnBreak: !!state.breakStartedAt,
        breakType: state.breakType,
        breakReason: state.breakReason,
        breakAccumulated: state.breakAccumulated || 0,
        breakStartedAt: state.breakStartedAt,
        breakDurationLimit: state.breakDurationLimit,
        currentBreakElapsed,
        totalBreakElapsed,
        maxBreakDuration,
        remainingBreakSeconds,
        startBreak,
        endBreak,
        resetBreak,
    };

    return <BreakContext.Provider value={value}>{children}</BreakContext.Provider>;
}

export function useBreak(): BreakContextValue {
    const ctx = useContext(BreakContext);
    if (!ctx) {
        throw new Error('useBreak must be used within BreakProvider');
    }
    return ctx;
}

export const useBreakTimer = useBreak;

