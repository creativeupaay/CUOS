/**
 * Interval utility — reusable pure functions for time-interval union calculations.
 *
 * KEY RULE: when calculating daily worked time, overlapping intervals from any
 * source (tasks, meetings, multiple devices, manual entries) must be merged so
 * that a single minute of real time is never counted more than once.
 */

export interface Interval {
    start: Date;
    end: Date;
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
 * Split an interval at UTC midnight boundaries.
 * Used when a meeting/task spans two calendar days.
 *
 * Example:
 *   23:30 – 00:30 UTC  →  [23:30–00:00, 00:00–00:30]
 */
export function splitAtMidnight(interval: Interval): Interval[] {
    const result: Interval[] = [];
    let current = new Date(interval.start);
    const end = new Date(interval.end);

    while (current < end) {
        // Find end of current UTC day
        const dayEnd = new Date(
            Date.UTC(
                current.getUTCFullYear(),
                current.getUTCMonth(),
                current.getUTCDate() + 1,
                0, 0, 0, 0
            )
        );

        const segmentEnd = dayEnd < end ? dayEnd : end;

        if (current < segmentEnd) {
            result.push({ start: new Date(current), end: segmentEnd });
        }

        current = segmentEnd;
    }

    return result;
}

/**
 * Filter a set of merged intervals to only those that fall within a given UTC day (YYYY-MM-DD).
 * Intervals that cross midnight are clipped to the day boundary.
 *
 * @param mergedIntervals - already-merged intervals (output of mergeIntervals)
 * @param dateStr - UTC date string in YYYY-MM-DD format
 */
export function filterIntervalsForDay(mergedIntervals: Interval[], dateStr: string): Interval[] {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const dayEnd   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

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
 * Given raw (possibly overlapping, possibly multi-day) intervals and a target date,
 * return the unique minutes worked on that specific day.
 *
 * This is the primary function used by calculateDailyWorkSummary.
 *
 * @param intervals - raw intervals from all sources
 * @param dateStr - UTC date string in YYYY-MM-DD format
 */
export function calculateDayUniqueMinutes(
    intervals: Interval[],
    dateStr: string
): number {
    // 1. Expand multi-day intervals into per-day segments
    const expanded: Interval[] = [];
    for (const iv of removeInvalidIntervals(intervals)) {
        const split = splitAtMidnight(iv);
        expanded.push(...split);
    }

    // 2. Merge within the full expanded set
    const merged = mergeIntervals(expanded);

    // 3. Filter to the requested day
    const dayIntervals = filterIntervalsForDay(merged, dateStr);

    // 4. Calculate total
    return Math.round(sumIntervalMinutes(dayIntervals));
}
