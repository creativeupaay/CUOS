import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LapseRecord {
    id: string;
    /** Net work seconds (wall-clock − break delta) captured at the moment of lapse */
    seconds: number;
    /** ISO timestamp when the lapse was taken */
    capturedAt: string;
    /** Task id that this lapse was assigned to (undefined or null = unassigned) */
    assignedTaskId?: string | null;
    /** Project id for the assigned task ('' = individual task) */
    assignedProjectId?: string | null;
    /** Optional note recorded at the time of assignment */
    note?: string | null;
}

export interface StoredLapseState {
    dateKey: string;
    lapses: LapseRecord[];
    lastLapseElapsed: number;
    lastLapseBreak: number;
}

export interface LapseContextValue {
    lapses: LapseRecord[];
    lastLapseElapsed: number;
    lastLapseBreak: number;
    addLapse: (seconds: number, currentElapsed?: number, currentBreak?: number) => LapseRecord;
    assignLapse: (id: string, taskId: string, projectId: string, note?: string) => Promise<void>;
    advanceLapseBoundary: (currentElapsed: number, currentBreak: number) => void;
    removeLapse: (id: string) => void;
    clearLapses: () => void;
    unassignedLapses: LapseRecord[];
    totalUnassignedSeconds: number;
    refreshLapses: () => Promise<void>;
}

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'cuos_lapses';
const WORK_DAY_START_UTC_MS = 30 * 60_000; // 30 mins = 00:30 UTC = 6:00 AM IST
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

function getTodayKey(): string {
    const shifted = new Date(Date.now() - WORK_DAY_START_UTC_MS);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function loadFromStorage(): StoredLapseState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {
                dateKey: getTodayKey(),
                lapses: [],
                lastLapseElapsed: 0,
                lastLapseBreak: 0,
            };
        }
        const parsed = JSON.parse(raw) as StoredLapseState;
        if (parsed.dateKey && parsed.dateKey !== getTodayKey()) {
            localStorage.removeItem(STORAGE_KEY);
            return {
                dateKey: getTodayKey(),
                lapses: [],
                lastLapseElapsed: 0,
                lastLapseBreak: 0,
            };
        }
        return {
            dateKey: parsed.dateKey || getTodayKey(),
            lapses: Array.isArray(parsed.lapses) ? parsed.lapses : [],
            lastLapseElapsed: typeof parsed.lastLapseElapsed === 'number' ? parsed.lastLapseElapsed : 0,
            lastLapseBreak: typeof parsed.lastLapseBreak === 'number' ? parsed.lastLapseBreak : 0,
        };
    } catch {
        return {
            dateKey: getTodayKey(),
            lapses: [],
            lastLapseElapsed: 0,
            lastLapseBreak: 0,
        };
    }
}

