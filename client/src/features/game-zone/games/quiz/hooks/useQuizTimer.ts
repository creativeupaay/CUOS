import { useState, useEffect, useRef } from 'react';

/**
 * useQuizTimer — visual countdown timer for quiz questions.
 *
 * Server is the sole authority on timing — this is purely for display.
 * The question ends when the server says so (via quiz:question_ended event),
 * not when this timer hits 0.
 *
 * Returns:
 * - secondsRemaining: current countdown value (0+)
 * - progress: 0.0 (full time) → 1.0 (time expired) — for progress bars
 * - isUrgent: true when < 5 seconds remaining
 */
export function useQuizTimer(endsAt: string | null, timePerQuestion: number) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!endsAt) {
      setSecondsRemaining(0);
      return;
    }

    const endsAtMs = new Date(endsAt).getTime();

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endsAtMs - now) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    tick(); // immediate first tick
    intervalRef.current = setInterval(tick, 200); // 5 updates/sec for smooth display

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [endsAt]);

  const totalSec = timePerQuestion > 0 ? timePerQuestion : 1;
  const progress = 1 - Math.min(1, secondsRemaining / totalSec); // 0=start → 1=done
  const isUrgent = secondsRemaining <= 5 && secondsRemaining > 0;

  return { secondsRemaining, progress, isUrgent };
}
