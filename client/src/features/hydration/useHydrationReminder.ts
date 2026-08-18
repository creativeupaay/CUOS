import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimer } from '@/hooks/useTaskTimer';
import { useAppSelector } from '@/app/hooks';
import { useGetHydrationMessageMutation } from './hydrationApi';
import { pickFallbackMessage } from './hydrationMessages';
import type { HydrationState, HydrationStage } from './hydrationTypes';

// ─── Thresholds (in seconds) ─────────────────────────────────────────────────
export const HYDRATION_THRESHOLD_90 = 90 * 60;  // 90 minutes
export const HYDRATION_THRESHOLD_120 = 120 * 60; // 120 minutes
export const HYDRATION_THRESHOLD_150 = 150 * 60; // 150 minutes
export const HYDRATION_THRESHOLD_180 = 180 * 60; // 180 minutes

const REMIND_LATER_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ─── Initial state ────────────────────────────────────────────────────────────
const INITIAL_STATE: HydrationState = {
    stage: 'NORMAL',
    message: null,
    cycleStartedAt: null,
    remindLaterAt: null,
    notificationFired: false,
    isSnoozed: false,
};

const LOCAL_STORAGE_KEY = 'cuos_hydration_state_v1';

function loadPersistedState(): HydrationState {
    try {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored) as HydrationState;
            }
        }
    } catch {
        // ignore
    }
    return INITIAL_STATE;
}