function saveToStorage(state: StoredLapseState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // localStorage write error (e.g. quota exceeded)
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
                // Ignore refresh error
            }
        }

        if (!res.ok) return null;
        const json = await res.json();
        return json?.data ?? null;
    } catch {
        return null;
    }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LapseContext = createContext<LapseContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LapseProvider({ children }: { children: React.ReactNode }) {
    const [storedState, setStoredState] = useState<StoredLapseState>(loadFromStorage);
    const broadcastRef = useRef<BroadcastChannel | null>(null);
    const stateRef = useRef<StoredLapseState>(storedState);
    stateRef.current = storedState;

    // Cross-tab synchronization via BroadcastChannel
    useEffect(() => {
        try {
            const bc = new BroadcastChannel('cuos_lapses');
            broadcastRef.current = bc;

            bc.onmessage = (event) => {
                if (event.data?.type === 'LAPSE_STATE_UPDATE' && event.data.state) {
                    const incoming = event.data.state as StoredLapseState;
                    if (incoming.dateKey === getTodayKey()) {
                        setStoredState(incoming);
                        saveToStorage(incoming);
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

    const broadcastState = useCallback((newState: StoredLapseState) => {
        try {
            broadcastRef.current?.postMessage({ type: 'LAPSE_STATE_UPDATE', state: newState });
        } catch { /* ignore */ }
    }, []);

    const updateAndPersist = useCallback((updater: (prev: StoredLapseState) => StoredLapseState) => {
        setStoredState(prev => {
            const next = updater(prev);
            saveToStorage(next);
            broadcastState(next);
            return next;
        });
    }, [broadcastState]);

    // Hydrate from backend DaySession on mount
    const refreshLapses = useCallback(async () => {
        try {
            const session = await apiCall('GET', '/projects/day-session');
            if (session && session.dateKey === getTodayKey()) {
                updateAndPersist(prev => {
                    const serverLapses = Array.isArray(session.lapses) ? session.lapses : [];
                    // Merge local and server lapses by ID
                    const lapseMap = new Map<string, LapseRecord>();
                    for (const l of serverLapses) {
                        lapseMap.set(l.id, l);
                    }
                    for (const l of prev.lapses) {
                        // If local has assignment and server doesn't, keep local
                        const existing = lapseMap.get(l.id);
                        if (!existing || (!existing.assignedTaskId && l.assignedTaskId)) {
                            lapseMap.set(l.id, l);
                        }
                    }

                    const mergedLapses = Array.from(lapseMap.values());
                    const lastLapseElapsed = Math.max(
                        prev.lastLapseElapsed,
                        session.lastLapseElapsed || 0,
                        session.lastEndedAccumulated || 0
                    );
                    const lastLapseBreak = Math.max(
                        prev.lastLapseBreak,
                        session.lastLapseBreak || 0,
                        session.lastEndedBreakAccumulated || 0
                    );

                    return {
                        dateKey: getTodayKey(),
                        lapses: mergedLapses,
                        lastLapseElapsed,
                        lastLapseBreak,
                    };
                });
            }
        } catch (err) {
            console.error('[LapseProvider] Failed to hydrate lapses from server:', err);
        }
    }, [updateAndPersist]);

    useEffect(() => {
        refreshLapses();
    }, [refreshLapses]);

    const addLapse = useCallback((seconds: number, currentElapsed?: number, currentBreak?: number): LapseRecord => {
        const record: LapseRecord = {
            id: `lapse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            seconds,
            capturedAt: new Date().toISOString(),
        };

        const targetElapsed = typeof currentElapsed === 'number' ? currentElapsed : stateRef.current.lastLapseElapsed;
        const targetBreak = typeof currentBreak === 'number' ? currentBreak : stateRef.current.lastLapseBreak;

        updateAndPersist(prev => ({
            ...prev,
            lapses: [...prev.lapses, record],
            lastLapseElapsed: typeof currentElapsed === 'number' ? currentElapsed : prev.lastLapseElapsed,
            lastLapseBreak: typeof currentBreak === 'number' ? currentBreak : prev.lastLapseBreak,
        }));

        // Persist to server DaySession in background
        apiCall('POST', '/projects/day-session/lapse', {
            lapse: record,
            lastLapseElapsed: targetElapsed,
            lastLapseBreak: targetBreak,
        }).catch(err => {
            console.error('[LapseProvider] Failed to sync lapse to server:', err);
        });

        return record;
    }, [updateAndPersist]);

    const advanceLapseBoundary = useCallback((currentElapsed: number, currentBreak: number) => {
        updateAndPersist(prev => ({
            ...prev,
            lastLapseElapsed: Math.max(prev.lastLapseElapsed, currentElapsed),
            lastLapseBreak: Math.max(prev.lastLapseBreak, currentBreak),
        }));

        apiCall('POST', '/projects/day-session/lapse-boundary', {
            lastLapseElapsed: currentElapsed,
            lastLapseBreak: currentBreak,
        }).catch(err => {
            console.error('[LapseProvider] Failed to sync lapse boundary to server:', err);
        });
    }, [updateAndPersist]);

    const assignLapse = useCallback(async (id: string, taskId: string, projectId: string, note?: string) => {
        updateAndPersist(prev => ({
            ...prev,
            lapses: prev.lapses.map(l =>
                l.id === id
                    ? { ...l, assignedTaskId: taskId, assignedProjectId: projectId, note }
                    : l
            ),
        }));

        // Persist assignment to server in background
        try {
            await apiCall('PATCH', `/projects/day-session/lapse/${id}/assign`, {
                assignedTaskId: taskId,
                assignedProjectId: projectId,
                note,
            });
        } catch (err) {
            console.error('[LapseProvider] Failed to sync lapse assignment to server:', err);
        }
    }, [updateAndPersist]);

    const removeLapse = useCallback((id: string) => {
        updateAndPersist(prev => ({
            ...prev,
            lapses: prev.lapses.filter(l => l.id !== id),
        }));
    }, [updateAndPersist]);

    const clearLapses = useCallback(() => {
        setStoredState(prev => {
            const resetState: StoredLapseState = {
                dateKey: getTodayKey(),
                lapses: [],
                lastLapseElapsed: prev.lastLapseElapsed,
                lastLapseBreak: prev.lastLapseBreak,
            };
            saveToStorage(resetState);
            broadcastState(resetState);
            return resetState;
        });
    }, [broadcastState]);

    const unassignedLapses = storedState.lapses.filter(l => !l.assignedTaskId);
    const totalUnassignedSeconds = unassignedLapses.reduce((acc, l) => acc + l.seconds, 0);

    const value: LapseContextValue = {
        lapses: storedState.lapses,
        lastLapseElapsed: storedState.lastLapseElapsed,
        lastLapseBreak: storedState.lastLapseBreak,
        addLapse,
        assignLapse,
        advanceLapseBoundary,
        removeLapse,
        clearLapses,
        unassignedLapses,
        totalUnassignedSeconds,
        refreshLapses,
    };

    return <LapseContext.Provider value={value}>{children}</LapseContext.Provider>;
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

export function useLapses(): LapseContextValue {
    const context = useContext(LapseContext);
    if (!context) {
        // Fallback for standalone components if outside provider during tests
        const loaded = loadFromStorage();
        return {
            lapses: loaded.lapses,
            lastLapseElapsed: loaded.lastLapseElapsed,
            lastLapseBreak: loaded.lastLapseBreak,
            addLapse: () => ({ id: '', seconds: 0, capturedAt: '' }),
            assignLapse: async () => {},
            advanceLapseBoundary: () => {},
            removeLapse: () => {},
            clearLapses: () => {},
            unassignedLapses: [],
            totalUnassignedSeconds: 0,
            refreshLapses: async () => {},
        };
    }
    return context;
}
