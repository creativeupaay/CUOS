/**
 * Interval utility — reusable pure functions for time-interval union calculations.
 *
 * KEY RULE: when calculating daily worked time, overlapping intervals from any
 * source (tasks, meetings, multiple devices, manual entries) must be merged so
 * that a single minute of real time is never counted more than once.
 *
 * WORK DAY DEFINITION:
 * A work day runs from 6:00 AM IST to 6:00 AM IST the next day.
 * In UTC terms: 00:30 UTC (day N) to 00:30 UTC (day N+1).
 * This allows remote/WFH employees to work late into the night and have
 * it counted on the correct calendar day.
 */

export interface Interval {
    start: Date;
    end: Date;
}

// ─── Work Day Boundary (6am IST = 00:30 UTC) ─────────────────────────────────

/** Work day start offset from midnight UTC: 30 minutes (= 00:30 UTC = 6:00 AM IST) */
export const WORK_DAY_START_UTC_MS = 30 * 60_000; // 30 minutes in ms

/**
 * Given a work day label (YYYY-MM-DD), returns the UTC start and end Date
 * for that 6am-IST-to-6am-IST window.
 *
 * Example: '2026-08-19'
 *   → dayStart = 2026-08-19T00:30:00Z  (= 6:00 AM IST Aug 19)
 *   → dayEnd   = 2026-08-20T00:29:59Z  (= 5:59 AM IST Aug 20)
 */
export function getWorkDayBounds(dateStr: string): { dayStart: Date; dayEnd: Date } {
    const [y, m, d] = dateStr.split('-').map(Number);
    // 6am IST = UTC midnight + 30 minutes
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 30, 0, 0));
    // End is 00:30 UTC next calendar day - 1ms
    const dayEnd   = new Date(Date.UTC(y, m - 1, d + 1, 0, 29, 59, 999));
    return { dayStart, dayEnd };
}

/**
 * Given any UTC Date, return the work-day label (YYYY-MM-DD) it belongs to.
 * Work days start at 00:30 UTC (6am IST). So:
 *   - 2026-08-19T00:15:00Z (5:45am IST) → belongs to work day '2026-08-18'
 *   - 2026-08-19T00:30:00Z (6:00am IST) → belongs to work day '2026-08-19'
 */