// ─── OS Notification helper ───────────────────────────────────────────────────
function fireOsNotification(body: string): void {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    try {
        const notif = new Notification('💧 CUOS — Water Break', {
            body,
            icon: '/favicon.ico',
            tag: 'cuos-hydration', // same tag = replaces previous, prevents duplicates
            requireInteraction: false,
        });

        // Auto-close after 8 seconds
        setTimeout(() => notif.close(), 8_000);
    } catch {
        // Browser may block notifications in certain contexts — fail silently
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useHydrationReminder
 *
 * Observes the existing CUOS TimerContext to track continuous active work.
 * Manages the hydration state machine entirely based on timer state transitions.
 *
 * Does NOT create a second work timer.
 * Does NOT call Gemini on every tick.
 * The existing timer is never modified.
 */
export function useHydrationReminder() {
    const { timer } = useTimer();
    const user = useAppSelector((state) => state.auth.user);

    const [state, setState] = useState<HydrationState>(loadPersistedState);
    const [getHydrationMessage] = useGetHydrationMessageMutation();

    // Sync to local storage whenever state changes
    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        } catch {
            // ignore
        }
    }, [state]);

    // Stable refs to avoid stale closures inside setInterval
    const stateRef = useRef<HydrationState>(state);
    stateRef.current = state;

    const timerRef = useRef(timer);
    timerRef.current = timer;

    const userRef = useRef(user);
    userRef.current = user;

    // Track previous timer status to detect transitions
    const prevTimerStatusRef = useRef<'running' | 'paused' | null>(null);

    // ── Gemini message fetch ──────────────────────────────────────────────────
    const fetchMessage = useCallback(async (workMinutes: number): Promise<string> => {
        const currentUser = userRef.current;
        const firstName = currentUser?.name
            ? currentUser.name.trim().split(/[\s-]/)[0]
            : undefined;

        const timeOfDay = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });

        try {
            // Race the Gemini API call against a fallback timeout.
            // The RTK mutation itself has no built-in timeout, so we race with
            // a local Promise that resolves to the fallback after 5 seconds.
            const fallbackTimer = new Promise<string>((resolve) =>
                setTimeout(() => resolve(pickFallbackMessage(workMinutes)), 5_000)
            );

            const apiCall = getHydrationMessage({
                userName: firstName,
                workMinutes,
                timeOfDay,
            }).unwrap().then((res) => res.data.message);

            return await Promise.race([apiCall, fallbackTimer]);
        } catch {
            return pickFallbackMessage(workMinutes);
        }
    }, [getHydrationMessage]);

    // ── Trigger hydration event ───────────────────────────────────────────────
    // Called when continuous work first crosses the 90-minute threshold.
    // Generates message (async), fires OS notification, transitions to REMINDER_90.
    const triggerHydrationEvent = useCallback(async (workMinutes: number) => {
        // Mark notification as pending immediately to prevent duplicate calls
        setState(prev => ({ ...prev, notificationFired: true }));

        // Generate message without blocking the UI
        const message = await fetchMessage(workMinutes);

        // Fire OS notification (if permitted) — uses tag to prevent duplicates
        fireOsNotification(message);

        setState(prev => ({
            ...prev,
            stage: 'REMINDER_90',
            message,
            isSnoozed: false,
            remindLaterAt: null,
        }));
    }, [fetchMessage]);

    // ── Reset hydration cycle ─────────────────────────────────────────────────
    const resetCycle = useCallback((keepTimerRunning: boolean) => {
        setState({
            stage: 'NORMAL',
            message: null,
            cycleStartedAt: keepTimerRunning ? Date.now() : null,
            remindLaterAt: null,
            notificationFired: false,
            isSnoozed: false,
        });
    }, []);

    // ── Public actions ────────────────────────────────────────────────────────

    /** User confirmed they drank water — fully reset the hydration cycle. */
    const acknowledgeWater = useCallback(() => {
        // Start a new cycle only if timer is still running
        const isRunning = timerRef.current?.status === 'running';
        resetCycle(isRunning);
    }, [resetCycle]);

    /** User wants 15 more minutes — hide overlay, don't reset cycle. */
    const remindLater = useCallback(() => {
        setState(prev => ({
            ...prev,
            isSnoozed: true,
            remindLaterAt: Date.now() + REMIND_LATER_DURATION_MS,
        }));
    }, []);

    /** Request browser notification permission from a user gesture. */
    const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'denied';
        if (Notification.permission !== 'default') return Notification.permission;
        return await Notification.requestPermission();
    }, []);

    // ── Main observation loop ─────────────────────────────────────────────────
    useEffect(() => {
        const tick = () => {
            const currentTimer = timerRef.current;
            const currentState = stateRef.current;
            const now = Date.now();

            // ── Timer status transition detection ─────────────────────────────

            const currentTimerStatus = currentTimer
                ? currentTimer.status
                : null;

            prevTimerStatusRef.current = currentTimerStatus;

            // Timer stopped or paused → reset hydration cycle immediately
            if (currentTimerStatus !== 'running') {
                // If the state is not already NORMAL, reset it.
                // This correctly dismisses the overlay and resets the cycle if 
                // the user pauses their timer, or if the page is reloaded and the timer is paused.
                if (currentState.stage !== 'NORMAL' || currentState.cycleStartedAt !== null) {
                    setState({
                        stage: 'NORMAL',
                        message: null,
                        cycleStartedAt: null,
                        remindLaterAt: null,
                        notificationFired: false,
                        isSnoozed: false,
                    });
                }
                return;
            }

            // ── Timer is running ──────────────────────────────────────────────

            // If cycle hasn't started yet (fresh start or post-resume), set the anchor
            if (currentState.cycleStartedAt === null) {
                setState(prev => ({ ...prev, cycleStartedAt: now }));
                return;
            }

            // Calculate continuous work seconds since cycle began
            const continuousSeconds = Math.floor((now - currentState.cycleStartedAt) / 1000);

            // ── Snooze expiry check ───────────────────────────────────────────
            if (currentState.isSnoozed && currentState.remindLaterAt !== null) {
                if (now >= currentState.remindLaterAt) {
                    // Snooze expired — return to BLOCKED_180 (full-screen)
                    setState(prev => ({
                        ...prev,
                        isSnoozed: false,
                        stage: 'BLOCKED_180',
                    }));
                }
                return; // Don't advance stage while snoozed
            }

            // ── Stage progression ─────────────────────────────────────────────
            const { stage } = currentState;

            if (stage === 'NORMAL' && continuousSeconds >= HYDRATION_THRESHOLD_90) {
                // First 90-minute threshold: trigger the full hydration event
                // (async: generates message, fires OS notification, transitions state)
                const workMinutes = Math.floor(continuousSeconds / 60);
                triggerHydrationEvent(workMinutes);
                return;
            }

            if (stage === 'REMINDER_90' && continuousSeconds >= HYDRATION_THRESHOLD_120) {
                setState(prev => ({ ...prev, stage: 'REMINDER_120' }));
                return;
            }

            if (stage === 'REMINDER_120' && continuousSeconds >= HYDRATION_THRESHOLD_150) {
                setState(prev => ({ ...prev, stage: 'REMINDER_150' }));
                return;
            }

            if (stage === 'REMINDER_150' && continuousSeconds >= HYDRATION_THRESHOLD_180) {
                setState(prev => ({ ...prev, stage: 'BLOCKED_180' }));
                return;
            }

            // ── Request notification permission at 90-min trigger ─────────────
            // Only attempt once per cycle, if permission is still undecided.
            // This is contextual — user has just reached the 90-min threshold.
            if (
                stage === 'REMINDER_90' &&
                typeof Notification !== 'undefined' &&
                Notification.permission === 'default'
            ) {
                // Request permission in background — don't await (don't block tick)
                Notification.requestPermission().catch(() => {/* ignore */ });
            }
        };

        const intervalId = window.setInterval(tick, 1_000);
        tick(); // Run immediately on mount

        return () => clearInterval(intervalId);
    }, [triggerHydrationEvent]); // stable deps only

    return {
        state,
        acknowledgeWater,
        remindLater,
        requestNotificationPermission,
    };
}

// Derive a human-readable work duration label from continuous seconds
export function formatContinuousDuration(cycleStartedAt: number | null): string {
    if (cycleStartedAt === null) return '90 minutes';
    const seconds = Math.floor((Date.now() - cycleStartedAt) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} minutes`;
}

// Derive current stage as a HydrationStage for external consumers
export type { HydrationStage };
