import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAppSelector } from '@/app/hooks';
import { getApiBaseUrl } from '@/config/api.config';

export type BreakType = 'lunch' | 'tea' | 'other';

export interface BreakState {
    dateKey: string;
    breakAccumulated: number;          // Total break seconds accumulated before current break
    breakStartedAt: number | null;     // Epoch ms when current break started, null if not on break
    breakType: BreakType | null;
    breakReason: string | null;
    userId?: string;
}

export interface BreakContextValue {
    isOnBreak: boolean;
    breakType: BreakType | null;
    breakReason: string | null;
    breakAccumulated: number;
    breakStartedAt: number | null;
    currentBreakElapsed: number;       // Seconds spent in current active break
    totalBreakElapsed: number;         // Total seconds spent on break today
    startBreak: (type: BreakType, reason?: string) => Promise<void>;
    endBreak: () => Promise<void>;
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

                    setState(() => {
                        const serverState: BreakState = {
                            dateKey: serverDateKey,
                            breakAccumulated: session.breakAccumulated || 0,
                            breakStartedAt: session.breakStartedAt || null,
                            breakType: session.breakType || null,
                            breakReason: session.breakReason || null,
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

    // ── Timer tick for break duration ──
    useEffect(() => {
        const updateElapsed = () => {
            if (state.breakStartedAt) {
                const currentSec = Math.max(0, Math.floor((Date.now() - state.breakStartedAt) / 1000));
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
    }, [state.breakStartedAt, state.breakAccumulated]);

    // ── Actions ──
    const startBreak = useCallback(async (type: BreakType, reason?: string) => {
        const now = Date.now();
        const newState: BreakState = {
            ...state,
            dateKey: getTodayKey(),
            breakStartedAt: now,
            breakType: type,
            breakReason: reason || null,
            userId,
        };
        setState(newState);
        saveToStorage(newState, userId);
        broadcastState(newState);

        // Fire-and-forget server sync
        apiCall('POST', '/projects/day-session/break/start', {
            breakType: type,
            reason: reason || null,
        }).catch(() => {});
    }, [state, broadcastState, userId]);

    const endBreak = useCallback(async () => {
        const now = Date.now();
        const additionalSec = state.breakStartedAt ? Math.max(0, Math.floor((now - state.breakStartedAt) / 1000)) : 0;
        const newAccumulated = (state.breakAccumulated || 0) + additionalSec;

        const newState: BreakState = {
            dateKey: getTodayKey(),
            breakAccumulated: newAccumulated,
            breakStartedAt: null,
            breakType: null,
            breakReason: null,
            userId,
        };
        setState(newState);
        saveToStorage(newState, userId);
        broadcastState(newState);

        // Fire-and-forget server sync
        apiCall('POST', '/projects/day-session/break/end').catch(() => {});
    }, [state, broadcastState, userId]);

    const resetBreak = useCallback(() => {
        const emptyState: BreakState = {
            dateKey: getTodayKey(),
            breakAccumulated: 0,
            breakStartedAt: null,
            breakType: null,
            breakReason: null,
            userId,
        };
        setState(emptyState);
        saveToStorage(emptyState, userId);
        broadcastState(emptyState);
    }, [broadcastState, userId]);

    const value: BreakContextValue = {
        isOnBreak: !!state.breakStartedAt,
        breakType: state.breakType,
        breakReason: state.breakReason,
        breakAccumulated: state.breakAccumulated || 0,
        breakStartedAt: state.breakStartedAt,
        currentBreakElapsed,
        totalBreakElapsed,
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
