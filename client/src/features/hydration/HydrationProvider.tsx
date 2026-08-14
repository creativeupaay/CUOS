import { createContext, useContext, type ReactNode } from 'react';
import { useHydrationReminder } from './useHydrationReminder';
import type { HydrationContextValue } from './hydrationTypes';

// ─── Context ──────────────────────────────────────────────────────────────────

const HydrationContext = createContext<HydrationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * HydrationProvider
 *
 * Must be placed INSIDE TimerProvider (so useTimer() is available).
 * Mounts the hydration observation logic once at the app root.
 * Exposes hydration state and actions to all descendants via HydrationContext.
 */
export function HydrationProvider({ children }: { children: ReactNode }) {
    const { state, acknowledgeWater, remindLater, requestNotificationPermission } =
        useHydrationReminder();

    return (
        <HydrationContext.Provider
            value={{ state, acknowledgeWater, remindLater, requestNotificationPermission }}
        >
            {children}
        </HydrationContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useHydrationContext
 * Access hydration state and actions from any descendant of HydrationProvider.
 */
export function useHydrationContext(): HydrationContextValue {
    const ctx = useContext(HydrationContext);
    if (!ctx) throw new Error('useHydrationContext must be used within HydrationProvider');
    return ctx;
}