export function getWorkDayLabel(date: Date): string {
    // Shift back by 30 minutes so that 00:30 UTC becomes 00:00 UTC for labelling
    const shifted = new Date(date.getTime() - WORK_DAY_START_UTC_MS);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Get the work day bounds for a Date object (not a date string).
 * Returns the 6am-IST bounds that contain the given timestamp.
 */
export function getWorkDayBoundsFromDate(date: Date): { dayStart: Date; dayEnd: Date; dateStr: string } {
    const dateStr = getWorkDayLabel(date);
    const bounds = getWorkDayBounds(dateStr);
    return { ...bounds, dateStr };
}


/**
 * Remove intervals where start >= end, or either boundary is not a valid Date.
 */
export function removeInvalidIntervals(intervals: Interval[]): Interval[] {
    return intervals.filter((iv) => {
        if (!(iv.start instanceof Date) || isNaN(iv.start.getTime())) return false;
        if (!(iv.end instanceof Date) || isNaN(iv.end.getTime())) return false;
        return iv.start.getTime() < iv.end.getTime();
    });
}

/**
 * Sort intervals by start time ascending.
 */
export function sortIntervals(intervals: Interval[]): Interval[] {
    return [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Merge overlapping and adjacent intervals.
 * Input does NOT need to be pre-sorted — this function sorts internally.
 *
 * Example:
 *   [09:00–11:00, 10:00–12:00]  →  [09:00–12:00]
 *   [09:00–10:00, 10:00–11:00]  →  [09:00–11:00]  (adjacent merged)
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
    const valid = removeInvalidIntervals(intervals);
    if (valid.length === 0) return [];

    const sorted = sortIntervals(valid);
    const merged: Interval[] = [{ start: sorted[0].start, end: sorted[0].end }];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        if (current.start.getTime() <= last.end.getTime()) {
            // Overlapping or adjacent — extend the last interval if needed
            if (current.end.getTime() > last.end.getTime()) {
                last.end = current.end;
            }
        } else {
            // Gap — push a new interval
            merged.push({ start: current.start, end: current.end });
        }
    }

    return merged;
}

/**
 * Calculate total minutes from a list of non-overlapping intervals.
 * Each interval's duration is (end - start) in milliseconds → converted to minutes.
 */
export function sumIntervalMinutes(intervals: Interval[]): number {
    return intervals.reduce((total, iv) => {
        const ms = iv.end.getTime() - iv.start.getTime();
        return total + ms / 60_000;
    }, 0);
}

/**
 * Main export: given a list of raw (potentially overlapping) intervals,
 * return the total unique minutes covered.
 *
 * Example (Test 3 from spec):
 *   Task  09:00–15:00
 *   Meet  13:00–15:00
 *   → unique = 360 minutes (6h), NOT 360+120=480
 */
export function calculateUniqueMinutes(intervals: Interval[]): number {
    const merged = mergeIntervals(intervals);
    return Math.round(sumIntervalMinutes(merged));
}

/**
 * Split an interval at work-day boundaries (6am IST = 00:30 UTC).
 * Used when a meeting/task spans two work days.
 *
 * Example (work day starts at 00:30 UTC):
 *   00:00 UTC – 01:00 UTC  →  split at 00:30 UTC:
 *     [00:00–00:30] belongs to previous work day
 *     [00:30–01:00] belongs to current work day
 */
export function splitAtWorkDayBoundary(interval: Interval): Interval[] {
    const result: Interval[] = [];
    let current = new Date(interval.start);
    const end = new Date(interval.end);

    while (current < end) {
        // Find the next work-day boundary after `current`
        // Work day boundary is 00:30 UTC each day
        const shifted = new Date(current.getTime() - WORK_DAY_START_UTC_MS);
        const nextBoundary = new Date(
            Date.UTC(
                shifted.getUTCFullYear(),
                shifted.getUTCMonth(),
                shifted.getUTCDate() + 1,
                0, 0, 0, 0
            ) + WORK_DAY_START_UTC_MS
        );

        const segmentEnd = nextBoundary < end ? nextBoundary : end;

        if (current < segmentEnd) {
            result.push({ start: new Date(current), end: segmentEnd });
        }

        current = segmentEnd;
    }

    return result;
}

/**
 * @deprecated Use splitAtWorkDayBoundary instead.
 * Kept for backward compatibility — splits at UTC midnight, not at 6am IST.
 */
export function splitAtMidnight(interval: Interval): Interval[] {
    return splitAtWorkDayBoundary(interval);
}

/**
 * Filter a set of merged intervals to only those that fall within a given work day.
 * A work day runs from 00:30 UTC (6am IST) to 00:30 UTC the next calendar day.
 * Intervals that cross the boundary are clipped.
 *
 * @param mergedIntervals - already-merged intervals (output of mergeIntervals)
 * @param dateStr - work-day date string in YYYY-MM-DD format
 */
export function filterIntervalsForDay(mergedIntervals: Interval[], dateStr: string): Interval[] {
    const { dayStart, dayEnd } = getWorkDayBounds(dateStr);

    const result: Interval[] = [];

    for (const iv of mergedIntervals) {
        const overlapStart = new Date(Math.max(iv.start.getTime(), dayStart.getTime()));
        const overlapEnd   = new Date(Math.min(iv.end.getTime(), dayEnd.getTime()));
        if (overlapStart < overlapEnd) {
            result.push({ start: overlapStart, end: overlapEnd });
        }
    }

    return result;
}

/**
 * Given raw (possibly overlapping, possibly multi-work-day) intervals and a target work day date,
 * return the unique minutes worked on that specific work day (6am IST – 6am IST).
 *
 * @param intervals - raw intervals from all sources
 * @param dateStr - work-day date label in YYYY-MM-DD format
 */
export function calculateDayUniqueMinutes(
    intervals: Interval[],
    dateStr: string
): number {
    // 1. Expand multi-work-day intervals into per-work-day segments
    const expanded: Interval[] = [];
    for (const iv of removeInvalidIntervals(intervals)) {
        const split = splitAtWorkDayBoundary(iv);
        expanded.push(...split);
    }

    // 2. Merge within the full expanded set
    const merged = mergeIntervals(expanded);

    // 3. Filter to the requested work day (6am IST boundary)
    const dayIntervals = filterIntervalsForDay(merged, dateStr);

    // 4. Calculate total
    return Math.round(sumIntervalMinutes(dayIntervals));
}
