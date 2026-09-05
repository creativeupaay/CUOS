import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export type BreakType = 'lunch' | 'tea' | 'other';

export interface BreakState {
    dateKey: string;
    breakAccumulated: number;          // Total break seconds accumulated before current break
    breakStartedAt: number | null;     // Epoch ms when current break started, null if not on break
    breakType: BreakType | null;
    breakReason: string | null;
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

const STORAGE_KEY = 'cuos_break_session';
const WORK_DAY_START_UTC_MS = 30 * 60_000; // 30 mins = 00:30 UTC = 6:00 AM IST
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

function getTodayKey(): string {
    const shifted = new Date(Date.now() - WORK_DAY_START_UTC_MS);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function loadFromStorage(): BreakState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {
                dateKey: getTodayKey(),
                breakAccumulated: 0,
                breakStartedAt: null,
                breakType: null,
                breakReason: null,
            };
        }
        const parsed = JSON.parse(raw) as BreakState;
        if (parsed.dateKey && parsed.dateKey !== getTodayKey()) {
            localStorage.removeItem(STORAGE_KEY);
            return {
                dateKey: getTodayKey(),
                breakAccumulated: 0,
                breakStartedAt: null,
                breakType: null,
                breakReason: null,
            };
        }
        return parsed;
    } catch {
        return {
            dateKey: getTodayKey(),
            breakAccumulated: 0,
            breakStartedAt: null,
            breakType: null,
            breakReason: null,
        };
    }
}

function saveToStorage(state: BreakState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    const [state, setState] = useState<BreakState>(loadFromStorage);
    const [currentBreakElapsed, setCurrentBreakElapsed] = useState<number>(() => {
        const s = loadFromStorage();
        return s.breakStartedAt ? Math.max(0, Math.floor((Date.now() - s.breakStartedAt) / 1000)) : 0;
    });
    const [totalBreakElapsed, setTotalBreakElapsed] = useState<number>(() => {
        const s = loadFromStorage();
        const currentSec = s.breakStartedAt ? Math.max(0, Math.floor((Date.now() - s.breakStartedAt) / 1000)) : 0;
        return (s.breakAccumulated || 0) + currentSec;
    });

    const intervalRef = useRef<number | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);

    // ── BroadcastChannel for tab synchronization ──
    useEffect(() => {
        try {
            const bc = new BroadcastChannel('cuos_break');
            broadcastRef.current = bc;
            bc.onmessage = (e) => {
                if (e.data?.type === 'BREAK_STATE_UPDATE') {
                    const newState = e.data.state as BreakState;
                    if (newState) {
                        setState(newState);
                        saveToStorage(newState);
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
            broadcastRef.current?.postMessage({ type: 'BREAK_STATE_UPDATE', state: newState });
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
                if (cancelled || !session) return;

                const serverDateKey = session.dateKey || getTodayKey();
                if (serverDateKey !== getTodayKey()) return;

                setState(() => {
                    // If local has more recent breakStartedAt, keep local
                    const serverState: BreakState = {
                        dateKey: serverDateKey,
                        breakAccumulated: session.breakAccumulated || 0,
                        breakStartedAt: session.breakStartedAt || null,
                        breakType: session.breakType || null,
                        breakReason: session.breakReason || null,
                    };
                    saveToStorage(serverState);
                    return serverState;
                });
            } catch {
                // Network offline
            }
        })();
        return () => { cancelled = true; };
    }, []);

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
        };
        setState(newState);
        saveToStorage(newState);
        broadcastState(newState);

        // Fire-and-forget server sync
        apiCall('POST', '/projects/day-session/break/start', {
            breakType: type,
            reason: reason || null,
        }).catch(() => {});
    }, [state, broadcastState]);

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
        };
        setState(newState);
        saveToStorage(newState);
        broadcastState(newState);

        // Fire-and-forget server sync
        apiCall('POST', '/projects/day-session/break/end').catch(() => {});
    }, [state, broadcastState]);

    const resetBreak = useCallback(() => {
        const emptyState: BreakState = {
            dateKey: getTodayKey(),
            breakAccumulated: 0,
            breakStartedAt: null,
            breakType: null,
            breakReason: null,
        };
        setState(emptyState);
        saveToStorage(emptyState);
        broadcastState(emptyState);
    }, [broadcastState]);

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
