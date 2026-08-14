// ─── Hydration Stage State Machine ───────────────────────────────────────────
//
// NORMAL ──(90 min)──► REMINDER_90 ──(120 min)──► REMINDER_120
//                                                        │
//                                            (150 min)──►│
//                                                   REMINDER_150
//                                                        │
//                                            (180 min)──►│
//                                                  BLOCKED_180
//                                                  │         │
//                                         "I've had water"  "Remind later"
//                                                  │         │
//                                               NORMAL    (snooze, returns at BLOCKED_180)
//
// Pause work timer at ANY stage → reset to NORMAL

export type HydrationStage =
    | 'NORMAL'
    | 'REMINDER_90'
    | 'REMINDER_120'
    | 'REMINDER_150'
    | 'BLOCKED_180';

export interface HydrationState {
    /** Current stage of the hydration state machine */
    stage: HydrationStage;
    /** The generated (Gemini or fallback) reminder message for the current cycle */
    message: string | null;
    /**
     * Epoch ms when the current hydration cycle began (i.e. when timer last
     * transitioned from paused/null to running after the last reset/ack).
     * null when stage is NORMAL and timer is not running.
     */
    cycleStartedAt: number | null;
    /**
     * Epoch ms at which the "Remind me later" snooze expires.
     * null if no snooze is active.
     */
    remindLaterAt: number | null;
    /** True once OS notification has been dispatched for the current cycle. */
    notificationFired: boolean;
    /** True while the overlay is hidden due to an active snooze. */
    isSnoozed: boolean;
}

export interface HydrationContextValue {
    state: HydrationState;
    /** User confirmed they drank water — fully resets the hydration cycle */
    acknowledgeWater: () => void;
    /** User wants 15 more minutes — hides overlay temporarily, does NOT reset cycle */
    remindLater: () => void;
    /** Request browser Notification permission. Call from a user interaction. */
    requestNotificationPermission: () => Promise<NotificationPermission>;
}
